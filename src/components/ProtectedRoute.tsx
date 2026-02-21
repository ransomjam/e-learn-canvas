import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredRoles?: Array<'learner' | 'instructor' | 'admin'>;
}

const AUTH_LOADING_TIMEOUT_MS = 15_000;

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
    const { user, isLoading, isAuthenticated } = useAuth();
    const location = useLocation();
    const [timedOut, setTimedOut] = useState(false);

    // Safety-net: if auth stays "loading" beyond a threshold, let the user recover
    useEffect(() => {
        if (!isLoading) {
            setTimedOut(false);
            return;
        }
        const timer = setTimeout(() => setTimedOut(true), AUTH_LOADING_TIMEOUT_MS);
        return () => clearTimeout(timer);
    }, [isLoading]);

    if (isLoading && !timedOut) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Auth hung for too long — give the user an escape hatch
    if (isLoading && timedOut) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
                <p className="text-muted-foreground">Still loading… This is taking longer than expected.</p>
                <div className="flex gap-3">
                    <button
                        onClick={() => window.location.reload()}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
                    >
                        Reload page
                    </button>
                    <button
                        onClick={() => { window.location.href = '/'; }}
                        className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent transition-colors"
                    >
                        Go home
                    </button>
                </div>
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
