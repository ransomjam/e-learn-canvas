const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { body } = require('express-validator');

const {
    getCourseReviews,
    addReview,
    updateReview,
    deleteReview,
    getUserReview
} = require('../controllers/review.controller');

// Validation rules
const reviewValidation = [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('title').optional().trim().isLength({ max: 100 }).withMessage('Title cannot exceed 100 characters'),
    body('comment').optional().trim().isLength({ max: 1000 }).withMessage('Comment cannot exceed 1000 characters')
];

router.route('/')
    .get(getCourseReviews)
    .post(authenticate, reviewValidation, validate, addReview);

router.route('/me')
    .get(authenticate, getUserReview)
    .put(authenticate, reviewValidation, validate, updateReview)
    .delete(authenticate, deleteReview);

module.exports = router;
