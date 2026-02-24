import api from '@/lib/api';

export interface Project {
    id: string;
    courseId: string;
    title: string;
    description?: string;
    instructions?: string;
    dueDate?: string;
    due_date?: string;
    maxFileSize?: number;
    allowedFileTypes?: string;
    attachmentUrl?: string;
    attachment_url?: string;
    attachmentName?: string;
    attachment_name?: string;
    submissionCount?: number;
    submission_count?: number;
    createdAt: string;
    updatedAt: string;
}

export interface ProjectSubmission {
    id: string;
    projectId: string;
    userId: string;
    submissionUrl?: string;
    submission_url?: string;
    submissionText?: string;
    submission_text?: string;
    fileName?: string;
    file_name?: string;
    fileSize?: number;
    file_size?: number;
    status: 'submitted' | 'graded';
    grade?: number;
    instructorFeedback?: string;
    instructor_feedback?: string;
    instructorId?: string;
    submittedAt: string;
    submitted_at?: string;
    gradedAt?: string;
    updatedAt: string;
    firstName?: string;
    first_name?: string;
    lastName?: string;
    last_name?: string;
    email?: string;
    instructorFirstName?: string;
    instructorLastName?: string;
}

export interface ProjectWithSubmission {
    project: Project;
    submission: ProjectSubmission | null;
}

export const projectsService = {
    async getCourseProjects(courseId: string): Promise<Project[]> {
        const response = await api.get(`/courses/${courseId}/projects`);
        return response.data.data;
    },

    async getProject(projectId: string): Promise<ProjectWithSubmission> {
        const response = await api.get(`/courses/projects/${projectId}`);
        return response.data.data;
    },

    async createProject(courseId: string, data: {
        title: string;
        description?: string;
        instructions?: string;
        dueDate?: string;
    }, file?: File): Promise<Project> {
        // If there's a file, upload directly to Cloudinary first
        let attachmentUrl: string | undefined;
        let attachmentName: string | undefined;
        if (file) {
            try {
                const { instructorService: svc } = await import('./instructor.service');
                const uploaded = await svc.uploadFile(file);
                attachmentUrl = uploaded.url;
                attachmentName = file.name;
            } catch {
                // Fall back to multipart upload through backend
                const formData = new FormData();
                formData.append('title', data.title);
                if (data.description) formData.append('description', data.description);
                if (data.instructions) formData.append('instructions', data.instructions);
                if (data.dueDate) formData.append('dueDate', data.dueDate);
                formData.append('file', file);
                const response = await api.post(`/courses/${courseId}/projects`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    timeout: 5 * 60 * 1000,
                });
                return response.data.data;
            }
        }

        const body: Record<string, any> = { ...data };
        if (attachmentUrl) body.attachmentUrl = attachmentUrl;
        if (attachmentName) body.attachmentName = attachmentName;

        const response = await api.post(`/courses/${courseId}/projects`, body);
        return response.data.data;
    },

    async updateProject(projectId: string, data: {
        title?: string;
        description?: string;
        instructions?: string;
        dueDate?: string;
    }, file?: File): Promise<Project> {
        // If there's a file, upload directly to Cloudinary first
        let attachmentUrl: string | undefined;
        let attachmentName: string | undefined;
        if (file) {
            try {
                const { instructorService: svc } = await import('./instructor.service');
                const uploaded = await svc.uploadFile(file);
                attachmentUrl = uploaded.url;
                attachmentName = file.name;
            } catch {
                // Fall back to multipart upload through backend
                const formData = new FormData();
                if (data.title) formData.append('title', data.title);
                if (data.description !== undefined) formData.append('description', data.description || '');
                if (data.instructions !== undefined) formData.append('instructions', data.instructions || '');
                if (data.dueDate) formData.append('dueDate', data.dueDate);
                formData.append('file', file);
                const response = await api.put(`/courses/projects/${projectId}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    timeout: 5 * 60 * 1000,
                });
                return response.data.data;
            }
        }

        const body: Record<string, any> = { ...data };
        if (attachmentUrl) body.attachmentUrl = attachmentUrl;
        if (attachmentName) body.attachmentName = attachmentName;

        const response = await api.put(`/courses/projects/${projectId}`, body);
        return response.data.data;
    },

    async deleteProject(projectId: string): Promise<void> {
        await api.delete(`/courses/projects/${projectId}`);
    },

    async submitProject(projectId: string, data: {
        submissionText?: string;
    }, file?: File): Promise<ProjectSubmission> {
        // If there's a file, upload directly to Cloudinary first
        let submissionUrl: string | undefined;
        let fileName: string | undefined;
        let fileSize: number | undefined;
        if (file) {
            try {
                const { instructorService: svc } = await import('./instructor.service');
                const uploaded = await svc.uploadFile(file);
                submissionUrl = uploaded.url;
                fileName = file.name;
                fileSize = file.size;
            } catch {
                // Fall back to multipart upload through backend
                const formData = new FormData();
                if (data.submissionText) formData.append('submissionText', data.submissionText);
                formData.append('file', file);
                const response = await api.post(`/courses/projects/${projectId}/submit`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    timeout: 5 * 60 * 1000,
                });
                return response.data.data;
            }
        }

        const body: Record<string, any> = { ...data };
        if (submissionUrl) body.submissionUrl = submissionUrl;
        if (fileName) body.fileName = fileName;
        if (fileSize) body.fileSize = fileSize;

        const response = await api.post(`/courses/projects/${projectId}/submit`, body);
        return response.data.data;
    },

    async getProjectSubmissions(projectId: string): Promise<ProjectSubmission[]> {
        const response = await api.get(`/courses/projects/${projectId}/submissions`);
        return response.data.data;
    },

    async getPublicProjectSubmissions(projectId: string): Promise<ProjectSubmission[]> {
        const response = await api.get(`/courses/projects/${projectId}/submissions/public`);
        return response.data.data;
    },

    async gradeSubmission(submissionId: string, data: {
        grade?: number;
        feedback?: string;
    }): Promise<ProjectSubmission> {
        const response = await api.put(`/courses/projects/submissions/${submissionId}/grade`, data);
        return response.data.data;
    }
};
