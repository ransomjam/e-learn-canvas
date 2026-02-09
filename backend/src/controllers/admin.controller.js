const { query } = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/error.middleware');
const { logWithState, AUDIT_ACTIONS } = require('../middleware/audit.middleware');

// =====================
// USER MANAGEMENT
// =====================

/**
 * @desc    Get all users with advanced filters
 * @route   GET /api/v1/admin/users
 * @access  Private/Admin
 */
const getAdminUsers = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 20,
        search,
        role,
        status,
        isBanned,
        sortBy = 'created_at',
        sortOrder = 'desc'
    } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (search) {
        whereClause += ` AND (email ILIKE $${paramIndex} OR first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
    }

    if (role) {
        whereClause += ` AND role = $${paramIndex++}`;
        params.push(role);
    }

    if (status) {
        whereClause += ` AND is_active = $${paramIndex++}`;
        params.push(status === 'active');
    }

    if (isBanned !== undefined) {
        whereClause += ` AND is_banned = $${paramIndex++}`;
        params.push(isBanned === 'true');
    }

    const validSortColumns = ['created_at', 'email', 'first_name', 'last_name', 'role'];
    const orderBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const countResult = await query(
        `SELECT COUNT(*) FROM users ${whereClause}`,
        params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
        `SELECT id, email, first_name, last_name, role, avatar_url, 
            is_active, is_banned, banned_at, ban_reason, created_at, last_login
     FROM users
     ${whereClause}
     ORDER BY ${orderBy} ${order}
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset]
    );

    res.json({
        success: true,
        data: {
            users: result.rows.map(u => ({
                id: u.id,
                email: u.email,
                firstName: u.first_name,
                lastName: u.last_name,
                role: u.role,
                avatarUrl: u.avatar_url,
                isActive: u.is_active,
                isBanned: u.is_banned,
                bannedAt: u.banned_at,
                banReason: u.ban_reason,
                createdAt: u.created_at,
                lastLoginAt: u.last_login
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
 * @desc    Ban a user
 * @route   PUT /api/v1/admin/users/:id/ban
 * @access  Private/Admin
 */
const banUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason, expiresAt } = req.body;

    // Can't ban yourself or other admins
    if (id === req.user.id) {
        throw new ApiError(400, 'You cannot ban yourself');
    }

    const userResult = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
        throw new ApiError(404, 'User not found');
    }

    const user = userResult.rows[0];
    if (user.role === 'admin') {
        throw new ApiError(400, 'Cannot ban admin users');
    }

    const oldValues = { is_banned: user.is_banned };

    await query(
        `UPDATE users 
     SET is_banned = true, 
         banned_at = CURRENT_TIMESTAMP,
         banned_by = $1,
         ban_reason = $2,
         ban_expires_at = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $4`,
        [req.user.id, reason, expiresAt || null, id]
    );

    // Invalidate user's refresh tokens
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [id]);

    await logWithState(req, AUDIT_ACTIONS.USER_BAN, 'user', id, oldValues, {
        is_banned: true,
        reason,
        expiresAt
    });

    res.json({
        success: true,
        message: 'User banned successfully'
    });
});

/**
 * @desc    Unban a user
 * @route   PUT /api/v1/admin/users/:id/unban
 * @access  Private/Admin
 */
const unbanUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const userResult = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
        throw new ApiError(404, 'User not found');
    }

    await query(
        `UPDATE users 
     SET is_banned = false, 
         banned_at = NULL,
         banned_by = NULL,
         ban_reason = NULL,
         ban_expires_at = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
        [id]
    );

    await logWithState(req, AUDIT_ACTIONS.USER_UNBAN, 'user', id, { is_banned: true }, { is_banned: false });

    res.json({
        success: true,
        message: 'User unbanned successfully'
    });
});

/**
 * @desc    Bulk user actions
 * @route   POST /api/v1/admin/users/bulk
 * @access  Private/Admin
 */
const bulkUserAction = asyncHandler(async (req, res) => {
    const { userIds, action, data } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        throw new ApiError(400, 'User IDs are required');
    }

    // Filter out admin's own ID
    const filteredIds = userIds.filter(id => id !== req.user.id);

    let result;
    switch (action) {
        case 'activate':
            result = await query(
                `UPDATE users SET is_active = true, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ANY($1) AND role != 'admin'
         RETURNING id`,
                [filteredIds]
            );
            break;

        case 'deactivate':
            result = await query(
                `UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ANY($1) AND role != 'admin'
         RETURNING id`,
                [filteredIds]
            );
            break;

        case 'change_role':
            if (!data?.role) {
                throw new ApiError(400, 'Role is required');
            }
            result = await query(
                `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ANY($2) AND role != 'admin'
         RETURNING id`,
                [data.role, filteredIds]
            );
            break;

        case 'delete':
            result = await query(
                `DELETE FROM users WHERE id = ANY($1) AND role != 'admin'
         RETURNING id`,
                [filteredIds]
            );
            break;

        default:
            throw new ApiError(400, 'Invalid action');
    }

    res.json({
        success: true,
        message: `Bulk ${action} completed`,
        data: {
            affectedCount: result.rowCount
        }
    });
});

// =====================
// COURSE MODERATION
// =====================

/**
 * @desc    Get courses pending review
 * @route   GET /api/v1/admin/courses/pending
 * @access  Private/Admin
 */
const getPendingCourses = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const countResult = await query(
        "SELECT COUNT(*) FROM courses WHERE moderation_status = 'pending_review'"
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
        `SELECT c.*, u.first_name as instructor_first, u.last_name as instructor_last, u.email as instructor_email,
            cat.name as category_name
     FROM courses c
     JOIN users u ON c.instructor_id = u.id
     LEFT JOIN categories cat ON c.category_id = cat.id
     WHERE c.moderation_status = 'pending_review'
     ORDER BY c.submitted_for_review_at ASC
     LIMIT $1 OFFSET $2`,
        [limit, offset]
    );

    res.json({
        success: true,
        data: {
            courses: result.rows.map(c => ({
                id: c.id,
                title: c.title,
                slug: c.slug,
                description: c.short_description,
                thumbnailUrl: c.thumbnail_url,
                price: parseFloat(c.price),
                level: c.level,
                category: c.category_name,
                submittedAt: c.submitted_for_review_at,
                instructor: {
                    id: c.instructor_id,
                    name: `${c.instructor_first} ${c.instructor_last}`,
                    email: c.instructor_email
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
 * @desc    Approve a course
 * @route   PUT /api/v1/admin/courses/:id/approve
 * @access  Private/Admin
 */
const approveCourse = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const courseResult = await query('SELECT * FROM courses WHERE id = $1', [id]);
    if (courseResult.rows.length === 0) {
        throw new ApiError(404, 'Course not found');
    }

    const course = courseResult.rows[0];
    if (course.moderation_status !== 'pending_review') {
        throw new ApiError(400, 'Course is not pending review');
    }

    await query(
        `UPDATE courses 
     SET moderation_status = 'approved',
         status = 'published',
         reviewed_at = CURRENT_TIMESTAMP,
         reviewed_by = $1,
         published_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
        [req.user.id, id]
    );

    await logWithState(req, AUDIT_ACTIONS.COURSE_APPROVE, 'course', id,
        { moderation_status: 'pending_review' },
        { moderation_status: 'approved' }
    );

    // Create notification for instructor
    await query(
        `INSERT INTO notifications (user_id, type, title, message, data)
     VALUES ($1, 'course_approved', 'Course Approved', $2, $3)`,
        [
            course.instructor_id,
            `Your course "${course.title}" has been approved and is now published!`,
            JSON.stringify({ courseId: id })
        ]
    );

    res.json({
        success: true,
        message: 'Course approved and published'
    });
});

