const { query } = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/error.middleware');

/**
 * Generate URL-friendly slug from title
 */
const generateSlug = (title) => {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
};

// =====================
// SECTION CONTROLLERS
// =====================

/**
 * @desc    Create a new section
 * @route   POST /api/v1/lessons/sections
 * @access  Private/Instructor
 */
const createSection = asyncHandler(async (req, res) => {
    const { courseId, title, description, orderIndex } = req.body;

    // Check course ownership
    const courseResult = await query(
        'SELECT instructor_id FROM courses WHERE id = $1',
        [courseId]
    );

    if (courseResult.rows.length === 0) {
        throw new ApiError(404, 'Course not found');
    }

    if (req.user.role !== 'admin' && courseResult.rows[0].instructor_id !== req.user.id) {
        throw new ApiError(403, 'You can only add sections to your own courses');
    }

    // Get next order index if not provided
    let order = orderIndex;
    if (order === undefined) {
        const maxOrder = await query(
            'SELECT COALESCE(MAX(order_index), -1) + 1 as next_order FROM sections WHERE course_id = $1',
            [courseId]
        );
        order = maxOrder.rows[0].next_order;
    }

    const result = await query(
        `INSERT INTO sections (course_id, title, description, order_index)
     VALUES ($1, $2, $3, $4)
     RETURNING id, title, description, order_index, created_at`,
        [courseId, title, description, order]
    );

    res.status(201).json({
        success: true,
        message: 'Section created successfully',
        data: {
            id: result.rows[0].id,
            title: result.rows[0].title,
            description: result.rows[0].description,
            orderIndex: result.rows[0].order_index,
            createdAt: result.rows[0].created_at
        }
    });
});

/**
 * @desc    Update a section
 * @route   PUT /api/v1/lessons/sections/:id
 * @access  Private/Instructor
 */
const updateSection = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, description, orderIndex } = req.body;

    // Get section with course info
    const sectionResult = await query(
        `SELECT s.*, c.instructor_id FROM sections s
     JOIN courses c ON s.course_id = c.id
     WHERE s.id = $1`,
        [id]
    );

    if (sectionResult.rows.length === 0) {
        throw new ApiError(404, 'Section not found');
    }

    if (req.user.role !== 'admin' && sectionResult.rows[0].instructor_id !== req.user.id) {
        throw new ApiError(403, 'You can only update sections in your own courses');
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (title !== undefined) {
        updates.push(`title = $${paramIndex++}`);
        params.push(title);
    }
    if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        params.push(description);
    }
    if (orderIndex !== undefined) {
        updates.push(`order_index = $${paramIndex++}`);
        params.push(orderIndex);
    }

    if (updates.length === 0) {
        throw new ApiError(400, 'No fields to update');
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await query(
        `UPDATE sections SET ${updates.join(', ')} WHERE id = $${paramIndex}
     RETURNING id, title, description, order_index`,
        params
    );

    res.json({
        success: true,
        message: 'Section updated successfully',
        data: {
            id: result.rows[0].id,
            title: result.rows[0].title,
            description: result.rows[0].description,
            orderIndex: result.rows[0].order_index
        }
    });
});

/**
 * @desc    Delete a section
 * @route   DELETE /api/v1/lessons/sections/:id
 * @access  Private/Instructor
 */
const deleteSection = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Get section with course info
    const sectionResult = await query(
        `SELECT s.*, c.instructor_id FROM sections s
     JOIN courses c ON s.course_id = c.id
     WHERE s.id = $1`,
        [id]
    );

    if (sectionResult.rows.length === 0) {
        throw new ApiError(404, 'Section not found');
    }

    if (req.user.role !== 'admin' && sectionResult.rows[0].instructor_id !== req.user.id) {
        throw new ApiError(403, 'You can only delete sections in your own courses');
    }

    await query('DELETE FROM sections WHERE id = $1', [id]);

    res.json({
        success: true,
        message: 'Section deleted successfully'
    });
});

// =====================
// LESSON CONTROLLERS
// =====================

/**
 * @desc    Get lessons for a course
 * @route   GET /api/v1/lessons/course/:courseId
 * @access  Public (limited) / Private (full)
 */
