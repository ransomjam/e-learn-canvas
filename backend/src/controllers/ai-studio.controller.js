/**
 * AI Course Studio controller.
 *
 * Thin HTTP layer: validates ownership, delegates every AI operation to
 * CourseAIService or the background job queue. No provider logic here.
 */
const { query } = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/error.middleware');
const aiConfig = require('../config/ai');
const courseAI = require('../services/ai/courseAI.service');
const whiteboardService = require('../services/ai/whiteboard.service');
const jobs = require('../services/jobs/aiJobs.service');

const SOURCE_TYPES = ['idea', 'text', 'pdf', 'doc', 'ppt', 'audio', 'video', 'lesson'];

/** Assert the user owns the course (admins bypass). Returns the course row. */
async function assertCourseOwnership(courseId, user) {
    const result = await query('SELECT id, title, instructor_id, level FROM courses WHERE id = $1', [courseId]);
    if (result.rows.length === 0) throw new ApiError(404, 'Course not found');
    if (user.role !== 'admin' && result.rows[0].instructor_id !== user.id) {
        throw new ApiError(403, 'You can only use the AI Studio on your own courses');
    }
    return result.rows[0];
}

async function assertLessonOwnership(lessonId, user) {
    const result = await query(
        `SELECT l.*, c.instructor_id FROM lessons l JOIN courses c ON l.course_id = c.id WHERE l.id = $1`,
        [lessonId]
    );
    if (result.rows.length === 0) throw new ApiError(404, 'Lesson not found');
    if (user.role !== 'admin' && result.rows[0].instructor_id !== user.id) {
        throw new ApiError(403, 'You can only edit lessons in your own courses');
    }
    return result.rows[0];
}

/**
 * @desc    AI feature availability (frontend hides AI features when off)
 * @route   GET /api/v1/ai/status
 */
const getStatus = asyncHandler(async (req, res) => {
    res.json({
        success: true,
        data: {
            enabled: aiConfig.isConfigured(),
            provider: aiConfig.provider,
            mediaUnderstanding: !!aiConfig.gemini.apiKey,
        },
    });
});

/**
 * @desc    Start the full lesson generation pipeline from any source
 * @route   POST /api/v1/ai/lessons/generate
 * @body    { courseId, source: {sourceType, text?, fileUrl?, mimeType?, lessonId?},
 *            options?: {language?, level?, questionCount?}, include?: {...} }
 */
const generateLessonPack = asyncHandler(async (req, res) => {
    const { courseId, source, options = {}, include = {} } = req.body;

    if (!courseId) throw new ApiError(400, 'courseId is required');
    if (!source || !SOURCE_TYPES.includes(source.sourceType)) {
        throw new ApiError(400, `source.sourceType must be one of: ${SOURCE_TYPES.join(', ')}`);
    }
    if (['idea', 'text'].includes(source.sourceType) && !(source.text || '').trim()) {
        throw new ApiError(400, 'Please provide some text to start from');
    }
    if (['pdf', 'doc', 'ppt', 'audio', 'video'].includes(source.sourceType) && !source.fileUrl) {
        throw new ApiError(400, 'source.fileUrl is required for file-based sources');
    }
    if (source.sourceType === 'lesson' && !source.lessonId) {
        throw new ApiError(400, 'source.lessonId is required');
    }
    if (!aiConfig.isConfigured()) {
        throw new ApiError(503, 'AI is not configured on this server yet. Add GEMINI_API_KEY to enable the AI Studio.');
    }

    const course = await assertCourseOwnership(courseId, req.user);

    const job = await jobs.enqueue({
        userId: req.user.id,
        courseId,
        type: 'lesson_pack',
        input: {
            source: {
                sourceType: source.sourceType,
                text: source.text,
                fileUrl: source.fileUrl,
                mimeType: source.mimeType,
                lessonId: source.lessonId,
            },
            options: { ...options, courseTitle: course.title, level: options.level || course.level },
            include,
        },
    });

    res.status(202).json({ success: true, data: { jobId: job.id, status: job.status } });
});

