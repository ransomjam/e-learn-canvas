/**
 * Background AI job queue — DB-persisted, in-process worker.
 *
 * Long generations (full lesson packs, video analysis, storyboards) run
 * asynchronously; the frontend polls GET /api/v1/ai/jobs/:id for progress.
 *
 * - Jobs survive restarts: rows live in ai_jobs; on boot, jobs stuck in
 *   'running' are re-queued (resume interrupted generations).
 * - Claiming uses FOR UPDATE SKIP LOCKED so multiple server instances
 *   never double-run a job.
 * - Failed jobs retry up to aiConfig.jobMaxAttempts before being marked
 *   'failed' with the error preserved for the UI.
 */
const { query } = require('../../config/database');
const aiConfig = require('../../config/ai');

const handlers = new Map(); // job type → async (job, progress) => result
let runningCount = 0;
let pumping = false;

function registerHandler(type, fn) {
    handlers.set(type, fn);
}

function rowToJob(row) {
    if (!row) return null;
    return {
        id: row.id,
        userId: row.user_id,
        courseId: row.course_id,
        lessonId: row.lesson_id,
        type: row.type,
        status: row.status,
        progress: row.progress,
        stepLabel: row.step_label,
        input: row.input || {},
        result: row.result,
        error: row.error,
        attempts: row.attempts,
        createdAt: row.created_at,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
    };
}

/** Create a job and kick the worker. */
async function enqueue({ userId, courseId = null, lessonId = null, type, input = {} }) {
    if (!handlers.has(type)) throw new Error(`No handler registered for job type "${type}"`);
    const result = await query(
        `INSERT INTO ai_jobs (user_id, course_id, lesson_id, type, input, step_label)
         VALUES ($1, $2, $3, $4, $5, 'Queued...') RETURNING *`,
        [userId, courseId, lessonId, type, JSON.stringify(input)]
    );
    setImmediate(pump);
    return rowToJob(result.rows[0]);
}

async function getJob(jobId, userId) {
    const result = await query(
        `SELECT * FROM ai_jobs WHERE id = $1${userId ? ' AND user_id = $2' : ''}`,
        userId ? [jobId, userId] : [jobId]
    );
    return rowToJob(result.rows[0]);
}

async function listJobs({ userId, courseId, limit = 20 }) {
    const params = [userId];
    let where = 'user_id = $1';
    if (courseId) {
        params.push(courseId);
        where += ` AND course_id = $${params.length}`;
    }
    params.push(limit);
    const result = await query(
        `SELECT id, user_id, course_id, lesson_id, type, status, progress, step_label,
                error, created_at, finished_at
         FROM ai_jobs WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
        params
    );
    return result.rows.map(rowToJob);
}

async function cancelJob(jobId, userId) {
    const result = await query(
        `UPDATE ai_jobs SET status = 'cancelled', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2 AND status IN ('queued', 'running') RETURNING *`,
        [jobId, userId]
    );
    return rowToJob(result.rows[0]);
}

async function updateProgress(jobId, progress, stepLabel) {
    await query(
        `UPDATE ai_jobs SET progress = $2, step_label = COALESCE($3, step_label), updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status = 'running'`,
        [jobId, Math.min(99, Math.max(0, Math.round(progress))), stepLabel || null]
    ).catch((err) => console.warn('[AI jobs] progress update failed:', err.message));
}

/** Claim the next queued job atomically (safe across instances). */
async function claimNext() {
    const result = await query(
        `UPDATE ai_jobs SET status = 'running', started_at = CURRENT_TIMESTAMP,
                attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = (
            SELECT id FROM ai_jobs WHERE status = 'queued'
            ORDER BY created_at ASC
            FOR UPDATE SKIP LOCKED LIMIT 1
         )
         RETURNING *`
    );
    return rowToJob(result.rows[0]);
}

async function runJob(job) {
    const handler = handlers.get(job.type);
    const progress = (pct, label) => updateProgress(job.id, pct, label);
    try {
        if (!handler) throw new Error(`No handler for job type "${job.type}"`);
        const result = await handler(job, progress);

        // Don't overwrite a cancellation that happened mid-run
        await query(
            `UPDATE ai_jobs SET status = 'completed', progress = 100, step_label = 'Done',
                    result = $2, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND status = 'running'`,
            [job.id, JSON.stringify(result ?? {})]
        );
    } catch (err) {
        console.error(`[AI jobs] job ${job.id} (${job.type}) failed:`, err.message);
        // Provider auth/config errors will fail identically on retry — don't waste attempts
        const permanent = [401, 403, 503].includes(err.statusCode);
        const willRetry = !permanent && job.attempts < aiConfig.jobMaxAttempts;
        await query(
            `UPDATE ai_jobs SET status = $2::varchar, error = $3, step_label = $4,
                    finished_at = CASE WHEN $2::varchar = 'failed' THEN CURRENT_TIMESTAMP ELSE finished_at END,
                    updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND status = 'running'`,
            [job.id, willRetry ? 'queued' : 'failed', err.message, willRetry ? 'Retrying...' : 'Failed']
        ).catch((e) => console.error('[AI jobs] failed to record job failure:', e.message));
    }
}

/** Worker loop: run queued jobs up to the configured concurrency. */
async function pump() {
    if (pumping) return;
    pumping = true;
    try {
        while (runningCount < aiConfig.jobConcurrency) {
            const job = await claimNext();
            if (!job) break;
            runningCount++;
            runJob(job)
                .finally(() => {
                    runningCount--;
                    setImmediate(pump);
                });
        }
    } catch (err) {
        console.error('[AI jobs] worker pump error:', err.message);
    } finally {
        pumping = false;
    }
}

/** Called once on server boot: resume jobs interrupted by a restart. */
async function recoverInterruptedJobs() {
    try {
        const result = await query(
            `UPDATE ai_jobs SET status = 'queued', step_label = 'Resuming...', updated_at = CURRENT_TIMESTAMP
             WHERE status = 'running' RETURNING id`
        );
        if (result.rows.length > 0) {
            console.log(`[AI jobs] re-queued ${result.rows.length} interrupted job(s)`);
        }
        setImmediate(pump);
        // Also poll periodically in case another instance enqueued work
        setInterval(pump, 30000).unref();
    } catch (err) {
        // Table may not exist yet (migration not run) — don't crash the server
        console.warn('[AI jobs] recovery skipped:', err.message);
    }
}

module.exports = {
    registerHandler,
    enqueue,
    getJob,
    listJobs,
    cancelJob,
    recoverInterruptedJobs,
};