/**
 * @desc    Reject a course
 * @route   PUT /api/v1/admin/courses/:id/reject
 * @access  Private/Admin
 */
const rejectCourse = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
        throw new ApiError(400, 'Rejection reason is required');
    }

    const courseResult = await query('SELECT * FROM courses WHERE id = $1', [id]);
    if (courseResult.rows.length === 0) {
        throw new ApiError(404, 'Course not found');
    }

    const course = courseResult.rows[0];

    await query(
        `UPDATE courses 
     SET moderation_status = 'rejected',
         status = 'draft',
         reviewed_at = CURRENT_TIMESTAMP,
         reviewed_by = $1,
         rejection_reason = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
        [req.user.id, reason, id]
    );

    await logWithState(req, AUDIT_ACTIONS.COURSE_REJECT, 'course', id,
        { moderation_status: course.moderation_status },
        { moderation_status: 'rejected', reason }
    );

    // Notify instructor
    await query(
        `INSERT INTO notifications (user_id, type, title, message, data)
     VALUES ($1, 'course_rejected', 'Course Rejected', $2, $3)`,
        [
            course.instructor_id,
            `Your course "${course.title}" requires changes: ${reason}`,
            JSON.stringify({ courseId: id, reason })
        ]
    );

    res.json({
        success: true,
        message: 'Course rejected'
    });
});

// =====================
// TRANSACTIONS & REFUNDS
// =====================

/**
 * @desc    Get all transactions
 * @route   GET /api/v1/admin/transactions
 * @access  Private/Admin
 */
const getTransactions = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 20,
        status,
        startDate,
        endDate,
        search
    } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (status) {
        whereClause += ` AND p.status = $${paramIndex++}`;
        params.push(status);
    }

    if (startDate) {
        whereClause += ` AND p.created_at >= $${paramIndex++}`;
        params.push(startDate);
    }

    if (endDate) {
        whereClause += ` AND p.created_at <= $${paramIndex++}`;
        params.push(endDate);
    }

    if (search) {
        whereClause += ` AND (p.transaction_id ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR c.title ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
    }

    const countResult = await query(
        `SELECT COUNT(*) FROM payments p 
     JOIN users u ON p.user_id = u.id
     JOIN courses c ON p.course_id = c.id
     ${whereClause}`,
        params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
        `SELECT p.*, 
            u.email as user_email, u.first_name, u.last_name,
            c.title as course_title,
            i.email as instructor_email
     FROM payments p
     JOIN users u ON p.user_id = u.id
     JOIN courses c ON p.course_id = c.id
     JOIN users i ON c.instructor_id = i.id
     ${whereClause}
     ORDER BY p.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset]
    );

    res.json({
        success: true,
        data: {
            transactions: result.rows.map(t => ({
                id: t.id,
                transactionId: t.transaction_id,
                amount: parseFloat(t.amount),
                currency: t.currency,
                status: t.status,
                paymentMethod: t.payment_method,
                createdAt: t.created_at,
                paidAt: t.paid_at,
                refundedAt: t.refunded_at,
                refundAmount: t.refund_amount ? parseFloat(t.refund_amount) : null,
                user: {
                    id: t.user_id,
                    email: t.user_email,
                    name: `${t.first_name} ${t.last_name}`
                },
                course: {
                    id: t.course_id,
                    title: t.course_title,
                    instructorEmail: t.instructor_email
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
 * @desc    Process refund
 * @route   POST /api/v1/admin/refunds
 * @access  Private/Admin
 */
const processRefund = asyncHandler(async (req, res) => {
    const { paymentId, amount, reason } = req.body;

    const paymentResult = await query('SELECT * FROM payments WHERE id = $1', [paymentId]);
    if (paymentResult.rows.length === 0) {
        throw new ApiError(404, 'Payment not found');
    }

    const payment = paymentResult.rows[0];

    if (payment.status !== 'completed') {
        throw new ApiError(400, 'Only completed payments can be refunded');
    }

    const refundAmount = amount || payment.amount;
    if (refundAmount > parseFloat(payment.amount)) {
        throw new ApiError(400, 'Refund amount exceeds payment amount');
    }

    await query(
        `UPDATE payments 
     SET status = 'refunded',
         refund_amount = $1,
         refund_reason = $2,
         refunded_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
        [refundAmount, reason, paymentId]
    );

    // Cancel enrollment if exists
    if (payment.enrollment_id) {
        await query(
            "UPDATE enrollments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [payment.enrollment_id]
        );
    }

    await logWithState(req, AUDIT_ACTIONS.PAYMENT_REFUND, 'payment', paymentId,
        { status: 'completed' },
        { status: 'refunded', refundAmount, reason }
    );

    // Notify user
    await query(
        `INSERT INTO notifications (user_id, type, title, message, data)
     VALUES ($1, 'refund_processed', 'Refund Processed', $2, $3)`,
        [
            payment.user_id,
            `Your payment of $${refundAmount} has been refunded.`,
            JSON.stringify({ paymentId, refundAmount })
        ]
    );

    res.json({
        success: true,
        message: 'Refund processed successfully',
        data: {
            paymentId,
            refundAmount: parseFloat(refundAmount)
        }
    });
});

