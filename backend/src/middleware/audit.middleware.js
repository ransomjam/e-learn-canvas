const { query } = require('../config/database');

/**
 * Audit log actions
 */
const AUDIT_ACTIONS = {
    // User actions
    USER_LOGIN: 'user.login',
    USER_LOGOUT: 'user.logout',
    USER_REGISTER: 'user.register',
    USER_UPDATE: 'user.update',
    USER_DELETE: 'user.delete',
    USER_BAN: 'user.ban',
    USER_UNBAN: 'user.unban',
    USER_ROLE_CHANGE: 'user.role_change',

    // Course actions
    COURSE_CREATE: 'course.create',
    COURSE_UPDATE: 'course.update',
    COURSE_DELETE: 'course.delete',
    COURSE_PUBLISH: 'course.publish',
    COURSE_ARCHIVE: 'course.archive',
    COURSE_SUBMIT_REVIEW: 'course.submit_review',
    COURSE_APPROVE: 'course.approve',
    COURSE_REJECT: 'course.reject',

    // Enrollment actions
    ENROLLMENT_CREATE: 'enrollment.create',
    ENROLLMENT_CANCEL: 'enrollment.cancel',
    ENROLLMENT_COMPLETE: 'enrollment.complete',

    // Payment actions
    PAYMENT_CREATE: 'payment.create',
    PAYMENT_COMPLETE: 'payment.complete',
    PAYMENT_REFUND: 'payment.refund',

    // Certificate actions
    CERTIFICATE_ISSUE: 'certificate.issue',

    // Admin actions
    SETTINGS_UPDATE: 'settings.update'
};

/**
 * Create an audit log entry
 */
const createAuditLog = async ({
    userId,
    action,
    entityType,
    entityId,
    oldValues = null,
    newValues = null,
    ipAddress = null,
    userAgent = null,
    metadata = {}
}) => {
    try {
        await query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
                userId,
                action,
                entityType,
                entityId,
                oldValues ? JSON.stringify(oldValues) : null,
                newValues ? JSON.stringify(newValues) : null,
                ipAddress,
                userAgent,
                JSON.stringify(metadata)
            ]
        );
    } catch (error) {
        // Don't throw - audit logging should not break the main operation
        console.error('Audit log error:', error.message);
    }
};

/**
 * Get client IP address from request
 */
const getClientIp = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] ||
        req.headers['x-real-ip'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        null;
};

/**
 * Middleware to automatically log certain actions
 */
const auditMiddleware = (action, entityType, getEntityId = null) => {
    return async (req, res, next) => {
        // Store original json method
        const originalJson = res.json.bind(res);

        // Override json to capture response
        res.json = function (data) {
            // Only log successful operations
            if (res.statusCode >= 200 && res.statusCode < 300 && data.success !== false) {
                const entityId = getEntityId ? getEntityId(req, data) : req.params.id;

                createAuditLog({
                    userId: req.user?.id,
                    action,
                    entityType,
                    entityId,
                    newValues: req.body,
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'],
                    metadata: {
                        method: req.method,
                        path: req.originalUrl
                    }
                });
            }

            return originalJson(data);
        };

        next();
    };
};

/**
 * Log action with before/after state
 */
const logWithState = async (req, action, entityType, entityId, oldValues, newValues) => {
    await createAuditLog({
        userId: req.user?.id,
        action,
        entityType,
        entityId,
        oldValues,
        newValues,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent']
    });
};

module.exports = {
    AUDIT_ACTIONS,
    createAuditLog,
    auditMiddleware,
    logWithState,
    getClientIp
};
