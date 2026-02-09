const { query } = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/error.middleware');

/**
 * Generate unique certificate number
 */
const generateCertificateNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `CERT-${timestamp}-${random}`;
};

/**
 * @desc    Issue certificate for completed course
 * @route   POST /api/v1/certificates
 * @access  Private/Instructor or Auto
 */
const issueCertificate = asyncHandler(async (req, res) => {
    const { enrollmentId, title } = req.body;

    // Get enrollment with course and user info
    const enrollmentResult = await query(
        `SELECT e.*, c.id as course_id, c.title as course_title, c.instructor_id,
            u.first_name, u.last_name
     FROM enrollments e
     JOIN courses c ON e.course_id = c.id
     JOIN users u ON e.user_id = u.id
     WHERE e.id = $1`,
        [enrollmentId]
    );

    if (enrollmentResult.rows.length === 0) {
        throw new ApiError(404, 'Enrollment not found');
    }

    const enrollment = enrollmentResult.rows[0];

    // Check if course is completed
    if (enrollment.status !== 'completed') {
        throw new ApiError(400, 'Certificate can only be issued for completed courses');
    }

    // Check authorization (instructor of the course, admin, or the learner themselves for auto-issue)
    if (req.user.role !== 'admin' &&
        req.user.id !== enrollment.instructor_id &&
        req.user.id !== enrollment.user_id) {
        throw new ApiError(403, 'Access denied');
    }

    // Check if certificate already exists
    const existingCert = await query(
        'SELECT id FROM certificates WHERE enrollment_id = $1',
        [enrollmentId]
    );

    if (existingCert.rows.length > 0) {
        throw new ApiError(400, 'Certificate has already been issued for this enrollment');
    }

    // Generate certificate
    const certificateNumber = generateCertificateNumber();
    const certificateTitle = title || `Certificate of Completion: ${enrollment.course_title}`;

    const result = await query(
        `INSERT INTO certificates (
      user_id, course_id, enrollment_id, certificate_number, title, 
      description, verification_url, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
        [
            enrollment.user_id,
            enrollment.course_id,
            enrollmentId,
            certificateNumber,
            certificateTitle,
            `This certifies that ${enrollment.first_name} ${enrollment.last_name} has successfully completed the course "${enrollment.course_title}".`,
            `/api/v1/certificates/verify/${certificateNumber}`,
            JSON.stringify({
                completedAt: enrollment.completed_at,
                instructorId: enrollment.instructor_id
            })
        ]
    );

    const certificate = result.rows[0];

    res.status(201).json({
        success: true,
        message: 'Certificate issued successfully',
        data: {
            id: certificate.id,
            certificateNumber: certificate.certificate_number,
            title: certificate.title,
            issuedAt: certificate.issued_at,
            verificationUrl: certificate.verification_url
        }
    });
});

/**
 * @desc    Get certificate by ID
 * @route   GET /api/v1/certificates/:id
 * @access  Private
 */
const getCertificateById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await query(
        `SELECT cert.*, 
            c.title as course_title, c.thumbnail_url,
            u.first_name, u.last_name,
            i.first_name as instructor_first_name, i.last_name as instructor_last_name
     FROM certificates cert
     JOIN courses c ON cert.course_id = c.id
     JOIN users u ON cert.user_id = u.id
     JOIN users i ON c.instructor_id = i.id
     WHERE cert.id = $1`,
        [id]
    );

    if (result.rows.length === 0) {
        throw new ApiError(404, 'Certificate not found');
    }

    const cert = result.rows[0];

    // Check access
    if (req.user.role !== 'admin' && cert.user_id !== req.user.id) {
        throw new ApiError(403, 'Access denied');
    }

    res.json({
        success: true,
        data: {
            id: cert.id,
            certificateNumber: cert.certificate_number,
            title: cert.title,
            description: cert.description,
            issuedAt: cert.issued_at,
            expiresAt: cert.expires_at,
            verificationUrl: cert.verification_url,
            recipient: {
                firstName: cert.first_name,
                lastName: cert.last_name
            },
            course: {
                id: cert.course_id,
                title: cert.course_title,
                thumbnailUrl: cert.thumbnail_url
            },
            instructor: {
                firstName: cert.instructor_first_name,
                lastName: cert.instructor_last_name
            }
        }
    });
});

/**
 * @desc    Verify certificate (public)
 * @route   GET /api/v1/certificates/verify/:certificateNumber
 * @access  Public
 */
const verifyCertificate = asyncHandler(async (req, res) => {
    const { certificateNumber } = req.params;

    const result = await query(
        `SELECT cert.id, cert.certificate_number, cert.title, cert.issued_at, cert.expires_at,
            c.title as course_title,
            u.first_name, u.last_name
     FROM certificates cert
     JOIN courses c ON cert.course_id = c.id
     JOIN users u ON cert.user_id = u.id
     WHERE cert.certificate_number = $1`,
        [certificateNumber]
    );

    if (result.rows.length === 0) {
        return res.json({
            success: true,
            data: {
                valid: false,
                message: 'Certificate not found'
            }
        });
    }

    const cert = result.rows[0];

    // Check if expired
    const isExpired = cert.expires_at && new Date(cert.expires_at) < new Date();

    res.json({
        success: true,
        data: {
            valid: !isExpired,
            expired: isExpired,
            certificate: {
                certificateNumber: cert.certificate_number,
                title: cert.title,
                recipientName: `${cert.first_name} ${cert.last_name}`,
                courseName: cert.course_title,
                issuedAt: cert.issued_at,
                expiresAt: cert.expires_at
            }
        }
    });
});

/**
 * @desc    Get user's certificates
 * @route   GET /api/v1/certificates
 * @access  Private
 */
const getMyCertificates = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const countResult = await query(
        'SELECT COUNT(*) FROM certificates WHERE user_id = $1',
        [req.user.id]
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
        `SELECT cert.id, cert.certificate_number, cert.title, cert.issued_at, cert.expires_at,
            c.id as course_id, c.title as course_title, c.thumbnail_url
     FROM certificates cert
     JOIN courses c ON cert.course_id = c.id
     WHERE cert.user_id = $1
     ORDER BY cert.issued_at DESC
     LIMIT $2 OFFSET $3`,
        [req.user.id, limit, offset]
    );

    res.json({
        success: true,
        data: {
            certificates: result.rows.map(cert => ({
                id: cert.id,
                certificateNumber: cert.certificate_number,
                title: cert.title,
                issuedAt: cert.issued_at,
                expiresAt: cert.expires_at,
                course: {
                    id: cert.course_id,
                    title: cert.course_title,
                    thumbnailUrl: cert.thumbnail_url
                }
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
 * @desc    Get all certificates (admin)
 * @route   GET /api/v1/certificates/all
 * @access  Private/Admin
 */
const getAllCertificates = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, userId, courseId } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (userId) {
        whereClause += ` AND cert.user_id = $${paramIndex++}`;
        params.push(userId);
    }

    if (courseId) {
        whereClause += ` AND cert.course_id = $${paramIndex++}`;
        params.push(courseId);
    }

    const countResult = await query(
        `SELECT COUNT(*) FROM certificates cert ${whereClause}`,
        params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
        `SELECT cert.*, 
            c.title as course_title,
            u.first_name, u.last_name, u.email
     FROM certificates cert
     JOIN courses c ON cert.course_id = c.id
     JOIN users u ON cert.user_id = u.id
     ${whereClause}
     ORDER BY cert.issued_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset]
    );

    res.json({
        success: true,
        data: {
            certificates: result.rows.map(cert => ({
                id: cert.id,
                certificateNumber: cert.certificate_number,
                title: cert.title,
                issuedAt: cert.issued_at,
                course: {
                    id: cert.course_id,
                    title: cert.course_title
                },
                user: {
                    id: cert.user_id,
                    firstName: cert.first_name,
                    lastName: cert.last_name,
                    email: cert.email
                }
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
 * @desc    Get course certificates (instructor)
 * @route   GET /api/v1/certificates/course/:courseId
 * @access  Private/Instructor
 */
const getCourseCertificates = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Check course ownership
    const courseResult = await query(
        'SELECT instructor_id FROM courses WHERE id = $1',
        [courseId]
    );

    if (courseResult.rows.length === 0) {
        throw new ApiError(404, 'Course not found');
    }

    if (req.user.role !== 'admin' && courseResult.rows[0].instructor_id !== req.user.id) {
        throw new ApiError(403, 'Access denied');
    }

    const countResult = await query(
        'SELECT COUNT(*) FROM certificates WHERE course_id = $1',
        [courseId]
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
        `SELECT cert.id, cert.certificate_number, cert.title, cert.issued_at,
            u.id as user_id, u.first_name, u.last_name, u.email
     FROM certificates cert
     JOIN users u ON cert.user_id = u.id
     WHERE cert.course_id = $1
     ORDER BY cert.issued_at DESC
     LIMIT $2 OFFSET $3`,
        [courseId, limit, offset]
    );

    res.json({
        success: true,
        data: {
            certificates: result.rows.map(cert => ({
                id: cert.id,
                certificateNumber: cert.certificate_number,
                title: cert.title,
                issuedAt: cert.issued_at,
                user: {
                    id: cert.user_id,
                    firstName: cert.first_name,
                    lastName: cert.last_name,
                    email: cert.email
                }
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
    issueCertificate,
    getCertificateById,
    verifyCertificate,
    getMyCertificates,
    getAllCertificates,
    getCourseCertificates
};
