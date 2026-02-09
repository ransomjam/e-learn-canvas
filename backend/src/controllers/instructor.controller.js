const { query } = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/error.middleware');

/**
 * @desc    Get instructor dashboard overview
 * @route   GET /api/v1/instructor/dashboard
 * @access  Private/Instructor
 */
const getInstructorDashboard = asyncHandler(async (req, res) => {
    const instructorId = req.user.id;

    // Get overview stats
    const statsResult = await query(`
        SELECT 
            COUNT(DISTINCT c.id) as total_courses,
            COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'published') as published_courses,
            COUNT(DISTINCT c.id) FILTER (WHERE c.moderation_status = 'pending_review') as pending_courses,
            COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'active') as active_students,
            COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0) as total_revenue,
            COALESCE(AVG(r.rating), 0) as average_rating
        FROM courses c
        LEFT JOIN enrollments e ON c.id = e.course_id
        LEFT JOIN payments p ON c.id = p.course_id
        LEFT JOIN reviews r ON c.id = r.course_id
        WHERE c.instructor_id = $1
    `, [instructorId]);

    const stats = statsResult.rows[0];

    res.json({
        success: true,
        data: {
            totalCourses: parseInt(stats.total_courses),
            publishedCourses: parseInt(stats.published_courses),
            pendingCourses: parseInt(stats.pending_courses),
            activeStudents: parseInt(stats.active_students),
            totalRevenue: parseFloat(stats.total_revenue),
            averageRating: parseFloat(stats.average_rating).toFixed(1)
        }
    });
});

/**
 * @desc    Get instructor's students
 * @route   GET /api/v1/instructor/students
 * @access  Private/Instructor
 */
