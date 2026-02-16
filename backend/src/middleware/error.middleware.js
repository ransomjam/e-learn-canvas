/**
 * 404 Not Found handler
 */
const notFound = (req, res, next) => {
    res.status(404).json({
        success: false,
        message: `Not Found - ${req.originalUrl}`
    });
};

/**
 * Global error handler
 */
const errorHandler = (err, req, res, next) => {
    // Log with request context for easier debugging
    console.error(`[${req.method} ${req.originalUrl}] Error:`, err.message || err);
    if (process.env.NODE_ENV === 'production' && err.stack) {
        console.error(err.stack);
    }

    // Default error
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Validation errors
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = err.message;
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    }

    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }

    // PostgreSQL errors
    if (err.code === '23505') {
        statusCode = 409;
        message = 'Resource already exists';
    }

    if (err.code === '23503') {
        statusCode = 400;
        message = 'Referenced resource does not exist';
    }

    if (err.code === '23502') {
        statusCode = 400;
        message = 'Required field is missing';
    }

    // PostgreSQL: undefined column / syntax error → 500, not 400
    if (err.code === '42703' || err.code === '42601') {
        statusCode = 500;
        message = 'Database query error';
        console.error('DB schema issue:', err.message);
    }

    // Send error response
    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV !== 'production' && {
            stack: err.stack,
            error: err
        })
    });
};

/**
 * Async handler wrapper to catch errors
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Custom API Error class
 */
class ApiError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = {
    notFound,
    errorHandler,
    asyncHandler,
    ApiError
};
