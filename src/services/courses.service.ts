import api from '@/lib/api';

export interface Course {
    id: string;
    title: string;
    slug: string;
    shortDescription?: string;
    description?: string;
    thumbnailUrl?: string;
    price: number;
    discountPrice?: number;
    currency: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    status: 'draft' | 'published' | 'archived';
    language?: string;
    duration?: number;
    lessonCount: number;
    enrollmentCount: number;
    likesCount?: number;
    ratingAvg: number;
    ratingCount: number;
    instructor: {
        id: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string;
        bio?: string;
    };
    category?: {
        id: string;
        name: string;
    };
    isFree: boolean;
    createdAt: string;
    objectives?: string[];
    requirements?: string[];
    isEnrolled?: boolean;
    sections?: any[];
}

export interface Category {
    id: string;
    name: string;
    slug: string;
    description?: string;
    courseCount: number;
}

export interface Section {
    id: string;
    title: string;
    orderIndex: number;
    lessons: Lesson[];
}

export interface Lesson {
    id: string;
    title: string;
    type: 'video' | 'text' | 'quiz' | 'assignment' | 'document' | 'pdf' | 'ppt' | 'doc';
    duration?: number;
    orderIndex: number;
    isFree: boolean;
    isCompleted?: boolean;
    videoUrl?: string;
    content?: string;
    resources?: any;
    practiceFiles?: any;
}

export interface CoursesParams {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    level?: string;
    sortBy?: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export const coursesService = {
    async getCourses(params: CoursesParams = {}): Promise<PaginatedResponse<Course>> {
        const response = await api.get('/courses', { params });
        return {
            data: response.data.data.courses,
            pagination: response.data.data.pagination,
        };
    },

    async getCourseById(id: string): Promise<Course> {
        const response = await api.get(`/courses/${id}`);
        return response.data.data;
    },

    async getCourseBySlug(slug: string): Promise<Course> {
        const response = await api.get(`/courses/${slug}`);
        return response.data.data;
    },

    async getCategories(): Promise<Category[]> {
        const response = await api.get('/courses/categories');
        return response.data.data;
    },

    async getCourseLessons(courseId: string): Promise<Section[]> {
        const response = await api.get(`/lessons/course/${courseId}`);
        return response.data.data.sections || [];
    },

    async getLessonById(lessonId: string): Promise<Lesson> {
        const response = await api.get(`/lessons/${lessonId}`);
        return response.data.data;
    },

    // Instructor methods
    async createCourse(data: Partial<Course>): Promise<Course> {
        const response = await api.post('/courses', data);
        return response.data.data;
    },

    async updateCourse(id: string, data: Partial<Course>): Promise<Course> {
        const response = await api.put(`/courses/${id}`, data);
        return response.data.data;
    },

    async publishCourse(id: string): Promise<void> {
        await api.put(`/courses/${id}/publish`);
    },

    async getInstructorCourses(): Promise<Course[]> {
        const response = await api.get('/courses/instructor/me');
        return response.data.data.courses;
    },

    async deleteCourse(id: string): Promise<void> {
        await api.delete(`/courses/${id}`);
    },

    // Resource methods
    async getResources(courseId: string): Promise<any[]> {
        const response = await api.get(`/courses/${courseId}/resources`);
        return response.data.data;
    },

    async addResource(courseId: string, data: { title: string, url: string, type?: string, description?: string }): Promise<any> {
        const response = await api.post(`/courses/${courseId}/resources`, data);
        return response.data.data;
    },

    async deleteResource(courseId: string, resourceId: string): Promise<void> {
        await api.delete(`/courses/${courseId}/resources/${resourceId}`);
    },

    // Chat methods
    async getChatMessages(courseId: string): Promise<any[]> {
        const response = await api.get(`/courses/${courseId}/chat`);
        return response.data.data;
    },

    async postChatMessage(courseId: string, message: string, replyTo?: string): Promise<any> {
        const response = await api.post(`/courses/${courseId}/chat`, { message, replyTo });
        return response.data.data;
    },

    async deleteChatMessage(courseId: string, messageId: string): Promise<void> {
        await api.delete(`/courses/${courseId}/chat/${messageId}`);
    },

    // Review methods
    async getReviews(courseId: string, params?: { page?: number; limit?: number }): Promise<any> {
        const response = await api.get(`/courses/${courseId}/reviews`, { params });
        return response.data.data;
    },

    async addReview(courseId: string, data: { rating: number; title?: string; comment?: string }): Promise<any> {
        const response = await api.post(`/courses/${courseId}/reviews`, data);
        return response.data.data;
    },

    async updateReview(courseId: string, data: { rating: number; title?: string; comment?: string }): Promise<any> {
        const response = await api.put(`/courses/${courseId}/reviews/me`, data);
        return response.data.data;
    },

    async getUserReview(courseId: string): Promise<any> {
        const response = await api.get(`/courses/${courseId}/reviews/me`);
        return response.data.data;
    },

    // Lesson likes
    async toggleLessonLike(lessonId: string): Promise<{ liked: boolean; likesCount: number }> {
        const response = await api.post(`/lessons/${lessonId}/like`);
        return response.data.data;
    },

    async getLessonLikes(lessonId: string): Promise<{ likesCount: number; liked: boolean }> {
        const response = await api.get(`/lessons/${lessonId}/likes`);
        return response.data.data;
    },

    // Course likes (global)
    async getCourseLikes(courseId: string): Promise<{ likesCount: number; liked: boolean }> {
        const response = await api.get(`/courses/${courseId}/likes`);
        return response.data.data;
    },

    // Admin methods
    async getAllCoursesAdmin(params?: { page?: number; limit?: number; search?: string; status?: string; instructorId?: string }): Promise<PaginatedResponse<Course>> {
        const response = await api.get('/courses/admin/all', { params });
        return {
            data: response.data.data.courses,
            pagination: response.data.data.pagination,
        };
    },

    async unpublishCourse(id: string): Promise<void> {
        await api.put(`/courses/${id}/unpublish`);
    },
};