const getCourseLessons = asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    // Check if course exists and user access
    const courseResult = await query(
        'SELECT id, instructor_id, status FROM courses WHERE id = $1',
        [courseId]
    );

    if (courseResult.rows.length === 0) {
        throw new ApiError(404, 'Course not found');
    }

    const course = courseResult.rows[0];

    // Check access
    let hasFullAccess = false;
    if (req.user) {
        if (req.user.role === 'admin' || req.user.id === course.instructor_id) {
            hasFullAccess = true;
        } else {
            // Check enrollment
            const enrollment = await query(
                'SELECT status FROM enrollments WHERE user_id = $1 AND course_id = $2',
                [req.user.id, courseId]
            );
            hasFullAccess = enrollment.rows.length > 0 && enrollment.rows[0].status === 'active';
        }
    }

    const result = await query(
        `SELECT s.id as section_id, s.title as section_title, s.description as section_description,
            s.order_index as section_order,
            l.id, l.title, l.slug, l.description, l.type, l.video_duration,
            l.order_index, l.is_free, l.is_published,
            l.content, l.video_url, l.resources, l.practice_files,
            l.created_at
     FROM sections s
     LEFT JOIN lessons l ON s.id = l.section_id ${!hasFullAccess ? 'AND l.is_published = true' : ''}
     WHERE s.course_id = $1
     ORDER BY s.order_index, l.order_index`,
        [courseId]
    );

    // Group by sections
    const sectionsMap = new Map();
    for (const row of result.rows) {
        if (!sectionsMap.has(row.section_id)) {
            sectionsMap.set(row.section_id, {
                id: row.section_id,
                title: row.section_title,
                description: row.section_description,
                orderIndex: row.section_order,
                lessons: []
            });
        }

        if (row.id) {
            const lesson = {
                id: row.id,
                title: row.title,
                slug: row.slug,
                description: row.description,
                type: row.type,
                videoDuration: row.video_duration,
                orderIndex: row.order_index,
                isFree: row.is_free,
                isPublished: row.is_published,
                createdAt: row.created_at
            };

            // Always include content for enrolled/admin users or free lessons
            if (hasFullAccess || row.is_free) {
                lesson.content = row.content;
                lesson.videoUrl = row.video_url;
                lesson.resources = row.resources;
                lesson.practiceFiles = row.practice_files;
            }

            sectionsMap.get(row.section_id).lessons.push(lesson);
        }
    }

    res.json({
        success: true,
        data: {
            courseId,
            hasFullAccess,
            sections: Array.from(sectionsMap.values())
        }
    });
});

/**
 * @desc    Get single lesson
 * @route   GET /api/v1/lessons/:id
 * @access  Public (limited) / Private (full)
 */
const getLessonById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await query(
        `SELECT l.*, s.title as section_title, s.order_index as section_order,
            c.id as course_id, c.title as course_title, c.instructor_id
     FROM lessons l
     JOIN sections s ON l.section_id = s.id
     JOIN courses c ON l.course_id = c.id
     WHERE l.id = $1`,
        [id]
    );

    if (result.rows.length === 0) {
        throw new ApiError(404, 'Lesson not found');
    }

    const lesson = result.rows[0];

    // Check access - allow instructor/admin full access
    let hasFullAccess = false;
    if (req.user && (req.user.role === 'admin' || req.user.id === lesson.instructor_id)) {
        hasFullAccess = true;
    } else if (req.user) {
        const enrollment = await query(
            'SELECT status FROM enrollments WHERE user_id = $1 AND course_id = $2',
            [req.user.id, lesson.course_id]
        );
        hasFullAccess = enrollment.rows.length > 0 && enrollment.rows[0].status === 'active';
    }

    // Instructors and admins can always see their lessons
    if (req.user && (req.user.role === 'admin' || req.user.id === lesson.instructor_id)) {
        res.json({
            success: true,
            data: {
                id: lesson.id,
                title: lesson.title,
                slug: lesson.slug,
                description: lesson.description,
                content: lesson.content,
                type: lesson.type,
                videoUrl: lesson.video_url,
                videoDuration: lesson.video_duration,
                orderIndex: lesson.order_index,
                isFree: lesson.is_free,
                isPublished: lesson.is_published,
                resources: lesson.resources,
                createdAt: lesson.created_at
            }
        });
        return;
    }

    if (!lesson.is_published && !hasFullAccess) {
        throw new ApiError(404, 'Lesson not found');
    }

    if (!lesson.is_free && !hasFullAccess) {
        return res.json({
            success: true,
            data: {
                id: lesson.id,
                title: lesson.title,
                description: lesson.description,
                type: lesson.type,
                videoDuration: lesson.video_duration,
                isFree: lesson.is_free,
                isLocked: true,
                message: 'Enroll in the course to access this lesson'
            }
        });
    }

    // Get next and previous lessons
    const navigation = await query(
        `SELECT id, title, order_index, 
            LAG(id) OVER (ORDER BY s.order_index, l.order_index) as prev_id,
            LAG(title) OVER (ORDER BY s.order_index, l.order_index) as prev_title,
            LEAD(id) OVER (ORDER BY s.order_index, l.order_index) as next_id,
            LEAD(title) OVER (ORDER BY s.order_index, l.order_index) as next_title
     FROM lessons l
     JOIN sections s ON l.section_id = s.id
     WHERE l.course_id = $1
     ORDER BY s.order_index, l.order_index`,
        [lesson.course_id]
    );

    const navItem = navigation.rows.find(n => n.id === id);

    res.json({
        success: true,
        data: {
            id: lesson.id,
            title: lesson.title,
            slug: lesson.slug,
            description: lesson.description,
            content: lesson.content,
            type: lesson.type,
            videoUrl: lesson.video_url,
            videoDuration: lesson.video_duration,
            orderIndex: lesson.order_index,
            isFree: lesson.is_free,
            isPublished: lesson.is_published,
            resources: lesson.resources,
            section: {
                id: lesson.section_id,
                title: lesson.section_title
            },
            course: {
                id: lesson.course_id,
                title: lesson.course_title
            },
            navigation: {
                previous: navItem?.prev_id ? { id: navItem.prev_id, title: navItem.prev_title } : null,
                next: navItem?.next_id ? { id: navItem.next_id, title: navItem.next_title } : null
            },
            createdAt: lesson.created_at
        }
    });
});

