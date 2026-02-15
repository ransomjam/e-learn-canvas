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

    // Check if lesson exists and get course_id
    const lessonResult = await query(
        'SELECT id, course_id FROM lessons WHERE id = $1',
        [lessonId]
    );

    if (lessonResult.rows.length === 0) {
        throw new ApiError(404, 'Lesson not found');
    }

    const courseId = lessonResult.rows[0].course_id;

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

        // Check if user still has likes on other lessons in the same course
        const otherLikes = await query(
            `SELECT ll.id FROM lesson_likes ll
             JOIN lessons l ON ll.lesson_id = l.id
             WHERE ll.user_id = $1 AND l.course_id = $2`,
            [userId, courseId]
        );

        // If no more lesson likes for this course, remove the course-level like
        if (otherLikes.rows.length === 0) {
            await query(
                'DELETE FROM course_likes WHERE user_id = $1 AND course_id = $2',
                [userId, courseId]
            );
            // Update cached count
            await query(
                `UPDATE courses SET likes_count = (
                    SELECT COUNT(DISTINCT user_id) FROM course_likes WHERE course_id = $1
                ) WHERE id = $1`,
                [courseId]
            );
        }

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

        // Also add a course-level like (if not already present)
        await query(
            `INSERT INTO course_likes (user_id, course_id) VALUES ($1, $2)
             ON CONFLICT (user_id, course_id) DO NOTHING`,
            [userId, courseId]
        );

        // Update cached count
        await query(
            `UPDATE courses SET likes_count = (
                SELECT COUNT(DISTINCT user_id) FROM course_likes WHERE course_id = $1
            ) WHERE id = $1`,
            [courseId]
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

/**
 * @desc    Get global course likes count (for course cards)
 * @route   GET /api/v1/courses/:courseId/likes
 * @access  Public
 */
const getCourseLikes = asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    // Get likes count from cached column
    const countResult = await query(
        'SELECT likes_count FROM courses WHERE id = $1',
        [courseId]
    );

    if (countResult.rows.length === 0) {
        throw new ApiError(404, 'Course not found');
    }

    // Check if current user liked (optional auth)
    let liked = false;
    if (req.user) {
        const userLiked = await query(
            'SELECT id FROM course_likes WHERE user_id = $1 AND course_id = $2',
            [req.user.id, courseId]
        );
        liked = userLiked.rows.length > 0;
    }

    res.json({
        success: true,
        data: {
            likesCount: parseInt(countResult.rows[0].likes_count || 0),
            liked
        }
    });
});

module.exports = {
    toggleLessonLike,
    getLessonLikes,
    getCourseLikes
};
