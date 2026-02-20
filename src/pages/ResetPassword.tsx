import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, ArrowRight, AlertTriangle } from 'lucide-react';
import Logo from '@/components/common/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { authService, getErrorMessage } from '@/services/auth.service';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const { toast } = useToast();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast({
                title: 'Passwords do not match',
                description: 'Please make sure both passwords are the same.',
                variant: 'destructive',
            });
            return;
        }

        if (!token) {
            setError('Reset token is missing. Please use the link from your email.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await authService.resetPassword(token, password);
            setIsSuccess(true);
            toast({
                title: 'Password reset successful!',
                description: 'You can now sign in with your new password.',
            });
        } catch (err) {
            const message = getErrorMessage(err);
            setError(message);
            toast({
                title: 'Reset failed',
                description: message,
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    // No token provided
    if (!token && !isSuccess) {
        return (
            <div className="flex min-h-screen items-center justify-center px-4">
                <div className="w-full max-w-sm text-center space-y-6">
                    <div className="flex justify-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                            <AlertTriangle className="h-8 w-8 text-destructive" />
                        </div>
                    </div>
                    <div>
                        <h1 className="font-display text-2xl font-bold text-foreground">Invalid Reset Link</h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            This password reset link is invalid or missing a token. Please request a new reset link.
                        </p>
                    </div>
                    <div className="space-y-3">
                        <Link to="/forgot-password">
                            <Button className="w-full h-10 font-semibold">
                                Request New Link
                            </Button>
                        </Link>
                        <Link to="/auth">
                            <Button variant="ghost" className="w-full h-10 text-muted-foreground mt-2">
                                Back to sign in
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen">
            {/* Left - Branding panel */}
            <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-card p-12 relative overflow-hidden">
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-primary/15 blur-[100px]" />
                    <div className="absolute right-0 bottom-0 h-72 w-72 rounded-full bg-accent/15 blur-[100px]" />
                </div>

                <Link to="/" className="relative flex items-center gap-2">
                    <Logo size="sm" className="h-8 w-8" />
                    <span className="font-display text-xl font-bold text-foreground">
                        Crad<span className="text-primary">ema</span>
                    </span>
                </Link>

                <div className="relative space-y-6">
                    <h2 className="font-display text-4xl font-bold leading-tight text-foreground">
                        {isSuccess ? 'All set!' : 'Almost there.'}
                    </h2>
                    <p className="max-w-sm text-muted-foreground">
                        {isSuccess
                            ? 'Your password has been updated. You can now sign in with your new password.'
                            : 'Choose a strong password to keep your account secure.'}
                    </p>
                </div>

                <p className="relative text-xs text-muted-foreground">
                    © {new Date().getFullYear()} Cradema. All rights reserved.
                </p>
            </div>

            {/* Right - Form */}
            <div className="flex w-full lg:w-1/2 flex-col items-center justify-center px-4 py-8 sm:px-6 lg:px-12">
                <div className="w-full max-w-sm">
                    {/* Mobile logo */}
                    <Link to="/" className="flex items-center justify-center gap-2 lg:hidden mb-8 sm:mb-10">
                        <Logo size="md" className="h-9 w-9" />
                        <span className="font-display text-lg font-bold text-foreground sm:text-xl">
                            Crad<span className="text-primary">ema</span>
                        </span>
                    </Link>

                    {/* Header */}
                    <div className="text-center mb-8 sm:mb-10">
                        <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                            {isSuccess ? 'Password updated!' : 'Reset your password'}
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            {isSuccess
                                ? 'Your password has been changed successfully.'
                                : 'Enter your new password below.'}
                        </p>
                    </div>

                    {/* Card */}
                    <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-6 sm:p-8 shadow-lg">
                        {isSuccess ? (
                            <div className="space-y-6">
                                <div className="flex justify-center">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                                        <CheckCircle2 className="h-8 w-8 text-primary" />
                                    </div>
                                </div>

                                <p className="text-center text-sm text-muted-foreground">
                                    You can now sign in with your new password.
                                </p>

                                <Link to="/auth">
                                    <Button size="lg" className="w-full h-10 font-semibold">
                                        <ArrowRight className="mr-2 h-4 w-4" />
                                        Sign in
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <form className="space-y-5" onSubmit={handleSubmit}>
                                {error && (
                                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-start gap-2">
                                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="password" className="text-sm font-medium">New password</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="••••••••"
                                            className="pl-10 pr-10 h-10 bg-background/50 border-border hover:border-border focus:border-primary/50 transition-colors"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            minLength={8}
                                            disabled={isLoading}
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Min 8 characters with uppercase, lowercase, and a number.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm password</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            id="confirmPassword"
                                            type={showConfirm ? 'text' : 'password'}
                                            placeholder="••••••••"
                                            className="pl-10 pr-10 h-10 bg-background/50 border-border hover:border-border focus:border-primary/50 transition-colors"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            minLength={8}
                                            disabled={isLoading}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirm(!showConfirm)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                {password && confirmPassword && password !== confirmPassword && (
                                    <p className="text-xs text-destructive flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        Passwords do not match
                                    </p>
                                )}

                                <Button
                                    size="lg"
                                    className="w-full h-10 font-semibold mt-2"
                                    type="submit"
                                    disabled={isLoading || (password !== confirmPassword && confirmPassword.length > 0)}
                                >
                                    {isLoading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Lock className="mr-2 h-4 w-4" />
                                    )}
                                    Reset Password
                                </Button>
                            </form>
                        )}
                    </div>

                    {!isSuccess && (
                        <p className="mt-6 text-center text-xs text-muted-foreground">
                            Remember your password?{' '}
                            <Link to="/auth" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                                Sign in
                            </Link>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
