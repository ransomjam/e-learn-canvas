import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import { lazy, Suspense } from "react";

/**
 * Retry a dynamic import up to `retries` times with an exponential back-off.
 * Mobile browsers on flaky connections frequently fail to fetch JS chunks on
 * the first attempt; this avoids a permanent blank screen.
 */
function lazyRetry<T extends { default: React.ComponentType<any> }>(
  factory: () => Promise<T>,
  retries = 3,
): React.LazyExoticComponent<T["default"]> {
  return lazy(() => {
    const attempt = (remaining: number): Promise<T> =>
      factory().catch((err) => {
        if (remaining <= 0) throw err;
        return new Promise<T>((res) =>
          setTimeout(() => res(attempt(remaining - 1)), 1000 * (retries - remaining + 1)),
        );
      });
    return attempt(retries);
  });
}

// Lazy-loaded pages (each gets its own chunk) – with automatic retry
const Index = lazyRetry(() => import("./pages/Index"));
const Courses = lazyRetry(() => import("./pages/Courses"));
const CourseDetail = lazyRetry(() => import("./pages/CourseDetail"));
const Auth = lazyRetry(() => import("./pages/Auth"));
const Player = lazyRetry(() => import("./pages/Player"));
const Profile = lazyRetry(() => import("./pages/Profile"));
const InstructorDashboard = lazyRetry(() => import("./pages/InstructorDashboard"));
const CourseEditor = lazyRetry(() => import("./pages/CourseEditor"));
const MyCourses = lazyRetry(() => import("./pages/MyCourses"));
const InstructorCourses = lazyRetry(() => import("./pages/InstructorCourses"));
const InstructorSubmissions = lazyRetry(() => import("./pages/InstructorSubmissions"));
const AddLesson = lazyRetry(() => import("./pages/AddLesson"));
const AdminEnrollmentCodes = lazyRetry(() => import("./pages/AdminEnrollmentCodes"));
const AdminStudents = lazyRetry(() => import("./pages/AdminStudents"));
const AdminCourses = lazyRetry(() => import("./pages/AdminCourses"));
const AdminInstructors = lazyRetry(() => import("./pages/AdminInstructors"));
const PaymentCallback = lazyRetry(() => import("./pages/PaymentCallback"));
const Wishlist = lazyRetry(() => import("./pages/Wishlist"));
const ProjectDetail = lazyRetry(() => import("./pages/ProjectDetail"));
const EnrollmentClaim = lazyRetry(() => import("./pages/EnrollmentClaim"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));
const ForgotPassword = lazyRetry(() => import("./pages/ForgotPassword"));
const ResetPassword = lazyRetry(() => import("./pages/ResetPassword"));
const Privacy = lazyRetry(() => import("./pages/Privacy"));
const Terms = lazyRetry(() => import("./pages/Terms"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '1009067757110-v97komeo68lkb232tqmnntdato37psm1.apps.googleusercontent.com';

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="cradema-theme">
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <ErrorBoundary>
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/courses" element={<Courses />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/course/:id" element={<CourseDetail />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/payment/callback" element={<PaymentCallback />} />
                <Route path="/dashboard" element={<Navigate to="/my-courses" replace />} />

                {/* Protected Routes */}
                <Route
                  path="/player/:id"
                  element={
                    <ProtectedRoute>
                      <Player />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my-courses"
                  element={
                    <ProtectedRoute>
                      <MyCourses />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/wishlist"
                  element={
                    <ProtectedRoute>
                      <Wishlist />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/course/:id/learn"
                  element={
                    <ProtectedRoute>
                      <Player />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/course/:courseId/project/:projectId"
                  element={
                    <ProtectedRoute>
                      <ProjectDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/course/:courseId/project/:projectId"
                  element={
                    <ProtectedRoute>
                      <ProjectDetail />
                    </ProtectedRoute>
                  }
                />

                {/* Enrollment Claim Page */}
                <Route
                  path="/enrollment"
                  element={
                    <ProtectedRoute>
                      <EnrollmentClaim />
                    </ProtectedRoute>
                  }
                />

                {/* Instructor Routes */}
                <Route
                  path="/instructor/courses"
                  element={
                    <ProtectedRoute requiredRoles={['instructor', 'admin']}>
                      <InstructorCourses />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/instructor/submissions"
                  element={
                    <ProtectedRoute requiredRoles={['instructor', 'admin']}>
                      <InstructorSubmissions />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/instructor"
                  element={
                    <ProtectedRoute requiredRoles={['instructor', 'admin']}>
                      <InstructorDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/instructor/courses/new"
                  element={
                    <ProtectedRoute requiredRoles={['instructor', 'admin']}>
                      <CourseEditor />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/instructor/courses/:id/edit"
                  element={
                    <ProtectedRoute requiredRoles={['instructor', 'admin']}>
                      <CourseEditor />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/instructor/courses/:courseId/lessons/new"
                  element={
                    <ProtectedRoute requiredRoles={['instructor', 'admin']}>
                      <AddLesson />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/instructor/admin-courses"
                  element={
                    <ProtectedRoute requiredRoles={['admin']}>
                      <AdminCourses />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/instructor/instructors"
                  element={
                    <ProtectedRoute requiredRoles={['admin']}>
                      <AdminInstructors />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/instructor/enrollment-codes"
                  element={
                    <ProtectedRoute requiredRoles={['admin']}>
                      <AdminEnrollmentCodes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/instructor/students"
                  element={
                    <ProtectedRoute requiredRoles={['admin']}>
                      <AdminStudents />
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
              </ErrorBoundary>
            </TooltipProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  </ThemeProvider>
);

export default App;
