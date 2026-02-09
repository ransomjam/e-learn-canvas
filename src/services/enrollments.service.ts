import api from '@/lib/api';

export interface Enrollment {
    id: string;
    courseId: string;
    status: 'active' | 'completed' | 'cancelled';
    progressPercentage: number;
    enrolledAt: string;
    completedAt?: string;
    course: {
        id: string;
        title: string;
        thumbnailUrl?: string;
        instructor: {
            firstName: string;
            lastName: string;
        };
    };
    lastAccessedLesson?: {
        id: string;
        title: string;
    };
}

export interface Progress {
    lessonId: string;
    isCompleted: boolean;
    completedAt?: string;
    watchTime?: number;
}

export interface CourseProgress {
    enrollmentId: string;
    progressPercentage: number;
    completedLessons: number;
    totalLessons: number;
    lessons: Progress[];
}

export interface LearningStats {
    totalEnrollments: number;
    completedCourses: number;
    inProgressCourses: number;
    totalLessonsCompleted: number;
    currentStreak: number;
    certificates: number;
}

export const enrollmentsService = {
    async getMyEnrollments(status?: string): Promise<Enrollment[]> {
        const response = await api.get('/enrollments', { params: { status } });
        return response.data.data.enrollments;
    },

    async getEnrollmentById(id: string): Promise<Enrollment> {
        const response = await api.get(`/enrollments/${id}`);
        return response.data.data;
    },

    async enrollInCourse(courseId: string): Promise<Enrollment> {
        const response = await api.post('/enrollments', { courseId });
        return response.data.data;
    },

    async cancelEnrollment(id: string): Promise<void> {
        await api.put(`/enrollments/${id}/cancel`);
    },

    async getCourseProgress(courseId: string): Promise<CourseProgress> {
        const response = await api.get(`/progress/course/${courseId}`);
        return response.data.data;
    },

    async updateProgress(lessonId: string, data: { isCompleted?: boolean; watchTime?: number }): Promise<void> {
        await api.post('/progress', { lessonId, ...data });
    },

    async completeLesson(lessonId: string): Promise<void> {
        await api.post(`/progress/complete/${lessonId}`);
    },

    async getLearningStats(): Promise<LearningStats> {
        const response = await api.get('/progress/stats');
        return response.data.data;
    },

    // Check if user is enrolled in a course
    async checkEnrollment(courseId: string): Promise<Enrollment | null> {
        try {
            const enrollments = await this.getMyEnrollments();
            return enrollments.find(e => e.courseId === courseId) || null;
        } catch {
            return null;
        }
    },
};
