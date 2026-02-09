const { query } = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/error.middleware');

// =====================
// INSTRUCTOR ANALYTICS
// =====================

/**
 * @desc    Get instructor overview stats
 * @route   GET /api/v1/analytics/instructor/overview
 * @access  Private/Instructor
 */
const getInstructorOverview = asyncHandler(async (req, res) => {
    const instructorId = req.user.id;

    // Get overview stats
    const statsResult = await query(`
    SELECT 
      COUNT(DISTINCT c.id) as total_courses,
      COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'published') as published_courses,
      COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'active') as active_students,
      COUNT(DISTINCT e.id) as total_enrollments,
      COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0) as total_revenue,
      COALESCE(AVG(r.rating), 0) as average_rating,
      COUNT(DISTINCT r.id) as total_reviews
    FROM courses c
    LEFT JOIN enrollments e ON c.id = e.course_id
    LEFT JOIN payments p ON c.id = p.course_id
    LEFT JOIN reviews r ON c.id = r.course_id
    WHERE c.instructor_id = $1
  `, [instructorId]);

    // Get this month's stats
    const monthlyResult = await query(`
    SELECT 
      COUNT(DISTINCT e.id) as new_enrollments,
      COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0) as monthly_revenue
    FROM courses c
    LEFT JOIN enrollments e ON c.id = e.course_id AND e.enrolled_at >= DATE_TRUNC('month', CURRENT_DATE)
    LEFT JOIN payments p ON c.id = p.course_id AND p.paid_at >= DATE_TRUNC('month', CURRENT_DATE)
    WHERE c.instructor_id = $1
  `, [instructorId]);

    const stats = statsResult.rows[0];
    const monthly = monthlyResult.rows[0];

    res.json({
        success: true,
        data: {
            totalCourses: parseInt(stats.total_courses),
            publishedCourses: parseInt(stats.published_courses),
            activeStudents: parseInt(stats.active_students),
            totalEnrollments: parseInt(stats.total_enrollments),
            totalRevenue: parseFloat(stats.total_revenue),
            averageRating: parseFloat(stats.average_rating).toFixed(1),
            totalReviews: parseInt(stats.total_reviews),
            thisMonth: {
                newEnrollments: parseInt(monthly.new_enrollments),
                revenue: parseFloat(monthly.monthly_revenue)
            }
        }
    });
});

/**
 * @desc    Get instructor revenue over time
 * @route   GET /api/v1/analytics/instructor/revenue
 * @access  Private/Instructor
 */
const getInstructorRevenue = asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;
    const instructorId = req.user.id;

    let interval, groupBy;
    switch (period) {
        case '7d':
            interval = '7 days';
            groupBy = 'day';
            break;
        case '30d':
            interval = '30 days';
            groupBy = 'day';
            break;
        case '90d':
            interval = '90 days';
            groupBy = 'week';
            break;
        case '1y':
            interval = '1 year';
            groupBy = 'month';
            break;
        default:
            interval = '30 days';
            groupBy = 'day';
    }

    const result = await query(`
    SELECT 
      DATE_TRUNC($1, p.paid_at) as date,
      SUM(p.amount) as revenue,
      COUNT(*) as transactions
    FROM payments p
    JOIN courses c ON p.course_id = c.id
    WHERE c.instructor_id = $2 
      AND p.status = 'completed'
      AND p.paid_at >= CURRENT_DATE - INTERVAL '${interval}'
    GROUP BY DATE_TRUNC($1, p.paid_at)
    ORDER BY date
  `, [groupBy, instructorId]);

    res.json({
        success: true,
        data: {
            period,
            revenue: result.rows.map(r => ({
                date: r.date,
                revenue: parseFloat(r.revenue),
                transactions: parseInt(r.transactions)
            }))
        }
    });
});

/**
 * @desc    Get instructor enrollment trends
 * @route   GET /api/v1/analytics/instructor/enrollments
 * @access  Private/Instructor
 */
