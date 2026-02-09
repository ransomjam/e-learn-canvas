module.exports = {
    jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
    },

    roles: {
        ADMIN: 'admin',
        INSTRUCTOR: 'instructor',
        LEARNER: 'learner'
    },

    permissions: {
        // User permissions
        USER_READ: 'user:read',
        USER_WRITE: 'user:write',
        USER_DELETE: 'user:delete',

        // Course permissions
        COURSE_READ: 'course:read',
        COURSE_WRITE: 'course:write',
        COURSE_DELETE: 'course:delete',
        COURSE_PUBLISH: 'course:publish',

        // Lesson permissions
        LESSON_READ: 'lesson:read',
        LESSON_WRITE: 'lesson:write',
        LESSON_DELETE: 'lesson:delete',

        // Enrollment permissions
        ENROLLMENT_READ: 'enrollment:read',
        ENROLLMENT_WRITE: 'enrollment:write',

        // Payment permissions
        PAYMENT_READ: 'payment:read',
        PAYMENT_PROCESS: 'payment:process',

        // Certificate permissions
        CERTIFICATE_READ: 'certificate:read',
        CERTIFICATE_ISSUE: 'certificate:issue'
    },

    rolePermissions: {
        admin: [
            'user:read', 'user:write', 'user:delete',
            'course:read', 'course:write', 'course:delete', 'course:publish',
            'lesson:read', 'lesson:write', 'lesson:delete',
            'enrollment:read', 'enrollment:write',
            'payment:read', 'payment:process',
            'certificate:read', 'certificate:issue'
        ],
        instructor: [
            'user:read',
            'course:read', 'course:write', 'course:publish',
            'lesson:read', 'lesson:write', 'lesson:delete',
            'enrollment:read',
            'payment:read',
            'certificate:read', 'certificate:issue'
        ],
        learner: [
            'user:read',
            'course:read',
            'lesson:read',
            'enrollment:read', 'enrollment:write',
            'payment:read', 'payment:process',
            'certificate:read'
        ]
    },

    courseStatus: {
        DRAFT: 'draft',
        PUBLISHED: 'published',
        ARCHIVED: 'archived'
    },

    enrollmentStatus: {
        PENDING: 'pending',
        ACTIVE: 'active',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled'
    },

    paymentStatus: {
        PENDING: 'pending',
        COMPLETED: 'completed',
        FAILED: 'failed',
        REFUNDED: 'refunded'
    },

    lessonTypes: {
        VIDEO: 'video',
        TEXT: 'text',
        QUIZ: 'quiz',
        ASSIGNMENT: 'assignment'
    }
};
