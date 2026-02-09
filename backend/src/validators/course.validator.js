const { body, param, query } = require('express-validator');

// Create course validation
const createCourseValidation = [
    body('title')
        .trim()
        .notEmpty()
        .withMessage('Course title is required')
        .isLength({ max: 255 })
        .withMessage('Title cannot exceed 255 characters'),
    body('description')
        .optional()
        .trim(),
    body('shortDescription')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Short description cannot exceed 500 characters'),
    body('categoryId')
        .optional()
        .isUUID()
        .withMessage('Invalid category ID'),
    body('price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Price must be a positive number'),
    body('level')
        .optional()
        .isIn(['beginner', 'intermediate', 'advanced'])
        .withMessage('Level must be beginner, intermediate, or advanced'),
    body('language')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Language cannot exceed 50 characters'),
    body('requirements')
        .optional()
        .isArray()
        .withMessage('Requirements must be an array'),
    body('objectives')
        .optional()
        .isArray()
        .withMessage('Objectives must be an array')
];

// Update course validation
const updateCourseValidation = [
    param('id')
        .isUUID()
        .withMessage('Invalid course ID'),
    ...createCourseValidation.map(rule => rule.optional())
];

// Course ID param validation
const courseIdValidation = [
    param('id')
        .isUUID()
        .withMessage('Invalid course ID')
];

// List courses query validation
const listCoursesValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('Limit must be between 1 and 50'),
    query('category')
        .optional()
        .isUUID()
        .withMessage('Invalid category ID'),
    query('level')
        .optional()
        .isIn(['beginner', 'intermediate', 'advanced'])
        .withMessage('Invalid level filter'),
    query('status')
        .optional()
        .isIn(['draft', 'published', 'archived'])
        .withMessage('Invalid status filter'),
    query('search')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Search query too long'),
    query('sortBy')
        .optional()
        .isIn(['created_at', 'price', 'rating_avg', 'enrollment_count', 'title'])
        .withMessage('Invalid sort field'),
    query('sortOrder')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Sort order must be asc or desc')
];

// Publish course validation
const publishCourseValidation = [
    param('id')
        .isUUID()
        .withMessage('Invalid course ID')
];

module.exports = {
    createCourseValidation,
    updateCourseValidation,
    courseIdValidation,
    listCoursesValidation,
    publishCourseValidation
};
