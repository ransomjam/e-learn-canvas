const { query, transaction } = require('../config/database');
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

/**
 * @desc    Get all courses
 * @route   GET /api/v1/courses
 * @access  Public
 */
const getCourses = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 12,
        category,
        level,
        status,
        search,
        instructor,
        minPrice,
        maxPrice,
        sortBy = 'created_at',
        sortOrder = 'desc',
        featured
    } = req.query;

    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    // Public users can only see published courses
    if (!req.user || req.user.role === 'learner') {
        whereClause += ` AND c.status = 'published' AND c.moderation_status = 'approved'`;
    } else if (status) {
        whereClause += ` AND c.status = $${paramIndex++}`;
        params.push(status);
    }

    if (category) {
        whereClause += ` AND c.category_id = $${paramIndex++}`;
        params.push(category);
    }

    if (level) {
        whereClause += ` AND c.level = $${paramIndex++}`;
        params.push(level);
    }

    if (instructor) {
        whereClause += ` AND c.instructor_id = $${paramIndex++}`;
        params.push(instructor);
    }

    if (minPrice !== undefined) {
        whereClause += ` AND c.price >= $${paramIndex++}`;
        params.push(minPrice);
    }

    if (maxPrice !== undefined) {
        whereClause += ` AND c.price <= $${paramIndex++}`;
        params.push(maxPrice);
    }

    if (featured === 'true') {
        whereClause += ` AND c.is_featured = true`;
    }

    if (search) {
        whereClause += ` AND (c.title ILIKE $${paramIndex} OR c.description ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
    }

    // Validate sort column
    const validSortColumns = ['created_at', 'price', 'rating_avg', 'enrollment_count', 'title'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Get total count
    const countResult = await query(
        `SELECT COUNT(*) FROM courses c ${whereClause}`,
        params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get courses
    const result = await query(
        `SELECT c.id, c.title, c.slug, c.short_description, c.thumbnail_url,
            c.price, c.discount_price, c.currency, c.level, c.language,
            c.duration_hours, c.status, c.is_featured, c.rating_avg, c.rating_count,
            c.enrollment_count, c.published_at, c.created_at,
            u.id as instructor_id, u.first_name as instructor_first_name, 
            u.last_name as instructor_last_name, u.avatar_url as instructor_avatar,
            cat.id as category_id, cat.name as category_name, cat.slug as category_slug
     FROM courses c
     LEFT JOIN users u ON c.instructor_id = u.id
     LEFT JOIN categories cat ON c.category_id = cat.id
     ${whereClause}
     ORDER BY c.${sortColumn} ${order}
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset]
    );

    res.json({
        success: true,
        data: {
            courses: result.rows.map(course => ({
                id: course.id,
                title: course.title,
                slug: course.slug,
                shortDescription: course.short_description,
                thumbnailUrl: course.thumbnail_url,
                price: parseFloat(course.price),
                discountPrice: course.discount_price ? parseFloat(course.discount_price) : null,
                currency: course.currency,
                level: course.level,
                language: course.language,
                durationHours: parseFloat(course.duration_hours),
                status: course.status,
                isFeatured: course.is_featured,
                ratingAvg: parseFloat(course.rating_avg),
                ratingCount: course.rating_count,
                enrollmentCount: course.enrollment_count,
                publishedAt: course.published_at,
                createdAt: course.created_at,
                instructor: {
                    id: course.instructor_id,
                    firstName: course.instructor_first_name,
                    lastName: course.instructor_last_name,
                    avatarUrl: course.instructor_avatar
                },
                category: course.category_id ? {
                    id: course.category_id,
                    name: course.category_name,
                    slug: course.category_slug
                } : null
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
 * @desc    Get single course by ID or slug
 * @route   GET /api/v1/courses/:id
 * @access  Public
 */
const getCourseById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if ID is UUID or slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUUID ? 'c.id' : 'c.slug';

    const result = await query(
        `SELECT c.*, 
            u.id as instructor_id, u.first_name as instructor_first_name, 
            u.last_name as instructor_last_name, u.avatar_url as instructor_avatar,
            u.bio as instructor_bio,
            cat.id as category_id, cat.name as category_name, cat.slug as category_slug
     FROM courses c
     LEFT JOIN users u ON c.instructor_id = u.id
     LEFT JOIN categories cat ON c.category_id = cat.id
     WHERE ${whereField} = $1`,
        [id]
    );

    if (result.rows.length === 0) {
        throw new ApiError(404, 'Course not found');
    }

    const course = result.rows[0];

    // Check access for unpublished courses
    if (course.status !== 'published') {
        if (!req.user || (req.user.role !== 'admin' && req.user.id !== course.instructor_id)) {
            throw new ApiError(404, 'Course not found');
        }
    }

    // Get sections and lessons
    const sectionsResult = await query(
        `SELECT s.id, s.title, s.description, s.order_index,
            json_agg(
              json_build_object(
                'id', l.id,
                'title', l.title,
                'slug', l.slug,
                'type', l.type,
                'videoDuration', l.video_duration,
                'orderIndex', l.order_index,
                'isFree', l.is_free,
                'isPublished', l.is_published
              ) ORDER BY l.order_index
            ) FILTER (WHERE l.id IS NOT NULL) as lessons
     FROM sections s
     LEFT JOIN lessons l ON s.id = l.section_id
     WHERE s.course_id = $1
     GROUP BY s.id
     ORDER BY s.order_index`,
        [course.id]
    );

    // Check if user is enrolled
    let isEnrolled = false;
    let enrollmentProgress = 0;
    if (req.user) {
        const enrollmentResult = await query(
            'SELECT status, progress_percentage FROM enrollments WHERE user_id = $1 AND course_id = $2',
            [req.user.id, course.id]
        );
        if (enrollmentResult.rows.length > 0) {
            isEnrolled = enrollmentResult.rows[0].status === 'active';
            enrollmentProgress = parseFloat(enrollmentResult.rows[0].progress_percentage);
        }
    }

    res.json({
        success: true,
        data: {
            id: course.id,
            title: course.title,
            slug: course.slug,
            description: course.description,
            shortDescription: course.short_description,
            thumbnailUrl: course.thumbnail_url,
            previewVideoUrl: course.preview_video_url,
            price: parseFloat(course.price),
            discountPrice: course.discount_price ? parseFloat(course.discount_price) : null,
            currency: course.currency,
            level: course.level,
            language: course.language,
            durationHours: parseFloat(course.duration_hours),
            status: course.status,
            isFeatured: course.is_featured,
            requirements: course.requirements || [],
            objectives: course.objectives || [],
            tags: course.tags || [],
            ratingAvg: parseFloat(course.rating_avg),
            ratingCount: course.rating_count,
            enrollmentCount: course.enrollment_count,
            publishedAt: course.published_at,
            createdAt: course.created_at,
            instructor: {
                id: course.instructor_id,
                firstName: course.instructor_first_name,
                lastName: course.instructor_last_name,
                avatarUrl: course.instructor_avatar,
                bio: course.instructor_bio
            },
            category: course.category_id ? {
                id: course.category_id,
                name: course.category_name,
                slug: course.category_slug
            } : null,
            sections: sectionsResult.rows.map(section => ({
                id: section.id,
                title: section.title,
                description: section.description,
                orderIndex: section.order_index,
                lessons: section.lessons || []
            })),
            isEnrolled,
            enrollmentProgress
        }
    });
});

/**
 * @desc    Create a new course
 * @route   POST /api/v1/courses
 * @access  Private/Instructor
 */
const createCourse = asyncHandler(async (req, res) => {
    const {
        title,
        description,
        shortDescription,
        categoryId,
        thumbnailUrl,
        previewVideoUrl,
        price = 0,
        discountPrice,
        currency = 'USD',
        level = 'beginner',
        language = 'English',
        requirements = [],
        objectives = [],
        tags = []
    } = req.body;

    // Generate unique slug
    let slug = generateSlug(title);
    const existingSlug = await query(
        'SELECT id FROM courses WHERE slug = $1',
        [slug]
    );
    if (existingSlug.rows.length > 0) {
        slug = `${slug}-${Date.now()}`;
    }

    const result = await query(
        `INSERT INTO courses (
      instructor_id, category_id, title, slug, description, short_description,
      thumbnail_url, preview_video_url, price, discount_price, currency,
      level, language, requirements, objectives, tags
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *`,
        [
            req.user.id, categoryId, title, slug, description, shortDescription,
            thumbnailUrl, previewVideoUrl, price, discountPrice, currency,
            level, language, requirements, objectives, tags
        ]
    );

    const course = result.rows[0];

    res.status(201).json({
        success: true,
        message: 'Course created successfully',
        data: {
            id: course.id,
            title: course.title,
            slug: course.slug,
            status: course.status,
            createdAt: course.created_at
        }
    });
});

/**
 * @desc    Update a course
 * @route   PUT /api/v1/courses/:id
 * @access  Private/Instructor
 */
const updateCourse = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check ownership
    const courseResult = await query(
        'SELECT instructor_id, status FROM courses WHERE id = $1',
        [id]
    );

    if (courseResult.rows.length === 0) {
        throw new ApiError(404, 'Course not found');
    }

    if (req.user.role !== 'admin' && courseResult.rows[0].instructor_id !== req.user.id) {
        throw new ApiError(403, 'You can only update your own courses');
    }

    const allowedFields = [
        'title', 'description', 'shortDescription', 'categoryId', 'thumbnailUrl',
        'previewVideoUrl', 'price', 'discountPrice', 'currency', 'level',
        'language', 'durationHours', 'requirements', 'objectives', 'tags'
    ];

    const fieldMapping = {
        shortDescription: 'short_description',
        categoryId: 'category_id',
        thumbnailUrl: 'thumbnail_url',
        previewVideoUrl: 'preview_video_url',
        discountPrice: 'discount_price',
        durationHours: 'duration_hours'
    };

    const updates = [];
    const params = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            const dbField = fieldMapping[field] || field.toLowerCase();
            updates.push(`${dbField} = $${paramIndex++}`);
            params.push(req.body[field]);
        }
    }

    if (updates.length === 0) {
        throw new ApiError(400, 'No fields to update');
    }

    // Reset moderation status if instructor updates published course
    if (req.user.role !== 'admin' && courseResult.rows[0].status === 'published') {
        updates.push(`moderation_status = 'pending_review'`);
        updates.push(`status = 'draft'`);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await query(
        `UPDATE courses SET ${updates.join(', ')} WHERE id = $${paramIndex}
     RETURNING id, title, slug, status, moderation_status, updated_at`,
        params
    );

    res.json({
        success: true,
        message: req.user.role !== 'admin' && courseResult.rows[0].status === 'published' 
            ? 'Course updated and sent for re-approval' 
            : 'Course updated successfully',
        data: result.rows[0]
    });
});

/**
 * @desc    Submit course for review
 * @route   PUT /api/v1/courses/:id/submit-review
 * @access  Private/Instructor
 */
const submitForReview = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const courseResult = await query(
        'SELECT instructor_id, status FROM courses WHERE id = $1',
        [id]
    );

    if (courseResult.rows.length === 0) {
        throw new ApiError(404, 'Course not found');
    }

    if (req.user.role !== 'admin' && courseResult.rows[0].instructor_id !== req.user.id) {
        throw new ApiError(403, 'You can only submit your own courses');
    }

    const lessonCount = await query(
        'SELECT COUNT(*) FROM lessons WHERE course_id = $1',
        [id]
    );

    if (parseInt(lessonCount.rows[0].count) === 0) {
        throw new ApiError(400, 'Course must have at least one lesson before submission');
    }

    const result = await query(
        `UPDATE courses 
     SET moderation_status = 'pending_review', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING id, title, status, moderation_status`,
        [id]
    );

    res.json({
        success: true,
        message: 'Course submitted for review',
        data: result.rows[0]
    });
});

