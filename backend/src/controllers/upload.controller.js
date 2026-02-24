const { asyncHandler, ApiError } = require('../middleware/error.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { cloudinary, isConfigured: cloudinaryEnabled } = require('../config/cloudinary');

// In production, Cloudinary MUST be configured. Render's filesystem is ephemeral —
// files saved to local disk are lost on every redeploy/restart.
if (process.env.NODE_ENV === 'production' && !cloudinaryEnabled) {
    console.error('\n🚨 CRITICAL: Cloudinary is NOT configured but NODE_ENV=production!');
    console.error('   Uploads will fail because Render uses an ephemeral filesystem.');
    console.error('   Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET');
    console.error('   in your Render dashboard environment variables.\n');
}

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
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
    fileFilter: (req, file, cb) => cb(null, true),
});

// Re-export a second multer instance for project uploads (same config)
const projectUpload = multer({
    storage: cloudinaryEnabled ? memoryStorage : localStorage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
    fileFilter: (req, file, cb) => cb(null, true),
});

// ── Multer error handler wrapper ─────────────────────────────────────────────
// Turns multer-level errors (e.g. file too large) into clean JSON 400 responses
// instead of letting them propagate as unhandled 500s.
const handleMulterError = (multerMiddleware) => (req, res, next) => {
    multerMiddleware(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'File too large. Maximum allowed size is 500 MB.' });
        }
        return res.status(400).json({ success: false, message: err.message || 'File upload error' });
    });
};

