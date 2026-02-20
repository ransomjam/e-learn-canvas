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

    // File upload
    async uploadFile(file: File): Promise<{ url: string; filename: string; fileType?: string; originalName?: string }> {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post('/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data.data;
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
};
