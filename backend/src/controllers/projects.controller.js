const { query } = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/error.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for project file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const projectUpload = multer({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
    fileFilter: (req, file, cb) => {
        cb(null, true); // Accept all file types
    }
});

/**
 * @desc    Create a project for a course
 * @route   POST /api/v1/courses/:courseId/projects
 * @access  Private (Instructor)
 */
const createProject = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const { title, description, instructions, dueDate, maxFileSize, allowedFileTypes } = req.body;

    // Verify course exists and user is instructor
    const courseResult = await query(
        'SELECT instructor_id FROM courses WHERE id = $1',
        [courseId]
    );

    if (courseResult.rows.length === 0) {
        throw new ApiError(404, 'Course not found');
    }

    if (courseResult.rows[0].instructor_id !== req.user.id && req.user.role !== 'admin') {
        throw new ApiError(403, 'Not authorized');
    }

    // Handle file attachment
    let attachmentUrl = null;
    let attachmentName = null;
    if (req.file) {
        attachmentUrl = `/uploads/${req.file.filename}`;
        attachmentName = req.file.originalname;
    }

    const result = await query(
        `INSERT INTO projects (course_id, title, description, instructions, due_date, max_file_size, allowed_file_types, attachment_url, attachment_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [courseId, title, description, instructions, dueDate || null, maxFileSize || 10485760, allowedFileTypes || null, attachmentUrl, attachmentName]
    );

    res.status(201).json({
        success: true,
        data: result.rows[0]
    });
});

/**
 * @desc    Get all projects for a course
 * @route   GET /api/v1/courses/:courseId/projects
 * @access  Private
 */
const getCourseProjects = asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    const result = await query(
        `SELECT p.*, 
                COUNT(DISTINCT ps.id) as submission_count
         FROM projects p
         LEFT JOIN project_submissions ps ON p.id = ps.project_id
         WHERE p.course_id = $1
         GROUP BY p.id
         ORDER BY p.created_at DESC`,
        [courseId]
    );

    res.json({
        success: true,
        data: result.rows
    });
});

/**
 * @desc    Get a single project with user's submission
 * @route   GET /api/v1/projects/:projectId
 * @access  Private
 */
const getProject = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const userId = req.user.id;

    const projectResult = await query(
        'SELECT * FROM projects WHERE id = $1',
        [projectId]
    );

    if (projectResult.rows.length === 0) {
        throw new ApiError(404, 'Project not found');
    }

    const project = projectResult.rows[0];

    // Get user's submission if exists
    const submissionResult = await query(
        'SELECT * FROM project_submissions WHERE project_id = $1 AND user_id = $2',
        [projectId, userId]
    );

    res.json({
        success: true,
        data: {
            project,
            submission: submissionResult.rows[0] || null
        }
    });
});

/**
 * @desc    Submit a project
 * @route   POST /api/v1/projects/:projectId/submit
 * @access  Private
 */
const submitProject = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { submissionText } = req.body;
    const userId = req.user.id;

    // Check if project exists
    const projectResult = await query(
        'SELECT * FROM projects WHERE id = $1',
        [projectId]
    );

    if (projectResult.rows.length === 0) {
        throw new ApiError(404, 'Project not found');
    }

    // Check if user is enrolled
    const enrollmentResult = await query(
        'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2 AND status = $3',
        [userId, projectResult.rows[0].course_id, 'active']
    );

    if (enrollmentResult.rows.length === 0) {
        throw new ApiError(403, 'You must be enrolled in this course to submit');
    }

    // Handle file upload
    let submissionUrl = req.body.submissionUrl || null;
    let fileName = req.body.fileName || null;
    let fileSize = req.body.fileSize || null;
    if (req.file) {
        submissionUrl = `/uploads/${req.file.filename}`;
        fileName = req.file.originalname;
        fileSize = req.file.size;
    }

    // Insert or update submission
    const result = await query(
        `INSERT INTO project_submissions (project_id, user_id, submission_url, submission_text, file_name, file_size, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'submitted')
         ON CONFLICT (project_id, user_id) 
         DO UPDATE SET 
            submission_url = $3,
            submission_text = $4,
            file_name = $5,
            file_size = $6,
            status = 'submitted',
            submitted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [projectId, userId, submissionUrl, submissionText, fileName, fileSize]
    );

    res.json({
        success: true,
        data: result.rows[0]
    });
});

