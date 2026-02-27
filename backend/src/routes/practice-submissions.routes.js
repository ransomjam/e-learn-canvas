const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
    projectUpload,
    submitPracticeFile,
    getMyPracticeSubmissions,
    getInstructorPracticeSubmissions,
    deletePracticeSubmission
} = require('../controllers/practice-submissions.controller');

// Student routes
router.post('/', authenticate, projectUpload.single('file'), submitPracticeFile);
router.get('/my', authenticate, getMyPracticeSubmissions);

// Instructor route
router.get('/instructor', authenticate, getInstructorPracticeSubmissions);

// Delete (owner or instructor)
router.delete('/:id', authenticate, deletePracticeSubmission);

module.exports = router;
