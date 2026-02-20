const express = require('express');
const router = express.Router();

const {
    getMyEnrollments,
    getEnrollmentById,
    enrollInCourse,
    cancelEnrollment,
    getCourseEnrollments,
    getAllEnrollments
} = require('../controllers/enrollment.controller');

const { redeemEnrollmentCode, getAvailableCodes, claimCode } = require('../controllers/enrollment-code.controller');

const {
    enrollValidation,
    enrollmentIdValidation,
    listEnrollmentsValidation
} = require('../validators/enrollment.validator');

const { validate } = require('../middleware/validation.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');

/**
 * @route   GET /api/v1/enrollments/all
 * @desc    Get all enrollments (admin)
 * @access  Private/Admin
 */
router.get('/all', authenticate, authorize('admin'), listEnrollmentsValidation, validate, getAllEnrollments);

/**
 * @route   GET /api/v1/enrollments/course/:courseId
 * @desc    Get course enrollments (instructor)
 * @access  Private/Instructor
 */
router.get('/course/:courseId', authenticate, authorize('instructor', 'admin'), getCourseEnrollments);

/**
 * @route   GET /api/v1/enrollments
 * @desc    Get user's enrollments
 * @access  Private
 */
router.get('/', authenticate, listEnrollmentsValidation, validate, getMyEnrollments);

/**
 * @route   GET /api/v1/enrollments/:id
 * @desc    Get single enrollment
 * @access  Private
 */
router.get('/:id', authenticate, enrollmentIdValidation, validate, getEnrollmentById);

/**
 * @route   POST /api/v1/enrollments
 * @desc    Enroll in a course
 * @access  Private
 */
router.post('/', authenticate, enrollValidation, validate, enrollInCourse);

/**
 * @route   POST /api/v1/enrollments/redeem-code
 * @desc    Redeem an enrollment code
 * @access  Private
 */
router.post('/redeem-code', authenticate, redeemEnrollmentCode);

/**
 * @route   GET /api/v1/enrollments/available-codes
 * @desc    Get available enrollment codes (for claim page)
 * @access  Private
 */
router.get('/available-codes', authenticate, getAvailableCodes);

/**
 * @route   POST /api/v1/enrollments/claim-code
 * @desc    Claim an enrollment code by ID
 * @access  Private
 */
router.post('/claim-code', authenticate, claimCode);

/**
 * @route   PUT /api/v1/enrollments/:id/cancel
 * @desc    Cancel enrollment
 * @access  Private
 */
router.put('/:id/cancel', authenticate, enrollmentIdValidation, validate, cancelEnrollment);

module.exports = router;
