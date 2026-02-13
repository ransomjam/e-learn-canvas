const { asyncHandler, ApiError } = require('../middleware/error.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file upload
const storage = multer.diskStorage({
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

const upload = multer({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB for large presentations/videos
    fileFilter: (req, file, cb) => {
        const imageTypes = /jpeg|jpg|png|gif|webp/;
        const videoTypes = /mp4|webm|ogg|mov|avi/;
        const documentTypes = /pdf|ppt|pptx|doc|docx/;
        const documentMimeTypes = [
            'application/pdf',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        const ext = path.extname(file.originalname).toLowerCase().slice(1);
        const isImage = imageTypes.test(ext) && imageTypes.test(file.mimetype);
        const isVideo = videoTypes.test(ext) || file.mimetype.startsWith('video/');
        const isDocument = documentTypes.test(ext) || documentMimeTypes.includes(file.mimetype);

        if (isImage || isVideo || isDocument) {
            return cb(null, true);
        }
        cb(new Error('Only image, video, and document files (PDF, PPT, PPTX, DOC, DOCX) are allowed'));
    }
});

const uploadFile = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new ApiError(400, 'No file uploaded');
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const ext = path.extname(req.file.originalname).toLowerCase().slice(1);

    // Detect file type category
    let fileType = 'file';
    if (/jpeg|jpg|png|gif|webp/.test(ext)) fileType = 'image';
    else if (/mp4|webm|ogg|mov|avi/.test(ext)) fileType = 'video';
    else if (ext === 'pdf') fileType = 'pdf';
    else if (/pptx?/.test(ext)) fileType = 'ppt';
    else if (/docx?/.test(ext)) fileType = 'doc';

    res.json({
        success: true,
        data: {
            url: fileUrl,
            filename: req.file.filename,
            originalName: req.file.originalname,
            fileType
        }
    });
});

module.exports = { upload, uploadFile };
