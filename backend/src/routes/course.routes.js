const express = require('express');
const router = express.Router();
const projectsRoutes = require('./projects.routes');

const {
    getCourses,
    getCourseById,
    createCourse,
    updateCourse,
    submitForReview,
    publishCourse,
    unpublishCourse,
    archiveCourse,
    deleteCourse,
    getInstructorCourses,
    getCategories,
    getAllCoursesAdmin
} = require('../controllers/course.controller');

const { getCourseLikes } = require('../controllers/likes.controller');

const { createSection } = require('../controllers/lesson.controller');

const {
    projectUpload,
    getProject,
    updateProject,
    deleteProject,
    submitProject,
    getProjectSubmissions,
    getPublicProjectSubmissions,
    gradeSubmission
} = require('../controllers/projects.controller');

const {
    createCourseValidation,
    updateCourseValidation,
    courseIdValidation,
    listCoursesValidation,
    publishCourseValidation
} = require('../validators/course.validator');

const { validate } = require('../middleware/validation.middleware');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth.middleware');

/**
 * @route   GET /api/v1/courses/categories
 * @desc    Get all categories
 * @access  Public
 */
router.get('/categories', getCategories);

/**
 * @route   GET /api/v1/courses/instructor/me
 * @desc    Get instructor's own courses
 * @access  Private/Instructor
 */
router.get('/instructor/me', authenticate, authorize('instructor', 'admin'), getInstructorCourses);

/**
 * @route   GET /api/v1/courses/admin/all
 * @desc    Get ALL courses for admin dashboard
 * @access  Private/Admin
 */
router.get('/admin/all', authenticate, authorize('admin'), getAllCoursesAdmin);

// ===== Standalone project routes (no courseId needed) =====
// These handle /courses/projects/... paths from the frontend

/**
 * @route   PUT /api/v1/courses/projects/submissions/:submissionId/grade
 * @desc    Grade a submission
 * @access  Private/Instructor
 */
router.put('/projects/submissions/:submissionId/grade', authenticate, gradeSubmission);

/**
 * @route   GET /api/v1/courses/projects/:projectId
 * @desc    Get a single project with user's submission
 * @access  Private
 */
router.get('/projects/:projectId', authenticate, getProject);

/**
 * @route   PUT /api/v1/courses/projects/:projectId
 * @desc    Update a project
 * @access  Private/Instructor
 */
router.put('/projects/:projectId', authenticate, projectUpload.single('file'), updateProject);

/**
 * @route   DELETE /api/v1/courses/projects/:projectId
 * @desc    Delete a project
 * @access  Private/Instructor
 */
router.delete('/projects/:projectId', authenticate, deleteProject);

/**
 * @route   POST /api/v1/courses/projects/:projectId/submit
 * @desc    Submit a project
 * @access  Private
 */
router.post('/projects/:projectId/submit', authenticate, projectUpload.single('file'), submitProject);

/**
 * @route   GET /api/v1/courses/projects/:projectId/submissions
 * @desc    Get all submissions for a project (instructor)
 * @access  Private/Instructor
 */
router.get('/projects/:projectId/submissions', authenticate, getProjectSubmissions);

/**
 * @route   GET /api/v1/courses/projects/:projectId/submissions/public
 * @desc    Get all submissions for a project (visible to all authenticated users)
 * @access  Private
 */
router.get('/projects/:projectId/submissions/public', authenticate, getPublicProjectSubmissions);

/**
 * @route   GET /api/v1/courses
 * @desc    Get all courses (with filters)
 * @access  Public
 */
router.get('/', optionalAuth, listCoursesValidation, validate, getCourses);

/**
 * @route   GET /api/v1/courses/:id
 * @desc    Get single course by ID or slug
 * @access  Public
 */
router.get('/:id', optionalAuth, getCourseById);

/**
 * @route   POST /api/v1/courses/:id/sections
 * @desc    Create a section for a course
 * @access  Private/Instructor
 */
router.post('/:id/sections', authenticate, authorize('instructor', 'admin'), (req, res, next) => {
    req.body.courseId = req.params.id;
    next();
}, createSection);

/**
 * @route   POST /api/v1/courses
 * @desc    Create a new course
 * @access  Private/Instructor
 */
router.post('/', authenticate, authorize('instructor', 'admin'), createCourseValidation, validate, createCourse);

/**
 * @route   PUT /api/v1/courses/:id
 * @desc    Update a course
 * @access  Private/Instructor
 */
router.put('/:id', authenticate, authorize('instructor', 'admin'), updateCourseValidation, validate, updateCourse);

/**
 * @route   PUT /api/v1/courses/:id/submit-review
 * @desc    Submit course for review
 * @access  Private/Instructor
 */
router.put('/:id/submit-review', authenticate, authorize('instructor', 'admin'), courseIdValidation, validate, submitForReview);

/**
 * @route   PUT /api/v1/courses/:id/publish
 * @desc    Publish a course
 * @access  Private/Instructor
 */
router.put('/:id/publish', authenticate, authorize('instructor', 'admin'), publishCourseValidation, validate, publishCourse);

/**
 * @route   PUT /api/v1/courses/:id/archive
 * @desc    Archive a course
 * @access  Private/Instructor
 */
router.put('/:id/archive', authenticate, authorize('instructor', 'admin'), courseIdValidation, validate, archiveCourse);

/**
 * @route   PUT /api/v1/courses/:id/unpublish
 * @desc    Unpublish a course (set to draft)
 * @access  Private/Admin
 */
router.put('/:id/unpublish', authenticate, authorize('admin'), unpublishCourse);

/**
 * @route   GET /api/v1/courses/:id/likes
 * @desc    Get course global likes count
 * @access  Public
 */
router.get('/:id/likes', optionalAuth, getCourseLikes);

/**
 * @route   DELETE /api/v1/courses/:id
 * @desc    Delete a course
 * @access  Private/Instructor
 */
router.delete('/:id', authenticate, authorize('instructor', 'admin'), courseIdValidation, validate, deleteCourse);

const {
    getResources,
    addResource,
    deleteResource,
    getChatMessages,
    postChatMessage
} = require('../controllers/course-features.controller');

/**
 * @route   GET /api/v1/courses/:id/resources
 * @desc    Get course resources
 * @access  Private
 */
router.get('/:id/resources', authenticate, getResources);

/**
 * @route   POST /api/v1/courses/:id/resources
 * @desc    Add a resource
 * @access  Private/Instructor
 */
router.post('/:id/resources', authenticate, authorize('instructor', 'admin'), addResource);

/**
 * @route   DELETE /api/v1/courses/:id/resources/:resourceId
 * @desc    Delete a resource
 * @access  Private/Instructor
 */
router.delete('/:id/resources/:resourceId', authenticate, authorize('instructor', 'admin'), deleteResource);

/**
 * @route   GET /api/v1/courses/:id/chat
 * @desc    Get chat messages
 * @access  Private
 */
router.get('/:id/chat', authenticate, getChatMessages);

/**
 * @route   POST /api/v1/courses/:id/chat
 * @desc    Post a chat message
 * @access  Private
 */
router.post('/:id/chat', authenticate, postChatMessage);

const reviewRoutes = require('./review.routes');

// Nested projects routes
router.use('/:courseId/projects', projectsRoutes);
router.use('/:id/reviews', reviewRoutes);

module.exports = router;
