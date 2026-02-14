const express = require('express');
const router = express.Router();

const {
    // Sections
    createSection,
    updateSection,
    deleteSection,

    // Lessons
    getCourseLessons,
    getLessonById,
    createLesson,
    updateLesson,
    deleteLesson,
    reorderLessons
} = require('../controllers/lesson.controller');

const {
    toggleLessonLike,
    getLessonLikes
} = require('../controllers/likes.controller');

const {
    createLessonValidation,
    updateLessonValidation,
    lessonIdValidation,
    createSectionValidation,
    updateSectionValidation
} = require('../validators/lesson.validator');

const { validate } = require('../middleware/validation.middleware');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth.middleware');

// =====================
// SECTION ROUTES
// =====================

/**
 * @route   POST /api/v1/lessons/sections
 * @desc    Create a new section
 * @access  Private/Instructor
 */
router.post('/sections', authenticate, authorize('instructor', 'admin'), createSectionValidation, validate, createSection);

/**
 * @route   PUT /api/v1/lessons/sections/:id
 * @desc    Update a section
 * @access  Private/Instructor
 */
router.put('/sections/:id', authenticate, authorize('instructor', 'admin'), updateSectionValidation, validate, updateSection);

/**
 * @route   DELETE /api/v1/lessons/sections/:id
 * @desc    Delete a section
 * @access  Private/Instructor
 */
router.delete('/sections/:id', authenticate, authorize('instructor', 'admin'), deleteSection);

/**
 * @route   PUT /api/v1/lessons/sections/:sectionId/reorder
 * @desc    Reorder lessons in a section
 * @access  Private/Instructor
 */
router.put('/sections/:sectionId/reorder', authenticate, authorize('instructor', 'admin'), reorderLessons);

// =====================
// LESSON ROUTES
// =====================

/**
 * @route   GET /api/v1/lessons/course/:courseId
 * @desc    Get all lessons for a course (grouped by sections)
 * @access  Public (limited) / Private (full)
 */
router.get('/course/:courseId', optionalAuth, getCourseLessons);

/**
 * @route   GET /api/v1/lessons/:id
 * @desc    Get single lesson
 * @access  Public (limited) / Private (full)
 */
router.get('/:id', optionalAuth, lessonIdValidation, validate, getLessonById);

/**
 * @route   POST /api/v1/lessons
 * @desc    Create a new lesson
 * @access  Private/Instructor
 */
router.post('/', authenticate, authorize('instructor', 'admin'), createLessonValidation, validate, createLesson);

/**
 * @route   PUT /api/v1/lessons/:id
 * @desc    Update a lesson
 * @access  Private/Instructor
 */
router.put('/:id', authenticate, authorize('instructor', 'admin'), updateLessonValidation, validate, updateLesson);

/**
 * @route   DELETE /api/v1/lessons/:id
 * @desc    Delete a lesson
 * @access  Private/Instructor
 */
router.delete('/:id', authenticate, authorize('instructor', 'admin'), lessonIdValidation, validate, deleteLesson);

// =====================
// LESSON LIKES ROUTES
// =====================

/**
 * @route   POST /api/v1/lessons/:lessonId/like
 * @desc    Toggle like on a lesson
 * @access  Private
 */
router.post('/:lessonId/like', authenticate, toggleLessonLike);

/**
 * @route   GET /api/v1/lessons/:lessonId/likes
 * @desc    Get lesson likes info
 * @access  Private
 */
router.get('/:lessonId/likes', authenticate, getLessonLikes);

module.exports = router;
