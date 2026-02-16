const { query, transaction } = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/error.middleware');

/**
 * @desc    Get user's enrollments
 * @route   GET /api/v1/enrollments
 * @access  Private
 */
const getMyEnrollments = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE e.user_id = $1';
    const params = [req.user.id];
    let paramIndex = 2;

    if (status) {
        whereClause += ` AND e.status = $${paramIndex++}`;
        params.push(status);
    }

    const countResult = await query(
        `SELECT COUNT(*) FROM enrollments e ${whereClause}`,
        params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
        `SELECT e.id, e.status, e.enrolled_at, e.progress_percentage, e.last_accessed_at,
            e.completed_at,
            c.id as course_id, c.title as course_title, c.slug as course_slug,
            c.thumbnail_url, c.duration_hours,
            u.first_name as instructor_first_name, u.last_name as instructor_last_name
     FROM enrollments e
     JOIN courses c ON e.course_id = c.id
     JOIN users u ON c.instructor_id = u.id
     ${whereClause}
     ORDER BY e.last_accessed_at DESC NULLS LAST, e.enrolled_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset]
    );

    res.json({
        success: true,
        data: {
            enrollments: result.rows.map(e => ({
                id: e.id,
                status: e.status,
                enrolledAt: e.enrolled_at,
                progressPercentage: parseFloat(e.progress_percentage),
                lastAccessedAt: e.last_accessed_at,
                completedAt: e.completed_at,
                course: {
                    id: e.course_id,
                    title: e.course_title,
                    slug: e.course_slug,
                    thumbnailUrl: e.thumbnail_url,
                    durationHours: parseFloat(e.duration_hours),
                    instructor: {
                        firstName: e.instructor_first_name,
                        lastName: e.instructor_last_name
                    }
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
 * @desc    Get single enrollment
 * @route   GET /api/v1/enrollments/:id
 * @access  Private
 */
const getEnrollmentById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await query(
        `SELECT e.*, 
            c.id as course_id, c.title as course_title, c.slug as course_slug,
            c.thumbnail_url, c.duration_hours, c.instructor_id,
            u.first_name as instructor_first_name, u.last_name as instructor_last_name
     FROM enrollments e
     JOIN courses c ON e.course_id = c.id
     JOIN users u ON c.instructor_id = u.id
     WHERE e.id = $1`,
        [id]
    );

    if (result.rows.length === 0) {
        throw new ApiError(404, 'Enrollment not found');
    }

    const enrollment = result.rows[0];

    // Check access
    if (req.user.role !== 'admin' &&
        req.user.id !== enrollment.user_id &&
        req.user.id !== enrollment.instructor_id) {
        throw new ApiError(403, 'Access denied');
    }

    // Get lesson progress
    const progressResult = await query(
        `SELECT p.lesson_id, p.is_completed, p.completed_at, p.watch_time,
            l.title as lesson_title
     FROM progress p
     JOIN lessons l ON p.lesson_id = l.id
     WHERE p.enrollment_id = $1
     ORDER BY l.order_index`,
        [id]
    );

    res.json({
        success: true,
        data: {
            id: enrollment.id,
            status: enrollment.status,
            enrolledAt: enrollment.enrolled_at,
            progressPercentage: parseFloat(enrollment.progress_percentage),
            lastAccessedAt: enrollment.last_accessed_at,
            completedAt: enrollment.completed_at,
            course: {
                id: enrollment.course_id,
                title: enrollment.course_title,
                slug: enrollment.course_slug,
                thumbnailUrl: enrollment.thumbnail_url,
                durationHours: parseFloat(enrollment.duration_hours),
                instructor: {
                    id: enrollment.instructor_id,
                    firstName: enrollment.instructor_first_name,
                    lastName: enrollment.instructor_last_name
                }
            },
            lessonProgress: progressResult.rows.map(p => ({
                lessonId: p.lesson_id,
                lessonTitle: p.lesson_title,
                isCompleted: p.is_completed,
                completedAt: p.completed_at,
                watchTime: p.watch_time
            }))
        }
    });
});

/**
 * @desc    Enroll in a course
 * @route   POST /api/v1/enrollments
 * @access  Private
 */
const enrollInCourse = asyncHandler(async (req, res) => {
    const { courseId } = req.body;

    // Check if course exists and is published
    const courseResult = await query(
        'SELECT id, title, price, status, is_free FROM courses WHERE id = $1',
        [courseId]
    );

    if (courseResult.rows.length === 0) {
        throw new ApiError(404, 'Course not found');
    }

    const course = courseResult.rows[0];

    if (course.status !== 'published') {
        throw new ApiError(400, 'This course is not available for enrollment');
    }

    // Check if already enrolled
    const existingEnrollment = await query(
        'SELECT id, status FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [req.user.id, courseId]
    );

    if (existingEnrollment.rows.length > 0) {
        const existing = existingEnrollment.rows[0];
        if (existing.status === 'active') {
            throw new ApiError(400, 'You are already enrolled in this course');
        }
        if (existing.status === 'completed') {
            throw new ApiError(400, 'You have already completed this course');
        }
    }

    // For paid courses (not free), check if payment is completed
    if (!course.is_free && parseFloat(course.price) > 0) {
        const paymentResult = await query(
            `SELECT id FROM payments 
       WHERE user_id = $1 AND course_id = $2 AND status = 'completed'`,
            [req.user.id, courseId]
        );

        if (paymentResult.rows.length === 0) {
            throw new ApiError(402, 'Payment required to enroll in this course');
        }
    }

    // Create enrollment
    const result = await query(
        `INSERT INTO enrollments (user_id, course_id, status)
     VALUES ($1, $2, 'active')
     ON CONFLICT (user_id, course_id) 
     DO UPDATE SET status = 'active', updated_at = CURRENT_TIMESTAMP
     RETURNING id, status, enrolled_at`,
        [req.user.id, courseId]
    );

    // Update course enrollment count
    await query(
        `UPDATE courses SET enrollment_count = enrollment_count + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
        [courseId]
    );

    res.status(201).json({
        success: true,
        message: 'Successfully enrolled in course',
        data: {
            id: result.rows[0].id,
            courseId,
            courseTitle: course.title,
            status: result.rows[0].status,
            enrolledAt: result.rows[0].enrolled_at
        }
    });
});

