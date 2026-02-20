const express = require('express');
const router = express.Router();
const { upload, uploadFile, downloadFile } = require('../controllers/upload.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.post('/', authenticate, upload.single('file'), uploadFile);

/**
 * @route   GET /api/v1/upload/download
 * @desc    Proxy download — fetches a file from Cloudinary / local and
 *          streams it to the client with the correct Content-Disposition header.
 * @query   url      — the absolute file URL
 * @query   filename — the desired download filename (optional)
 * @access  Private
 */
router.get('/download', authenticate, downloadFile);

module.exports = router;
