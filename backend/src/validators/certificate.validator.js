const { body, param, query } = require('express-validator');

// Issue certificate validation
const issueCertificateValidation = [
    body('enrollmentId')
        .isUUID()
        .withMessage('Valid enrollment ID is required'),
    body('title')
        .optional()
        .trim()
        .isLength({ max: 255 })
        .withMessage('Title cannot exceed 255 characters')
];

// Certificate ID validation
const certificateIdValidation = [
    param('id')
        .isUUID()
        .withMessage('Invalid certificate ID')
];

// Certificate number validation
const certificateNumberValidation = [
    param('certificateNumber')
        .notEmpty()
        .withMessage('Certificate number is required')
];

// List certificates query validation
const listCertificatesValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    query('userId')
        .optional()
        .isUUID()
        .withMessage('Invalid user ID filter'),
    query('courseId')
        .optional()
        .isUUID()
        .withMessage('Invalid course ID filter')
];

module.exports = {
    issueCertificateValidation,
    certificateIdValidation,
    certificateNumberValidation,
    listCertificatesValidation
};
