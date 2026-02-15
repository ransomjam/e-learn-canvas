const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { jwt: jwtConfig } = require('../config/constants');
const { asyncHandler, ApiError } = require('../middleware/error.middleware');

/**
 * Generate access and refresh tokens (same as auth.controller)
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
 * @desc    Authenticate with Google (login or register)
 * @route   POST /api/v1/auth/google
 * @access  Public
 *
 * Accepts a Google OAuth2 access_token from the frontend implicit flow.
 * Verifies it by calling Google's userinfo endpoint.
 */
const googleAuth = asyncHandler(async (req, res) => {
    const { credential, role = 'learner' } = req.body;

    if (!credential) {
        throw new ApiError(400, 'Google access token is required');
    }

    // Fetch user info from Google using the access token
    let googleUser;
    try {
        const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${credential}` },
        });
        googleUser = response.data;
    } catch (error) {
        console.error('Google userinfo fetch failed:', error.response?.data || error.message);
        throw new ApiError(401, 'Invalid Google access token');
    }

    const { email, given_name, family_name, picture, email_verified, sub: googleId } = googleUser;

    if (!email) {
        throw new ApiError(401, 'Could not retrieve email from Google');
    }

    if (email_verified === false) {
        throw new ApiError(401, 'Google email is not verified');
    }

    // Check if user already exists
    let userResult = await query(
        `SELECT id, email, first_name, last_name, role, is_active, is_verified, google_id
         FROM users WHERE email = $1`,
        [email.toLowerCase()]
    );

    let user;
    let isNewUser = false;

    if (userResult.rows.length > 0) {
        // Existing user — login
        user = userResult.rows[0];

        if (!user.is_active) {
            throw new ApiError(401, 'Your account has been deactivated');
        }

        // Link Google ID if not already linked
        if (!user.google_id) {
            await query(
                `UPDATE users SET google_id = $1, avatar_url = COALESCE(avatar_url, $2), is_verified = true, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
                [googleId, picture, user.id]
            );
        }

        // Update last login
        await query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );
    } else {
        // New user — register
        isNewUser = true;

        // Generate a random password hash (user will use Google to login, not password)
        const randomPassword = require('crypto').randomBytes(32).toString('hex');
        const passwordHash = await bcrypt.hash(randomPassword, 12);

        const insertResult = await query(
            `INSERT INTO users (email, password_hash, first_name, last_name, role, avatar_url, google_id, is_active, is_verified)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true, true)
             RETURNING id, email, first_name, last_name, role`,
            [email.toLowerCase(), passwordHash, given_name || 'User', family_name || '', role, picture, googleId]
        );

        user = insertResult.rows[0];
    }

    // Generate JWT tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await query(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, refreshToken, expiresAt]
    );

    res.status(isNewUser ? 201 : 200).json({
        success: true,
        message: isNewUser ? 'Account created with Google' : 'Login successful with Google',
        data: {
            user: {
                id: user.id,
                email: user.email || email.toLowerCase(),
                firstName: user.first_name || given_name,
                lastName: user.last_name || family_name,
                role: user.role || role,
                isVerified: true,
            },
            accessToken,
            refreshToken,
            isNewUser,
        }
    });
});

module.exports = {
    googleAuth,
};