/**
 * @desc    Poll a background job (progress + result when done)
 * @route   GET /api/v1/ai/jobs/:id
 */
const getJob = asyncHandler(async (req, res) => {
    const job = await jobs.getJob(req.params.id, req.user.role === 'admin' ? null : req.user.id);
    if (!job) throw new ApiError(404, 'Job not found');
    res.json({ success: true, data: job });
});

/**
 * @desc    List my recent AI jobs
 * @route   GET /api/v1/ai/jobs?courseId=
 */
const listJobs = asyncHandler(async (req, res) => {
    const data = await jobs.listJobs({
        userId: req.user.id,
        courseId: req.query.courseId,
        limit: Math.min(parseInt(req.query.limit) || 20, 50),
    });
    res.json({ success: true, data });
});

/**
 * @desc    Cancel a queued/running job
 * @route   POST /api/v1/ai/jobs/:id/cancel
 */
const cancelJob = asyncHandler(async (req, res) => {
    const job = await jobs.cancelJob(req.params.id, req.user.id);
    if (!job) throw new ApiError(404, 'Job not found or already finished');
    res.json({ success: true, data: job });
});

/**
 * @desc    Persist a completed lesson_pack job into the course
 * @route   POST /api/v1/ai/jobs/:id/apply
 * @body    { sectionId, include?: { quizLesson?: boolean } , title? }
 */
