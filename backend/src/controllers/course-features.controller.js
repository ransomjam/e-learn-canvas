const { query } = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/error.middleware');

// =====================
// RESOURCES CONTROLLERS
// =====================

/**
 * @desc    Get course resources
 * @route   GET /api/v1/courses/:id/resources
 * @access  Private (Enrolled/Instructor/Admin)
 */
const getResources = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check course existence
    const courseResult = await query(
        'SELECT instructor_id FROM courses WHERE id = $1',
        [id]
    );

    if (courseResult.rows.length === 0) {
        throw new ApiError(404, 'Course not found');
    }

    // Check access — allow admin, instructor, or any enrolled user
    if (req.user.role !== 'admin' && req.user.id !== courseResult.rows[0].instructor_id) {
        const enrollment = await query(
            'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
            [req.user.id, id]
        );
        if (enrollment.rows.length === 0) {
            throw new ApiError(403, 'You must be enrolled to access resources');
        }
    }

    const result = await query(
        'SELECT * FROM course_resources WHERE course_id = $1 ORDER BY created_at DESC',
        [id]
    );

    // Map rows to camelCase for frontend consistency
    const resources = result.rows.map(r => ({
        id: r.id,
        courseId: r.course_id,
        title: r.title,
        description: r.description,
        url: r.url,
        type: r.type,
        originalName: r.original_name || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }));

    res.json({
        success: true,
        data: resources
    });
});

/**
 * @desc    Add a resource to a course
 * @route   POST /api/v1/courses/:id/resources
 * @access  Private (Instructor/Admin)
 */