const getInstructorEnrollments = asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;
    const instructorId = req.user.id;

    let interval = period === '7d' ? '7 days' : period === '90d' ? '90 days' : '30 days';

    const result = await query(`
    SELECT 
      DATE_TRUNC('day', e.enrolled_at) as date,
      COUNT(*) as enrollments
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    WHERE c.instructor_id = $1 
      AND e.enrolled_at >= CURRENT_DATE - INTERVAL '${interval}'
    GROUP BY DATE_TRUNC('day', e.enrolled_at)
    ORDER BY date
  `, [instructorId]);

    res.json({
        success: true,
        data: {
            period,
            enrollments: result.rows.map(r => ({
                date: r.date,
                count: parseInt(r.enrollments)
            }))
        }
    });
});

/**
 * @desc    Get course-specific analytics
 * @route   GET /api/v1/analytics/instructor/courses/:id
 * @access  Private/Instructor
 */
const getCourseAnalytics = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const instructorId = req.user.id;

    // Verify ownership
    const courseResult = await query(
        'SELECT * FROM courses WHERE id = $1 AND instructor_id = $2',
        [id, instructorId]
    );

    if (courseResult.rows.length === 0) {
        throw new ApiError(404, 'Course not found');
    }

    // Get detailed stats
    const statsResult = await query(`
    SELECT 
      COUNT(DISTINCT e.id) as total_enrollments,
      COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'active') as active_enrollments,
      COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'completed') as completions,
      AVG(e.progress_percentage) as avg_progress,
      COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0) as total_revenue,
      COALESCE(AVG(r.rating), 0) as avg_rating,
      COUNT(DISTINCT r.id) as review_count
    FROM courses c
    LEFT JOIN enrollments e ON c.id = e.course_id
    LEFT JOIN payments p ON c.id = p.course_id
    LEFT JOIN reviews r ON c.id = r.course_id
    WHERE c.id = $1
  `, [id]);

    // Get lesson completion rates
    const lessonStats = await query(`
    SELECT 
      l.id, l.title, l.order_index,
      COUNT(DISTINCT pr.id) as completions,
      COUNT(DISTINCT e.id) as total_enrolled
    FROM lessons l
    JOIN courses c ON l.course_id = c.id
    LEFT JOIN enrollments e ON c.id = e.course_id AND e.status IN ('active', 'completed')
    LEFT JOIN progress pr ON l.id = pr.lesson_id AND pr.is_completed = true
    WHERE c.id = $1
    GROUP BY l.id
    ORDER BY l.order_index
  `, [id]);

    // Get recent enrollments
    const recentEnrollments = await query(`
    SELECT e.enrolled_at, u.first_name, u.last_name
    FROM enrollments e
    JOIN users u ON e.user_id = u.id
    WHERE e.course_id = $1
    ORDER BY e.enrolled_at DESC
    LIMIT 10
  `, [id]);

    const stats = statsResult.rows[0];

    res.json({
        success: true,
        data: {
            courseId: id,
            totalEnrollments: parseInt(stats.total_enrollments),
            activeEnrollments: parseInt(stats.active_enrollments),
            completions: parseInt(stats.completions),
            completionRate: stats.total_enrollments > 0
                ? ((parseInt(stats.completions) / parseInt(stats.total_enrollments)) * 100).toFixed(1)
                : 0,
            avgProgress: parseFloat(stats.avg_progress || 0).toFixed(1),
            totalRevenue: parseFloat(stats.total_revenue),
            avgRating: parseFloat(stats.avg_rating).toFixed(1),
            reviewCount: parseInt(stats.review_count),
            lessonCompletions: lessonStats.rows.map(l => ({
                lessonId: l.id,
                title: l.title,
                completions: parseInt(l.completions),
                totalEnrolled: parseInt(l.total_enrolled),
                completionRate: l.total_enrolled > 0
                    ? ((parseInt(l.completions) / parseInt(l.total_enrolled)) * 100).toFixed(1)
                    : 0
            })),
            recentEnrollments: recentEnrollments.rows.map(e => ({
                enrolledAt: e.enrolled_at,
                studentName: `${e.first_name} ${e.last_name}`
            }))
        }
    });
});

