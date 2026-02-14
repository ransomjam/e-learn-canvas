const { query } = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/error.middleware');

const getWishlist = asyncHandler(async (req, res) => {
    const result = await query(
        `SELECT w.id, w.course_id as "courseId", w.created_at as "createdAt",
                c.title, c.slug, c.price, c.thumbnail_url as thumbnail, c.category
         FROM wishlist w
         JOIN courses c ON w.course_id = c.id
         WHERE w.user_id = $1
         ORDER BY w.created_at DESC`,
        [req.user.id]
    );
    
    res.json({ 
        success: true, 
        data: result.rows 
    });
});

const addToWishlist = asyncHandler(async (req, res) => {
    const { courseId } = req.body;

    if (!courseId) {
        throw new ApiError(400, 'Course ID is required');
    }

    // Check if already in wishlist
    const existing = await query(
        'SELECT id FROM wishlist WHERE user_id = $1 AND course_id = $2',
        [req.user.id, courseId]
    );

    if (existing.rows.length > 0) {
        throw new ApiError(400, 'Course already in wishlist');
    }

    const result = await query(
        'INSERT INTO wishlist (user_id, course_id) VALUES ($1, $2) RETURNING *',
        [req.user.id, courseId]
    );

    res.status(201).json({ 
        success: true, 
        data: result.rows[0] 
    });
});

const removeFromWishlist = asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    await query(
        'DELETE FROM wishlist WHERE user_id = $1 AND course_id = $2',
        [req.user.id, courseId]
    );

    res.json({ 
        success: true, 
        message: 'Removed from wishlist' 
    });
});

module.exports = {
    getWishlist,
    addToWishlist,
    removeFromWishlist
};
