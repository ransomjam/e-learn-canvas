const express = require('express');
const router = express.Router();

const {
    issueCertificate,
    getCertificateById,
    verifyCertificate,
    getMyCertificates,
    getAllCertificates,
    getCourseCertificates
} = require('../controllers/certificate.controller');

const {
    issueCertificateValidation,
    certificateIdValidation,
    certificateNumberValidation,
    listCertificatesValidation
} = require('../validators/certificate.validator');

const { validate } = require('../middleware/validation.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');

/**
 * @route   GET /api/v1/certificates/verify/:certificateNumber
 * @desc    Verify certificate (public)
 * @access  Public
 */
router.get('/verify/:certificateNumber', certificateNumberValidation, validate, verifyCertificate);

/**
 * @route   GET /api/v1/certificates/all
 * @desc    Get all certificates (admin)
 * @access  Private/Admin
 */
router.get('/all', authenticate, authorize('admin'), listCertificatesValidation, validate, getAllCertificates);

/**
 * @route   GET /api/v1/certificates/course/:courseId
 * @desc    Get course certificates (instructor)
 * @access  Private/Instructor
 */
router.get('/course/:courseId', authenticate, authorize('instructor', 'admin'), getCourseCertificates);

/**
 * @route   GET /api/v1/certificates
 * @desc    Get user's certificates
 * @access  Private
 */
router.get('/', authenticate, listCertificatesValidation, validate, getMyCertificates);

/**
 * @route   GET /api/v1/certificates/:id
 * @desc    Get certificate by ID
 * @access  Private
 */
router.get('/:id', authenticate, certificateIdValidation, validate, getCertificateById);

/**
 * @route   POST /api/v1/certificates
 * @desc    Issue certificate
 * @access  Private/Instructor
 */
router.post('/', authenticate, authorize('instructor', 'admin', 'learner'), issueCertificateValidation, validate, issueCertificate);

module.exports = router;
