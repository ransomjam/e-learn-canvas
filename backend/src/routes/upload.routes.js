const express = require('express');
const router = express.Router();
const { upload, uploadFile, downloadFile, handleMulterError, getUploadSignature, getVideoEncodingStatus } = require('../controllers/upload.controller');
const { authenticate, optionalAuth } = require('../middleware/auth.middleware');

/**
 * @route   GET /api/v1/upload/sign
 * @desc    Return a Cloudinary signed upload params so the frontend can
 *          upload directly to Cloudinary (bypasses Render's 30 s timeout
 *          and avoids buffering large files in server memory).
 * @access  Private
 */
router.get('/sign', authenticate, getUploadSignature);

/**
 * @route   GET /api/v1/upload/video-status
 * @desc    Report a Bunny video's encoding status so the player can show a
 *          "still processing" state (with progress) and auto-retry, instead of
 *          failing with a misleading "hosted externally" error.
 * @query   url      — the stored playback URL (Bunny .m3u8)
 * @query   videoId  — alternatively, the Bunny video guid
 * @access  Public (optionalAuth — only exposes encoding progress)
 */
router.get('/video-status', optionalAuth, getVideoEncodingStatus);

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
