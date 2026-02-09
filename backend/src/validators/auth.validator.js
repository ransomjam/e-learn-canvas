const { body, param, query } = require('express-validator');

// Registration validation
const registerValidation = [
    body('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('firstName')
        .trim()
        .notEmpty()
        .withMessage('First name is required')
        .isLength({ max: 100 })
        .withMessage('First name cannot exceed 100 characters'),
    body('lastName')
        .trim()
        .notEmpty()
        .withMessage('Last name is required')
        .isLength({ max: 100 })
        .withMessage('Last name cannot exceed 100 characters'),
    body('role')
        .optional()
        .isIn(['learner', 'instructor'])
        .withMessage('Role must be either learner or instructor')
];

// Login validation
const loginValidation = [
    body('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail(),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

// Refresh token validation
const refreshTokenValidation = [
    body('refreshToken')
        .notEmpty()
        .withMessage('Refresh token is required')
];

// Change password validation
const changePasswordValidation = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('New password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
];

// Forgot password validation
const forgotPasswordValidation = [
    body('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail()
];

// Reset password validation
const resetPasswordValidation = [
    body('token')
        .notEmpty()
        .withMessage('Reset token is required'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
];

module.exports = {
    registerValidation,
    loginValidation,
    refreshTokenValidation,
    changePasswordValidation,
    forgotPasswordValidation,
    resetPasswordValidation
};
