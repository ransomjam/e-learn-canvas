const { query } = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/error.middleware');
const { projectUpload, uploadToCloudinary, cloudinaryEnabled, signCloudinaryUrl } = require('./upload.controller');
const { notifyPracticeSubmission, notifySubmissionReviewed } = require('../services/notification.service');

/**
 * @desc    Submit a custom practice file for a lesson
 * @route   POST /api/v1/practice-submissions
 * @access  Private (Learner)
 */
const submitPracticeFile = asyncHandler(async (req, res) => {
    const { lessonId, courseId, notes } = req.body;
    const userId = req.user.id;

    if (!lessonId || !courseId) {
        throw new ApiError(400, 'lessonId and courseId are required');
    }

    // Verify lesson belongs to the course
    const lessonResult = await query(
        'SELECT id, title FROM lessons WHERE id = $1 AND course_id = $2',
        [lessonId, courseId]
    );

    if (lessonResult.rows.length === 0) {
        throw new ApiError(404, 'Lesson not found in this course');
    }

    // Verify user is enrolled
    const enrollmentResult = await query(
        'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2 AND status = $3',
        [userId, courseId, 'active']
    );

    if (enrollmentResult.rows.length === 0) {
        throw new ApiError(403, 'You must be enrolled in this course to submit files');
    }

    // Handle file upload — accept pre-uploaded Cloudinary URL from body OR multer file
    let fileUrl = req.body.fileUrl || null;
    let fileName = req.body.fileName || null;
    let fileSize = req.body.fileSize || null;

    if (req.file) {
        if (cloudinaryEnabled) {
            const uploaded = await uploadToCloudinary(req.file.buffer, req.file.originalname);
            fileUrl = uploaded.url;
        } else {
            fileUrl = `/uploads/${req.file.filename}`;
        }
        fileName = req.file.originalname;
        fileSize = req.file.size || req.file.buffer?.length;
    }

    if (!fileUrl && !notes) {
        throw new ApiError(400, 'Please upload a file or add notes');
    }

    const result = await query(
        `INSERT INTO practice_submissions (lesson_id, course_id, user_id, file_url, file_name, file_size, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [lessonId, courseId, userId, fileUrl, fileName, fileSize, notes || null]
    );

    const submissionData = result.rows[0];
    if (submissionData.file_url) {
        submissionData.file_url = signCloudinaryUrl(submissionData.file_url);
    }

    // Notify instructor about the new submission (fire-and-forget)
    notifyPracticeSubmission({ userId, courseId, lessonId });

    res.status(201).json({
        success: true,
        data: submissionData
    });
});

/**
 * @desc    Get all practice submissions for a user in a course
 * @route   GET /api/v1/practice-submissions/my?courseId=xxx
 * @access  Private
 */
const getMyPracticeSubmissions = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { courseId } = req.query;

    let whereClause = 'WHERE ps.user_id = $1';
    const params = [userId];

    if (courseId) {
        whereClause += ' AND ps.course_id = $2';
        params.push(courseId);
    }

    const result = await query(
        `SELECT ps.*, 
                l.title as lesson_title,
                c.title as course_title
         FROM practice_submissions ps
         JOIN lessons l ON ps.lesson_id = l.id
         JOIN courses c ON ps.course_id = c.id
         ${whereClause}
         ORDER BY ps.submitted_at DESC`,
        params
    );

    const submissions = result.rows.map(s => {
        if (s.file_url) {
            s.file_url = signCloudinaryUrl(s.file_url);
        }
        return s;
    });

    res.json({
        success: true,
        data: submissions
    });
});

/**
 * @desc    Get all practice submissions for instructor's courses
 * @route   GET /api/v1/practice-submissions/instructor
 * @access  Private (Instructor)
 */
const getInstructorPracticeSubmissions = asyncHandler(async (req, res) => {
    const instructorId = req.user.id;
    const { courseId, lessonId, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE c.instructor_id = $1';
    const params = [instructorId];
    let paramIndex = 2;

    if (courseId) {
        whereClause += ` AND ps.course_id = $${paramIndex}`;
        params.push(courseId);
        paramIndex++;
    }

    if (lessonId) {
        whereClause += ` AND ps.lesson_id = $${paramIndex}`;
        params.push(lessonId);
        paramIndex++;
    }

    // Total count
    const countResult = await query(
        `SELECT COUNT(*) as total
         FROM practice_submissions ps
         JOIN courses c ON ps.course_id = c.id
         ${whereClause}`,
        params
    );

    const total = parseInt(countResult.rows[0].total);

    const result = await query(
        `SELECT ps.*,
                u.first_name, u.last_name, u.email,
                l.title as lesson_title,
                c.title as course_title
         FROM practice_submissions ps
         JOIN users u ON ps.user_id = u.id
         JOIN lessons l ON ps.lesson_id = l.id
         JOIN courses c ON ps.course_id = c.id
         ${whereClause}
         ORDER BY ps.submitted_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, parseInt(limit), parseInt(offset)]
    );

    const submissions = result.rows.map(s => {
        if (s.file_url) {
            s.file_url = signCloudinaryUrl(s.file_url);
        }
        return s;
    });

    res.json({
        success: true,
        data: {
            submissions,
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
 * @desc    Approve or reject a practice submission
 * @route   PATCH /api/v1/practice-submissions/:id/approval
 * @access  Private (Instructor/Admin)
 */
const updatePracticeSubmissionApproval = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, feedback } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
        throw new ApiError(400, 'status must be one of: pending, approved, rejected');
    }

    const submissionResult = await query(
        `SELECT ps.id, ps.course_id, c.instructor_id
         FROM practice_submissions ps
         JOIN courses c ON ps.course_id = c.id
         WHERE ps.id = $1`,
        [id]
    );

    if (submissionResult.rows.length === 0) {
        throw new ApiError(404, 'Submission not found');
    }

    const submission = submissionResult.rows[0];
    const isOwnerInstructor = submission.instructor_id === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwnerInstructor && !isAdmin) {
        throw new ApiError(403, 'Not authorized to review this submission');
    }

    const columnMetadata = await query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'practice_submissions'
           AND column_name IN ('status', 'instructor_feedback', 'approved_by', 'approved_at', 'updated_at')`
    );

    const availableColumns = new Set(columnMetadata.rows.map((row) => row.column_name));

    // Build SET clauses and params dynamically to avoid parameter index gaps
    const updateFields = [];
    const params = [];
    let paramIndex = 1;

    if (availableColumns.has('status')) {
        updateFields.push(`status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
    }

    if (availableColumns.has('instructor_feedback')) {
        updateFields.push(`instructor_feedback = $${paramIndex}`);
        params.push(feedback || null);
        paramIndex++;
    }

    if (availableColumns.has('updated_at')) {
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
    }

    if (availableColumns.has('approved_by')) {
        updateFields.push(`approved_by = $${paramIndex}`);
        params.push(status === 'approved' ? req.user.id : null);
        paramIndex++;
    }

    if (availableColumns.has('approved_at')) {
        updateFields.push(`approved_at = ${status === 'approved' ? 'CURRENT_TIMESTAMP' : 'NULL'}`);
    }

    if (updateFields.length === 0) {
        throw new ApiError(500, 'Database schema missing required columns for practice submissions');
    }

    // WHERE clause uses the next param index
    const whereParam = `$${paramIndex}`;
    params.push(id);

    const result = await query(
        `UPDATE practice_submissions
         SET ${updateFields.join(', ')}
         WHERE id = ${whereParam}
         RETURNING *`,
        params
    );

    if (result.rows.length === 0) {
        throw new ApiError(404, 'Submission not found or update failed');
    }

    const updated = result.rows[0];
    if (updated.file_url) {
        updated.file_url = signCloudinaryUrl(updated.file_url);
    }

    // Notify student about the review result (fire-and-forget)
    if (status === 'approved' || status === 'rejected') {
        notifySubmissionReviewed({
            submissionId: id,
            status,
            feedback: feedback || null
        });
    }

    res.json({
        success: true,
        data: updated
    });
});

/**
 * @desc    Delete a practice submission
 * @route   DELETE /api/v1/practice-submissions/:id
 * @access  Private (owner or instructor/admin)
 */
const deletePracticeSubmission = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const submissionResult = await query(
        `SELECT ps.*, c.instructor_id
         FROM practice_submissions ps
         JOIN courses c ON ps.course_id = c.id
         WHERE ps.id = $1`,
        [id]
    );

    if (submissionResult.rows.length === 0) {
        throw new ApiError(404, 'Submission not found');
    }

    const submission = submissionResult.rows[0];

    if (submission.user_id !== userId && submission.instructor_id !== userId && req.user.role !== 'admin') {
        throw new ApiError(403, 'Not authorized');
    }

    await query('DELETE FROM practice_submissions WHERE id = $1', [id]);

    res.json({ success: true, data: {} });
});

module.exports = {
    projectUpload,
    submitPracticeFile,
    getMyPracticeSubmissions,
    getInstructorPracticeSubmissions,
    updatePracticeSubmissionApproval,
    deletePracticeSubmission
};