const addResource = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, url, type = 'link', description, originalName } = req.body;

    // Check course ownership
    const courseResult = await query(
        'SELECT instructor_id FROM courses WHERE id = $1',
        [id]
    );

    if (courseResult.rows.length === 0) {
        throw new ApiError(404, 'Course not found');
    }

    if (req.user.role !== 'admin' && req.user.id !== courseResult.rows[0].instructor_id) {
        throw new ApiError(403, 'You can only add resources to your own courses');
    }

    const result = await query(
        `INSERT INTO course_resources (course_id, title, url, type, description, original_name)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, title, url, type, description, originalName || null]
    );

    const r = result.rows[0];
    res.status(201).json({
        success: true,
        message: 'Resource added successfully',
        data: {
            id: r.id,
            courseId: r.course_id,
            title: r.title,
            description: r.description,
            url: r.url,
            type: r.type,
            originalName: r.original_name || null,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        }
    });
});

/**
 * @desc    Delete a resource
 * @route   DELETE /api/v1/courses/:id/resources/:resourceId
 * @access  Private (Instructor/Admin)
 */
const deleteResource = asyncHandler(async (req, res) => {
    const { id, resourceId } = req.params;

    // Check course ownership logic via the resource
    const resourceResult = await query(
        `SELECT r.*, c.instructor_id 
         FROM course_resources r
         JOIN courses c ON r.course_id = c.id
         WHERE r.id = $1 AND c.id = $2`,
        [resourceId, id]
    );

    if (resourceResult.rows.length === 0) {
        throw new ApiError(404, 'Resource not found');
    }

    if (req.user.role !== 'admin' && req.user.id !== resourceResult.rows[0].instructor_id) {
        throw new ApiError(403, 'You can only delete resources from your own courses');
    }

    await query('DELETE FROM course_resources WHERE id = $1', [resourceId]);

    res.json({
        success: true,
        message: 'Resource deleted successfully'
    });
});

// =====================
// CHAT CONTROLLERS
// =====================

/**
 * @desc    Get course chat messages
 * @route   GET /api/v1/courses/:id/chat
 * @access  Private (Enrolled/Instructor/Admin)
 */
const getChatMessages = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { limit = 50, before } = req.query;

    // Check access
    const courseResult = await query(
        'SELECT instructor_id FROM courses WHERE id = $1',
        [id]
    );

    if (courseResult.rows.length === 0) {
        throw new ApiError(404, 'Course not found');
    }

    if (req.user.role !== 'admin' && req.user.id !== courseResult.rows[0].instructor_id) {
        const enrollment = await query(
            'SELECT status FROM enrollments WHERE user_id = $1 AND course_id = $2',
            [req.user.id, id]
        );
        if (enrollment.rows.length === 0 || !['active', 'completed'].includes(enrollment.rows[0].status)) {
            throw new ApiError(403, 'You must be enrolled to access chat');
        }
    }

    let queryStr = `
        SELECT m.id, m.message, m.created_at, m.reply_to,
               u.id as user_id, u.first_name, u.last_name, u.avatar_url, u.role
        FROM chat_messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.course_id = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (before) {
        queryStr += ` AND m.created_at < $${paramIndex++}`;
        params.push(before);
    }

    queryStr += ` ORDER BY m.created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await query(queryStr, params);

    // Collect all reply_to ids so we can fetch parent messages
    const replyToIds = [...new Set(result.rows.filter(r => r.reply_to).map(r => r.reply_to))];
    let parentMessages = {};
    if (replyToIds.length > 0) {
        const parentResult = await query(
            `SELECT m.id, m.message, u.id as user_id, u.first_name, u.last_name
             FROM chat_messages m
             JOIN users u ON m.user_id = u.id
             WHERE m.id = ANY($1)`,
            [replyToIds]
        );
        for (const p of parentResult.rows) {
            parentMessages[p.id] = {
                id: p.id,
                message: p.message,
                user: {
                    id: p.user_id,
                    firstName: p.first_name,
                    lastName: p.last_name
                }
            };
        }
    }

    // Reverse to show oldest first in chat UI, but we fetched newest first for pagination
    const messages = result.rows.reverse().map(msg => ({
        id: msg.id,
        message: msg.message,
        createdAt: msg.created_at,
        replyTo: msg.reply_to ? (parentMessages[msg.reply_to] || { id: msg.reply_to }) : null,
        user: {
            id: msg.user_id,
            firstName: msg.first_name,
            lastName: msg.last_name,
            avatarUrl: msg.avatar_url,
            role: msg.role
        }
    }));

    res.json({
        success: true,
        data: messages
    });
});

/**
 * @desc    Post a chat message
 * @route   POST /api/v1/courses/:id/chat
 * @access  Private (Enrolled/Instructor/Admin)
 */
const postChatMessage = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { message, replyTo } = req.body;

    if (!message || !message.trim()) {
        throw new ApiError(400, 'Message cannot be empty');
    }

    // Check access
    const courseResult = await query(
        'SELECT instructor_id FROM courses WHERE id = $1',
        [id]
    );

    if (courseResult.rows.length === 0) {
        throw new ApiError(404, 'Course not found');
    }

    if (req.user.role !== 'admin' && req.user.id !== courseResult.rows[0].instructor_id) {
        const enrollment = await query(
            'SELECT status FROM enrollments WHERE user_id = $1 AND course_id = $2',
            [req.user.id, id]
        );
        if (enrollment.rows.length === 0 || !['active', 'completed'].includes(enrollment.rows[0].status)) {
            throw new ApiError(403, 'You must be enrolled to post in chat');
        }
    }

    // Validate replyTo if provided
    if (replyTo) {
        const parentMsg = await query(
            'SELECT id FROM chat_messages WHERE id = $1 AND course_id = $2',
            [replyTo, id]
        );
        if (parentMsg.rows.length === 0) {
            throw new ApiError(400, 'Reply target message not found');
        }
    }

    const result = await query(
        `INSERT INTO chat_messages (course_id, user_id, message, reply_to)
         VALUES ($1, $2, $3, $4)
         RETURNING id, message, created_at, reply_to`,
        [id, req.user.id, message.trim(), replyTo || null]
    );

    // Fetch user details to return complete message object
    const userResult = await query(
        'SELECT first_name, last_name, avatar_url, role FROM users WHERE id = $1',
        [req.user.id]
    );
    const u = userResult.rows[0];

    // If replying, fetch parent message info
    let replyToData = null;
    if (result.rows[0].reply_to) {
        const parentResult = await query(
            `SELECT m.id, m.message, u.first_name, u.last_name, u.id as user_id
             FROM chat_messages m JOIN users u ON m.user_id = u.id
             WHERE m.id = $1`,
            [result.rows[0].reply_to]
        );
        if (parentResult.rows.length > 0) {
            const p = parentResult.rows[0];
            replyToData = {
                id: p.id,
                message: p.message,
                user: { id: p.user_id, firstName: p.first_name, lastName: p.last_name }
            };
        }
    }

    res.status(201).json({
        success: true,
        data: {
            id: result.rows[0].id,
            message: result.rows[0].message,
            createdAt: result.rows[0].created_at,
            replyTo: replyToData,
            user: {
                id: req.user.id,
                firstName: u.first_name,
                lastName: u.last_name,
                avatarUrl: u.avatar_url,
                role: u.role
            }
        }
    });
});

/**
 * @desc    Delete a chat message
 * @route   DELETE /api/v1/courses/:id/chat/:messageId
 * @access  Private (Owner/Instructor/Admin)
 */
const deleteChatMessage = asyncHandler(async (req, res) => {
    const { id, messageId } = req.params;

    // Get the message and course info
    const msgResult = await query(
        `SELECT m.user_id, c.instructor_id
         FROM chat_messages m
         JOIN courses c ON m.course_id = c.id
         WHERE m.id = $1 AND m.course_id = $2`,
        [messageId, id]
    );

    if (msgResult.rows.length === 0) {
        throw new ApiError(404, 'Message not found');
    }

    const msg = msgResult.rows[0];

    // Only the message author, course instructor, or admin can delete
    if (req.user.role !== 'admin' && req.user.id !== msg.user_id && req.user.id !== msg.instructor_id) {
        throw new ApiError(403, 'You can only delete your own messages');
    }

    await query('DELETE FROM chat_messages WHERE id = $1', [messageId]);

    res.json({
        success: true,
        message: 'Message deleted successfully'
    });
});

module.exports = {
    getResources,
    addResource,
    deleteResource,
    getChatMessages,
    postChatMessage,
    deleteChatMessage
};
