import api from '@/lib/api';

export interface InstructorDashboard {
    totalCourses: number;
    totalStudents: number;
    activeStudents: number;
    totalRevenue: number;
    averageRating: string;
}

export interface InstructorStudent {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
    enrolledAt: string;
    progressPercentage: number;
    course: {
        id: string;
        title: string;
    };
}

export interface InstructorReview {
    id: string;
    rating: number;
    title?: string;
    comment?: string;
    createdAt: string;
    user: {
        id: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string;
    };
    course: {
        id: string;
        title: string;
    };
}

export interface EarningsData {
    earnings: Array<{
        date: string;
        revenue: number;
        transactions: number;
    }>;
    total: number;
    totalTransactions: number;
}

export interface InstructorNotification {
    id: string;
    type: string;
    message: string;
    isRead: boolean;
    createdAt: string;
}

export interface QuizAttempt {
    id: string;
    score: number;
    totalQuestions: number;
    passed: boolean;
    attemptedAt: string;
    student: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        avatarUrl?: string;
    };
    quiz: {
        id: string;
        title: string;
    };
    course: {
        id: string;
        title: string;
    };
}

export interface QuizAttemptDetail {
    id: string;
    score: number;
    totalQuestions: number;
    passed: boolean;
    answers: Array<{
        question: string;
        userAnswer: number;
        correctAnswer: number;
        isCorrect: boolean;
    }>;
    attemptedAt: string;
    student: {
        firstName: string;
        lastName: string;
        email: string;
        avatarUrl?: string;
    };
    quiz: {
        title: string;
        questions: Array<{
            question: string;
            options: string[];
            correctAnswer: number;
            explanation?: string;
        }>;
    };
    course: {
        id: string;
        title: string;
    };
}

export interface QuizStats {
    totalStudents: number;
    totalAttempts: number;
    avgScore: number;
    passedCount: number;
    failedCount: number;
}

