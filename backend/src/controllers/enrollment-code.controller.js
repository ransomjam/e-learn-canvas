const { query, transaction } = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/error.middleware');
const crypto = require('crypto');

/**
 * Generate a unique enrollment code (format: ENR-XXXX-XXXX)
 */
function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion
    let code = 'ENR-';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code += '-';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// =====================
// ADMIN: Generate enrollment codes
// =====================

/**
 * @desc    Generate enrollment codes for a course
 * @route   POST /api/v1/admin/enrollment-codes/generate
 * @access  Private/Admin
 */
const generateEnrollmentCodes = asyncHandler(async (req, res) => {
    const { courseId, count = 1, expiresAt } = req.body;

    if (!courseId) {
        throw new ApiError(400, 'Course ID is required');
    }

    if (count < 1 || count > 100) {
        throw new ApiError(400, 'Count must be between 1 and 100');
    }

    // Verify course exists
    const courseResult = await query(
        'SELECT id, title FROM courses WHERE id = $1',
        [courseId]
    );

    if (courseResult.rows.length === 0) {
        throw new ApiError(404, 'Course not found');
    }

    const codes = [];
    const generatedCodes = new Set();

    // Generate unique codes
    while (codes.length < count) {
        const code = generateCode();
        if (!generatedCodes.has(code)) {
            generatedCodes.add(code);

            // Check uniqueness in DB
            const existing = await query('SELECT id FROM enrollment_codes WHERE code = $1', [code]);
            if (existing.rows.length === 0) {
                codes.push(code);
            }
        }
    }

    // Insert all codes
    const insertedCodes = [];
    for (const code of codes) {
        const result = await query(
            `INSERT INTO enrollment_codes (code, course_id, created_by, expires_at)
             VALUES ($1, $2, $3, $4)
             RETURNING id, code, course_id, is_used, expires_at, created_at`,
            [code, courseId, req.user.id, expiresAt || null]
        );
        insertedCodes.push(result.rows[0]);
    }

    res.status(201).json({
        success: true,
        message: `Generated ${count} enrollment code(s)`,
        data: {
            codes: insertedCodes.map(c => ({
                id: c.id,
                code: c.code,
                courseId: c.course_id,
                isUsed: c.is_used,
                expiresAt: c.expires_at,
                createdAt: c.created_at
            })),
            course: courseResult.rows[0]
        }
    });
});

/**
 * @desc    Get all enrollment codes (with filters)
 * @route   GET /api/v1/admin/enrollment-codes
 * @access  Private/Admin
 */
const getEnrollmentCodes = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, courseId, isUsed, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (courseId) {
        whereClause += ` AND ec.course_id = $${paramIndex++}`;
        params.push(courseId);
    }

    if (isUsed !== undefined) {
        whereClause += ` AND ec.is_used = $${paramIndex++}`;
        params.push(isUsed === 'true');
    }

    if (search) {
        whereClause += ` AND ec.code ILIKE $${paramIndex++}`;
        params.push(`%${search}%`);
    }

    const countResult = await query(
        `SELECT COUNT(*) FROM enrollment_codes ec ${whereClause}`,
        params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
        `SELECT ec.id, ec.code, ec.course_id, ec.is_used, ec.used_at, ec.expires_at, ec.created_at,
                c.title as course_title,
                u_created.first_name as created_by_first_name, u_created.last_name as created_by_last_name,
                u_used.first_name as used_by_first_name, u_used.last_name as used_by_last_name, u_used.email as used_by_email
         FROM enrollment_codes ec
         JOIN courses c ON ec.course_id = c.id
         JOIN users u_created ON ec.created_by = u_created.id
         LEFT JOIN users u_used ON ec.used_by = u_used.id
         ${whereClause}
         ORDER BY ec.created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset]
    );

    res.json({
        success: true,
        data: {
            codes: result.rows.map(c => ({
                id: c.id,
                code: c.code,
                courseId: c.course_id,
                courseTitle: c.course_title,
                isUsed: c.is_used,
                usedAt: c.used_at,
                expiresAt: c.expires_at,
                createdAt: c.created_at,
                createdBy: `${c.created_by_first_name} ${c.created_by_last_name}`,
                usedBy: c.used_by_first_name ? {
                    name: `${c.used_by_first_name} ${c.used_by_last_name}`,
                    email: c.used_by_email
                } : null
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
 * @desc    Delete an enrollment code
 * @route   DELETE /api/v1/admin/enrollment-codes/:id
 * @access  Private/Admin
 */
const deleteEnrollmentCode = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await query(
        'DELETE FROM enrollment_codes WHERE id = $1 AND is_used = false RETURNING id',
        [id]
    );

    if (result.rows.length === 0) {
        throw new ApiError(404, 'Code not found or already used');
    }

    res.json({
        success: true,
        message: 'Enrollment code deleted'
    });
});

// =====================
// STUDENT: Redeem enrollment code
// =====================

/**
 * @desc    Redeem an enrollment code
 * @route   POST /api/v1/enrollments/redeem-code
 * @access  Private
 */
const redeemEnrollmentCode = asyncHandler(async (req, res) => {
    const { code } = req.body;

    if (!code) {
        throw new ApiError(400, 'Enrollment code is required');
    }

    const trimmedCode = code.trim().toUpperCase();

    // Find the code
    const codeResult = await query(
        `SELECT ec.*, c.title as course_title, c.status as course_status
         FROM enrollment_codes ec
         JOIN courses c ON ec.course_id = c.id
         WHERE ec.code = $1`,
        [trimmedCode]
    );

    if (codeResult.rows.length === 0) {
        throw new ApiError(404, 'Invalid enrollment code');
    }

    const enrollmentCode = codeResult.rows[0];

    if (enrollmentCode.is_used) {
        throw new ApiError(400, 'This enrollment code has already been used');
    }

    if (enrollmentCode.expires_at && new Date(enrollmentCode.expires_at) < new Date()) {
        throw new ApiError(400, 'This enrollment code has expired');
    }

    if (enrollmentCode.course_status !== 'published') {
        throw new ApiError(400, 'This course is not available for enrollment');
    }

    // Check if already enrolled
    const existingEnrollment = await query(
        "SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2 AND status IN ('active', 'completed')",
        [req.user.id, enrollmentCode.course_id]
    );

    if (existingEnrollment.rows.length > 0) {
        throw new ApiError(400, 'You are already enrolled in this course');
    }

    // Use transaction to redeem code and create enrollment atomically
    const result = await transaction(async (client) => {
        // Mark code as used
        await client.query(
            `UPDATE enrollment_codes 
             SET is_used = true, used_by = $1, used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [req.user.id, enrollmentCode.id]
        );

        // Create enrollment
        const enrollmentResult = await client.query(
            `INSERT INTO enrollments (user_id, course_id, status)
             VALUES ($1, $2, 'active')
             ON CONFLICT (user_id, course_id) DO UPDATE SET status = 'active'
             RETURNING id`,
            [req.user.id, enrollmentCode.course_id]
        );

        // Update course enrollment count
        await client.query(
            'UPDATE courses SET enrollment_count = enrollment_count + 1 WHERE id = $1',
            [enrollmentCode.course_id]
        );

        return enrollmentResult.rows[0];
    });

    res.json({
        success: true,
        message: 'Enrollment code redeemed successfully',
        data: {
            enrollmentId: result.id,
            courseId: enrollmentCode.course_id,
            courseTitle: enrollmentCode.course_title
        }
    });
});