/**
 * @desc    Publish a course
 * @route   PUT /api/v1/courses/:id/publish
 * @access  Private/Instructor
 */
const publishCourse = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const courseResult = await query(
        'SELECT instructor_id, status, moderation_status FROM courses WHERE id = $1',
        [id]
    );

    if (courseResult.rows.length === 0) {
        throw new ApiError(404, 'Course not found');
    }

    if (req.user.role !== 'admin' && courseResult.rows[0].instructor_id !== req.user.id) {
        throw new ApiError(403, 'You can only publish your own courses');
    }

    // Instructors need approval, admins can publish directly
    if (req.user.role !== 'admin' && courseResult.rows[0].moderation_status !== 'approved') {
        throw new ApiError(400, 'Course must be approved before publishing');
    }

    const lessonCount = await query(
        'SELECT COUNT(*) FROM lessons WHERE course_id = $1',
        [id]
    );

    if (parseInt(lessonCount.rows[0].count) === 0) {
        throw new ApiError(400, 'Course must have at least one lesson before publishing');
    }

    const result = await query(
        `UPDATE courses 
     SET status = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING id, title, status, published_at`,
        [id]
    );

    res.json({
        success: true,
        message: 'Course published successfully',
        data: result.rows[0]
    });
});

/**
 * @desc    Archive a course
 * @route   PUT /api/v1/courses/:id/archive
 * @access  Private/Instructor
 */