// ── Upload a file to Cloudinary (returns { url, publicId }) ──────────────────
const uploadToCloudinary = (fileBuffer, originalname) => {
    const fileType = detectFileType(originalname);
    const resourceType = getCloudinaryResourceType(fileType);
    const folder = `cradema/${fileType === 'image' ? 'images' : fileType === 'video' ? 'videos' : 'files'}`;

    console.log(`☁️  Uploading to Cloudinary: ${originalname} (${resourceType}, ${(fileBuffer.length / 1024).toFixed(1)} KB)`);

    return new Promise((resolve, reject) => {
        const uploadOptions = {
            resource_type: resourceType,
            folder,
            // Keep original extension for raw files so download links work
            ...(resourceType === 'raw' ? { use_filename: true, unique_filename: true } : {}),
        };

        // For videos, force transcoding to H.264/MP4 for universal mobile compatibility.
        // Many mobile browsers cannot play AVI, MOV, MKV, or HEVC-encoded files.
        // Note: streaming_profile (adaptive bitrate) is a paid Cloudinary feature — do NOT use it here.
        if (resourceType === 'video') {
            uploadOptions.format = 'mp4';
            // No eager transforms needed — Cloudinary converts on-the-fly via the format option above.
        }

        const stream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
                if (error) {
                    console.error('❌ Cloudinary upload failed:', error.message || error);
                    return reject(new Error(`Cloudinary upload failed: ${error.message || 'Unknown error'}`));
                }
                let deliveryUrl = result.secure_url;
                // Ensure the video URL ends with .mp4 for mobile compatibility
                if (resourceType === 'video' && !deliveryUrl.endsWith('.mp4')) {
                    deliveryUrl = deliveryUrl.replace(/\.[^/.]+$/, '.mp4');
                }
                console.log(`✅ Cloudinary upload success: ${deliveryUrl}`);
                resolve({ url: deliveryUrl, publicId: result.public_id });
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
        try {
            const result = await uploadToCloudinary(req.file.buffer, req.file.originalname);
            fileUrl = result.url; // full https://res.cloudinary.com/... URL
        } catch (err) {
            console.error('❌ Cloudinary upload failed for', req.file.originalname, err.message);
            throw new ApiError(500, 'File upload failed. Please try again later.');
        }
    } else if (process.env.NODE_ENV === 'production') {
        // In production without Cloudinary, reject the upload immediately.
        // Render's ephemeral filesystem means local files will be lost on redeploy.
        console.error('❌ Upload rejected: Cloudinary not configured in production');
        throw new ApiError(503, 'File uploads are temporarily unavailable. Cloud storage is not configured.');
    } else {
        // Local disk — file already saved by multer diskStorage (dev only)
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

// ── Proxy download: stream a remote file to the client with correct filename ─
const downloadFile = asyncHandler(async (req, res) => {
    const { url, filename } = req.query;

    if (!url) {
        throw new ApiError(400, 'Missing "url" query parameter');
    }

    const downloadName = filename || 'download';

    // --- Local uploads (served from /uploads/) ---
    if (url.startsWith('/uploads/') || url.startsWith('uploads/')) {
        const safePath = path.normalize(url.replace(/^\//, ''));
        const filePath = path.join(__dirname, '../../', safePath);

        // Prevent directory traversal
        const uploadsDir = path.resolve(__dirname, '../../uploads');
        const resolved = path.resolve(filePath);
        if (!resolved.startsWith(uploadsDir)) {
            throw new ApiError(403, 'Access denied');
        }

        if (!fs.existsSync(resolved)) {
            throw new ApiError(404, 'File not found');
        }

        // Set headers for download
        const ext = path.extname(downloadName) || path.extname(resolved);
        const finalName = downloadName.endsWith(ext) ? downloadName : downloadName + ext;
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(finalName)}"`);
        return fs.createReadStream(resolved).pipe(res);
    }

    // --- Remote URL (Cloudinary, etc.) ---
    // Use dynamic import for node-fetch or native https
    const https = require('https');
    const http = require('http');
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (proxyRes) => {
        if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
            // Follow redirect once
            const redirectProtocol = proxyRes.headers.location.startsWith('https') ? https : http;
            redirectProtocol.get(proxyRes.headers.location, (redirectRes) => {
                streamResponse(redirectRes, res, downloadName, url);
            }).on('error', (err) => {
                console.error('Download redirect error:', err.message);
                res.status(502).json({ success: false, message: 'Failed to download file' });
            });
            return;
        }
        streamResponse(proxyRes, res, downloadName, url);
    }).on('error', (err) => {
        console.error('Download proxy error:', err.message);
        res.status(502).json({ success: false, message: 'Failed to download file' });
    });
});

function streamResponse(proxyRes, res, downloadName, originalUrl) {
    if (proxyRes.statusCode !== 200) {
        res.status(proxyRes.statusCode || 502).json({ success: false, message: 'File not available' });
        return;
    }

    // Determine extension from the original URL if the download name doesn't have one
    let ext = path.extname(downloadName);
    if (!ext) {
        try {
            const urlPath = new URL(originalUrl).pathname;
            ext = path.extname(urlPath) || '';
        } catch { /* ignore */ }
    }
    const finalName = ext && !downloadName.endsWith(ext) ? downloadName + ext : downloadName;

    // Forward content headers
    if (proxyRes.headers['content-type']) {
        res.setHeader('Content-Type', proxyRes.headers['content-type']);
    }
    if (proxyRes.headers['content-length']) {
        res.setHeader('Content-Length', proxyRes.headers['content-length']);
    }
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(finalName)}"`);

    proxyRes.pipe(res);
}

// ── Signed upload params for direct frontend-to-Cloudinary uploads ───────────
const getUploadSignature = asyncHandler(async (req, res) => {
    if (!cloudinaryEnabled) {
        throw new ApiError(503, 'Cloud storage is not configured');
    }

    const { fileType } = req.query; // 'image', 'video', 'pdf', etc.
    const detectedType = fileType || 'file';
    const resourceType = getCloudinaryResourceType(detectedType);
    const folder = `cradema/${detectedType === 'image' ? 'images' : detectedType === 'video' ? 'videos' : 'files'}`;

    const timestamp = Math.round(Date.now() / 1000);
    const params = {
        timestamp,
        folder,
        resource_type: resourceType,
        ...(resourceType === 'video' ? { format: 'mp4' } : {}),
        ...(resourceType === 'raw' ? { use_filename: true, unique_filename: true } : {}),
    };

    // Generate the signature
    const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);

    res.json({
        success: true,
        data: {
            signature,
            timestamp,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
            apiKey: process.env.CLOUDINARY_API_KEY,
            folder,
            resourceType,
            ...(resourceType === 'video' ? { format: 'mp4' } : {}),
            ...(resourceType === 'raw' ? { use_filename: 'true', unique_filename: 'true' } : {}),
        }
    });
});

module.exports = { upload, projectUpload, uploadFile, downloadFile, uploadToCloudinary, detectFileType, cloudinaryEnabled, handleMulterError, getUploadSignature };
