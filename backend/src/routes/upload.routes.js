const express = require('express');
const router = express.Router();
const { upload, uploadFile, downloadFile, handleMulterError, getUploadSignature } = require('../controllers/upload.controller');
const { authenticate, optionalAuth } = require('../middleware/auth.middleware');

/**
 * @route   GET /api/v1/upload/sign
 * @desc    Return a Cloudinary signed upload params so the frontend can
 *          upload directly to Cloudinary (bypasses Render's 30 s timeout
 *          and avoids buffering large files in server memory).
 * @access  Private
 */
router.get('/sign', authenticate, getUploadSignature);

router.post('/', authenticate, handleMulterError(upload.single('file')), uploadFile);

/**
 * @route   GET /api/v1/upload/download
 * @desc    Proxy download — fetches a file from Cloudinary / local and
 *          streams it to the client with the correct Content-Disposition header.
 * @query   url      — the absolute file URL
 * @query   filename — the desired download filename (optional)
 * @access  Public (optionalAuth — no sensitive data, just proxies public URLs)
 */
router.get('/download', optionalAuth, downloadFile);

module.exports = router;
