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

    // Check access
    if (req.user.role !== 'admin' && req.user.id !== courseResult.rows[0].instructor_id) {
        const enrollment = await query(
            'SELECT status FROM enrollments WHERE user_id = $1 AND course_id = $2',
            [req.user.id, id]
        );
        if (enrollment.rows.length === 0 || enrollment.rows[0].status !== 'active') {
            throw new ApiError(403, 'You must be enrolled to access resources');
        }
    }

    const result = await query(
        'SELECT * FROM course_resources WHERE course_id = $1 ORDER BY created_at DESC',
        [id]
    );

    res.json({
        success: true,
        data: result.rows
    });
});

/**
 * @desc    Add a resource to a course
 * @route   POST /api/v1/courses/:id/resources
 * @access  Private (Instructor/Admin)
 */
const addResource = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, url, type = 'link', description } = req.body;

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
        `INSERT INTO course_resources (course_id, title, url, type, description)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [id, title, url, type, description]
    );

    res.status(201).json({
        success: true,
        message: 'Resource added successfully',
        data: result.rows[0]
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
        if (enrollment.rows.length === 0 || enrollment.rows[0].status !== 'active') {
            throw new ApiError(403, 'You must be enrolled to access chat');
        }
    }

    let queryStr = `
        SELECT m.id, m.message, m.created_at, 
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

    // Reverse to show oldest first in chat UI, but we fetched newest first for pagination
    const messages = result.rows.reverse().map(msg => ({
        id: msg.id,
        message: msg.message,
        createdAt: msg.created_at,
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
    const { message } = req.body;

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
        if (enrollment.rows.length === 0 || enrollment.rows[0].status !== 'active') {
            throw new ApiError(403, 'You must be enrolled to post in chat');
        }
    }

    const result = await query(
        `INSERT INTO chat_messages (course_id, user_id, message)
         VALUES ($1, $2, $3)
         RETURNING id, message, created_at`,
        [id, req.user.id, message.trim()]
    );

    // Fetch user details to return complete message object
    const userResult = await query(
        'SELECT first_name, last_name, avatar_url, role FROM users WHERE id = $1',
        [req.user.id]
    );
    const user = userResult.rows[0];

    res.status(201).json({
        success: true,
        data: {
            id: result.rows[0].id,
            message: result.rows[0].message,
            createdAt: result.rows[0].created_at,
            user: {
                id: req.user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                avatarUrl: user.avatar_url,
                role: user.role
            }
        }
    });
});

module.exports = {
    getResources,
    addResource,
    deleteResource,
    getChatMessages,
    postChatMessage
};
