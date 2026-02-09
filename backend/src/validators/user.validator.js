const { body, param, query } = require('express-validator');

// Update user validation
const updateUserValidation = [
    body('firstName')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('First name must be between 1 and 100 characters'),
    body('lastName')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Last name must be between 1 and 100 characters'),
    body('bio')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Bio cannot exceed 1000 characters'),
    body('phone')
        .optional()
        .trim()
        .matches(/^[\d\s\-\+\(\)]+$/)
        .withMessage('Please provide a valid phone number')
];

// Update role validation (admin only)
const updateRoleValidation = [
    param('id')
        .isUUID()
        .withMessage('Invalid user ID'),
    body('role')
        .isIn(['admin', 'instructor', 'learner'])
        .withMessage('Role must be admin, instructor, or learner')
];

// User ID param validation
const userIdValidation = [
    param('id')
        .isUUID()
        .withMessage('Invalid user ID')
];

// List users query validation
const listUsersValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    query('role')
        .optional()
        .isIn(['admin', 'instructor', 'learner'])
        .withMessage('Invalid role filter'),
    query('search')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Search query too long')
];

module.exports = {
    updateUserValidation,
    updateRoleValidation,
    userIdValidation,
    listUsersValidation
};
