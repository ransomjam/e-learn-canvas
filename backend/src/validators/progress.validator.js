const { body, param, query } = require('express-validator');

// Update progress validation
const updateProgressValidation = [
    body('lessonId')
        .isUUID()
        .withMessage('Valid lesson ID is required'),
    body('isCompleted')
        .optional()
        .isBoolean()
        .withMessage('isCompleted must be a boolean'),
    body('watchTime')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Watch time must be a non-negative integer'),
    body('lastPosition')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Last position must be a non-negative integer'),
    body('notes')
        .optional()
        .trim()
        .isLength({ max: 5000 })
        .withMessage('Notes cannot exceed 5000 characters')
];

// Complete lesson validation
const completeLessonValidation = [
    param('lessonId')
        .isUUID()
        .withMessage('Invalid lesson ID')
];

// Get course progress validation
const courseProgressValidation = [
    param('courseId')
        .isUUID()
        .withMessage('Invalid course ID')
];

module.exports = {
    updateProgressValidation,
    completeLessonValidation,
    courseProgressValidation
};