/**
 * @desc    Create a lesson
 * @route   POST /api/v1/lessons
 * @access  Private/Instructor
 */
const createLesson = asyncHandler(async (req, res) => {
    const {
        sectionId,
        title,
        description,
        content,
        type = 'video',
        videoUrl,
        videoDuration = 0,
        orderIndex,
        isFree = false,
        isPublished = true,
        resources = [],
        practiceFiles = []
    } = req.body;

    // Get section with course info
    const sectionResult = await query(
        `SELECT s.course_id, c.instructor_id FROM sections s
     JOIN courses c ON s.course_id = c.id
     WHERE s.id = $1`,
        [sectionId]
    );

    if (sectionResult.rows.length === 0) {
        throw new ApiError(404, 'Section not found');
    }

    if (req.user.role !== 'admin' && sectionResult.rows[0].instructor_id !== req.user.id) {
        throw new ApiError(403, 'You can only add lessons to your own courses');
    }

    const courseId = sectionResult.rows[0].course_id;

    // Generate slug
    let slug = generateSlug(title);
    const existingSlug = await query(
        'SELECT id FROM lessons WHERE course_id = $1 AND slug = $2',
        [courseId, slug]
    );
    if (existingSlug.rows.length > 0) {
        slug = `${slug}-${Date.now()}`;
    }

    // Get next order index if not provided
    let order = orderIndex;
    if (order === undefined) {
        const maxOrder = await query(
            'SELECT COALESCE(MAX(order_index), -1) + 1 as next_order FROM lessons WHERE section_id = $1',
            [sectionId]
        );
        order = maxOrder.rows[0].next_order;
    }

    const result = await query(
        `INSERT INTO lessons (
      section_id, course_id, title, slug, description, content, type,
      video_url, video_duration, order_index, is_free, is_published, resources, practice_files
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *`,
        [
            sectionId, courseId, title, slug, description, content, type,
            videoUrl, videoDuration, order, isFree, isPublished, JSON.stringify(resources), JSON.stringify(practiceFiles)
        ]
    );

    // Update course duration
    await query(
        `UPDATE courses SET duration_hours = (
      SELECT COALESCE(SUM(video_duration) / 3600.0, 0) FROM lessons WHERE course_id = $1
    ), updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [courseId]
    );

    const lesson = result.rows[0];

    res.status(201).json({
        success: true,
        message: 'Lesson created successfully',
        data: {
            id: lesson.id,
            title: lesson.title,
            slug: lesson.slug,
            type: lesson.type,
            orderIndex: lesson.order_index,
            isFree: lesson.is_free,
            isPublished: lesson.is_published,
            createdAt: lesson.created_at
        }
    });
});

/**
 * @desc    Update a lesson
 * @route   PUT /api/v1/lessons/:id
 * @access  Private/Instructor
 */
const updateLesson = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Get lesson with course info
    const lessonResult = await query(
        `SELECT l.*, c.instructor_id FROM lessons l
     JOIN courses c ON l.course_id = c.id
     WHERE l.id = $1`,
        [id]
    );

    if (lessonResult.rows.length === 0) {
        throw new ApiError(404, 'Lesson not found');
    }

    if (req.user.role !== 'admin' && lessonResult.rows[0].instructor_id !== req.user.id) {
        throw new ApiError(403, 'You can only update lessons in your own courses');
    }

    const allowedFields = [
        'title', 'description', 'content', 'type', 'videoUrl', 'videoDuration',
        'orderIndex', 'isFree', 'isPublished', 'resources', 'practiceFiles'
    ];

    const fieldMapping = {
        videoUrl: 'video_url',
        videoDuration: 'video_duration',
        orderIndex: 'order_index',
        isFree: 'is_free',
        isPublished: 'is_published'
    };

    const updates = [];
    const params = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            const dbField = fieldMapping[field] || field.replace(/([A-Z])/g, '_$1').toLowerCase();
            updates.push(`${dbField} = $${paramIndex++}`);
            let value = req.body[field];
            if (field === 'resources' || field === 'practiceFiles') {
                value = JSON.stringify(value);
            }
            params.push(value);
        }
    }

    if (updates.length === 0) {
        throw new ApiError(400, 'No fields to update');
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await query(
        `UPDATE lessons SET ${updates.join(', ')} WHERE id = $${paramIndex}
     RETURNING id, title, slug, type, order_index, is_free, is_published`,
        params
    );

    // Update course duration if video duration changed
    if (req.body.videoDuration !== undefined) {
        await query(
            `UPDATE courses SET duration_hours = (
        SELECT COALESCE(SUM(video_duration) / 3600.0, 0) FROM lessons WHERE course_id = $1
      ), updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [lessonResult.rows[0].course_id]
        );
    }

    const lesson = result.rows[0];

    res.json({
        success: true,
        message: 'Lesson updated successfully',
        data: {
            id: lesson.id,
            title: lesson.title,
            slug: lesson.slug,
            type: lesson.type,
            orderIndex: lesson.order_index,
            isFree: lesson.is_free,
            isPublished: lesson.is_published
        }
    });
});

