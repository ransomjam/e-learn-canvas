const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query, transaction } = require('../config/database');
const { jwt: jwtConfig } = require('../config/constants');
const { asyncHandler, ApiError } = require('../middleware/error.middleware');

/**
 * Generate access and refresh tokens
 */
const generateTokens = (userId) => {
    const accessToken = jwt.sign(
        { userId },
        jwtConfig.secret,
        { expiresIn: jwtConfig.expiresIn }
    );

    const refreshToken = jwt.sign(
        { userId, type: 'refresh' },
        jwtConfig.refreshSecret,
        { expiresIn: jwtConfig.refreshExpiresIn }
    );

    return { accessToken, refreshToken };
};

/**
 * @desc    Register a new user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
const register = asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName, role = 'learner' } = req.body;

    // Check if user exists
    const existingUser = await query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
        throw new ApiError(409, 'User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const result = await query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, first_name, last_name, role, created_at`,
        [email.toLowerCase(), passwordHash, firstName, lastName, role]
    );

    const user = result.rows[0];

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await query(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, refreshToken, expiresAt]
    );

    res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role
            },
            accessToken,
            refreshToken
        }
    });
});

/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Get user
    const result = await query(
        `SELECT id, email, password_hash, first_name, last_name, role, is_active, is_verified
     FROM users WHERE email = $1`,
        [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
        throw new ApiError(401, 'Invalid email or password');
    }

    const user = result.rows[0];

    // Check if account is active
    if (!user.is_active) {
        throw new ApiError(401, 'Your account has been deactivated');
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
        throw new ApiError(401, 'Invalid email or password');
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await query(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, refreshToken, expiresAt]
    );

    // Update last login
    await query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
    );

    res.json({
        success: true,
        message: 'Login successful',
        data: {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                isVerified: user.is_verified
            },
            accessToken,
            refreshToken
        }
    });
});

/**
 * @desc    Refresh access token
 * @route   POST /api/v1/auth/refresh
 * @access  Public
 */
const refreshAccessToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    // Verify refresh token
    let decoded;
    try {
        decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret);
    } catch (error) {
        throw new ApiError(401, 'Invalid or expired refresh token');
    }

    // Check if token exists in database
    const tokenResult = await query(
        'SELECT * FROM refresh_tokens WHERE token = $1 AND user_id = $2 AND expires_at > NOW()',
        [refreshToken, decoded.userId]
    );

    if (tokenResult.rows.length === 0) {
        throw new ApiError(401, 'Invalid or expired refresh token');
    }

    // Get user
    const userResult = await query(
        'SELECT id, is_active FROM users WHERE id = $1',
        [decoded.userId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
        throw new ApiError(401, 'User not found or inactive');
    }

    // Generate new tokens
    const tokens = generateTokens(decoded.userId);

    // Delete old refresh token and create new one
    await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await query(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [decoded.userId, tokens.refreshToken, expiresAt]
    );

    res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
        }
    });
});

/**
 * @desc    Logout user
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
const logout = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (refreshToken) {
        await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    }

    // Optionally delete all refresh tokens for this user
    // await query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.user.id]);

    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

/**
 * @desc    Get current user profile
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
const getMe = asyncHandler(async (req, res) => {
    const result = await query(
        `SELECT id, email, first_name, last_name, role, avatar_url, bio, phone, 
            is_verified, created_at, last_login
     FROM users WHERE id = $1`,
        [req.user.id]
    );

    const user = result.rows[0];

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
            isVerified: user.is_verified,
            createdAt: user.created_at,
            lastLogin: user.last_login
        }
    });
});

/**
 * @desc    Change password
 * @route   PUT /api/v1/auth/change-password
 * @access  Private
 */
const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const result = await query(
        'SELECT password_hash FROM users WHERE id = $1',
        [req.user.id]
    );

    const user = result.rows[0];

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
        throw new ApiError(400, 'Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [passwordHash, req.user.id]
    );

    // Invalidate all refresh tokens
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.user.id]);

    res.json({
        success: true,
        message: 'Password changed successfully. Please login again.'
    });
});

/**
 * @desc    Forgot password - send reset email
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const result = await query(
        'SELECT id, email FROM users WHERE email = $1',
        [email.toLowerCase()]
    );

    // Always return success to prevent email enumeration
    if (result.rows.length === 0) {
        return res.json({
            success: true,
            message: 'If an account with that email exists, a password reset link has been sent.'
        });
    }

    const user = result.rows[0];

    // Generate reset token
    const resetToken = uuidv4();
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1);

    await query(
        `UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3`,
        [resetToken, resetExpires, user.id]
    );

    // TODO: Send email with reset link
    // In production, send email with: `${frontendUrl}/reset-password?token=${resetToken}`

    res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
        // Only for development - remove in production
        ...(process.env.NODE_ENV === 'development' && { resetToken })
    });
});

/**
 * @desc    Reset password
 * @route   POST /api/v1/auth/reset-password
 * @access  Public
 */
const resetPassword = asyncHandler(async (req, res) => {
    const { token, password } = req.body;

    const result = await query(
        `SELECT id FROM users 
     WHERE reset_password_token = $1 AND reset_password_expires > NOW()`,
        [token]
    );

    if (result.rows.length === 0) {
        throw new ApiError(400, 'Invalid or expired reset token');
    }

    const user = result.rows[0];

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update password and clear reset token
    await query(
        `UPDATE users 
     SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
        [passwordHash, user.id]
    );

    // Invalidate all refresh tokens
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [user.id]);

    res.json({
        success: true,
        message: 'Password reset successful. Please login with your new password.'
    });
});

module.exports = {
    register,
    login,
    refreshAccessToken,
    logout,
    getMe,
    changePassword,
    forgotPassword,
    resetPassword
};