const archiveCourse = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check ownership
    const courseResult = await query(
        'SELECT instructor_id FROM courses WHERE id = $1',
        [id]
    );

    if (courseResult.rows.length === 0) {
        throw new ApiError(404, 'Course not found');
    }

    if (req.user.role !== 'admin' && courseResult.rows[0].instructor_id !== req.user.id) {
        throw new ApiError(403, 'You can only archive your own courses');
    }

    const result = await query(
        `UPDATE courses SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = $1
     RETURNING id, title, status`,
        [id]
    );

    res.json({
        success: true,
        message: 'Course archived successfully',
        data: result.rows[0]
    });
});

/**
 * @desc    Delete a course
 * @route   DELETE /api/v1/courses/:id
 * @access  Private/Instructor
 */
const deleteCourse = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check ownership
    const courseResult = await query(
        'SELECT instructor_id, enrollment_count FROM courses WHERE id = $1',
        [id]
    );

    if (courseResult.rows.length === 0) {
        throw new ApiError(404, 'Course not found');
    }

    if (req.user.role !== 'admin' && courseResult.rows[0].instructor_id !== req.user.id) {
        throw new ApiError(403, 'You can only delete your own courses');
    }

    // Check if course has enrollments
    if (courseResult.rows[0].enrollment_count > 0) {
        throw new ApiError(400, 'Cannot delete course with active enrollments. Archive it instead.');
    }

    await query('DELETE FROM courses WHERE id = $1', [id]);

    res.json({
        success: true,
        message: 'Course deleted successfully'
    });
});

