const { query } = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/error.middleware');

/**
 * @desc    Update lesson progress
 * @route   POST /api/v1/progress
 * @access  Private
 */
const updateProgress = asyncHandler(async (req, res) => {
    const { lessonId, isCompleted, watchTime, lastPosition, notes } = req.body;

    // Get lesson and check enrollment
    const lessonResult = await query(
        'SELECT course_id FROM lessons WHERE id = $1',
        [lessonId]
    );

    if (lessonResult.rows.length === 0) {
        throw new ApiError(404, 'Lesson not found');
    }

    const courseId = lessonResult.rows[0].course_id;

    // Get enrollment
    const enrollmentResult = await query(
        'SELECT id, status FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [req.user.id, courseId]
    );

    if (enrollmentResult.rows.length === 0 || !['active', 'completed'].includes(enrollmentResult.rows[0].status)) {
        throw new ApiError(403, 'You must be enrolled in this course to track progress');
    }

    const enrollmentId = enrollmentResult.rows[0].id;

    // Upsert progress
    const result = await query(
        `INSERT INTO progress (user_id, lesson_id, enrollment_id, is_completed, watch_time, last_position, notes, completed_at)
     VALUES ($1, $2, $3, $4, COALESCE($5, 0), COALESCE($6, 0), $7, ${isCompleted ? 'CURRENT_TIMESTAMP' : 'NULL'})
     ON CONFLICT (user_id, lesson_id) 
     DO UPDATE SET 
       is_completed = COALESCE($4, progress.is_completed),
       watch_time = COALESCE($5, progress.watch_time),
       last_position = COALESCE($6, progress.last_position),
       notes = COALESCE($7, progress.notes),
       completed_at = CASE WHEN $4 = true AND progress.completed_at IS NULL THEN CURRENT_TIMESTAMP ELSE progress.completed_at END,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
        [req.user.id, lessonId, enrollmentId, isCompleted, watchTime, lastPosition, notes]
    );

    // Update enrollment progress percentage and last accessed
    await updateEnrollmentProgress(enrollmentId, courseId);

    // Update enrollment last accessed
    await query(
        'UPDATE enrollments SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = $1',
        [enrollmentId]
    );

    const progress = result.rows[0];

    res.json({
        success: true,
        message: 'Progress updated successfully',
        data: {
            lessonId: progress.lesson_id,
            isCompleted: progress.is_completed,
            completedAt: progress.completed_at,
            watchTime: progress.watch_time,
            lastPosition: progress.last_position
        }
    });
});

/**
 * @desc    Mark lesson as complete
 * @route   POST /api/v1/progress/complete/:lessonId
 * @access  Private
 */
const completeLesson = asyncHandler(async (req, res) => {
    const { lessonId } = req.params;

    // Get lesson and check enrollment
    const lessonResult = await query(
        'SELECT course_id FROM lessons WHERE id = $1',
        [lessonId]
    );

    if (lessonResult.rows.length === 0) {
        throw new ApiError(404, 'Lesson not found');
    }

    const courseId = lessonResult.rows[0].course_id;

    // Get enrollment
    const enrollmentResult = await query(
        'SELECT id, status FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [req.user.id, courseId]
    );

    if (enrollmentResult.rows.length === 0 || !['active', 'completed'].includes(enrollmentResult.rows[0].status)) {
        throw new ApiError(403, 'You must be enrolled in this course');
    }

    const enrollmentId = enrollmentResult.rows[0].id;

    // Mark as complete
    await query(
        `INSERT INTO progress (user_id, lesson_id, enrollment_id, is_completed, completed_at)
     VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, lesson_id) 
     DO UPDATE SET is_completed = true, completed_at = COALESCE(progress.completed_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP`,
        [req.user.id, lessonId, enrollmentId]
    );

    // Update enrollment progress
    const completed = await updateEnrollmentProgress(enrollmentId, courseId);

    res.json({
        success: true,
        message: 'Lesson marked as complete',
        data: {
            lessonId,
            courseCompleted: completed
        }
    });
});

/**
 * Helper function to update enrollment progress percentage
 */
const updateEnrollmentProgress = async (enrollmentId, courseId) => {
    // Count total lessons and completed lessons
    const statsResult = await query(
        `SELECT 
       (SELECT COUNT(*) FROM lessons WHERE course_id = $1 AND is_published = true) as total_lessons,
       (SELECT COUNT(*) FROM progress p 
        JOIN lessons l ON p.lesson_id = l.id 
        WHERE p.enrollment_id = $2 AND p.is_completed = true AND l.is_published = true) as completed_lessons`,
        [courseId, enrollmentId]
    );

    const total = parseInt(statsResult.rows[0].total_lessons);
    const completed = parseInt(statsResult.rows[0].completed_lessons);
    const percentage = total > 0 ? (completed / total) * 100 : 0;

    // Check if course is complete
    const isComplete = total > 0 && completed >= total;

    await query(
        `UPDATE enrollments 
     SET progress_percentage = $1, 
         status = CASE WHEN $2 THEN 'completed' ELSE status END,
         completed_at = CASE WHEN $2 AND completed_at IS NULL THEN CURRENT_TIMESTAMP ELSE completed_at END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
        [percentage, isComplete, enrollmentId]
    );

    return isComplete;
};

/**
 * @desc    Get course progress
 * @route   GET /api/v1/progress/course/:courseId
 * @access  Private
 */
const getCourseProgress = asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    // Get enrollment
    const enrollmentResult = await query(
        'SELECT id, status, progress_percentage FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [req.user.id, courseId]
    );

    if (enrollmentResult.rows.length === 0) {
        throw new ApiError(404, 'Enrollment not found');
    }

    const enrollment = enrollmentResult.rows[0];

    // Get detailed progress
    const progressResult = await query(
        `SELECT l.id as lesson_id, l.title, l.type, l.order_index, l.video_duration,
            s.id as section_id, s.title as section_title, s.order_index as section_order,
            COALESCE(p.is_completed, false) as is_completed,
            p.completed_at, p.watch_time, p.last_position
     FROM lessons l
     JOIN sections s ON l.section_id = s.id
     LEFT JOIN progress p ON l.id = p.lesson_id AND p.user_id = $1
     WHERE l.course_id = $2 AND l.is_published = true
     ORDER BY s.order_index, l.order_index`,
        [req.user.id, courseId]
    );

    // Group by sections
    const sectionsMap = new Map();
    let totalLessons = 0;
    let completedLessons = 0;
    let totalWatchTime = 0;

    for (const row of progressResult.rows) {
        if (!sectionsMap.has(row.section_id)) {
            sectionsMap.set(row.section_id, {
                id: row.section_id,
                title: row.section_title,
                orderIndex: row.section_order,
                lessons: [],
                completedCount: 0,
                totalCount: 0
            });
        }

        const section = sectionsMap.get(row.section_id);
        section.totalCount++;
        totalLessons++;

        if (row.is_completed) {
            section.completedCount++;
            completedLessons++;
        }

        totalWatchTime += row.watch_time || 0;

        section.lessons.push({
            id: row.lesson_id,
            title: row.title,
            type: row.type,
            videoDuration: row.video_duration,
            isCompleted: row.is_completed,
            completedAt: row.completed_at,
            watchTime: row.watch_time,
            lastPosition: row.last_position
        });
    }

    res.json({
        success: true,
        data: {
            courseId,
            enrollmentStatus: enrollment.status,
            progressPercentage: parseFloat(enrollment.progress_percentage),
            totalLessons,
            completedLessons,
            totalWatchTime,
            sections: Array.from(sectionsMap.values()).map(s => ({
                ...s,
                progressPercentage: s.totalCount > 0 ? (s.completedCount / s.totalCount) * 100 : 0
            }))
        }
    });
});