// =====================
// ADMIN: Get users with enrollment info
// =====================

/**
 * @desc    Get users with their enrollment codes and course progress
 * @route   GET /api/v1/admin/users/enrollments
 * @access  Private/Admin
 */
const getUsersWithEnrollments = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE u.role = 'learner'";
    const params = [];
    let paramIndex = 1;

    if (search) {
        whereClause += ` AND (u.email ILIKE $${paramIndex} OR u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
    }

    const countResult = await query(
        `SELECT COUNT(*) FROM users u ${whereClause}`,
        params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get users
    const usersResult = await query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.avatar_url, u.created_at
         FROM users u
         ${whereClause}
         ORDER BY u.created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset]
    );

    // For each user, get their enrollments with progress and enrollment codes used
    const usersWithDetails = await Promise.all(usersResult.rows.map(async (user) => {
        // Get enrollments with progress
        const enrollments = await query(
            `SELECT e.id, e.course_id, e.status, e.progress_percentage, e.enrolled_at,
                    c.title as course_title,
                    (SELECT COUNT(*) FROM progress p WHERE p.enrollment_id = e.id AND p.is_completed = true) as lessons_completed,
                    (SELECT COUNT(*) FROM lessons l WHERE l.course_id = e.course_id) as total_lessons
             FROM enrollments e
             JOIN courses c ON e.course_id = c.id
             WHERE e.user_id = $1
             ORDER BY e.enrolled_at DESC`,
            [user.id]
        );

        // Get enrollment codes used by this user
        const codes = await query(
            `SELECT ec.code, ec.course_id, ec.used_at, c.title as course_title
             FROM enrollment_codes ec
             JOIN courses c ON ec.course_id = c.id
             WHERE ec.used_by = $1
             ORDER BY ec.used_at DESC`,
            [user.id]
        );

        return {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            avatarUrl: user.avatar_url,
            createdAt: user.created_at,
            enrollments: enrollments.rows.map(e => ({
                id: e.id,
                courseId: e.course_id,
                courseTitle: e.course_title,
                status: e.status,
                progressPercentage: parseFloat(e.progress_percentage),
                lessonsCompleted: parseInt(e.lessons_completed),
                totalLessons: parseInt(e.total_lessons),
                enrolledAt: e.enrolled_at
            })),
            enrollmentCodes: codes.rows.map(c => ({
                code: c.code,
                courseId: c.course_id,
                courseTitle: c.course_title,
                usedAt: c.used_at
            }))
        };
    }));

    res.json({
        success: true,
        data: {
            users: usersWithDetails,
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
    generateEnrollmentCodes,
    getEnrollmentCodes,
    deleteEnrollmentCode,
    redeemEnrollmentCode,
    getUsersWithEnrollments
};
