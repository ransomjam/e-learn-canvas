const { body, param, query } = require('express-validator');

// Create payment intent validation
const createPaymentValidation = [
    body('courseId')
        .isUUID()
        .withMessage('Valid course ID is required'),
    body('paymentMethod')
        .optional()
        .isString()
        .withMessage('Payment method must be a string')
];

// Payment ID validation
const paymentIdValidation = [
    param('id')
        .isUUID()
        .withMessage('Invalid payment ID')
];

// Confirm payment validation
const confirmPaymentValidation = [
    param('id')
        .isUUID()
        .withMessage('Invalid payment ID'),
    body('transactionId')
        .notEmpty()
        .withMessage('Transaction ID is required')
];

// Refund payment validation
const refundPaymentValidation = [
    param('id')
        .isUUID()
        .withMessage('Invalid payment ID'),
    body('reason')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Reason cannot exceed 500 characters'),
    body('amount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Refund amount must be a positive number')
];

// List payments query validation
const listPaymentsValidation = [
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
        .isIn(['pending', 'completed', 'failed', 'refunded'])
        .withMessage('Invalid status filter'),
    query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid ISO 8601 date')
];

module.exports = {
    createPaymentValidation,
    paymentIdValidation,
    confirmPaymentValidation,
    refundPaymentValidation,
    listPaymentsValidation
};
