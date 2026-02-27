import api from '@/lib/api';

export interface EnrollmentCode {
    id: string;
    code: string;
    courseId: string;
    courseTitle: string;
    isUsed: boolean;
    usedAt?: string;
    expiresAt?: string;
    createdAt: string;
    createdBy: string;
    usedBy?: {
        name: string;
        email: string;
    } | null;
}

export interface UserWithEnrollments {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    createdAt: string;
    enrollments: Array<{
        id: string;
        courseId: string;
        courseTitle: string;
        status: string;
        progressPercentage: number;
        lessonsCompleted: number;
        totalLessons: number;
        enrolledAt: string;
    }>;
    enrollmentCodes: Array<{
        code: string;
        courseId: string;
        courseTitle: string;
        usedAt: string;
    }>;
}

export interface PlatformVideo {
    id: number;
    videoUrl: string;
    thumbnailUrl?: string;
    title: string;
    description?: string;
    uploadedBy?: string;
    createdAt: string;
    updatedAt: string;
}

export const adminService = {
    // Enrollment Codes
    async generateEnrollmentCodes(courseId: string, count: number = 1, expiresAt?: string): Promise<{
        codes: EnrollmentCode[];
        course: { id: string; title: string };
    }> {
        const response = await api.post('/admin/enrollment-codes/generate', {
            courseId,
            count,
            expiresAt: expiresAt || undefined
        });
        return response.data.data;
    },

    async getEnrollmentCodes(params?: {
        page?: number;
        limit?: number;
        courseId?: string;
        isUsed?: string;
        search?: string;
    }): Promise<{
        codes: EnrollmentCode[];
        pagination: { page: number; limit: number; total: number; pages: number };
    }> {
        const response = await api.get('/admin/enrollment-codes', { params });
        return response.data.data;
    },

    async deleteEnrollmentCode(id: string): Promise<void> {
        await api.delete(`/admin/enrollment-codes/${id}`);
    },

    // Users with enrollment info
    async getUsersWithEnrollments(params?: {
        page?: number;
        limit?: number;
        search?: string;
    }): Promise<{
        users: UserWithEnrollments[];
        pagination: { page: number; limit: number; total: number; pages: number };
    }> {
        const response = await api.get('/admin/users/enrollments', { params });
        return response.data.data;
    },

    // Courses (for dropdown)
    async getAllCourses(): Promise<Array<{ id: string; title: string }>> {
        const response = await api.get('/admin/courses');
        return response.data.data.courses || [];
    },

    // Platform Video
    async getPlatformVideo(): Promise<PlatformVideo | null> {
        const response = await api.get('/admin/platform-video');
        return response.data.data;
    },

    async uploadPlatformVideo(data: {
        videoUrl: string;
        thumbnailUrl?: string;
        title?: string;
        description?: string;
    }): Promise<PlatformVideo> {
        const response = await api.post('/admin/platform-video', data);
        return response.data.data;
    },
};