/**
 * @desc    Get all submissions for a project (Instructor only)
 * @route   GET /api/v1/projects/:projectId/submissions
 * @access  Private (Instructor)
 */
const getProjectSubmissions = asyncHandler(async (req, res) => {
    const { projectId } = req.params;

    // Verify project exists and user is instructor
    const projectResult = await query(
        `SELECT p.*, c.instructor_id 
         FROM projects p
         JOIN courses c ON p.course_id = c.id
         WHERE p.id = $1`,
        [projectId]
    );

    if (projectResult.rows.length === 0) {
        throw new ApiError(404, 'Project not found');
    }

    if (projectResult.rows[0].instructor_id !== req.user.id && req.user.role !== 'admin') {
        throw new ApiError(403, 'Not authorized');
    }

    // Get all submissions with user info
    const result = await query(
        `SELECT ps.*, 
                u.first_name, u.last_name, u.email,
                i.first_name as instructor_first_name, i.last_name as instructor_last_name
         FROM project_submissions ps
         JOIN users u ON ps.user_id = u.id
         LEFT JOIN users i ON ps.instructor_id = i.id
         WHERE ps.project_id = $1
         ORDER BY ps.submitted_at DESC`,
        [projectId]
    );

    res.json({
        success: true,
        data: result.rows
    });
});

/**
 * @desc    Get all submissions for a project (public to all authenticated users)
 * @route   GET /api/v1/projects/:projectId/submissions/public
 * @access  Private
 */
const getPublicProjectSubmissions = asyncHandler(async (req, res) => {
    const { projectId } = req.params;

    // Verify project exists
    const projectResult = await query(
        'SELECT * FROM projects WHERE id = $1',
        [projectId]
    );

    if (projectResult.rows.length === 0) {
        throw new ApiError(404, 'Project not found');
    }

    // Get all submissions with user info (public view - no file URLs for other students)
    const result = await query(
        `SELECT ps.id, ps.project_id, ps.user_id, ps.status, ps.grade, 
                ps.instructor_feedback, ps.submitted_at, ps.graded_at,
                ps.file_name, ps.submission_text,
                u.first_name, u.last_name
         FROM project_submissions ps
         JOIN users u ON ps.user_id = u.id
         WHERE ps.project_id = $1
         ORDER BY ps.submitted_at DESC`,
        [projectId]
    );

    res.json({
        success: true,
        data: result.rows
    });
});

/**
 * @desc    Get ALL submissions across all instructor's projects
 * @route   GET /api/v1/instructor/submissions
 * @access  Private (Instructor)
 */
