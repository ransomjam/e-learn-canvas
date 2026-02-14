const express = require('express');
const router = express.Router();

const {
    createPayment,
    confirmPayment,
    getPaymentById,
    getMyPayments,
    getAllPayments,
    refundPayment,
    getInstructorEarnings,
    createFapshiPayment,
    checkFapshiPaymentStatus,
    handleFapshiWebhook
} = require('../controllers/payment.controller');

const {
    createPaymentValidation,
    paymentIdValidation,
    confirmPaymentValidation,
    refundPaymentValidation,
    listPaymentsValidation
} = require('../validators/payment.validator');

const { validate } = require('../middleware/validation.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');

/**
 * @route   GET /api/v1/payments/all
 * @desc    Get all payments (admin)
 * @access  Private/Admin
 */
router.get('/all', authenticate, authorize('admin'), listPaymentsValidation, validate, getAllPayments);

/**
 * @route   GET /api/v1/payments/earnings
 * @desc    Get instructor earnings
 * @access  Private/Instructor
 */
router.get('/earnings', authenticate, authorize('instructor', 'admin'), getInstructorEarnings);

/**
 * @route   POST /api/v1/payments/fapshi
 * @desc    Initiate Fapshi mobile money payment
 * @access  Private
 */
router.post('/fapshi', authenticate, createFapshiPayment);

/**
 * @route   GET /api/v1/payments/fapshi/status/:transactionId
 * @desc    Check Fapshi payment status
 * @access  Private
 */
router.get('/fapshi/status/:transactionId', authenticate, checkFapshiPaymentStatus);

/**
 * @route   POST /api/v1/payments/webhook/fapshi
 * @desc    Fapshi webhook handler (no auth - called by Fapshi)
 * @access  Public
 */
router.post('/webhook/fapshi', handleFapshiWebhook);

/**
 * @route   GET /api/v1/payments
 * @desc    Get user's payments
 * @access  Private
 */
router.get('/', authenticate, listPaymentsValidation, validate, getMyPayments);

/**
 * @route   GET /api/v1/payments/:id
 * @desc    Get payment by ID
 * @access  Private
 */
router.get('/:id', authenticate, paymentIdValidation, validate, getPaymentById);

/**
 * @route   POST /api/v1/payments
 * @desc    Create payment intent
 * @access  Private
 */
router.post('/', authenticate, createPaymentValidation, validate, createPayment);

/**
 * @route   POST /api/v1/payments/:id/confirm
 * @desc    Confirm payment
 * @access  Private
 */
router.post('/:id/confirm', authenticate, confirmPaymentValidation, validate, confirmPayment);

/**
 * @route   POST /api/v1/payments/:id/refund
 * @desc    Refund payment
 * @access  Private/Admin
 */
router.post('/:id/refund', authenticate, authorize('admin'), refundPaymentValidation, validate, refundPayment);

module.exports = router;
