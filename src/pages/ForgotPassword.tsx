import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle2, Copy, Check } from 'lucide-react';
import Logo from '@/components/common/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/services/auth.service';
import api from '@/lib/api';

const ForgotPassword = () => {
    const { toast } = useToast();
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [resetLink, setResetLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await api.post('/auth/forgot-password', { email });
            setIsSubmitted(true);

            // In development, the backend returns the reset token directly
            const token = response.data?.resetToken;
            if (token) {
                const link = `${window.location.origin}/reset-password?token=${token}`;
                setResetLink(link);
                console.log('[Dev] Password reset link:', link);
            }

            toast({
                title: 'Reset link generated',
                description: 'Use the link below to reset your password.',
            });
        } catch (error) {
            toast({
                title: 'Request failed',
                description: getErrorMessage(error),
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!resetLink) return;
        await navigator.clipboard.writeText(resetLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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
                        Don't worry,{'\n'}we've got you.
                    </h2>
                    <p className="max-w-sm text-muted-foreground">
                        Enter your email and we'll generate a link to reset your password.
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
                            {isSubmitted ? 'Reset link ready' : 'Forgot password'}
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            {isSubmitted
                                ? 'Use the link below to reset your password.'
                                : 'Enter the email associated with your account.'}
                        </p>
                    </div>

                    {/* Card */}
                    <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-6 sm:p-8 shadow-lg">
                        {isSubmitted ? (
                            <div className="space-y-6">
                                {/* Success icon */}
                                <div className="flex justify-center">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                                        <CheckCircle2 className="h-8 w-8 text-primary" />
                                    </div>
                                </div>

                                {resetLink ? (
                                    <div className="space-y-4">
                                        <p className="text-center text-sm text-muted-foreground">
                                            A reset link has been generated for <span className="font-medium text-foreground">{email}</span>.
                                            Click the button below to reset your password.
                                        </p>

                                        <Link to={`/reset-password?token=${resetLink.split('token=')[1]}`}>
                                            <Button size="lg" className="w-full h-10 font-semibold">
                                                Reset Your Password
                                            </Button>
                                        </Link>

                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 text-xs bg-background/80 rounded px-2 py-1.5 break-all text-foreground/60 border border-border">
                                                {resetLink}
                                            </code>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="shrink-0 h-8 w-8 p-0"
                                                onClick={handleCopy}
                                            >
                                                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-center text-sm text-muted-foreground">
                                        No account found for <span className="font-medium text-foreground">{email}</span>.
                                        Please check the email address and try again.
                                    </p>
                                )}

                                <div className="space-y-3">
                                    <Button
                                        variant="outline"
                                        className="w-full h-10"
                                        onClick={() => {
                                            setIsSubmitted(false);
                                            setResetLink(null);
                                            setEmail('');
                                        }}
                                    >
                                        Try another email
                                    </Button>
                                    <Link to="/auth" className="block">
                                        <Button variant="ghost" className="w-full h-10 text-muted-foreground">
                                            <ArrowLeft className="mr-2 h-4 w-4" />
                                            Back to sign in
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <form className="space-y-5" onSubmit={handleSubmit}>
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="you@example.com"
                                            className="pl-10 h-10 bg-background/50 border-border hover:border-border focus:border-primary/50 transition-colors"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            disabled={isLoading}
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <Button size="lg" className="w-full h-10 font-semibold" type="submit" disabled={isLoading}>
                                    {isLoading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Mail className="mr-2 h-4 w-4" />
                                    )}
                                    Send Reset Link
                                </Button>
                            </form>
                        )}
                    </div>

                    {!isSubmitted && (
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

export default ForgotPassword;
