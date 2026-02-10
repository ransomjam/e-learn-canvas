const express = require('express');
const router = express.Router();

const {
    getCourses,
    getCourseById,
    createCourse,
    updateCourse,
    submitForReview,
    publishCourse,
    archiveCourse,
    deleteCourse,
    getInstructorCourses,
    getCategories
} = require('../controllers/course.controller');

const { createSection } = require('../controllers/lesson.controller');

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

module.exports = router;
