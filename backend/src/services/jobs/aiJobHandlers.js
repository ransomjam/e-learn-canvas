/**
 * Job handlers — the actual AI pipelines that run in the background queue.
 *
 * The flagship pipeline is `lesson_pack`: any source → structured content →
 * lesson article + quiz + flashcards + slides + assignment + whiteboard
 * storyboard/scene-graph. Optional steps fail soft (recorded as warnings)
 * so one flaky generation never wastes the whole run; each intermediate
 * output is persisted to ai_artifacts for partial regeneration.
 */
const crypto = require('crypto');
const { query } = require('../../config/database');
const aiConfig = require('../../config/ai');
const courseAI = require('../ai/courseAI.service');
const jobs = require('./aiJobs.service');

/** Persist an intermediate artifact (never store only the final output). */
async function saveArtifact(job, kind, data) {
    await query(
        `INSERT INTO ai_artifacts (job_id, user_id, course_id, lesson_id, kind, data)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [job.id, job.userId, job.courseId, job.lessonId, kind, JSON.stringify(data)]
    ).catch((err) => console.warn('[AI jobs] artifact save failed:', err.message));
}

/** Content-addressed cache over ai_generation_history (dedupes re-runs). */
async function cached(action, keyPayload, producer, meta = {}) {
    const inputHash = crypto.createHash('sha256')
        .update(JSON.stringify({ action, keyPayload }))
        .digest('hex');
    try {
        const hit = await query(
            `SELECT output FROM ai_generation_history
             WHERE input_hash = $1 AND action = $2 AND output IS NOT NULL
             ORDER BY created_at DESC LIMIT 1`,
            [inputHash, action]
        );
        if (hit.rows.length > 0) return hit.rows[0].output;
    } catch { /* cache is best-effort */ }

    const started = Date.now();
    const output = await producer();
    query(
        `INSERT INTO ai_generation_history (user_id, course_id, lesson_id, action, provider, model, input_hash, output, duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [meta.userId || null, meta.courseId || null, meta.lessonId || null, action,
        aiConfig.provider, aiConfig.gemini.model, inputHash, JSON.stringify(output), Date.now() - started]
    ).catch(() => { /* history is best-effort */ });
    return output;
}

/** Run an optional pipeline step; collect a warning instead of failing. */
async function softStep(warnings, label, fn) {
    try {
        return await fn();
    } catch (err) {
        console.warn(`[AI jobs] optional step "${label}" failed:`, err.message);
        warnings.push(`${label} could not be generated (${err.message})`);
        return null;
    }
}

/**
 * Full lesson pack generation.
 * input: { source: {sourceType, text?, fileUrl?, mimeType?, lessonId?},
 *          options: {language?, level?, courseTitle?, questionCount?},
 *          include: {quiz, flashcards, slides, assignment, whiteboard, summary} }
 */
async function lessonPackHandler(job, progress) {
    const { source, options = {}, include = {} } = job.input;
    const meta = { userId: job.userId, courseId: job.courseId, lessonId: job.lessonId };
    const wants = (key, def = true) => include[key] !== undefined ? !!include[key] : def;
    const warnings = [];

    // 1 — extract & normalize (the expensive understanding step is cached
    //     by content hash: re-running the same source costs nothing)
    await progress(4, 'Reading your content...');
    const cacheKey = { sourceType: source.sourceType, text: source.text, fileUrl: source.fileUrl, lessonId: source.lessonId, options };
    const structured = await cached('extract', cacheKey, () =>
        courseAI.extractContent(source, options, (label) => progress(10, label)), meta);
    await saveArtifact(job, 'structured_content', structured);

    // 2 — lesson article (the core deliverable — a hard failure here fails the job)
    await progress(32, 'Generating lesson...');
    const lesson = await courseAI.generateLesson(structured);
    await saveArtifact(job, 'lesson_draft', lesson);

    // 3+ — the rest of the pack, each optional and fail-soft
    let quiz = null, flashcards = null, slides = null, assignment = null, summary = null;
    let storyboard = null, sceneGraph = null;

    if (wants('quiz')) {
        await progress(48, 'Creating quiz...');
        quiz = await softStep(warnings, 'Quiz', () =>
            courseAI.generateQuiz({ structured, questionCount: options.questionCount }));
        if (quiz) await saveArtifact(job, 'quiz', quiz);
    }
    if (wants('flashcards')) {
        await progress(58, 'Creating flashcards...');
        flashcards = await softStep(warnings, 'Flashcards', () => courseAI.generateFlashcards(structured));
        if (flashcards) await saveArtifact(job, 'flashcards', flashcards);
    }
    if (wants('slides')) {
        await progress(66, 'Generating slides...');
        slides = await softStep(warnings, 'Slides', () => courseAI.generateSlides(structured));
        if (slides) await saveArtifact(job, 'slides', slides);
    }
    if (wants('assignment')) {
        await progress(74, 'Creating assignment...');
        assignment = await softStep(warnings, 'Assignment', () => courseAI.generateAssignments(structured));
        if (assignment) await saveArtifact(job, 'assignment', assignment);
    }
    if (wants('summary')) {
        await progress(80, 'Writing summary notes...');
        summary = await softStep(warnings, 'Summary', () =>
            courseAI.generateSummary(lesson.markdown || JSON.stringify(structured)));
        if (summary) await saveArtifact(job, 'summary', summary);
    }
    let whiteboardVideo = null;
    if (wants('whiteboard')) {
        await progress(82, 'Creating storyboard...');
        storyboard = await softStep(warnings, 'Whiteboard video', () => courseAI.generateStoryboard(structured));
        if (storyboard) {
            await saveArtifact(job, 'storyboard', storyboard);
            // Deterministic compile — no AI, cannot hallucinate
            sceneGraph = await softStep(warnings, 'Whiteboard rendering', () =>
                courseAI.generateWhiteboardVideo(storyboard));
            if (sceneGraph) {
                await saveArtifact(job, 'scene_graph', sceneGraph);
                // Produce the real MP4 (narration TTS + frames + upload) and
                // host it on the same video storage as instructor uploads.
                whiteboardVideo = await softStep(warnings, 'Whiteboard video rendering', () =>
                    courseAI.renderWhiteboardVideo(storyboard, sceneGraph, {
                        title: lesson.title || structured.title,
                        onProgress: (f, label) => progress(85 + Math.round(f * 12), label || 'Rendering whiteboard video...'),
                    }));
                if (whiteboardVideo) {
                    await saveArtifact(job, 'whiteboard_video', whiteboardVideo);
                    if (!whiteboardVideo.voiced) {
                        warnings.push(`The whiteboard video was rendered without narration voice${whiteboardVideo.voiceError ? ` — ${whiteboardVideo.voiceError}` : ' (TTS unavailable)'}`);
                    }
                }
            }
        }
    }

    await progress(98, 'Finishing up...');
    return {
        structured,
        lesson,
        quiz,
        flashcards,
        slides,
        assignment,
        summary,
        storyboard,
        sceneGraph,
        whiteboardVideo,
        narration: storyboard ? courseAI.generateVoiceNarration(storyboard) : null,
        warnings,
        source: { sourceType: source.sourceType, fileUrl: source.fileUrl || null },
    };
}

/**
 * Whiteboard generation for an existing lesson or provided structured content.
 * input: { structured? , lessonId? }
 */
async function storyboardHandler(job, progress) {
    let structured = job.input.structured;
    if (!structured) {
        await progress(10, 'Loading lesson...');
        structured = await courseAI.extractContent(
            { sourceType: 'lesson', lessonId: job.input.lessonId || job.lessonId },
            {}, (label) => progress(20, label));
    }
    await progress(30, 'Creating storyboard...');
    const storyboard = await courseAI.generateStoryboard(structured);
    await saveArtifact(job, 'storyboard', storyboard);

    await progress(45, 'Rendering whiteboard video...');
    const sceneGraph = courseAI.generateWhiteboardVideo(storyboard);
    await saveArtifact(job, 'scene_graph', sceneGraph);

    // Produce the streamable MP4 (voice + drawing) on the platform's video storage
    const warnings = [];
    const whiteboardVideo = await softStep(warnings, 'Whiteboard video rendering', () =>
        courseAI.renderWhiteboardVideo(storyboard, sceneGraph, {
            title: sceneGraph.title,
            onProgress: (f, label) => progress(50 + Math.round(f * 45), label || 'Rendering whiteboard video...'),
        }));
    if (whiteboardVideo) await saveArtifact(job, 'whiteboard_video', whiteboardVideo);

    // Persist as an editable storyboard record with per-scene rows
    const sb = await query(
        `INSERT INTO storyboards (user_id, course_id, lesson_id, title, structured_content, total_duration_seconds)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [job.userId, job.courseId, job.lessonId || job.input.lessonId || null,
        sceneGraph.title, JSON.stringify(structured), Math.round(sceneGraph.totalDurationSeconds)]
    );
    const storyboardId = sb.rows[0].id;
    for (let i = 0; i < storyboard.scenes.length; i++) {
        await query(
            `INSERT INTO storyboard_scenes (storyboard_id, scene_index, scene, scene_graph)
             VALUES ($1, $2, $3, $4)`,
            [storyboardId, i, JSON.stringify(storyboard.scenes[i]), JSON.stringify(sceneGraph.scenes[i])]
        );
    }

    // If this whiteboard was generated for an existing lesson that has no
    // video yet, attach it so the lesson becomes playable immediately.
    const targetLessonId = job.lessonId || job.input.lessonId || null;
    if (whiteboardVideo?.url && targetLessonId) {
        await query(
            `UPDATE lessons SET video_url = $2, type = 'video',
                    video_duration = GREATEST(video_duration, $3), updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND (video_url IS NULL OR video_url = '')`,
            [targetLessonId, whiteboardVideo.url, whiteboardVideo.durationSeconds || 0]
        ).catch((err) => console.warn('[AI jobs] could not attach whiteboard video to lesson:', err.message));
    }

    return {
        storyboardId,
        storyboard,
        sceneGraph,
        whiteboardVideo,
        warnings,
        narration: courseAI.generateVoiceNarration(storyboard),
    };
}

/**
 * Lecture recording analysis (video import extras).
 * input: { fileUrl, mimeType? }
 */
async function recordingAnalysisHandler(job, progress) {
    await progress(10, 'Watching the recording...');
    const meta = { userId: job.userId, courseId: job.courseId, lessonId: job.lessonId };
    const analysis = await cached('recording_analysis', { fileUrl: job.input.fileUrl },
        () => courseAI.analyzeRecording(job.input.fileUrl, job.input.mimeType), meta);
    await progress(90, 'Organizing chapters...');
    await saveArtifact(job, 'recording_analysis', analysis);
    return analysis;
}

function registerAIJobHandlers() {
    jobs.registerHandler('lesson_pack', lessonPackHandler);
    jobs.registerHandler('storyboard', storyboardHandler);
    jobs.registerHandler('recording_analysis', recordingAnalysisHandler);
}

module.exports = { registerAIJobHandlers };
