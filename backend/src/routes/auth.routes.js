const express = require('express');
const router = express.Router();

const {
    register,
    login,
    refreshAccessToken,
    logout,
    getMe,
    changePassword,
    forgotPassword,
    resetPassword
} = require('../controllers/auth.controller');

const {
    registerValidation,
    loginValidation,
    refreshTokenValidation,
    changePasswordValidation,
    forgotPasswordValidation,
    resetPasswordValidation
} = require('../validators/auth.validator');

const { validate } = require('../middleware/validation.middleware');
const { authenticate } = require('../middleware/auth.middleware');

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', registerValidation, validate, register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user and return tokens
 * @access  Public
 */
router.post('/login', loginValidation, validate, login);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh', refreshTokenValidation, validate, refreshAccessToken);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user and invalidate refresh token
 * @access  Private
 */
router.post('/logout', authenticate, logout);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current logged in user
 * @access  Private
 */
router.get('/me', authenticate, getMe);

/**
 * @route   PUT /api/v1/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put('/change-password', authenticate, changePasswordValidation, validate, changePassword);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset email
 * @access  Public
 */
router.post('/forgot-password', forgotPasswordValidation, validate, forgotPassword);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password using token
 * @access  Public
 */
router.post('/reset-password', resetPasswordValidation, validate, resetPassword);

module.exports = router;
