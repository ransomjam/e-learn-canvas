import api, { setTokens, clearTokens, getErrorMessage, getRefreshToken } from '@/lib/api';

export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'learner' | 'instructor' | 'admin';
    avatarUrl?: string;
    bio?: string;
    createdAt: string;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterData {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: 'learner' | 'instructor';
}

export interface AuthResponse {
    user: User;
    accessToken: string;
    refreshToken: string;
}

export const authService = {
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const response = await api.post('/auth/login', credentials);
        const { user, accessToken, refreshToken } = response.data.data;
        setTokens(accessToken, refreshToken);
        return { user, accessToken, refreshToken };
    },

    async register(data: RegisterData): Promise<AuthResponse> {
        const response = await api.post('/auth/register', data);
        const { user, accessToken, refreshToken } = response.data.data;
        setTokens(accessToken, refreshToken);
        return { user, accessToken, refreshToken };
    },

    async logout(): Promise<void> {
        try {
            const refreshToken = getRefreshToken();
            await api.post('/auth/logout', { refreshToken });
        } catch {
            // Ignore errors on logout
        } finally {
            clearTokens();
        }
    },

    async getMe(): Promise<User> {
        const response = await api.get('/auth/me');
        return response.data.data;
    },

    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
        await api.put('/auth/change-password', { currentPassword, newPassword });
    },

    async forgotPassword(email: string): Promise<void> {
        await api.post('/auth/forgot-password', { email });
    },

    async resetPassword(token: string, password: string): Promise<void> {
        await api.post('/auth/reset-password', { token, password });
    },
};

export { getErrorMessage };
