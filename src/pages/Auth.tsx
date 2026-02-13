import { useState } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Mail, Lock, User, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
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
  const { login, register, isAuthenticated } = useAuth();
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
        });
        toast({
          title: "Account created!",
          description: "Welcome to LearnHub. Start exploring courses.",
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
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold text-foreground">
            Learn<span className="text-primary">Hub</span>
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
          © {new Date().getFullYear()} LearnHub. All rights reserved.
        </p>
      </div>

      {/* Right - Form */}
      <div className="flex w-full lg:w-1/2 flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          {/* Mobile logo */}
          <Link to="/" className="flex items-center gap-2 lg:hidden mb-10">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold text-foreground">
              Learn<span className="text-primary">Hub</span>
            </span>
          </Link>

          <h1 className="font-display text-2xl font-bold text-foreground">
            {isLogin ? 'Sign in' : 'Create account'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLogin
              ? 'Enter your credentials to continue.'
              : 'Fill in your details to get started.'}
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName" className="text-xs">First name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="firstName"
                      placeholder="John"
                      className="pl-9"
                      value={formData.firstName}
                      onChange={handleChange}
                      required={!isLogin}
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName" className="text-xs">Last name</Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={handleChange}
                    required={!isLogin}
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="pl-9"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-9 pr-9"
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
              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
            )}

            <Button size="lg" className="w-full" type="submit" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              {isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          {/* === DEMO DATA === Remove this entire block before production */}
          {isLogin && (
            <div className="mt-6 rounded-lg border border-dashed border-border bg-secondary/30 p-4">
              <p className="text-center text-xs text-muted-foreground mb-3">
                🧪 Quick Demo Login <span className="opacity-60">(password: demo123)</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '👩 Student 1', email: 'student1@demo.com', color: 'bg-emerald-600 hover:bg-emerald-700' },
                  { label: '👨 Student 2', email: 'student2@demo.com', color: 'bg-cyan-600 hover:bg-cyan-700' },
                  { label: '👩 Student 3', email: 'student3@demo.com', color: 'bg-violet-600 hover:bg-violet-700' },
                  { label: '👨‍🏫 Instructor', email: 'instructor1@demo.com', color: 'bg-orange-600 hover:bg-orange-700' },
                ].map((demo) => (
                  <Button
                    key={demo.email}
                    type="button"
                    size="sm"
                    className={`${demo.color} text-white text-xs`}
                    disabled={isLoading}
                    onClick={async () => {
                      setIsLoading(true);
                      try {
                        await login(demo.email, 'demo123');
                        toast({ title: 'Demo login successful!', description: `Logged in as ${demo.label}` });
                        const from = (location.state as { from?: Location })?.from?.pathname || '/dashboard';
                        navigate(from, { replace: true });
                      } catch (error) {
                        toast({
                          title: 'Demo login failed',
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

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="font-semibold text-primary hover:underline"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
