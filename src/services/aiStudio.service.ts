import api from '@/lib/api';
import type {
    AIJob,
    AIStatus,
    ApplyResult,
    AssistAction,
    GenerationInclude,
    GenerationSource,
    QuizQuestion,
    SceneGraph,
    LessonSummary,
    Flashcard,
} from '@/types/aiStudio';

/**
 * Client for the AI Course Studio API (/api/v1/ai).
 * The heavy generations are asynchronous: start a job, then poll it.
 */
export const aiStudioService = {
    /**
     * Upload a source file for AI ingestion as a RAW file (R2 presigned PUT
     * or backend proxy). Deliberately bypasses the Bunny Stream video path:
     * the AI needs a downloadable file, not an HLS playlist.
     */
    async uploadSourceFile(
        file: File,
        onProgress?: (percent: number) => void,
    ): Promise<{ url: string; mimeType: string }> {
        try {
            const signRes = await api.get('/upload/sign', {
                params: { fileType: 'file', filename: file.name },
            });
            const sig = signRes.data.data;
            if (sig.provider === 'r2') {
                const putRes = await fetch(sig.uploadUrl, {
                    method: 'PUT',
                    body: file,
                    headers: { 'Content-Type': sig.contentType || file.type || 'application/octet-stream' },
                });
                if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);
                onProgress?.(100);
                return { url: sig.publicUrl, mimeType: file.type };
            }
            throw new Error('No direct raw-file storage available');
        } catch {
            // Backend proxy fallback (local dev / storage not configured)
            const formData = new FormData();
            formData.append('file', file);
            const response = await api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 10 * 60 * 1000,
                onUploadProgress: (e) => {
                    if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
                },
            });
            return { url: response.data.data.url, mimeType: file.type };
        }
    },

    async getStatus(): Promise<AIStatus> {
        const response = await api.get('/ai/status');
        return response.data.data;
    },

    /** Start the full lesson generation pipeline from any source. */
    async generateLessonPack(params: {
        courseId: string;
        source: GenerationSource;
        options?: { language?: string; level?: string; questionCount?: number };
        include?: GenerationInclude;
    }): Promise<{ jobId: string }> {
        const response = await api.post('/ai/lessons/generate', params);
        return response.data.data;
    },

    async getJob(jobId: string): Promise<AIJob> {
        const response = await api.get(`/ai/jobs/${jobId}`);
        return response.data.data;
    },

    async cancelJob(jobId: string): Promise<void> {
        await api.post(`/ai/jobs/${jobId}/cancel`);
    },

    /**
     * Poll a job until it finishes. Calls onProgress on every tick.
     * Resolves with the completed job or rejects on failure/cancel.
     */
    pollJob(
        jobId: string,
        onProgress: (job: AIJob) => void,
        { intervalMs = 4000 }: { intervalMs?: number } = {},
    ): { promise: Promise<AIJob>; stop: () => void } {
        let stopped = false;
        const promise = new Promise<AIJob>((resolve, reject) => {
            const tick = async () => {
                if (stopped) return;
                try {
                    const job = await this.getJob(jobId);
                    if (stopped) return;
                    onProgress(job);
                    if (job.status === 'completed') return resolve(job);
                    if (job.status === 'failed') return reject(new Error(job.error || 'Generation failed'));
                    if (job.status === 'cancelled') return reject(new Error('Generation was cancelled'));
                    setTimeout(tick, intervalMs);
                } catch (err) {
                    // Transient polling errors: keep trying (job runs server-side)
                    if (!stopped) setTimeout(tick, intervalMs * 2);
                }
            };
            tick();
        });
        return { promise, stop: () => { stopped = true; } };
    },

    /** Persist a completed generation into the course. */
    async applyJob(
        jobId: string,
        params: {
            sectionId: string;
            title?: string;
            include?: { quizLesson?: boolean };
            overrides?: { markdown?: string };
        },
    ): Promise<ApplyResult> {
        const response = await api.post(`/ai/jobs/${jobId}/apply`, params);
        return response.data.data;
    },

    /** AI Assistant: rewrite content (improve/shorten/expand/...). */
    async assist(params: {
        content: string;
        action: AssistAction;
        instructions?: string;
        lessonId?: string;
    }): Promise<string> {
        const response = await api.post('/ai/assist', params, { timeout: 180000 });
        return response.data.data.markdown;
    },

    async generateQuiz(text: string, options?: { questionCount?: number; difficulty?: string }): Promise<QuizQuestion[]> {
        const response = await api.post('/ai/quiz', { text, ...options }, { timeout: 180000 });
        return response.data.data;
    },

    async generateSummary(text: string): Promise<LessonSummary> {
        const response = await api.post('/ai/summary', { text }, { timeout: 180000 });
        return response.data.data;
    },

    async translate(text: string, targetLanguage: string): Promise<string> {
        const response = await api.post('/ai/translate', { text, targetLanguage }, { timeout: 180000 });
        return response.data.data.markdown;
    },

    /** Whiteboard generation for an existing lesson (async job). */
    async createStoryboard(lessonId: string): Promise<{ jobId: string }> {
        const response = await api.post('/ai/storyboards', { lessonId });
        return response.data.data;
    },

    async getStoryboard(storyboardId: string): Promise<{
        id: string;
        lessonId?: string;
        title: string;
        totalDurationSeconds: number;
        sceneGraph: SceneGraph;
    }> {
        const response = await api.get(`/ai/storyboards/${storyboardId}`);
        return response.data.data;
    },

    async regenerateScene(storyboardId: string, sceneIndex: number, instructions?: string) {
        const response = await api.post(
            `/ai/storyboards/${storyboardId}/scenes/${sceneIndex}/regenerate`,
            { instructions },
            { timeout: 180000 },
        );
        return response.data.data;
    },

    async getLessonArtifacts(lessonId: string): Promise<{
        flashcardDecks: Array<{ id: string; title: string; cards: Flashcard[] }>;
        slideDecks: Array<{ id: string; title: string; slides: unknown[] }>;
        storyboards: Array<{ id: string; title: string; totalDurationSeconds: number }>;
    }> {
        const response = await api.get(`/ai/lessons/${lessonId}/artifacts`);
        return response.data.data;
    },
};
