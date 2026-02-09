const { body, param, query } = require('express-validator');

// Enroll validation
const enrollValidation = [
    body('courseId')
        .isUUID()
        .withMessage('Valid course ID is required')
];

// Enrollment ID validation
const enrollmentIdValidation = [
    param('id')
        .isUUID()
        .withMessage('Invalid enrollment ID')
];

// Update enrollment status validation
const updateEnrollmentStatusValidation = [
    param('id')
        .isUUID()
        .withMessage('Invalid enrollment ID'),
    body('status')
        .isIn(['pending', 'active', 'completed', 'cancelled'])
        .withMessage('Status must be pending, active, completed, or cancelled')
];

// List enrollments query validation
const listEnrollmentsValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    query('status')
        .optional()
        .isIn(['pending', 'active', 'completed', 'cancelled'])
        .withMessage('Invalid status filter'),
    query('courseId')
        .optional()
        .isUUID()
        .withMessage('Invalid course ID filter')
];

module.exports = {
    enrollValidation,
    enrollmentIdValidation,
    updateEnrollmentStatusValidation,
    listEnrollmentsValidation
};