// =====================
// AUDIT LOGS
// =====================

/**
 * @desc    Get audit logs
 * @route   GET /api/v1/admin/audit-logs
 * @access  Private/Admin
 */
const getAuditLogs = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 50,
        userId,
        action,
        entityType,
        startDate,
        endDate
    } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (userId) {
        whereClause += ` AND a.user_id = $${paramIndex++}`;
        params.push(userId);
    }

    if (action) {
        whereClause += ` AND a.action ILIKE $${paramIndex++}`;
        params.push(`%${action}%`);
    }

    if (entityType) {
        whereClause += ` AND a.entity_type = $${paramIndex++}`;
        params.push(entityType);
    }

    if (startDate) {
        whereClause += ` AND a.created_at >= $${paramIndex++}`;
        params.push(startDate);
    }

    if (endDate) {
        whereClause += ` AND a.created_at <= $${paramIndex++}`;
        params.push(endDate);
    }

    const countResult = await query(
        `SELECT COUNT(*) FROM audit_logs a ${whereClause}`,
        params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
        `SELECT a.*, u.email as user_email, u.first_name, u.last_name
     FROM audit_logs a
     LEFT JOIN users u ON a.user_id = u.id
     ${whereClause}
     ORDER BY a.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset]
    );

    res.json({
        success: true,
        data: {
            logs: result.rows.map(l => ({
                id: l.id,
                action: l.action,
                entityType: l.entity_type,
                entityId: l.entity_id,
                oldValues: l.old_values,
                newValues: l.new_values,
                ipAddress: l.ip_address,
                userAgent: l.user_agent,
                createdAt: l.created_at,
                user: l.user_id ? {
                    id: l.user_id,
                    email: l.user_email,
                    name: `${l.first_name} ${l.last_name}`
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

// =====================
// SYSTEM SETTINGS
// =====================

/**
 * @desc    Get system settings
 * @route   GET /api/v1/admin/settings
 * @access  Private/Admin
 */
const getSettings = asyncHandler(async (req, res) => {
    const result = await query('SELECT key, value, description FROM system_settings');

    const settings = result.rows.reduce((acc, s) => {
        acc[s.key] = {
            value: s.value,
            description: s.description
        };
        return acc;
    }, {});

    res.json({
        success: true,
        data: settings
    });
});

/**
 * @desc    Update system settings
 * @route   PUT /api/v1/admin/settings
 * @access  Private/Admin
 */
const updateSettings = asyncHandler(async (req, res) => {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
        throw new ApiError(400, 'Settings object is required');
    }

    for (const [key, value] of Object.entries(settings)) {
        await query(
            `UPDATE system_settings 
       SET value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE key = $3`,
            [JSON.stringify(value), req.user.id, key]
        );
    }

    await logWithState(req, AUDIT_ACTIONS.SETTINGS_UPDATE, 'settings', null, null, settings);

    res.json({
        success: true,
        message: 'Settings updated successfully'
    });
});

// =====================
// NOTIFICATIONS
// =====================

/**
 * @desc    Get user notifications
 * @route   GET /api/v1/admin/notifications
 * @access  Private
 */
const getNotifications = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE user_id = $1';
    if (unreadOnly === 'true') {
        whereClause += ' AND is_read = false';
    }

    const result = await query(
        `SELECT * FROM notifications ${whereClause}
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
        [req.user.id, limit, offset]
    );

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
 * @route   PUT /api/v1/admin/notifications/read
 * @access  Private
 */