const getInstructorStudents = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, courseId } = req.query;
    const offset = (page - 1) * limit;
    const instructorId = req.user.id;

    let whereClause = 'WHERE c.instructor_id = $1';
    const params = [instructorId];
    let paramIndex = 2;

    if (courseId) {
        whereClause += ` AND c.id = $${paramIndex++}`;
        params.push(courseId);
    }

    const countResult = await query(`
        SELECT COUNT(DISTINCT e.user_id)
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        ${whereClause}
    `, params);

    const total = parseInt(countResult.rows[0].count);

    const result = await query(`
        SELECT DISTINCT ON (u.id)
            u.id, u.first_name, u.last_name, u.email, u.avatar_url,
            e.enrolled_at, e.progress_percentage, e.status,
            c.title as course_title, c.id as course_id
        FROM users u
        JOIN enrollments e ON u.id = e.user_id
        JOIN courses c ON e.course_id = c.id
        ${whereClause}
        ORDER BY u.id, e.enrolled_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, [...params, limit, offset]);

    res.json({
        success: true,
        data: {
            students: result.rows.map(s => ({
                id: s.id,
                firstName: s.first_name,
                lastName: s.last_name,
                email: s.email,
                avatarUrl: s.avatar_url,
                enrolledAt: s.enrolled_at,
                progress: parseFloat(s.progress_percentage),
                status: s.status,
                course: {
                    id: s.course_id,
                    title: s.course_title
                }
            })),
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
 * @desc    Get instructor's reviews
 * @route   GET /api/v1/instructor/reviews
 * @access  Private/Instructor
 */
const getInstructorReviews = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, courseId } = req.query;
    const offset = (page - 1) * limit;
    const instructorId = req.user.id;

    let whereClause = 'WHERE c.instructor_id = $1';
    const params = [instructorId];
    let paramIndex = 2;

    if (courseId) {
        whereClause += ` AND c.id = $${paramIndex++}`;
        params.push(courseId);
    }

    const countResult = await query(`
        SELECT COUNT(*)
        FROM reviews r
        JOIN courses c ON r.course_id = c.id
        ${whereClause}
    `, params);

    const total = parseInt(countResult.rows[0].count);

    const result = await query(`
        SELECT r.*, 
            u.first_name, u.last_name, u.avatar_url,
            c.title as course_title, c.id as course_id
        FROM reviews r
        JOIN users u ON r.user_id = u.id
        JOIN courses c ON r.course_id = c.id
        ${whereClause}
        ORDER BY r.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, [...params, limit, offset]);

    res.json({
        success: true,
        data: {
            reviews: result.rows.map(r => ({
                id: r.id,
                rating: r.rating,
                title: r.title,
                comment: r.comment,
                createdAt: r.created_at,
                user: {
                    firstName: r.first_name,
                    lastName: r.last_name,
                    avatarUrl: r.avatar_url
                },
                course: {
                    id: r.course_id,
                    title: r.course_title
                }
            })),
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
 * @desc    Get instructor's earnings
 * @route   GET /api/v1/instructor/earnings
 * @access  Private/Instructor
 */
const getInstructorEarnings = asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;
    const instructorId = req.user.id;

    let interval = period === '7d' ? '7 days' : period === '90d' ? '90 days' : '30 days';

    const result = await query(`
        SELECT 
            DATE_TRUNC('day', p.paid_at) as date,
            SUM(p.amount) as earnings,
            COUNT(*) as transactions
        FROM payments p
        JOIN courses c ON p.course_id = c.id
        WHERE c.instructor_id = $1 
            AND p.status = 'completed'
            AND p.paid_at >= CURRENT_DATE - INTERVAL '${interval}'
        GROUP BY DATE_TRUNC('day', p.paid_at)
        ORDER BY date
    `, [instructorId]);

    // Get total earnings
    const totalResult = await query(`
        SELECT 
            COALESCE(SUM(amount), 0) as total,
            COUNT(*) as total_transactions
        FROM payments p
        JOIN courses c ON p.course_id = c.id
        WHERE c.instructor_id = $1 AND p.status = 'completed'
    `, [instructorId]);

    res.json({
        success: true,
        data: {
            period,
            earnings: result.rows.map(r => ({
                date: r.date,
                amount: parseFloat(r.earnings),
                transactions: parseInt(r.transactions)
            })),
            total: parseFloat(totalResult.rows[0].total),
            totalTransactions: parseInt(totalResult.rows[0].total_transactions)
        }
    });
});

/**
 * @desc    Get instructor notifications
 * @route   GET /api/v1/instructor/notifications
 * @access  Private/Instructor
 */
const getInstructorNotifications = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE user_id = $1';
    if (unreadOnly === 'true') {
        whereClause += ' AND is_read = false';
    }

    const result = await query(`
        SELECT * FROM notifications ${whereClause}
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
    `, [req.user.id, limit, offset]);

    const unreadCount = await query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
        [req.user.id]
    );

    res.json({
        success: true,
        data: {
            notifications: result.rows.map(n => ({
                id: n.id,
                type: n.type,
                title: n.title,
                message: n.message,
                data: n.data,
                isRead: n.is_read,
                createdAt: n.created_at
            })),
            unreadCount: parseInt(unreadCount.rows[0].count)
        }
    });
});

/**
 * @desc    Mark notifications as read
 * @route   PUT /api/v1/instructor/notifications/read
 * @access  Private/Instructor
 */
const markNotificationsRead = asyncHandler(async (req, res) => {
    const { notificationIds } = req.body;

    if (notificationIds && notificationIds.length > 0) {
        await query(`
            UPDATE notifications 
            SET is_read = true, read_at = CURRENT_TIMESTAMP 
            WHERE id = ANY($1) AND user_id = $2
        `, [notificationIds, req.user.id]);
    } else {
        await query(`
            UPDATE notifications 
            SET is_read = true, read_at = CURRENT_TIMESTAMP 
            WHERE user_id = $1 AND is_read = false
        `, [req.user.id]);
    }

    res.json({
        success: true,
        message: 'Notifications marked as read'
    });
});

module.exports = {
    getInstructorDashboard,
    getInstructorStudents,
    getInstructorReviews,
    getInstructorEarnings,
    getInstructorNotifications,
    markNotificationsRead
};