/**
 * @desc    Cancel enrollment
 * @route   PUT /api/v1/enrollments/:id/cancel
 * @access  Private
 */
const cancelEnrollment = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Get enrollment
    const enrollmentResult = await query(
        'SELECT * FROM enrollments WHERE id = $1',
        [id]
    );

    if (enrollmentResult.rows.length === 0) {
        throw new ApiError(404, 'Enrollment not found');
    }

    const enrollment = enrollmentResult.rows[0];

    // Check ownership
    if (req.user.role !== 'admin' && enrollment.user_id !== req.user.id) {
        throw new ApiError(403, 'You can only cancel your own enrollments');
    }

    if (enrollment.status === 'cancelled') {
        throw new ApiError(400, 'Enrollment is already cancelled');
    }

    if (enrollment.status === 'completed') {
        throw new ApiError(400, 'Cannot cancel a completed enrollment');
    }

    // Update enrollment status
    await query(
        `UPDATE enrollments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id]
    );

    // Update course enrollment count
    await query(
        `UPDATE courses SET enrollment_count = GREATEST(enrollment_count - 1, 0), updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
        [enrollment.course_id]
    );

    res.json({
        success: true,
        message: 'Enrollment cancelled successfully'
    });
});

/**
 * @desc    Get course enrollments (instructor/admin)
 * @route   GET /api/v1/enrollments/course/:courseId
 * @access  Private/Instructor
 */
const getCourseEnrollments = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    // Check course ownership
    const courseResult = await query(
        'SELECT instructor_id FROM courses WHERE id = $1',
        [courseId]
    );

    if (courseResult.rows.length === 0) {
        throw new ApiError(404, 'Course not found');
    }

    if (req.user.role !== 'admin' && courseResult.rows[0].instructor_id !== req.user.id) {
        throw new ApiError(403, 'Access denied');
    }

    let whereClause = 'WHERE e.course_id = $1';
    const params = [courseId];
    let paramIndex = 2;

    if (status) {
        whereClause += ` AND e.status = $${paramIndex++}`;
        params.push(status);
    }

    const countResult = await query(
        `SELECT COUNT(*) FROM enrollments e ${whereClause}`,
        params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
        `SELECT e.id, e.status, e.enrolled_at, e.progress_percentage, e.last_accessed_at,
            e.completed_at,
            u.id as user_id, u.first_name, u.last_name, u.email, u.avatar_url
     FROM enrollments e
     JOIN users u ON e.user_id = u.id
     ${whereClause}
     ORDER BY e.enrolled_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset]
    );

    res.json({
        success: true,
        data: {
            enrollments: result.rows.map(e => ({
                id: e.id,
                status: e.status,
                enrolledAt: e.enrolled_at,
                progressPercentage: parseFloat(e.progress_percentage),
                lastAccessedAt: e.last_accessed_at,
                completedAt: e.completed_at,
                user: {
                    id: e.user_id,
                    firstName: e.first_name,
                    lastName: e.last_name,
                    email: e.email,
                    avatarUrl: e.avatar_url
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
 * @desc    Get all enrollments (admin)
 * @route   GET /api/v1/enrollments/all
 * @access  Private/Admin
 */
const getAllEnrollments = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, courseId, userId } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (status) {
        whereClause += ` AND e.status = $${paramIndex++}`;
        params.push(status);
    }

    if (courseId) {
        whereClause += ` AND e.course_id = $${paramIndex++}`;
        params.push(courseId);
    }

    if (userId) {
        whereClause += ` AND e.user_id = $${paramIndex++}`;
        params.push(userId);
    }

    const countResult = await query(
        `SELECT COUNT(*) FROM enrollments e ${whereClause}`,
        params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
        `SELECT e.id, e.status, e.enrolled_at, e.progress_percentage, e.completed_at,
            c.id as course_id, c.title as course_title,
            u.id as user_id, u.first_name, u.last_name, u.email
     FROM enrollments e
     JOIN courses c ON e.course_id = c.id
     JOIN users u ON e.user_id = u.id
     ${whereClause}
     ORDER BY e.enrolled_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset]
    );

    res.json({
        success: true,
        data: {
            enrollments: result.rows.map(e => ({
                id: e.id,
                status: e.status,
                enrolledAt: e.enrolled_at,
                progressPercentage: parseFloat(e.progress_percentage),
                completedAt: e.completed_at,
                course: {
                    id: e.course_id,
                    title: e.course_title
                },
                user: {
                    id: e.user_id,
                    firstName: e.first_name,
                    lastName: e.last_name,
                    email: e.email
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

module.exports = {
    getMyEnrollments,
    getEnrollmentById,
    enrollInCourse,
    cancelEnrollment,
    getCourseEnrollments,
    getAllEnrollments
};