/**
 * @desc    Get lesson progress
 * @route   GET /api/v1/progress/lesson/:lessonId
 * @access  Private
 */
const getLessonProgress = asyncHandler(async (req, res) => {
    const { lessonId } = req.params;

    const result = await query(
        `SELECT p.*, l.title as lesson_title, l.type as lesson_type
     FROM progress p
     JOIN lessons l ON p.lesson_id = l.id
     WHERE p.user_id = $1 AND p.lesson_id = $2`,
        [req.user.id, lessonId]
    );

    if (result.rows.length === 0) {
        // Return default progress
        return res.json({
            success: true,
            data: {
                lessonId,
                isCompleted: false,
                watchTime: 0,
                lastPosition: 0,
                notes: null
            }
        });
    }

    const progress = result.rows[0];

    res.json({
        success: true,
        data: {
            lessonId: progress.lesson_id,
            lessonTitle: progress.lesson_title,
            lessonType: progress.lesson_type,
            isCompleted: progress.is_completed,
            completedAt: progress.completed_at,
            watchTime: progress.watch_time,
            lastPosition: progress.last_position,
            notes: progress.notes
        }
    });
});

/**
 * @desc    Get user's learning stats
 * @route   GET /api/v1/progress/stats
 * @access  Private
 */
const getLearningStats = asyncHandler(async (req, res) => {
    const result = await query(
        `SELECT 
       COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'active') as active_courses,
       COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'completed') as completed_courses,
       COALESCE(SUM(p.watch_time), 0) as total_watch_time,
       COUNT(DISTINCT p.lesson_id) FILTER (WHERE p.is_completed = true) as lessons_completed,
       COUNT(DISTINCT cert.id) as certificates_earned
     FROM enrollments e
     LEFT JOIN progress p ON e.id = p.enrollment_id
     LEFT JOIN certificates cert ON e.id = cert.enrollment_id
     WHERE e.user_id = $1`,
        [req.user.id]
    );

    const stats = result.rows[0];

    // Get recent activity
    const recentActivity = await query(
        `SELECT p.updated_at, p.is_completed, l.title as lesson_title, c.title as course_title
     FROM progress p
     JOIN lessons l ON p.lesson_id = l.id
     JOIN courses c ON l.course_id = c.id
     JOIN enrollments e ON p.enrollment_id = e.id
     WHERE e.user_id = $1
     ORDER BY p.updated_at DESC
     LIMIT 5`,
        [req.user.id]
    );

    res.json({
        success: true,
        data: {
            activeCourses: parseInt(stats.active_courses),
            completedCourses: parseInt(stats.completed_courses),
            totalWatchTime: parseInt(stats.total_watch_time),
            lessonsCompleted: parseInt(stats.lessons_completed),
            certificatesEarned: parseInt(stats.certificates_earned),
            recentActivity: recentActivity.rows.map(a => ({
                lessonTitle: a.lesson_title,
                courseTitle: a.course_title,
                isCompleted: a.is_completed,
                timestamp: a.updated_at
            }))
        }
    });
});

module.exports = {
    updateProgress,
    completeLesson,
    getCourseProgress,
    getLessonProgress,
    getLearningStats
};