// =====================
// ADMIN ANALYTICS
// =====================

/**
 * @desc    Get admin platform overview
 * @route   GET /api/v1/analytics/admin/overview
 * @access  Private/Admin
 */
const getAdminOverview = asyncHandler(async (req, res) => {
    // Get platform-wide stats
    const statsResult = await query(`
    SELECT 
      (SELECT COUNT(*) FROM users) as total_users,
      (SELECT COUNT(*) FROM users WHERE role = 'instructor') as total_instructors,
      (SELECT COUNT(*) FROM users WHERE role = 'learner') as total_learners,
      (SELECT COUNT(*) FROM users WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) as new_users_this_month,
      (SELECT COUNT(*) FROM courses) as total_courses,
      (SELECT COUNT(*) FROM courses WHERE status = 'published') as published_courses,
      (SELECT COUNT(*) FROM courses WHERE moderation_status = 'pending_review') as pending_courses,
      (SELECT COUNT(*) FROM enrollments) as total_enrollments,
      (SELECT COUNT(*) FROM enrollments WHERE enrolled_at >= DATE_TRUNC('month', CURRENT_DATE)) as enrollments_this_month,
      (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'completed') as total_revenue,
      (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'completed' AND paid_at >= DATE_TRUNC('month', CURRENT_DATE)) as revenue_this_month,
      (SELECT COUNT(*) FROM certificates) as total_certificates
  `);

    const stats = statsResult.rows[0];

    res.json({
        success: true,
        data: {
            users: {
                total: parseInt(stats.total_users),
                instructors: parseInt(stats.total_instructors),
                learners: parseInt(stats.total_learners),
                newThisMonth: parseInt(stats.new_users_this_month)
            },
            courses: {
                total: parseInt(stats.total_courses),
                published: parseInt(stats.published_courses),
                pendingReview: parseInt(stats.pending_courses)
            },
            enrollments: {
                total: parseInt(stats.total_enrollments),
                thisMonth: parseInt(stats.enrollments_this_month)
            },
            revenue: {
                total: parseFloat(stats.total_revenue),
                thisMonth: parseFloat(stats.revenue_this_month)
            },
            certificates: parseInt(stats.total_certificates)
        }
    });
});

/**
 * @desc    Get admin user growth metrics
 * @route   GET /api/v1/analytics/admin/users
 * @access  Private/Admin
 */
const getAdminUserMetrics = asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;
    let interval = period === '7d' ? '7 days' : period === '90d' ? '90 days' : '30 days';

    const result = await query(`
    SELECT 
      DATE_TRUNC('day', created_at) as date,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE role = 'learner') as learners,
      COUNT(*) FILTER (WHERE role = 'instructor') as instructors
    FROM users
    WHERE created_at >= CURRENT_DATE - INTERVAL '${interval}'
    GROUP BY DATE_TRUNC('day', created_at)
    ORDER BY date
  `);

    // Get role distribution
    const roleDistribution = await query(`
    SELECT role, COUNT(*) as count
    FROM users
    GROUP BY role
  `);

    res.json({
        success: true,
        data: {
            period,
            growth: result.rows.map(r => ({
                date: r.date,
                total: parseInt(r.total),
                learners: parseInt(r.learners),
                instructors: parseInt(r.instructors)
            })),
            distribution: roleDistribution.rows.reduce((acc, r) => {
                acc[r.role] = parseInt(r.count);
                return acc;
            }, {})
        }
    });
});

/**
 * @desc    Get admin revenue metrics
 * @route   GET /api/v1/analytics/admin/revenue
 * @access  Private/Admin
 */
