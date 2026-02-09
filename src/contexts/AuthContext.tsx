import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService, User } from '@/services/auth.service';
import { getAccessToken, clearTokens } from '@/lib/api';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (data: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Check for existing token on mount
    useEffect(() => {
        const initAuth = async () => {
            const token = getAccessToken();
            if (token) {
                try {
                    const userData = await authService.getMe();
                    setUser(userData);
                } catch {
                    clearTokens();
                }
            }
            setIsLoading(false);
        };
        initAuth();

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'accessToken' && !e.newValue) {
                setUser(null);
            }
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    const login = async (email: string, password: string) => {
        const { user: userData } = await authService.login({ email, password });
        setUser(userData);
    };

    const register = async (data: { email: string; password: string; firstName: string; lastName: string }) => {
        const { user: userData } = await authService.register(data);
        setUser(userData);
    };

    const logout = async () => {
        await authService.logout();
        setUser(null);
    };

    const refreshUser = async () => {
        try {
            const userData = await authService.getMe();
            setUser(userData);
        } catch {
            setUser(null);
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                login,
                register,
                logout,
                refreshUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
