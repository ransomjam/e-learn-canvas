const express = require('express');
const router = express.Router();

const {
    getUsers,
    getUserById,
    updateUser,
    updateUserRole,
    updateUserStatus,
    deleteUser,
    getInstructors
} = require('../controllers/user.controller');

const {
    updateUserValidation,
    updateRoleValidation,
    userIdValidation,
    listUsersValidation
} = require('../validators/user.validator');

const { validate } = require('../middleware/validation.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');

/**
 * @route   GET /api/v1/users/instructors
 * @desc    Get all instructors (public)
 * @access  Public
 */
router.get('/instructors', getInstructors);

/**
 * @route   GET /api/v1/users
 * @desc    Get all users
 * @access  Private/Admin
 */
router.get('/', authenticate, authorize('admin'), listUsersValidation, validate, getUsers);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
router.get('/:id', authenticate, userIdValidation, validate, getUserById);

/**
 * @route   PUT /api/v1/users/:id
 * @desc    Update user profile
 * @access  Private
 */
router.put('/:id', authenticate, userIdValidation, updateUserValidation, validate, updateUser);

/**
 * @route   PUT /api/v1/users/:id/role
 * @desc    Update user role
 * @access  Private/Admin
 */
router.put('/:id/role', authenticate, authorize('admin'), updateRoleValidation, validate, updateUserRole);

/**
 * @route   PUT /api/v1/users/:id/status
 * @desc    Activate/Deactivate user
 * @access  Private/Admin
 */
router.put('/:id/status', authenticate, authorize('admin'), userIdValidation, validate, updateUserStatus);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Delete user
 * @access  Private/Admin
 */
router.delete('/:id', authenticate, authorize('admin'), userIdValidation, validate, deleteUser);

module.exports = router;
