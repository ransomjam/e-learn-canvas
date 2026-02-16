const { asyncHandler, ApiError } = require('../middleware/error.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { cloudinary, isConfigured: cloudinaryEnabled } = require('../config/cloudinary');

// ── Helper: detect file type from extension ──────────────────────────────────
const detectFileType = (originalname) => {
    const ext = path.extname(originalname).toLowerCase().slice(1);
    if (/jpeg|jpg|png|gif|webp/.test(ext)) return 'image';
    if (/mp4|webm|ogg|mov|avi/.test(ext)) return 'video';
    if (ext === 'pdf') return 'pdf';
    if (/pptx?/.test(ext)) return 'ppt';
    if (/docx?/.test(ext)) return 'doc';
    return 'file';
};

// ── Helper: Cloudinary resource_type from file type ──────────────────────────
const getCloudinaryResourceType = (fileType) => {
    if (fileType === 'image') return 'image';
    if (fileType === 'video') return 'video';
    return 'raw'; // PDFs, docs, etc.
};

// ── Storage: local disk (fallback / dev) ─────────────────────────────────────
const localStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// ── Storage: memory buffer (used when uploading to Cloudinary) ───────────────
const memoryStorage = multer.memoryStorage();

// Pick storage engine based on whether Cloudinary is configured
const upload = multer({
    storage: cloudinaryEnabled ? memoryStorage : localStorage,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
    fileFilter: (req, file, cb) => cb(null, true),
});

// Re-export a second multer instance for project uploads (same config)
const projectUpload = multer({
    storage: cloudinaryEnabled ? memoryStorage : localStorage,
    limits: { fileSize: 200 * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(null, true),
});

// ── Upload a file to Cloudinary (returns { url, publicId }) ──────────────────
const uploadToCloudinary = (fileBuffer, originalname) => {
    const fileType = detectFileType(originalname);
    const resourceType = getCloudinaryResourceType(fileType);
    const folder = `cradema/${fileType === 'image' ? 'images' : fileType === 'video' ? 'videos' : 'files'}`;

    console.log(`☁️  Uploading to Cloudinary: ${originalname} (${resourceType}, ${(fileBuffer.length / 1024).toFixed(1)} KB)`);

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                resource_type: resourceType,
                folder,
                // Keep original extension for raw files so download links work
                ...(resourceType === 'raw' ? { use_filename: true, unique_filename: true } : {}),
            },
            (error, result) => {
                if (error) {
                    console.error('❌ Cloudinary upload failed:', error.message || error);
                    return reject(new Error(`Cloudinary upload failed: ${error.message || 'Unknown error'}`));
                }
                console.log(`✅ Cloudinary upload success: ${result.secure_url}`);
                resolve({ url: result.secure_url, publicId: result.public_id });
            }
        );
        stream.end(fileBuffer);
    });
};

// ── Route handler: POST /api/v1/upload ───────────────────────────────────────
const uploadFile = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new ApiError(400, 'No file uploaded');
    }

    const fileType = detectFileType(req.file.originalname);
    let fileUrl;

    if (cloudinaryEnabled) {
        // Upload buffer to Cloudinary
        const result = await uploadToCloudinary(req.file.buffer, req.file.originalname);
        fileUrl = result.url; // full https://res.cloudinary.com/... URL
    } else {
        // Local disk — file already saved by multer diskStorage
        fileUrl = `/uploads/${req.file.filename}`;
    }

    res.json({
        success: true,
        data: {
            url: fileUrl,
            filename: req.file.filename || path.basename(fileUrl),
            originalName: req.file.originalname,
            fileType
        }
    });
});

module.exports = { upload, projectUpload, uploadFile, uploadToCloudinary, detectFileType, cloudinaryEnabled };