/**
 * @desc    Delete a lesson
 * @route   DELETE /api/v1/lessons/:id
 * @access  Private/Instructor
 */
const deleteLesson = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Get lesson with course info
    const lessonResult = await query(
        `SELECT l.*, c.instructor_id FROM lessons l
     JOIN courses c ON l.course_id = c.id
     WHERE l.id = $1`,
        [id]
    );

    if (lessonResult.rows.length === 0) {
        throw new ApiError(404, 'Lesson not found');
    }

    if (req.user.role !== 'admin' && lessonResult.rows[0].instructor_id !== req.user.id) {
        throw new ApiError(403, 'You can only delete lessons in your own courses');
    }

    const courseId = lessonResult.rows[0].course_id;

    await query('DELETE FROM lessons WHERE id = $1', [id]);

    // Update course duration
    await query(
        `UPDATE courses SET duration_hours = (
      SELECT COALESCE(SUM(video_duration) / 3600.0, 0) FROM lessons WHERE course_id = $1
    ), updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [courseId]
    );

    res.json({
        success: true,
        message: 'Lesson deleted successfully'
    });
});

/**
 * @desc    Reorder lessons in a section
 * @route   PUT /api/v1/lessons/sections/:sectionId/reorder
 * @access  Private/Instructor
 */
const reorderLessons = asyncHandler(async (req, res) => {
    const { sectionId } = req.params;
    const { lessonIds } = req.body;

    if (!Array.isArray(lessonIds) || lessonIds.length === 0) {
        throw new ApiError(400, 'lessonIds must be a non-empty array');
    }

    // Check section ownership
    const sectionResult = await query(
        `SELECT s.*, c.instructor_id FROM sections s
     JOIN courses c ON s.course_id = c.id
     WHERE s.id = $1`,
        [sectionId]
    );

    if (sectionResult.rows.length === 0) {
        throw new ApiError(404, 'Section not found');
    }

    if (req.user.role !== 'admin' && sectionResult.rows[0].instructor_id !== req.user.id) {
        throw new ApiError(403, 'You can only reorder lessons in your own courses');
    }

    // Update order of each lesson
    for (let i = 0; i < lessonIds.length; i++) {
        await query(
            'UPDATE lessons SET order_index = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND section_id = $3',
            [i, lessonIds[i], sectionId]
        );
    }

    res.json({
        success: true,
        message: 'Lessons reordered successfully'
    });
});

module.exports = {
    // Sections
    createSection,
    updateSection,
    deleteSection,

    // Lessons
    getCourseLessons,
    getLessonById,
    createLesson,
    updateLesson,
    deleteLesson,
    reorderLessons
};
