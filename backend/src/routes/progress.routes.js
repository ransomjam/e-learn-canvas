const express = require('express');
const router = express.Router();

const {
    updateProgress,
    completeLesson,
    getCourseProgress,
    getLessonProgress,
    getLearningStats
} = require('../controllers/progress.controller');

const {
    updateProgressValidation,
    completeLessonValidation,
    courseProgressValidation
} = require('../validators/progress.validator');

const { validate } = require('../middleware/validation.middleware');
const { authenticate } = require('../middleware/auth.middleware');

/**
 * @route   GET /api/v1/progress/stats
 * @desc    Get user's learning stats
 * @access  Private
 */
router.get('/stats', authenticate, getLearningStats);

/**
 * @route   GET /api/v1/progress/course/:courseId
 * @desc    Get course progress
 * @access  Private
 */
router.get('/course/:courseId', authenticate, courseProgressValidation, validate, getCourseProgress);

/**
 * @route   GET /api/v1/progress/lesson/:lessonId
 * @desc    Get lesson progress
 * @access  Private
 */
router.get('/lesson/:lessonId', authenticate, getLessonProgress);

/**
 * @route   POST /api/v1/progress
 * @desc    Update lesson progress
 * @access  Private
 */
router.post('/', authenticate, updateProgressValidation, validate, updateProgress);

/**
 * @route   POST /api/v1/progress/complete/:lessonId
 * @desc    Mark lesson as complete
 * @access  Private
 */
router.post('/complete/:lessonId', authenticate, completeLessonValidation, validate, completeLesson);

module.exports = router;
