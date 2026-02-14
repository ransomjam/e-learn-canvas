const express = require('express');
const router = express.Router();

const {
    // Users
    getAdminUsers,
    banUser,
    unbanUser,
    bulkUserAction,

    // Courses
    getPendingCourses,
    getAllCourses,
    approveCourse,
    rejectCourse,

    // Transactions
    getTransactions,
    processRefund,
    refundTransaction,

    // Audit
    getAuditLogs,

    // Settings
    getSettings,
    updateSettings,

    // Notifications
    getNotifications,
    markNotificationsRead
} = require('../controllers/admin.controller');

const {
    generateEnrollmentCodes,
    getEnrollmentCodes,
    deleteEnrollmentCode,
    getUsersWithEnrollments
} = require('../controllers/enrollment-code.controller');

const { authenticate, authorize } = require('../middleware/auth.middleware');

// All admin routes require authentication and admin role
router.use(authenticate);

// =====================
// NOTIFICATIONS (available to all authenticated users)
// =====================

/**
 * @route   GET /api/v1/admin/notifications
 * @desc    Get user notifications
 * @access  Private
 */
router.get('/notifications', getNotifications);

/**
 * @route   PUT /api/v1/admin/notifications/read
 * @desc    Mark notifications as read
 * @access  Private
 */
router.put('/notifications/read', markNotificationsRead);

// =====================
// ADMIN ONLY ROUTES
// =====================
router.use(authorize('admin'));

// =====================
// USER MANAGEMENT
// =====================

/**
 * @route   GET /api/v1/admin/users
 * @desc    Get all users with filters
 * @access  Private/Admin
 */
router.get('/users', getAdminUsers);

/**
 * @route   PUT /api/v1/admin/users/:id/ban
 * @desc    Ban a user
 * @access  Private/Admin
 */
router.put('/users/:id/ban', banUser);

/**
 * @route   PUT /api/v1/admin/users/:id/unban
 * @desc    Unban a user
 * @access  Private/Admin
 */
router.put('/users/:id/unban', unbanUser);

/**
 * @route   POST /api/v1/admin/users/bulk
 * @desc    Bulk user actions
 * @access  Private/Admin
 */
router.post('/users/bulk', bulkUserAction);

// =====================
// COURSE MODERATION
// =====================

/**
 * @route   GET /api/v1/admin/courses
 * @desc    Get all courses for admin
 * @access  Private/Admin
 */
router.get('/courses', getAllCourses);

/**
 * @route   GET /api/v1/admin/courses/pending
 * @desc    Get courses pending review
 * @access  Private/Admin
 */
router.get('/courses/pending', getPendingCourses);

/**
 * @route   PUT /api/v1/admin/courses/:id/approve
 * @desc    Approve a course
 * @access  Private/Admin
 */
router.put('/courses/:id/approve', approveCourse);

/**
 * @route   PUT /api/v1/admin/courses/:id/reject
 * @desc    Reject a course
 * @access  Private/Admin
 */
router.put('/courses/:id/reject', rejectCourse);

// =====================
// TRANSACTIONS
// =====================

/**
 * @route   GET /api/v1/admin/transactions
 * @desc    Get all transactions
 * @access  Private/Admin
 */
router.get('/transactions', getTransactions);

/**
 * @route   POST /api/v1/admin/transactions/:id/refund
 * @desc    Refund a transaction by ID
 * @access  Private/Admin
 */
router.post('/transactions/:id/refund', refundTransaction);

/**
 * @route   POST /api/v1/admin/refunds
 * @desc    Process a refund
 * @access  Private/Admin
 */
router.post('/refunds', processRefund);

// =====================
// AUDIT LOGS
// =====================

/**
 * @route   GET /api/v1/admin/audit-logs
 * @desc    Get audit logs
 * @access  Private/Admin
 */
router.get('/audit-logs', getAuditLogs);

// =====================
// SYSTEM SETTINGS
// =====================

/**
 * @route   GET /api/v1/admin/settings
 * @desc    Get system settings
 * @access  Private/Admin
 */
router.get('/settings', getSettings);

/**
 * @route   PUT /api/v1/admin/settings
 * @desc    Update system settings
 * @access  Private/Admin
 */
router.put('/settings', updateSettings);

// =====================
// ENROLLMENT CODES
// =====================

/**
 * @route   POST /api/v1/admin/enrollment-codes/generate
 * @desc    Generate enrollment codes for a course
 * @access  Private/Admin
 */
router.post('/enrollment-codes/generate', generateEnrollmentCodes);

/**
 * @route   GET /api/v1/admin/enrollment-codes
 * @desc    Get all enrollment codes
 * @access  Private/Admin
 */
router.get('/enrollment-codes', getEnrollmentCodes);

/**
 * @route   DELETE /api/v1/admin/enrollment-codes/:id
 * @desc    Delete an unused enrollment code
 * @access  Private/Admin
 */
router.delete('/enrollment-codes/:id', deleteEnrollmentCode);

/**
 * @route   GET /api/v1/admin/users/enrollments
 * @desc    Get users with enrollment and progress info
 * @access  Private/Admin
 */
router.get('/users/enrollments', getUsersWithEnrollments);

module.exports = router;

