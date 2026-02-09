import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredRoles?: Array<'learner' | 'instructor' | 'admin'>;
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
    const { user, isLoading, isAuthenticated } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    if (requiredRoles && user && !requiredRoles.includes(user.role)) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}
