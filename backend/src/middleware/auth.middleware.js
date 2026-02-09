const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { jwt: jwtConfig, rolePermissions } = require('../config/constants');

/**
 * Authenticate user via JWT token
 */
const authenticate = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        const token = authHeader.split(' ')[1];

        // Verify token
        const decoded = jwt.verify(token, jwtConfig.secret);

        // Get user from database
        const { rows } = await query(
            'SELECT id, email, first_name, last_name, role, is_active, is_verified FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token. User not found.'
            });
        }

        const user = rows[0];

        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'Your account has been deactivated.'
            });
        }

        // Attach user to request
        req.user = {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            isVerified: user.is_verified,
            permissions: rolePermissions[user.role] || []
        };

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token.'
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token has expired.'
            });
        }
        console.error('Authentication error:', error);
        res.status(500).json({
            success: false,
            message: 'Authentication failed.'
        });
    }
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            req.user = null;
            return next();
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, jwtConfig.secret);

        const { rows } = await query(
            'SELECT id, email, first_name, last_name, role, is_active FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (rows.length > 0 && rows[0].is_active) {
            req.user = {
                id: rows[0].id,
                email: rows[0].email,
                firstName: rows[0].first_name,
                lastName: rows[0].last_name,
                role: rows[0].role,
                permissions: rolePermissions[rows[0].role] || []
            };
        } else {
            req.user = null;
        }

        next();
    } catch (error) {
        req.user = null;
        next();
    }
};

/**
 * Authorize based on roles
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to access this resource.'
            });
        }

        next();
    };
};

/**
 * Authorize based on permissions
 */
const hasPermission = (...permissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.'
            });
        }

        const userPermissions = req.user.permissions || [];
        const hasAllPermissions = permissions.every(p => userPermissions.includes(p));

        if (!hasAllPermissions) {
            return res.status(403).json({
                success: false,
                message: 'You do not have the required permissions.'
            });
        }

        next();
    };
};

/**
 * Check if user owns the resource or is admin
 */
const isOwnerOrAdmin = (userIdField = 'userId') => {
    return (req, res, next) => {
        const resourceUserId = req.params[userIdField] || req.body[userIdField];

        if (req.user.role === 'admin' || req.user.id === resourceUserId) {
            return next();
        }

        return res.status(403).json({
            success: false,
            message: 'You can only access your own resources.'
        });
    };
};

module.exports = {
    authenticate,
    optionalAuth,
    authorize,
    hasPermission,
    isOwnerOrAdmin
};
