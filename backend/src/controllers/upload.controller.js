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
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB for video support
    fileFilter: (req, file, cb) => {
        const imageTypes = /jpeg|jpg|png|gif|webp/;
        const videoTypes = /mp4|webm|ogg|mov|avi/;
        const ext = path.extname(file.originalname).toLowerCase().slice(1);
        const isImage = imageTypes.test(ext) && imageTypes.test(file.mimetype);
        const isVideo = videoTypes.test(ext) || file.mimetype.startsWith('video/');

        if (isImage || isVideo) {
            return cb(null, true);
        }
        cb(new Error('Only image and video files are allowed'));
    }
});

const uploadFile = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new ApiError(400, 'No file uploaded');
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    res.json({
        success: true,
        data: {
            url: fileUrl,
            filename: req.file.filename
        }
    });
});

module.exports = { upload, uploadFile };
