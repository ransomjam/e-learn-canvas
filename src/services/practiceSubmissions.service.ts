import api from '@/lib/api';

export interface PracticeSubmission {
    id: string;
    lessonId?: string;
    lesson_id?: string;
    courseId?: string;
    course_id?: string;
    userId?: string;
    user_id?: string;
    fileUrl?: string;
    file_url?: string;
    fileName?: string;
    file_name?: string;
    fileSize?: number;
    file_size?: number;
    notes?: string;
    submittedAt?: string;
    submitted_at?: string;
    lessonTitle?: string;
    lesson_title?: string;
    courseTitle?: string;
    course_title?: string;
    firstName?: string;
    first_name?: string;
    lastName?: string;
    last_name?: string;
    email?: string;
    status?: 'pending' | 'approved' | 'rejected' | string;
    instructorFeedback?: string;
    instructor_feedback?: string;
    approvedAt?: string;
    approved_at?: string;
}


export const practiceSubmissionsService = {
    async submit(data: {
        lessonId: string;
        courseId: string;
        notes?: string;
    }, file?: File): Promise<PracticeSubmission> {
        // Try Cloudinary direct upload first if there's a file
        let fileUrl: string | undefined;
        let fileName: string | undefined;
        let fileSize: number | undefined;

        if (file) {
            try {
                const { instructorService: svc } = await import('./instructor.service');
                const uploaded = await svc.uploadFile(file);
                fileUrl = uploaded.url;
                fileName = file.name;
                fileSize = file.size;
            } catch {
                // Fall back to multipart upload via backend
                const formData = new FormData();
                formData.append('lessonId', data.lessonId);
                formData.append('courseId', data.courseId);
                if (data.notes) formData.append('notes', data.notes);
                formData.append('file', file);
                const response = await api.post('/practice-submissions', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    timeout: 5 * 60 * 1000,
                });
                return response.data.data;
            }
        }

        const body: Record<string, any> = { ...data };
        if (fileUrl) body.fileUrl = fileUrl;
        if (fileName) body.fileName = fileName;
        if (fileSize) body.fileSize = fileSize;

        const response = await api.post('/practice-submissions', body);
        return response.data.data;
    },

    async getMy(courseId?: string): Promise<PracticeSubmission[]> {
        const response = await api.get('/practice-submissions/my', {
            params: courseId ? { courseId } : undefined,
        });
        return response.data.data;
    },

    async getInstructor(params?: {
        courseId?: string;
        lessonId?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        submissions: PracticeSubmission[];
        pagination: { page: number; limit: number; total: number; pages: number };
    }> {
        const response = await api.get('/practice-submissions/instructor', { params });
        return response.data.data;
    },


    async updateApproval(id: string, data: {
        status: 'pending' | 'approved' | 'rejected';
        feedback?: string;
    }): Promise<PracticeSubmission> {
        const response = await api.patch(`/practice-submissions/${id}/approval`, data);
        return response.data.data;
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/practice-submissions/${id}`);
    },
};
