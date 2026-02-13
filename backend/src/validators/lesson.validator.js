const { body, param, query } = require('express-validator');

// Create lesson validation
const createLessonValidation = [
    body('sectionId')
        .isUUID()
        .withMessage('Valid section ID is required'),
    body('title')
        .trim()
        .notEmpty()
        .withMessage('Lesson title is required')
        .isLength({ max: 255 })
        .withMessage('Title cannot exceed 255 characters'),
    body('description')
        .optional()
        .trim(),
    body('content')
        .optional()
        .trim(),
    body('type')
        .optional()
        .isIn(['video', 'text', 'quiz', 'assignment', 'document', 'pdf', 'ppt', 'doc'])
        .withMessage('Type must be video, text, quiz, assignment, document, pdf, ppt, or doc'),
    body('videoUrl')
        .optional()
        .trim()
        .custom((value) => {
            // Accept full URLs or relative paths starting with /uploads/
            if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/uploads/') || value.startsWith('uploads/')) {
                return true;
            }
            throw new Error('Video URL must be a valid URL or upload path');
        }),
    body('videoDuration')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Video duration must be a positive integer'),
    body('orderIndex')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Order index must be a non-negative integer'),
    body('isFree')
        .optional()
        .isBoolean()
        .withMessage('isFree must be a boolean'),
    body('isPublished')
        .optional()
        .isBoolean()
        .withMessage('isPublished must be a boolean')
];

// Update lesson validation
const updateLessonValidation = [
    param('id')
        .isUUID()
        .withMessage('Invalid lesson ID'),
    body('title')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Lesson title cannot be empty')
        .isLength({ max: 255 })
        .withMessage('Title cannot exceed 255 characters'),
    body('description')
        .optional()
        .trim(),
    body('content')
        .optional()
        .trim(),
    body('type')
        .optional()
        .isIn(['video', 'text', 'quiz', 'assignment', 'document', 'pdf', 'ppt', 'doc'])
        .withMessage('Type must be video, text, quiz, assignment, document, pdf, ppt, or doc'),
    body('videoUrl')
        .optional()
        .trim()
        .custom((value) => {
            if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/uploads/') || value.startsWith('uploads/')) {
                return true;
            }
            throw new Error('Video URL must be a valid URL or upload path');
        }),
    body('videoDuration')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Video duration must be a positive integer'),
    body('orderIndex')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Order index must be a non-negative integer'),
    body('isFree')
        .optional()
        .isBoolean()
        .withMessage('isFree must be a boolean'),
    body('isPublished')
        .optional()
        .isBoolean()
        .withMessage('isPublished must be a boolean')
];

// Lesson ID param validation
const lessonIdValidation = [
    param('id')
        .isUUID()
        .withMessage('Invalid lesson ID')
];

// Create section validation
const createSectionValidation = [
    body('courseId')
        .isUUID()
        .withMessage('Valid course ID is required'),
    body('title')
        .trim()
        .notEmpty()
        .withMessage('Section title is required')
        .isLength({ max: 255 })
        .withMessage('Title cannot exceed 255 characters'),
    body('description')
        .optional()
        .trim(),
    body('orderIndex')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Order index must be a non-negative integer')
];

// Update section validation
const updateSectionValidation = [
    param('id')
        .isUUID()
        .withMessage('Invalid section ID'),
    body('title')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Section title cannot be empty')
        .isLength({ max: 255 })
        .withMessage('Title cannot exceed 255 characters'),
    body('description')
        .optional()
        .trim(),
    body('orderIndex')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Order index must be a non-negative integer')
];

module.exports = {
    createLessonValidation,
    updateLessonValidation,
    lessonIdValidation,
    createSectionValidation,
    updateSectionValidation
};