const applyJob = asyncHandler(async (req, res) => {
    // overrides: instructor edits made during review (e.g. via the AI
    // assistant) that should win over the raw job result
    const { sectionId, include = {}, title, overrides = {} } = req.body;
    if (!sectionId) throw new ApiError(400, 'sectionId is required');

    const job = await jobs.getJob(req.params.id, req.user.role === 'admin' ? null : req.user.id);
    if (!job) throw new ApiError(404, 'Job not found');
    if (job.status !== 'completed' || !job.result) throw new ApiError(400, 'This generation has not finished yet');

    // Section must belong to the job's course and the user
    const sectionResult = await query(
        `SELECT s.id, s.course_id, c.instructor_id FROM sections s JOIN courses c ON s.course_id = c.id WHERE s.id = $1`,
        [sectionId]
    );
    if (sectionResult.rows.length === 0) throw new ApiError(404, 'Section not found');
    const section = sectionResult.rows[0];
    if (req.user.role !== 'admin' && section.instructor_id !== req.user.id) {
        throw new ApiError(403, 'You can only add lessons to your own courses');
    }

    const pack = job.result;
    const structured = pack.structured || {};
    const lessonDraft = pack.lesson || {};
    const lessonTitle = (title || lessonDraft.title || structured.title || 'AI generated lesson').slice(0, 255);

    // Slug (same convention as lesson.controller)
    let slug = lessonTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lesson';
    const slugTaken = await query('SELECT id FROM lessons WHERE course_id = $1 AND slug = $2', [section.course_id, slug]);
    if (slugTaken.rows.length > 0) slug = `${slug}-${Date.now()}`;

    const orderResult = await query(
        'SELECT COALESCE(MAX(order_index), -1) + 1 AS next_order FROM lessons WHERE section_id = $1',
        [sectionId]
    );

    // For video imports keep the original video playable on the lesson
    const isVideoSource = pack.source?.sourceType === 'video' && pack.source?.fileUrl;
    const lessonType = isVideoSource ? 'video' : 'text';
    const readSeconds = (lessonDraft.estimatedReadMinutes || structured.estimatedDurationMinutes || 5) * 60;

    // The lesson player renders content as HTML — convert the generated
    // markdown here; the raw markdown stays available in ai_artifacts.
    const { marked } = require('marked');
    const finalMarkdown = overrides.markdown || lessonDraft.markdown || '';
    const contentHtml = finalMarkdown ? marked.parse(finalMarkdown) : '';

    const lessonInsert = await query(
        `INSERT INTO lessons (section_id, course_id, title, slug, description, content, type,
                              video_url, video_duration, order_index, is_published)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true) RETURNING id`,
        [sectionId, section.course_id, lessonTitle, slug,
        structured.summary || '', contentHtml, lessonType,
        isVideoSource ? pack.source.fileUrl : null, readSeconds,
        orderResult.rows[0].next_order]
    );
    const lessonId = lessonInsert.rows[0].id;
    const created = { lessonId };

    // Optional separate quiz lesson (uses the existing quiz player format)
    if (pack.quiz?.length && include.quizLesson !== false) {
        const playable = pack.quiz
            .map((q) => {
                if (q.type === 'true_false') {
                    const answer = typeof q.correctAnswer === 'number' ? q.correctAnswer
                        : String(q.correctAnswer).toLowerCase().startsWith('t') ? 0 : 1;
                    return { question: q.question, options: ['True', 'False'], correctAnswer: answer, explanation: q.explanation };
                }
                if (Array.isArray(q.options) && q.options.length >= 2 && typeof q.correctAnswer === 'number') {
                    return { question: q.question, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation };
                }
                return null; // fill_blank / short_answer are not playable in the current quiz UI
            })
            .filter(Boolean);
        if (playable.length) {
            const quizSlugBase = `${slug}-quiz`;
            const quizInsert = await query(
                `INSERT INTO lessons (section_id, course_id, title, slug, description, type,
                                      quiz_data, order_index, is_published)
                 VALUES ($1, $2, $3, $4, $5, 'quiz', $6, $7, true) RETURNING id`,
                [sectionId, section.course_id, `Quiz: ${lessonTitle}`.slice(0, 255), `${quizSlugBase}-${Date.now()}`,
                'Auto-generated knowledge check', JSON.stringify(playable),
                orderResult.rows[0].next_order + 1]
            );
            created.quizLessonId = quizInsert.rows[0].id;
        }
    }

    // Flashcard deck
    if (pack.flashcards?.length) {
        const deck = await query(
            `INSERT INTO flashcard_decks (user_id, course_id, lesson_id, title) VALUES ($1, $2, $3, $4) RETURNING id`,
            [req.user.id, section.course_id, lessonId, `${lessonTitle} — Flashcards`.slice(0, 255)]
        );
        for (let i = 0; i < pack.flashcards.length; i++) {
            const c = pack.flashcards[i];
            await query(
                `INSERT INTO flashcards (deck_id, question, answer, category, difficulty, tags, order_index)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [deck.rows[0].id, c.question, c.answer, c.category, c.difficulty, JSON.stringify(c.tags || []), i]
            );
        }
        created.flashcardDeckId = deck.rows[0].id;
    }

    // Slide deck
    if (pack.slides?.slides?.length) {
        const deck = await query(
            `INSERT INTO slide_decks (user_id, course_id, lesson_id, title, slides) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [req.user.id, section.course_id, lessonId, pack.slides.title || lessonTitle, JSON.stringify(pack.slides.slides)]
        );
        created.slideDeckId = deck.rows[0].id;
    }

    // Whiteboard storyboard + per-scene rows
    if (pack.storyboard?.scenes?.length && pack.sceneGraph) {
        const sb = await query(
            `INSERT INTO storyboards (user_id, course_id, lesson_id, title, structured_content, total_duration_seconds)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [req.user.id, section.course_id, lessonId, pack.sceneGraph.title || lessonTitle,
            JSON.stringify(structured), Math.round(pack.sceneGraph.totalDurationSeconds || 0)]
        );
        for (let i = 0; i < pack.storyboard.scenes.length; i++) {
            await query(
                `INSERT INTO storyboard_scenes (storyboard_id, scene_index, scene, scene_graph)
                 VALUES ($1, $2, $3, $4)`,
                [sb.rows[0].id, i, JSON.stringify(pack.storyboard.scenes[i]), JSON.stringify(pack.sceneGraph.scenes[i])]
            );
        }
        created.storyboardId = sb.rows[0].id;
    }

    // Link job + artifacts to the created lesson
    await query('UPDATE ai_jobs SET lesson_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [job.id, lessonId]);
    await query('UPDATE ai_artifacts SET lesson_id = $2 WHERE job_id = $1', [job.id, lessonId]);

    res.status(201).json({ success: true, message: 'Lesson created from AI generation', data: created });
});

/**
 * @desc    AI Assistant — rewrite lesson content (sync)
 * @route   POST /api/v1/ai/assist
 * @body    { content, action, instructions?, lessonId? }
 */
const assist = asyncHandler(async (req, res) => {
    const { content, action = 'improve', instructions, lessonId } = req.body;
    if (!(content || '').trim()) throw new ApiError(400, 'content is required');
    if (lessonId) await assertLessonOwnership(lessonId, req.user);
    const markdown = await courseAI.assistLesson({ action, content, instructions });
    res.json({ success: true, data: { markdown } });
});

/**
 * @desc    Generate a quiz from text or a lesson (sync)
 * @route   POST /api/v1/ai/quiz
 */
const generateQuiz = asyncHandler(async (req, res) => {
    const { text, questionCount, difficulty } = req.body;
    if (!(text || '').trim()) throw new ApiError(400, 'text is required');
    const quiz = await courseAI.generateQuiz({ text, questionCount, difficulty });
    res.json({ success: true, data: quiz });
});

/**
 * @desc    Summarize content (sync)
 * @route   POST /api/v1/ai/summary
 */
const generateSummary = asyncHandler(async (req, res) => {
    const { text } = req.body;
    if (!(text || '').trim()) throw new ApiError(400, 'text is required');
    const summary = await courseAI.generateSummary(text);
    res.json({ success: true, data: summary });
});

/**
 * @desc    Translate lesson content (sync)
 * @route   POST /api/v1/ai/translate
 */
const translate = asyncHandler(async (req, res) => {
    const { text, targetLanguage } = req.body;
    if (!(text || '').trim()) throw new ApiError(400, 'text is required');
    if (!targetLanguage) throw new ApiError(400, 'targetLanguage is required');
    const markdown = await courseAI.translateCourse(text, targetLanguage);
    res.json({ success: true, data: { markdown } });
});

/**
 * @desc    Generate a course outline from a topic (sync)
 * @route   POST /api/v1/ai/course-outline
 */
const generateCourseOutline = asyncHandler(async (req, res) => {
    const { topic, level, lessonCount } = req.body;
    if (!(topic || '').trim()) throw new ApiError(400, 'topic is required');
    const outline = await courseAI.generateCourse({ topic, level, lessonCount });
    res.json({ success: true, data: outline });
});

/**
 * @desc    Start whiteboard generation for an existing lesson
 * @route   POST /api/v1/ai/storyboards
 * @body    { lessonId }
 */
const createStoryboard = asyncHandler(async (req, res) => {
    const { lessonId } = req.body;
    if (!lessonId) throw new ApiError(400, 'lessonId is required');
    const lesson = await assertLessonOwnership(lessonId, req.user);

    const job = await jobs.enqueue({
        userId: req.user.id,
        courseId: lesson.course_id,
        lessonId,
        type: 'storyboard',
        input: { lessonId },
    });
    res.status(202).json({ success: true, data: { jobId: job.id, status: job.status } });
});

/**
 * @desc    Fetch a storyboard with all scenes (compiled scene graph)
 * @route   GET /api/v1/ai/storyboards/:id
 */
const getStoryboard = asyncHandler(async (req, res) => {
    const sb = await query('SELECT * FROM storyboards WHERE id = $1', [req.params.id]);
    if (sb.rows.length === 0) throw new ApiError(404, 'Storyboard not found');
    const scenes = await query(
        'SELECT scene_index, scene, scene_graph FROM storyboard_scenes WHERE storyboard_id = $1 ORDER BY scene_index',
        [req.params.id]
    );
    const graphScenes = scenes.rows.map((r) => r.scene_graph);
    res.json({
        success: true,
        data: {
            id: sb.rows[0].id,
            lessonId: sb.rows[0].lesson_id,
            title: sb.rows[0].title,
            totalDurationSeconds: sb.rows[0].total_duration_seconds,
            scenes: scenes.rows.map((r) => ({ index: r.scene_index, description: r.scene, graph: r.scene_graph })),
            sceneGraph: {
                version: 1,
                title: sb.rows[0].title,
                canvas: whiteboardService.CANVAS,
                theme: whiteboardService.THEME,
                totalDurationSeconds: sb.rows[0].total_duration_seconds,
                scenes: graphScenes,
            },
        },
    });
});

/**
 * @desc    Regenerate ONE scene (never the whole video)
 * @route   POST /api/v1/ai/storyboards/:id/scenes/:index/regenerate
 * @body    { instructions? }
 */
const regenerateScene = asyncHandler(async (req, res) => {
    const { id, index } = req.params;
    const sceneIndex = parseInt(index, 10);

    const sb = await query('SELECT * FROM storyboards WHERE id = $1', [id]);
    if (sb.rows.length === 0) throw new ApiError(404, 'Storyboard not found');
    if (req.user.role !== 'admin' && sb.rows[0].user_id !== req.user.id) {
        throw new ApiError(403, 'You can only edit your own storyboards');
    }
    const sceneRow = await query(
        'SELECT * FROM storyboard_scenes WHERE storyboard_id = $1 AND scene_index = $2',
        [id, sceneIndex]
    );
    if (sceneRow.rows.length === 0) throw new ApiError(404, 'Scene not found');

    const newScene = await courseAI.regenerateScene(
        sb.rows[0].structured_content,
        sceneRow.rows[0].scene,
        req.body.instructions
    );
    // Deterministic recompile of just this scene
    const newGraph = whiteboardService.compileScene(newScene, sceneIndex);

    await query(
        `UPDATE storyboard_scenes SET scene = $3, scene_graph = $4, updated_at = CURRENT_TIMESTAMP
         WHERE storyboard_id = $1 AND scene_index = $2`,
        [id, sceneIndex, JSON.stringify(newScene), JSON.stringify(newGraph)]
    );
    // Keep total duration in sync
    await query(
        `UPDATE storyboards SET total_duration_seconds = (
            SELECT COALESCE(SUM((scene_graph->>'durationSeconds')::numeric), 0)
            FROM storyboard_scenes WHERE storyboard_id = $1
         ), updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id]
    );

    res.json({ success: true, data: { index: sceneIndex, description: newScene, graph: newGraph } });
});

/**
 * @desc    All AI artifacts attached to a lesson (flashcards, slides, storyboard)
 * @route   GET /api/v1/ai/lessons/:lessonId/artifacts
 */
const getLessonArtifacts = asyncHandler(async (req, res) => {
    const { lessonId } = req.params;

    const [decks, slides, storyboards] = await Promise.all([
        query(
            `SELECT d.id, d.title,
                    (SELECT json_agg(json_build_object(
                        'id', f.id, 'question', f.question, 'answer', f.answer,
                        'category', f.category, 'difficulty', f.difficulty, 'tags', f.tags
                     ) ORDER BY f.order_index) FROM flashcards f WHERE f.deck_id = d.id) AS cards
             FROM flashcard_decks d WHERE d.lesson_id = $1 ORDER BY d.created_at DESC`,
            [lessonId]
        ),
        query('SELECT id, title, slides FROM slide_decks WHERE lesson_id = $1 ORDER BY created_at DESC', [lessonId]),
        query('SELECT id, title, total_duration_seconds FROM storyboards WHERE lesson_id = $1 ORDER BY created_at DESC', [lessonId]),
    ]);

    res.json({
        success: true,
        data: {
            flashcardDecks: decks.rows.map((d) => ({ id: d.id, title: d.title, cards: d.cards || [] })),
            slideDecks: slides.rows,
            storyboards: storyboards.rows.map((s) => ({ id: s.id, title: s.title, totalDurationSeconds: s.total_duration_seconds })),
        },
    });
});

module.exports = {
    getStatus,
    generateLessonPack,
    getJob,
    listJobs,
    cancelJob,
    applyJob,
    assist,
    generateQuiz,
    generateSummary,
    translate,
    generateCourseOutline,
    createStoryboard,
    getStoryboard,
    regenerateScene,
    getLessonArtifacts,
};
