import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { lazy, Suspense } from "react";

// Lazy-loaded pages (each gets its own chunk)
const Index = lazy(() => import("./pages/Index"));
const Courses = lazy(() => import("./pages/Courses"));
const CourseDetail = lazy(() => import("./pages/CourseDetail"));
const Auth = lazy(() => import("./pages/Auth"));
const Player = lazy(() => import("./pages/Player"));
const Profile = lazy(() => import("./pages/Profile"));
const InstructorDashboard = lazy(() => import("./pages/InstructorDashboard"));
const CourseEditor = lazy(() => import("./pages/CourseEditor"));
const MyCourses = lazy(() => import("./pages/MyCourses"));
const InstructorCourses = lazy(() => import("./pages/InstructorCourses"));
const InstructorSubmissions = lazy(() => import("./pages/InstructorSubmissions"));
const AddLesson = lazy(() => import("./pages/AddLesson"));
const AdminEnrollmentCodes = lazy(() => import("./pages/AdminEnrollmentCodes"));
const AdminStudents = lazy(() => import("./pages/AdminStudents"));
const AdminCourses = lazy(() => import("./pages/AdminCourses"));
const AdminInstructors = lazy(() => import("./pages/AdminInstructors"));
const PaymentCallback = lazy(() => import("./pages/PaymentCallback"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const EnrollmentClaim = lazy(() => import("./pages/EnrollmentClaim"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

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
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/courses" element={<Courses />} />
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
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </GoogleOAuthProvider>
);

export default App;