const getAdminRevenueMetrics = asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;
    let interval = period === '7d' ? '7 days' : period === '90d' ? '90 days' : period === '1y' ? '1 year' : '30 days';
    let groupBy = period === '1y' ? 'month' : 'day';

    const result = await query(`
    SELECT 
      DATE_TRUNC($1, paid_at) as date,
      SUM(amount) as revenue,
      COUNT(*) as transactions,
      SUM(amount) FILTER (WHERE status = 'refunded') as refunds
    FROM payments
    WHERE paid_at >= CURRENT_DATE - INTERVAL '${interval}'
    GROUP BY DATE_TRUNC($1, paid_at)
    ORDER BY date
  `, [groupBy]);

    // Get top courses by revenue
    const topCourses = await query(`
    SELECT 
      c.id, c.title, c.thumbnail_url,
      SUM(p.amount) as revenue,
      COUNT(p.id) as sales
    FROM payments p
    JOIN courses c ON p.course_id = c.id
    WHERE p.status = 'completed' AND p.paid_at >= CURRENT_DATE - INTERVAL '${interval}'
    GROUP BY c.id
    ORDER BY revenue DESC
    LIMIT 10
  `);

    res.json({
        success: true,
        data: {
            period,
            revenue: result.rows.map(r => ({
                date: r.date,
                revenue: parseFloat(r.revenue || 0),
                transactions: parseInt(r.transactions),
                refunds: parseFloat(r.refunds || 0)
            })),
            topCourses: topCourses.rows.map(c => ({
                id: c.id,
                title: c.title,
                thumbnailUrl: c.thumbnail_url,
                revenue: parseFloat(c.revenue),
                sales: parseInt(c.sales)
            }))
        }
    });
});

/**
 * @desc    Get admin course statistics
 * @route   GET /api/v1/analytics/admin/courses
 * @access  Private/Admin
 */
const getAdminCourseMetrics = asyncHandler(async (req, res) => {
    // Course status distribution
    const statusDist = await query(`
    SELECT status, COUNT(*) as count
    FROM courses
    GROUP BY status
  `);

    // Category distribution
    const categoryDist = await query(`
    SELECT cat.name, COUNT(c.id) as count
    FROM categories cat
    LEFT JOIN courses c ON cat.id = c.category_id
    GROUP BY cat.id
    ORDER BY count DESC
  `);

    // Level distribution
    const levelDist = await query(`
    SELECT level, COUNT(*) as count
    FROM courses
    GROUP BY level
  `);

    // Top rated courses
    const topRated = await query(`
    SELECT id, title, rating_avg, rating_count, enrollment_count
    FROM courses
    WHERE status = 'published' AND rating_count >= 5
    ORDER BY rating_avg DESC
    LIMIT 10
  `);

    res.json({
        success: true,
        data: {
            statusDistribution: statusDist.rows.reduce((acc, r) => {
                acc[r.status] = parseInt(r.count);
                return acc;
            }, {}),
            categoryDistribution: categoryDist.rows.map(c => ({
                category: c.name,
                count: parseInt(c.count)
            })),
            levelDistribution: levelDist.rows.reduce((acc, r) => {
                acc[r.level] = parseInt(r.count);
                return acc;
            }, {}),
            topRatedCourses: topRated.rows.map(c => ({
                id: c.id,
                title: c.title,
                rating: parseFloat(c.rating_avg).toFixed(1),
                reviewCount: parseInt(c.rating_count),
                enrollments: parseInt(c.enrollment_count)
            }))
        }
    });
});

module.exports = {
    // Instructor
    getInstructorOverview,
    getInstructorRevenue,
    getInstructorEnrollments,
    getCourseAnalytics,

    // Admin
    getAdminOverview,
    getAdminUserMetrics,
    getAdminRevenueMetrics,
    getAdminCourseMetrics
};
