const express = require('express');
const router = express.Router();
const { upload, uploadFile } = require('../controllers/upload.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.post('/', authenticate, upload.single('file'), uploadFile);

module.exports = router;