/**
 * @desc    Get instructor's courses
 * @route   GET /api/v1/courses/instructor/me
 * @access  Private/Instructor
 */
const getInstructorCourses = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE c.instructor_id = $1';
    const params = [req.user.id];
    let paramIndex = 2;

    if (status) {
        whereClause += ` AND c.status = $${paramIndex++}`;
        params.push(status);
    }

    const countResult = await query(
        `SELECT COUNT(*) FROM courses c ${whereClause}`,
        params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
        `SELECT c.id, c.title, c.slug, c.thumbnail_url, c.status, c.price,
            c.rating_avg, c.enrollment_count, c.created_at, c.published_at
     FROM courses c
     ${whereClause}
     ORDER BY c.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset]
    );

    res.json({
        success: true,
        data: {
            courses: result.rows.map(course => ({
                id: course.id,
                title: course.title,
                slug: course.slug,
                thumbnailUrl: course.thumbnail_url,
                status: course.status,
                price: parseFloat(course.price),
                ratingAvg: parseFloat(course.rating_avg),
                enrollmentCount: course.enrollment_count,
                createdAt: course.created_at,
                publishedAt: course.published_at
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
 * @desc    Get categories
 * @route   GET /api/v1/courses/categories
 * @access  Public
 */
const getCategories = asyncHandler(async (req, res) => {
    const result = await query(
        `SELECT c.id, c.name, c.slug, c.description, c.parent_id,
            COUNT(co.id) FILTER (WHERE co.status = 'published') as course_count
     FROM categories c
     LEFT JOIN courses co ON c.id = co.category_id
     GROUP BY c.id
     ORDER BY c.name`
    );

    res.json({
        success: true,
        data: result.rows.map(cat => ({
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            description: cat.description,
            parentId: cat.parent_id,
            courseCount: parseInt(cat.course_count)
        }))
    });
});

module.exports = {
    getCourses,
    getCourseById,
    createCourse,
    updateCourse,
    submitForReview,
    publishCourse,
    archiveCourse,
    deleteCourse,
    getInstructorCourses,
    getCategories
};
