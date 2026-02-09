const { query } = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/error.middleware');

/**
 * @desc    Get all users (admin only)
 * @route   GET /api/v1/users
 * @access  Private/Admin
 */
const getUsers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, role, search, isActive } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (role) {
        whereClause += ` AND role = $${paramIndex++}`;
        params.push(role);
    }

    if (isActive !== undefined) {
        whereClause += ` AND is_active = $${paramIndex++}`;
        params.push(isActive === 'true');
    }

    if (search) {
        whereClause += ` AND (first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
    }

    // Get total count
    const countResult = await query(
        `SELECT COUNT(*) FROM users ${whereClause}`,
        params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get users
    const result = await query(
        `SELECT id, email, first_name, last_name, role, avatar_url, bio, 
            is_active, is_verified, created_at, last_login
     FROM users ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset]
    );

    res.json({
        success: true,
        data: {
            users: result.rows.map(user => ({
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                avatarUrl: user.avatar_url,
                bio: user.bio,
                isActive: user.is_active,
                isVerified: user.is_verified,
                createdAt: user.created_at,
                lastLogin: user.last_login
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
 * @desc    Get user by ID
 * @route   GET /api/v1/users/:id
 * @access  Private
 */
const getUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await query(
        `SELECT id, email, first_name, last_name, role, avatar_url, bio, phone,
            is_active, is_verified, created_at
     FROM users WHERE id = $1`,
        [id]
    );

    if (result.rows.length === 0) {
        throw new ApiError(404, 'User not found');
    }

    const user = result.rows[0];

    // Get additional stats for instructors
    let instructorStats = null;
    if (user.role === 'instructor') {
        const statsResult = await query(
            `SELECT 
        COUNT(DISTINCT c.id) as course_count,
        COUNT(DISTINCT e.id) as student_count,
        COALESCE(AVG(r.rating), 0) as avg_rating
       FROM courses c
       LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
       LEFT JOIN reviews r ON c.id = r.course_id
       WHERE c.instructor_id = $1 AND c.status = 'published'`,
            [id]
        );
        instructorStats = {
            courseCount: parseInt(statsResult.rows[0].course_count),
            studentCount: parseInt(statsResult.rows[0].student_count),
            avgRating: parseFloat(statsResult.rows[0].avg_rating).toFixed(1)
        };
    }

    res.json({
        success: true,
        data: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            avatarUrl: user.avatar_url,
            bio: user.bio,
            phone: user.phone,
            isActive: user.is_active,
            isVerified: user.is_verified,
            createdAt: user.created_at,
            ...(instructorStats && { stats: instructorStats })
        }
    });
});

/**
 * @desc    Update user profile
 * @route   PUT /api/v1/users/:id
 * @access  Private
 */
const updateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, bio, phone, avatarUrl } = req.body;

    // Check ownership or admin
    if (req.user.id !== id && req.user.role !== 'admin') {
        throw new ApiError(403, 'You can only update your own profile');
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (firstName !== undefined) {
        updates.push(`first_name = $${paramIndex++}`);
        params.push(firstName);
    }
    if (lastName !== undefined) {
        updates.push(`last_name = $${paramIndex++}`);
        params.push(lastName);
    }
    if (bio !== undefined) {
        updates.push(`bio = $${paramIndex++}`);
        params.push(bio);
    }
    if (phone !== undefined) {
        updates.push(`phone = $${paramIndex++}`);
        params.push(phone);
    }
    if (avatarUrl !== undefined) {
        updates.push(`avatar_url = $${paramIndex++}`);
        params.push(avatarUrl);
    }

    if (updates.length === 0) {
        throw new ApiError(400, 'No fields to update');
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
     RETURNING id, email, first_name, last_name, role, avatar_url, bio, phone`,
        params
    );

    if (result.rows.length === 0) {
        throw new ApiError(404, 'User not found');
    }

    const user = result.rows[0];

    res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            avatarUrl: user.avatar_url,
            bio: user.bio,
            phone: user.phone
        }
    });
});

/**
 * @desc    Update user role (admin only)
 * @route   PUT /api/v1/users/:id/role
 * @access  Private/Admin
 */
const updateUserRole = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    // Prevent changing own role
    if (req.user.id === id) {
        throw new ApiError(400, 'You cannot change your own role');
    }

    const result = await query(
        `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
     RETURNING id, email, first_name, last_name, role`,
        [role, id]
    );

    if (result.rows.length === 0) {
        throw new ApiError(404, 'User not found');
    }

    const user = result.rows[0];

    res.json({
        success: true,
        message: 'User role updated successfully',
        data: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role
        }
    });
});

/**
 * @desc    Deactivate/Activate user (admin only)
 * @route   PUT /api/v1/users/:id/status
 * @access  Private/Admin
 */
const updateUserStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;

    // Prevent deactivating own account
    if (req.user.id === id) {
        throw new ApiError(400, 'You cannot change your own status');
    }

    const result = await query(
        `UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
     RETURNING id, email, first_name, last_name, is_active`,
        [isActive, id]
    );

    if (result.rows.length === 0) {
        throw new ApiError(404, 'User not found');
    }

    // If deactivating, invalidate all refresh tokens
    if (!isActive) {
        await query('DELETE FROM refresh_tokens WHERE user_id = $1', [id]);
    }

    const user = result.rows[0];

    res.json({
        success: true,
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            isActive: user.is_active
        }
    });
});

/**
 * @desc    Delete user (admin only)
 * @route   DELETE /api/v1/users/:id
 * @access  Private/Admin
 */
const deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Prevent deleting own account
    if (req.user.id === id) {
        throw new ApiError(400, 'You cannot delete your own account');
    }

    const result = await query(
        'DELETE FROM users WHERE id = $1 RETURNING id, email',
        [id]
    );

    if (result.rows.length === 0) {
        throw new ApiError(404, 'User not found');
    }

    res.json({
        success: true,
        message: 'User deleted successfully'
    });
});

/**
 * @desc    Get instructors list (public)
 * @route   GET /api/v1/users/instructors
 * @access  Public
 */
const getInstructors = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await query(
        `SELECT u.id, u.first_name, u.last_name, u.avatar_url, u.bio,
            COUNT(DISTINCT c.id) as course_count,
            COUNT(DISTINCT e.id) as student_count,
            COALESCE(AVG(r.rating), 0) as avg_rating
     FROM users u
     LEFT JOIN courses c ON u.id = c.instructor_id AND c.status = 'published'
     LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
     LEFT JOIN reviews r ON c.id = r.course_id
     WHERE u.role = 'instructor' AND u.is_active = true
     GROUP BY u.id
     ORDER BY course_count DESC, avg_rating DESC
     LIMIT $1 OFFSET $2`,
        [limit, offset]
    );

    const countResult = await query(
        "SELECT COUNT(*) FROM users WHERE role = 'instructor' AND is_active = true"
    );
    const total = parseInt(countResult.rows[0].count);

    res.json({
        success: true,
        data: {
            instructors: result.rows.map(instructor => ({
                id: instructor.id,
                firstName: instructor.first_name,
                lastName: instructor.last_name,
                avatarUrl: instructor.avatar_url,
                bio: instructor.bio,
                courseCount: parseInt(instructor.course_count),
                studentCount: parseInt(instructor.student_count),
                avgRating: parseFloat(instructor.avg_rating).toFixed(1)
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
    getUsers,
    getUserById,
    updateUser,
    updateUserRole,
    updateUserStatus,
    deleteUser,
    getInstructors
};
