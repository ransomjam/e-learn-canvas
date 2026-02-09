const express = require('express');
const router = express.Router();

const {
    // Instructor
    getInstructorOverview,
    getInstructorRevenue,
    getInstructorEnrollments,
    getCourseAnalytics,

    // Admin
    getAdminOverview,
    getAdminUserMetrics,
    getAdminRevenueMetrics,
    getAdminCourseMetrics
} = require('../controllers/analytics.controller');

const { authenticate, authorize } = require('../middleware/auth.middleware');

// =====================
// INSTRUCTOR ANALYTICS
// =====================

/**
 * @route   GET /api/v1/analytics/instructor/overview
 * @desc    Get instructor overview stats
 * @access  Private/Instructor
 */
router.get('/instructor/overview', authenticate, authorize('instructor', 'admin'), getInstructorOverview);

/**
 * @route   GET /api/v1/analytics/instructor/revenue
 * @desc    Get instructor revenue over time
 * @access  Private/Instructor
 */
router.get('/instructor/revenue', authenticate, authorize('instructor', 'admin'), getInstructorRevenue);

/**
 * @route   GET /api/v1/analytics/instructor/enrollments
 * @desc    Get instructor enrollment trends
 * @access  Private/Instructor
 */
router.get('/instructor/enrollments', authenticate, authorize('instructor', 'admin'), getInstructorEnrollments);

/**
 * @route   GET /api/v1/analytics/instructor/courses/:id
 * @desc    Get analytics for specific course
 * @access  Private/Instructor
 */
router.get('/instructor/courses/:id', authenticate, authorize('instructor', 'admin'), getCourseAnalytics);

// =====================
// ADMIN ANALYTICS
// =====================

/**
 * @route   GET /api/v1/analytics/admin/overview
 * @desc    Get platform overview
 * @access  Private/Admin
 */
router.get('/admin/overview', authenticate, authorize('admin'), getAdminOverview);

/**
 * @route   GET /api/v1/analytics/admin/users
 * @desc    Get user growth metrics
 * @access  Private/Admin
 */
router.get('/admin/users', authenticate, authorize('admin'), getAdminUserMetrics);

/**
 * @route   GET /api/v1/analytics/admin/revenue
 * @desc    Get platform revenue metrics
 * @access  Private/Admin
 */
router.get('/admin/revenue', authenticate, authorize('admin'), getAdminRevenueMetrics);

/**
 * @route   GET /api/v1/analytics/admin/courses
 * @desc    Get course statistics
 * @access  Private/Admin
 */
router.get('/admin/courses', authenticate, authorize('admin'), getAdminCourseMetrics);

module.exports = router;
