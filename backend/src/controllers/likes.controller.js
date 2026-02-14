const { query } = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/error.middleware');

/**
 * @desc    Toggle like on a lesson
 * @route   POST /api/v1/lessons/:lessonId/like
 * @access  Private
 */
const toggleLessonLike = asyncHandler(async (req, res) => {
    const { lessonId } = req.params;
    const userId = req.user.id;

    // Check if lesson exists
    const lessonResult = await query(
        'SELECT id FROM lessons WHERE id = $1',
        [lessonId]
    );

    if (lessonResult.rows.length === 0) {
        throw new ApiError(404, 'Lesson not found');
    }

    // Check if already liked
    const existingLike = await query(
        'SELECT id FROM lesson_likes WHERE user_id = $1 AND lesson_id = $2',
        [userId, lessonId]
    );

    if (existingLike.rows.length > 0) {
        // Unlike
        await query(
            'DELETE FROM lesson_likes WHERE user_id = $1 AND lesson_id = $2',
            [userId, lessonId]
        );

        // Get updated count
        const countResult = await query(
            'SELECT COUNT(*) as count FROM lesson_likes WHERE lesson_id = $1',
            [lessonId]
        );

        res.json({
            success: true,
            data: {
                liked: false,
                likesCount: parseInt(countResult.rows[0].count)
            }
        });
    } else {
        // Like
        await query(
            'INSERT INTO lesson_likes (user_id, lesson_id) VALUES ($1, $2)',
            [userId, lessonId]
        );

        // Get updated count
        const countResult = await query(
            'SELECT COUNT(*) as count FROM lesson_likes WHERE lesson_id = $1',
            [lessonId]
        );

        res.json({
            success: true,
            data: {
                liked: true,
                likesCount: parseInt(countResult.rows[0].count)
            }
        });
    }
});

/**
 * @desc    Get lesson likes info
 * @route   GET /api/v1/lessons/:lessonId/likes
 * @access  Private
 */
const getLessonLikes = asyncHandler(async (req, res) => {
    const { lessonId } = req.params;
    const userId = req.user.id;

    // Get likes count
    const countResult = await query(
        'SELECT COUNT(*) as count FROM lesson_likes WHERE lesson_id = $1',
        [lessonId]
    );

    // Check if current user liked
    const userLiked = await query(
        'SELECT id FROM lesson_likes WHERE user_id = $1 AND lesson_id = $2',
        [userId, lessonId]
    );

    res.json({
        success: true,
        data: {
            likesCount: parseInt(countResult.rows[0].count),
            liked: userLiked.rows.length > 0
        }
    });
});

module.exports = {
    toggleLessonLike,
    getLessonLikes
};
