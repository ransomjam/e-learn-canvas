import { useState, useCallback } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, Loader2, ArrowRight, GraduationCap, Presentation } from 'lucide-react';
import Logo from '@/components/common/Logo';
import { useGoogleLogin } from '@react-oauth/google';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage } from '@/services/auth.service';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, googleLogin, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });

  const [selectedRole, setSelectedRole] = useState<'learner' | 'instructor'>('learner');

  if (isAuthenticated) {
    const from = (location.state as { from?: Location })?.from?.pathname || '/dashboard';
    navigate(from, { replace: true });
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        toast({
          title: "Welcome back!",
          description: "You have been logged in successfully.",
        });
      } else {
        await register({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: selectedRole,
        });
        toast({
          title: "Account created!",
          description: "Welcome to Cradema. Start exploring courses.",
        });
      }

      const from = (location.state as { from?: Location })?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (error) {
      toast({
        title: isLogin ? "Login failed" : "Registration failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
<<<<<<< HEAD
          <Logo size="sm" className="h-8 w-8" />
          <span className="font-display text-xl font-bold text-foreground">
            Crad<span className="text-primary">ema</span>
=======
          <img src="/logo.png" alt="Cradema" className="h-9 w-9 rounded-lg" />
          <span className="font-display text-xl font-bold text-foreground">
            Cra<span className="text-primary">dema</span>
>>>>>>> 0a999ef1c7db9892e164ecf68d33fdccd5e26edb
          </span>
        </Link>

        <div className="relative space-y-6">
          <h2 className="font-display text-4xl font-bold leading-tight text-foreground">
            {isLogin
              ? 'Pick up right\nwhere you left off.'
              : 'Start learning\nsomething new today.'}
          </h2>
          <p className="max-w-sm text-muted-foreground">
            {isLogin
              ? 'Your courses, progress and certificates are waiting for you.'
              : 'Join thousands of learners mastering new skills with expert-led courses.'}
          </p>
        </div>

        <p className="relative text-xs text-muted-foreground">
          © {new Date().getFullYear()} Cradema. All rights reserved.
        </p>
      </div>

      {/* Right - Form */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center px-4 py-8 sm:px-6 lg:px-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo - centered at top */}
<<<<<<< HEAD
          <Link to="/" className="flex items-center justify-center gap-2 lg:hidden mb-8 sm:mb-10">
            <Logo size="md" className="h-9 w-9" />
            <span className="font-display text-lg font-bold text-foreground sm:text-xl">
              Crad<span className="text-primary">ema</span>
=======
           <Link to="/" className="flex items-center justify-center gap-2 lg:hidden mb-8 sm:mb-10">
            <img src="/logo.png" alt="Cradema" className="h-10 w-10 rounded-lg" />
            <span className="font-display text-lg font-bold text-foreground sm:text-xl">
              Cra<span className="text-primary">dema</span>
>>>>>>> 0a999ef1c7db9892e164ecf68d33fdccd5e26edb
            </span>
          </Link>

          {/* Centered form header */}
          <div className="text-center mb-8 sm:mb-10">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              {isLogin ? 'Welcome back' : 'Create account'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isLogin
                ? 'Enter your credentials to continue.'
                : 'Fill in your details to get started.'}
            </p>
          </div>

          {/* Form card */}
          <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-6 sm:p-8 shadow-lg">
            <form className="space-y-5" onSubmit={handleSubmit}>
              {!isLogin && (
                <>
                  {/* Role selector */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">I want to</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedRole('learner')}
                        className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-all ${selectedRole === 'learner'
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-background/50 text-muted-foreground hover:border-border hover:bg-muted/50'
                          }`}
                      >
                        <GraduationCap className="h-5 w-5" />
                        <span className="text-xs font-medium">Learn</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedRole('instructor')}
                        className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-all ${selectedRole === 'instructor'
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-background/50 text-muted-foreground hover:border-border hover:bg-muted/50'
                          }`}
                      >
                        <Presentation className="h-5 w-5" />
                        <span className="text-xs font-medium">Teach</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-sm font-medium">First name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="firstName"
                          placeholder="John"
                          className="pl-10 h-10 bg-background/50 border-border hover:border-border focus:border-primary/50 transition-colors"
                          value={formData.firstName}
                          onChange={handleChange}
                          required={!isLogin}
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-sm font-medium">Last name</Label>
                      <Input
                        id="lastName"
                        placeholder="Doe"
                        className="h-10 bg-background/50 border-border hover:border-border focus:border-primary/50 transition-colors"
                        value={formData.lastName}
                        onChange={handleChange}
                        required={!isLogin}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2 pt-2">
                <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    className="pl-10 h-10 bg-background/50 border-border hover:border-border focus:border-primary/50 transition-colors"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="pl-10 pr-10 h-10 bg-background/50 border-border hover:border-border focus:border-primary/50 transition-colors"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={6}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {isLogin && (
                <div className="flex justify-end pt-1">
                  <Link to="/forgot-password" className="text-xs text-primary/80 hover:text-primary transition-colors">
                    Forgot password?
                  </Link>
                </div>
              )}

              <Button size="lg" className="w-full h-10 font-semibold mt-2" type="submit" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                {isLogin ? 'Sign In' : 'Create Account'}
              </Button>
            </form>

            {/* Google Sign-In */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card/50 px-2 text-muted-foreground">
                  or continue with
                </span>
              </div>
            </div>

            <GoogleButton
              isLogin={isLogin}
              isLoading={isLoading}
              selectedRole={selectedRole}
            />
          </div>

          {/* === DEMO DATA === Only visible in development (localhost) */}
          {import.meta.env.DEV && isLogin && (
            <div className="mt-5 rounded-lg border border-dashed border-border/50 bg-secondary/20 p-4">
              <p className="text-center text-xs text-muted-foreground mb-3">
                Demo Login <span className="opacity-60">(password: demo123)</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Student 1', email: 'student1@demo.com', color: 'bg-emerald-600 hover:bg-emerald-700' },
                  { label: 'Student 2', email: 'student2@demo.com', color: 'bg-cyan-600 hover:bg-cyan-700' },
                  { label: 'Student 3', email: 'student3@demo.com', color: 'bg-violet-600 hover:bg-violet-700' },
                  { label: 'Instructor', email: 'instructor1@demo.com', color: 'bg-orange-600 hover:bg-orange-700' },
                ].map((demo) => (
                  <Button
                    key={demo.email}
                    type="button"
                    size="sm"
                    className={`${demo.color} text-white text-xs h-8`}
                    disabled={isLoading}
                    onClick={async () => {
                      setIsLoading(true);
                      try {
                        await login(demo.email, 'demo123');
                        toast({ title: 'Login successful!', description: `Logged in as ${demo.label}` });
                        const from = (location.state as { from?: Location })?.from?.pathname || '/dashboard';
                        navigate(from, { replace: true });
                      } catch (error) {
                        toast({
                          title: 'Login failed',
                          description: 'Run: node backend/src/database/seed-demo.js',
                          variant: 'destructive',
                        });
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                  >
                    {demo.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {/* === END DEMO DATA === */}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Custom Google sign-in button using useGoogleLogin (implicit flow).
 * Sends the access_token to the backend which fetches user info from Google.
 */
function GoogleButton({ isLogin, isLoading: parentLoading, selectedRole }: {
  isLogin: boolean;
  isLoading: boolean;
  selectedRole: 'learner' | 'instructor';
}) {
  const { googleLogin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      console.log('[Google Auth] onSuccess fired, token type:', tokenResponse.token_type);
      setLoading(true);
      try {
        const { isNewUser } = await googleLogin(
          tokenResponse.access_token,
          isLogin ? undefined : selectedRole
        );
        toast({
          title: isNewUser ? 'Account created!' : 'Welcome back!',
          description: isNewUser
            ? 'Your account was created with Google.'
            : 'You have been logged in with Google.',
        });
        const from = (location.state as { from?: Location })?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
      } catch (error) {
        console.error('[Google Auth] Backend call failed:', error);
        toast({
          title: 'Google sign-in failed',
          description: getErrorMessage(error),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    onError: (errorResponse) => {
      console.error('[Google Auth] onError:', errorResponse);
      toast({
        title: 'Google sign-in failed',
        description: `OAuth error: ${errorResponse?.error_description || errorResponse?.error || 'Unknown error. Make sure the OAuth consent screen is published in Google Cloud Console.'}`,
        variant: 'destructive',
      });
    },
    onNonOAuthError: (nonOAuthError) => {
      console.error('[Google Auth] onNonOAuthError:', nonOAuthError);
      if (nonOAuthError?.type === 'popup_closed') {
        toast({
          title: 'Sign-in cancelled',
          description: 'The Google sign-in popup was closed before completing.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Google sign-in failed',
          description: `Popup error: ${nonOAuthError?.type || 'Unknown'}. Try disabling popup blockers.`,
          variant: 'destructive',
        });
      }
    },
  });

  const disabled = loading || parentLoading;

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full h-10 gap-3 font-medium"
      onClick={() => handleGoogleLogin()}
      disabled={disabled}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
      )}
      {isLogin ? 'Sign in with Google' : 'Sign up with Google'}
    </Button>
  );
}

export default Auth;
