const express = require('express');
const router = express.Router();

const {
    getInstructorDashboard,
    getInstructorStudents,
    getInstructorReviews,
    getInstructorEarnings,
    getInstructorNotifications,
    markNotificationsRead
} = require('../controllers/instructor.controller');

const { authenticate, authorize } = require('../middleware/auth.middleware');

// All routes require instructor authentication
router.use(authenticate);
router.use(authorize('instructor', 'admin'));

/**
 * @route   GET /api/v1/instructor/dashboard
 * @desc    Get instructor dashboard overview
 * @access  Private/Instructor
 */
router.get('/dashboard', getInstructorDashboard);

/**
 * @route   GET /api/v1/instructor/students
 * @desc    Get instructor's students
 * @access  Private/Instructor
 */
router.get('/students', getInstructorStudents);

/**
 * @route   GET /api/v1/instructor/reviews
 * @desc    Get instructor's reviews
 * @access  Private/Instructor
 */
router.get('/reviews', getInstructorReviews);

/**
 * @route   GET /api/v1/instructor/earnings
 * @desc    Get instructor's earnings
 * @access  Private/Instructor
 */
router.get('/earnings', getInstructorEarnings);

/**
 * @route   GET /api/v1/instructor/notifications
 * @desc    Get instructor notifications
 * @access  Private/Instructor
 */
router.get('/notifications', getInstructorNotifications);

/**
 * @route   PUT /api/v1/instructor/notifications/read
 * @desc    Mark notifications as read
 * @access  Private/Instructor
 */
router.put('/notifications/read', markNotificationsRead);

module.exports = router;
