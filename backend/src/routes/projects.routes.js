const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticate } = require('../middleware/auth.middleware');
const {
    projectUpload,
    createProject,
    getCourseProjects,
    getProject,
    submitProject,
    getProjectSubmissions,
    gradeSubmission,
    updateProject,
    deleteProject
} = require('../controllers/projects.controller');

// Course projects routes
router.post('/', authenticate, projectUpload.single('file'), createProject);
router.get('/', authenticate, getCourseProjects);

// Single project routes
router.get('/:projectId', authenticate, getProject);
router.put('/:projectId', authenticate, projectUpload.single('file'), updateProject);
router.delete('/:projectId', authenticate, deleteProject);

// Submission routes
router.post('/:projectId/submit', authenticate, projectUpload.single('file'), submitProject);
router.get('/:projectId/submissions', authenticate, getProjectSubmissions);

// Grading route
router.put('/submissions/:submissionId/grade', authenticate, gradeSubmission);

module.exports = router;