const markNotificationsRead = asyncHandler(async (req, res) => {
    const { notificationIds } = req.body;

    if (notificationIds && notificationIds.length > 0) {
        await query(
            `UPDATE notifications 
       SET is_read = true, read_at = CURRENT_TIMESTAMP 
       WHERE id = ANY($1) AND user_id = $2`,
            [notificationIds, req.user.id]
        );
    } else {
        await query(
            `UPDATE notifications 
       SET is_read = true, read_at = CURRENT_TIMESTAMP 
       WHERE user_id = $1 AND is_read = false`,
            [req.user.id]
        );
    }

    res.json({
        success: true,
        message: 'Notifications marked as read'
    });
});

// =====================
// GET ALL COURSES (Admin)
// =====================

/**
 * @desc    Get all courses for admin
 * @route   GET /api/v1/admin/courses
 * @access  Private/Admin
 */
const getAllCourses = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, status, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (status) {
        whereClause += ` AND c.status = $${paramIndex++}`;
        params.push(status);
    }

    if (search) {
        whereClause += ` AND (c.title ILIKE $${paramIndex} OR c.short_description ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
    }

    // Get stats
    const statsResult = await query(`
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'published') as published,
            COUNT(*) FILTER (WHERE status = 'draft') as draft,
            COUNT(*) FILTER (WHERE moderation_status = 'pending_review') as pending
        FROM courses
    `);

    const countResult = await query(
        `SELECT COUNT(*) FROM courses c ${whereClause}`,
        params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
        `SELECT c.*, 
            u.first_name as instructor_first, u.last_name as instructor_last,
            (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) as enrollment_count
        FROM courses c
        JOIN users u ON c.instructor_id = u.id
        ${whereClause}
        ORDER BY c.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset]
    );

    res.json({
        success: true,
        data: {
            courses: result.rows.map(c => ({
                id: c.id,
                title: c.title,
                slug: c.slug,
                status: c.status,
                moderationStatus: c.moderation_status,
                price: parseFloat(c.price || 0),
                thumbnailUrl: c.thumbnail_url,
                enrollmentCount: parseInt(c.enrollment_count || 0),
                createdAt: c.created_at,
                instructor: {
                    id: c.instructor_id,
                    firstName: c.instructor_first,
                    lastName: c.instructor_last
                }
            })),
            stats: {
                total: parseInt(statsResult.rows[0].total),
                published: parseInt(statsResult.rows[0].published),
                draft: parseInt(statsResult.rows[0].draft),
                pending: parseInt(statsResult.rows[0].pending)
            },
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
 * @desc    Refund a transaction by ID
 * @route   POST /api/v1/admin/transactions/:id/refund
 * @access  Private/Admin
 */
const refundTransaction = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    const paymentResult = await query('SELECT * FROM payments WHERE id = $1', [id]);
    if (paymentResult.rows.length === 0) {
        throw new ApiError(404, 'Payment not found');
    }

    const payment = paymentResult.rows[0];

    if (payment.status !== 'completed') {
        throw new ApiError(400, 'Only completed payments can be refunded');
    }

    const refundAmount = payment.amount;

    await query(
        `UPDATE payments 
     SET status = 'refunded',
         refund_amount = $1,
         refund_reason = $2,
         refunded_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
        [refundAmount, reason || 'Admin refund', id]
    );

    // Cancel enrollment if exists
    if (payment.enrollment_id) {
        await query(
            "UPDATE enrollments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [payment.enrollment_id]
        );
    }

    await logWithState(req, AUDIT_ACTIONS.PAYMENT_REFUND, 'payment', id,
        { status: 'completed' },
        { status: 'refunded', refundAmount, reason }
    );

    // Notify user
    await query(
        `INSERT INTO notifications (user_id, type, title, message, data)
     VALUES ($1, 'refund_processed', 'Refund Processed', $2, $3)`,
        [
            payment.user_id,
            `Your payment of $${refundAmount} has been refunded.`,
            JSON.stringify({ paymentId: id, refundAmount })
        ]
    );

    res.json({
        success: true,
        message: 'Refund processed successfully',
        data: {
            paymentId: id,
            refundAmount: parseFloat(refundAmount)
        }
    });
});

module.exports = {
    // Users
    getAdminUsers,
    banUser,
    unbanUser,
    bulkUserAction,

    // Courses
    getPendingCourses,
    getAllCourses,
    approveCourse,
    rejectCourse,

    // Transactions
    getTransactions,
    processRefund,
    refundTransaction,

    // Audit
    getAuditLogs,

    // Settings
    getSettings,
    updateSettings,

    // Notifications
    getNotifications,
    markNotificationsRead
};
