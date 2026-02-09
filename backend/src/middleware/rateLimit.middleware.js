const rateLimit = require('express-rate-limit');

/**
 * Create role-based rate limiter
 */
const createRateLimiter = (options = {}) => {
    const {
        windowMs = 15 * 60 * 1000, // 15 minutes
        maxRequests = {
            admin: 1000,
            instructor: 500,
            learner: 100,
            anonymous: 50
        },
        message = 'Too many requests, please try again later.'
    } = options;

    return rateLimit({
        windowMs,
        max: (req) => {
            if (!req.user) return maxRequests.anonymous;
            return maxRequests[req.user.role] || maxRequests.learner;
        },
        message: {
            success: false,
            message
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            // Use user ID if authenticated, otherwise use IP
            return req.user?.id || req.ip;
        },
        skip: (req) => {
            // Skip rate limiting for health checks
            return req.path === '/health';
        }
    });
};

/**
 * Strict rate limiter for sensitive operations
 */
const strictRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: {
        success: false,
        message: 'Too many attempts, please try again in an hour.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Auth rate limiter (login/register)
 */
const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: {
        success: false,
        message: 'Too many authentication attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true
});

/**
 * Payment rate limiter
 */
const paymentRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: {
        success: false,
        message: 'Too many payment attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * API rate limiter with sliding window
 */
const apiRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: {
        admin: 2000,
        instructor: 1000,
        learner: 300,
        anonymous: 100
    }
});

module.exports = {
    createRateLimiter,
    strictRateLimiter,
    authRateLimiter,
    paymentRateLimiter,
    apiRateLimiter
};