export const instructorService = {
    async getDashboard(): Promise<InstructorDashboard> {
        const response = await api.get('/instructor/dashboard');
        return response.data.data;
    },

    async getStudents(params?: { page?: number; limit?: number; courseId?: string }): Promise<{
        students: InstructorStudent[];
        pagination: { page: number; limit: number; total: number; pages: number };
    }> {
        const response = await api.get('/instructor/students', { params });
        return response.data.data;
    },

    async getReviews(params?: { page?: number; limit?: number; courseId?: string }): Promise<{
        reviews: InstructorReview[];
        pagination: { page: number; limit: number; total: number; pages: number };
    }> {
        const response = await api.get('/instructor/reviews', { params });
        return response.data.data;
    },

    async getEarnings(period?: string): Promise<EarningsData> {
        const response = await api.get('/instructor/earnings', { params: { period } });
        return response.data.data;
    },

    async getNotifications(): Promise<{
        notifications: InstructorNotification[];
        unreadCount: number;
    }> {
        const response = await api.get('/instructor/notifications');
        return response.data.data;
    },

    async markNotificationsRead(notificationIds?: string[]): Promise<void> {
        await api.put('/instructor/notifications/read', { notificationIds });
    },

    async getAllSubmissions(params?: { courseId?: string; status?: string; page?: number; limit?: number }): Promise<{
        submissions: any[];
        pagination: { page: number; limit: number; total: number; pages: number };
    }> {
        const response = await api.get('/instructor/submissions', { params });
        return response.data.data;
    },

    // Quiz Attempts
    async getQuizAttempts(params?: { page?: number; limit?: number; courseId?: string; search?: string }): Promise<{
        attempts: QuizAttempt[];
        stats: QuizStats;
        courses: Array<{ id: string; title: string }>;
        pagination: { page: number; limit: number; total: number; pages: number };
    }> {
        const response = await api.get('/quiz/instructor/attempts', { params });
        return response.data.data;
    },

    async getQuizAttemptDetail(attemptId: string): Promise<QuizAttemptDetail> {
        const response = await api.get(`/quiz/instructor/attempts/${attemptId}`);
        return response.data.data;
    },

    // File upload — asks the backend which storage provider to use, then uploads
    // directly from the browser (bypasses Render's 30 s timeout entirely):
    //   bunny      → TUS resumable upload to Bunny Stream (videos, transcoded to HLS)
    //   r2         → presigned PUT to Cloudflare R2 (images, docs, everything else)
    //   cloudinary → legacy signed form upload (fallback while migrating)
    async uploadFile(file: File, onProgress?: (percent: number) => void): Promise<{ url: string; filename: string; fileType?: string; originalName?: string }> {
        // Detect file type from extension
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        let fileType = 'file';
        if (/jpeg|jpg|png|gif|webp/.test(ext)) fileType = 'image';
        else if (/mp4|webm|ogg|mov|avi|mkv/.test(ext)) fileType = 'video';
        else if (ext === 'pdf') fileType = 'pdf';
        else if (/pptx?/.test(ext)) fileType = 'ppt';
        else if (/docx?/.test(ext)) fileType = 'doc';

        try {
            // Step 1: Get signed upload params from backend
            const signRes = await api.get('/upload/sign', { params: { fileType, filename: file.name } });
            const sig = signRes.data.data;

            // ── Bunny Stream: TUS resumable upload ─────────────────────────────
            if (sig.provider === 'bunny') {
                const { Upload } = await import('tus-js-client');
                await new Promise<void>((resolve, reject) => {
                    const upload = new Upload(file, {
                        endpoint: sig.tusEndpoint,
                        retryDelays: [0, 3000, 5000, 10000, 20000],
                        headers: {
                            AuthorizationSignature: sig.signature,
                            AuthorizationExpire: String(sig.expiration),
                            VideoId: sig.videoId,
                            LibraryId: String(sig.libraryId),
                        },
                        metadata: {
                            filetype: file.type,
                            title: file.name,
                        },
                        onError: reject,
                        onProgress: (sent, total) => {
                            if (onProgress && total > 0) onProgress(Math.round((sent / total) * 100));
                        },
                        onSuccess: () => resolve(),
                    });
                    upload.start();
                });
                return {
                    url: sig.playbackUrl, // HLS playlist URL — stored in the DB
                    filename: file.name,
                    fileType,
                    originalName: file.name,
                };
            }

            // ── Cloudflare R2: presigned PUT ────────────────────────────────────
            if (sig.provider === 'r2') {
                const putRes = await fetch(sig.uploadUrl, {
                    method: 'PUT',
                    body: file,
                    headers: { 'Content-Type': sig.contentType || file.type || 'application/octet-stream' },
                });
                if (!putRes.ok) {
                    throw new Error(`R2 upload failed (${putRes.status})`);
                }
                if (onProgress) onProgress(100);
                return {
                    url: sig.publicUrl,
                    filename: file.name,
                    fileType,
                    originalName: file.name,
                };
            }

            // ── Cloudinary (legacy fallback) ────────────────────────────────────
            const cloudFormData = new FormData();
            cloudFormData.append('file', file);
            cloudFormData.append('api_key', sig.apiKey);
            cloudFormData.append('timestamp', String(sig.timestamp));
            cloudFormData.append('signature', sig.signature);
            cloudFormData.append('folder', sig.folder);
            if (sig.format) cloudFormData.append('format', sig.format);
            if (sig.use_filename) cloudFormData.append('use_filename', sig.use_filename);
            if (sig.unique_filename) cloudFormData.append('unique_filename', sig.unique_filename);

            const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${sig.cloudName}/${sig.resourceType}/upload`;
            const uploadRes = await fetch(cloudinaryUrl, {
                method: 'POST',
                body: cloudFormData,
            });

            if (!uploadRes.ok) {
                const errBody = await uploadRes.json().catch(() => ({}));
                throw new Error(errBody?.error?.message || `Cloudinary upload failed (${uploadRes.status})`);
            }

            const result = await uploadRes.json();
            let url = result.secure_url;
            // Ensure video URL ends with .mp4 for mobile compatibility
            if (sig.resourceType === 'video' && url && !url.endsWith('.mp4')) {
                url = url.replace(/\.[^/.]+$/, '.mp4');
            }

            return {
                url,
                filename: result.original_filename || file.name,
                fileType,
                originalName: file.name,
            };
        } catch (signErr: any) {
            // If direct upload fails (e.g. storage not configured), fall back
            // to the backend proxy upload (works in local dev)
            console.warn('Direct upload unavailable, falling back to backend proxy:', signErr?.message);
            const formData = new FormData();
            formData.append('file', file);
            const response = await api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 10 * 60 * 1000, // 10 min for large videos via backend
            });
            return response.data.data;
        }
    },

    // Section management
    async createSection(courseId: string, data: { title: string; description?: string }): Promise<any> {
        const response = await api.post('/lessons/sections', { courseId, ...data });
        return response.data.data;
    },

    async updateSection(sectionId: string, data: { title?: string; description?: string }): Promise<any> {
        const response = await api.put(`/lessons/sections/${sectionId}`, data);
        return response.data.data;
    },

    async deleteSection(sectionId: string): Promise<void> {
        await api.delete(`/lessons/sections/${sectionId}`);
    },

    // Lesson management
    async createLesson(data: {
        sectionId: string;
        courseId: string;
        title: string;
        type?: string;
        content?: string;
        videoUrl?: string;
        duration?: number;
        isFree?: boolean;
        isMandatory?: boolean;
        quizData?: any[];
        resources?: any[];
        practiceFiles?: any[];
    }): Promise<any> {
        const response = await api.post('/lessons', data);
        return response.data.data;
    },

    async updateLesson(lessonId: string, data: {
        title?: string;
        type?: string;
        content?: string;
        videoUrl?: string;
        duration?: number;
        isFree?: boolean;
        isMandatory?: boolean;
        quizData?: any[];
        resources?: any[];
        practiceFiles?: any[];
    }): Promise<any> {
        const response = await api.put(`/lessons/${lessonId}`, data);
        return response.data.data;
    },

    async deleteLesson(lessonId: string): Promise<void> {
        await api.delete(`/lessons/${lessonId}`);
    },

    async reorderLessons(sectionId: string, lessonIds: string[]): Promise<void> {
        await api.put(`/lessons/sections/${sectionId}/reorder`, { lessonIds });
    },

    async reorderSections(courseId: string, sectionIds: string[]): Promise<void> {
        await api.put(`/lessons/course/${courseId}/sections/reorder`, { sectionIds });
    },

    async reorderAllLessons(courseId: string, updates: { id: string, sectionId: string, orderIndex: number }[]): Promise<void> {
        await api.put(`/lessons/course/${courseId}/lessons/reorder-all`, { updates });
    },

    // Quiz Generation
    async generateQuiz(text: string, options?: { questionCount?: number; difficulty?: string }): Promise<any> {
        const response = await api.post('/quiz/generate', { text, options }, {
            timeout: 180000 // 3 min timeout for AI quiz generation (can generate many questions)
        });
        return response.data.data;
    }
};
