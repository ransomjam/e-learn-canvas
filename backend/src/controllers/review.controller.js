/* eslint-disable no-undef */
const { query } = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/error.middleware');

/**
 * @desc    Get reviews for a course
 * @route   GET /api/v1/courses/:id/reviews
 * @access  Public
 */
const getCourseReviews = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const countResult = await query(
        'SELECT COUNT(*) FROM reviews WHERE course_id = $1 AND is_approved = true',
        [id]
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
        `SELECT r.id, r.rating, r.title, r.comment, r.created_at,
            u.id as user_id, u.first_name, u.last_name, u.avatar_url
         FROM reviews r
         JOIN users u ON r.user_id = u.id
         WHERE r.course_id = $1 AND r.is_approved = true
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [id, limit, offset]
    );

    // Calculate average rating
    const avgResult = await query(
        'SELECT AVG(rating) as average_rating FROM reviews WHERE course_id = $1 AND is_approved = true',
        [id]
    );
    const averageRating = parseFloat(avgResult.rows[0].average_rating || 0).toFixed(1);

    res.json({
        success: true,
        data: {
            reviews: result.rows.map(review => ({
                id: review.id,
                rating: review.rating,
                title: review.title,
                comment: review.comment,
                createdAt: review.created_at,
                user: {
                    id: review.user_id,
                    firstName: review.first_name,
                    lastName: review.last_name,
                    avatarUrl: review.avatar_url
                }
            })),
            averageRating,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        }
    });
});

/**
 * @desc    Add review to a course
 * @route   POST /api/v1/courses/:id/reviews
 * @access  Private
 */
const addReview = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rating, title, comment } = req.body;
    const userId = req.user.id;

    // Check if user is enrolled
    const enrollmentCheck = await query(
        'SELECT * FROM enrollments WHERE user_id = $1 AND course_id = $2 AND status IN (\'active\', \'completed\')',
        [userId, id]
    );

    if (enrollmentCheck.rows.length === 0) {
        throw new ApiError(403, 'You must be enrolled in this course to leave a review');
    }

    // Check if review already exists
    const existingReview = await query(
        'SELECT * FROM reviews WHERE user_id = $1 AND course_id = $2',
        [userId, id]
    );

    if (existingReview.rows.length > 0) {
        throw new ApiError(400, 'You have already reviewed this course. Please update your existing review.');
    }

    const result = await query(
        `INSERT INTO reviews (user_id, course_id, rating, title, comment)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, id, rating, title, comment]
    );

    // Update course average rating
    await updateCourseRatingRef(id);

    res.status(201).json({
        success: true,
        data: result.rows[0]
    });
});

/**
 * @desc    Update review
 * @route   PUT /api/v1/courses/:id/reviews/me
 * @access  Private
 */
const updateReview = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rating, title, comment } = req.body;
    const userId = req.user.id;

    const result = await query(
        `UPDATE reviews 
         SET rating = $1, title = $2, comment = $3, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $4 AND course_id = $5
         RETURNING *`,
        [rating, title, comment, userId, id]
    );

    if (result.rows.length === 0) {
        throw new ApiError(404, 'Review not found');
    }

    // Update course average rating
    await updateCourseRatingRef(id);

    res.json({
        success: true,
        data: result.rows[0]
    });
});

/**
 * @desc    Delete review
 * @route   DELETE /api/v1/courses/:id/reviews/me
 * @access  Private
 */
const deleteReview = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await query(
        'DELETE FROM reviews WHERE user_id = $1 AND course_id = $2 RETURNING id',
        [userId, id]
    );

    if (result.rows.length === 0) {
        throw new ApiError(404, 'Review not found');
    }

    // Update course average rating
    await updateCourseRatingRef(id);

    res.json({
        success: true,
        message: 'Review deleted successfully'
    });
});

/**
 * @desc    Get current user's review
 * @route   GET /api/v1/courses/:id/reviews/me
 * @access  Private
 */
const getUserReview = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await query(
        'SELECT * FROM reviews WHERE user_id = $1 AND course_id = $2',
        [userId, id]
    );

    if (result.rows.length === 0) {
        return res.json({
            success: true,
            data: null
        });
    }

    res.json({
        success: true,
        data: result.rows[0]
    });
});

// Helper function to update course table with new average
const updateCourseRatingRef = async (courseId) => {
    const avgResult = await query(
        'SELECT AVG(rating) as avg, COUNT(*) as count FROM reviews WHERE course_id = $1 AND is_approved = true',
        [courseId]
    );

    const avg = parseFloat(avgResult.rows[0].avg || 0);
    const count = parseInt(avgResult.rows[0].count || 0);

    await query(
        'UPDATE courses SET rating_avg = $1, rating_count = $2 WHERE id = $3',
        [avg, count, courseId]
    );
};

module.exports = {
    getCourseReviews,
    addReview,
    updateReview,
    deleteReview,
    getUserReview
};