const getInstructorAllSubmissions = asyncHandler(async (req, res) => {
    const instructorId = req.user.id;
    const { courseId, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE c.instructor_id = $1';
    const params = [instructorId];
    let paramIndex = 2;

    if (courseId) {
        whereClause += ` AND c.id = $${paramIndex}`;
        params.push(courseId);
        paramIndex++;
    }

    if (status) {
        whereClause += ` AND ps.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
    }

    // Get total count
    const countResult = await query(
        `SELECT COUNT(*) as total
         FROM project_submissions ps
         JOIN projects p ON ps.project_id = p.id
         JOIN courses c ON p.course_id = c.id
         ${whereClause}`,
        params
    );

    const total = parseInt(countResult.rows[0].total);

    // Get submissions with full details
    const result = await query(
        `SELECT ps.*, 
                u.first_name, u.last_name, u.email,
                p.title as project_title, p.course_id,
                c.title as course_title
         FROM project_submissions ps
         JOIN users u ON ps.user_id = u.id
         JOIN projects p ON ps.project_id = p.id
         JOIN courses c ON p.course_id = c.id
         ${whereClause}
         ORDER BY ps.submitted_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({
        success: true,
        data: {
            submissions: result.rows,
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
 * @desc    Grade a submission (Instructor only)
 * @route   PUT /api/v1/submissions/:submissionId/grade
 * @access  Private (Instructor)
 */
const gradeSubmission = asyncHandler(async (req, res) => {
    const { submissionId } = req.params;
    const { grade, feedback } = req.body;

    // Verify submission exists and user is instructor
    const submissionResult = await query(
        `SELECT ps.*, p.course_id, c.instructor_id
         FROM project_submissions ps
         JOIN projects p ON ps.project_id = p.id
         JOIN courses c ON p.course_id = c.id
         WHERE ps.id = $1`,
        [submissionId]
    );

    if (submissionResult.rows.length === 0) {
        throw new ApiError(404, 'Submission not found');
    }

    if (submissionResult.rows[0].instructor_id !== req.user.id && req.user.role !== 'admin') {
        throw new ApiError(403, 'Not authorized');
    }

    // Update submission
    const result = await query(
        `UPDATE project_submissions 
         SET grade = $1, 
             instructor_feedback = $2, 
             instructor_id = $3,
             status = 'graded',
             graded_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [grade, feedback, req.user.id, submissionId]
    );

    res.json({
        success: true,
        data: result.rows[0]
    });
});

/**
 * @desc    Update a project
 * @route   PUT /api/v1/projects/:projectId
 * @access  Private (Instructor)
 */
const updateProject = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { title, description, instructions, dueDate, maxFileSize, allowedFileTypes } = req.body;

    // Verify project exists and user is instructor
    const projectResult = await query(
        `SELECT p.*, c.instructor_id 
         FROM projects p
         JOIN courses c ON p.course_id = c.id
         WHERE p.id = $1`,
        [projectId]
    );

    if (projectResult.rows.length === 0) {
        throw new ApiError(404, 'Project not found');
    }

    if (projectResult.rows[0].instructor_id !== req.user.id && req.user.role !== 'admin') {
        throw new ApiError(403, 'Not authorized');
    }

    // Handle file attachment
    let attachmentUrl = projectResult.rows[0].attachment_url;
    let attachmentName = projectResult.rows[0].attachment_name;
    if (req.file) {
        attachmentUrl = `/uploads/${req.file.filename}`;
        attachmentName = req.file.originalname;
    }

    const result = await query(
        `UPDATE projects 
         SET title = $1,
             description = $2,
             instructions = $3,
             due_date = $4,
             max_file_size = $5,
             allowed_file_types = $6,
             attachment_url = $7,
             attachment_name = $8,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $9
         RETURNING *`,
        [title, description, instructions, dueDate, maxFileSize, allowedFileTypes, attachmentUrl, attachmentName, projectId]
    );

    res.json({
        success: true,
        data: result.rows[0]
    });
});

/**
 * @desc    Delete a project
 * @route   DELETE /api/v1/projects/:projectId
 * @access  Private (Instructor)
 */
const deleteProject = asyncHandler(async (req, res) => {
    const { projectId } = req.params;

    // Verify project exists and user is instructor
    const projectResult = await query(
        `SELECT p.*, c.instructor_id 
         FROM projects p
         JOIN courses c ON p.course_id = c.id
         WHERE p.id = $1`,
        [projectId]
    );

    if (projectResult.rows.length === 0) {
        throw new ApiError(404, 'Project not found');
    }

    if (projectResult.rows[0].instructor_id !== req.user.id && req.user.role !== 'admin') {
        throw new ApiError(403, 'Not authorized');
    }

    await query('DELETE FROM projects WHERE id = $1', [projectId]);

    res.json({
        success: true,
        data: {}
    });
});

module.exports = {
    projectUpload,
    createProject,
    getCourseProjects,
    getProject,
    submitProject,
    getProjectSubmissions,
    getPublicProjectSubmissions,
    getInstructorAllSubmissions,
    gradeSubmission,
    updateProject,
    deleteProject
};
