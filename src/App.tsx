import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Courses from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import Auth from "./pages/Auth";
import Player from "./pages/Player";

import Profile from "./pages/Profile";
import InstructorDashboard from "./pages/InstructorDashboard";
import CourseEditor from "./pages/CourseEditor";
import MyCourses from "./pages/MyCourses";
import InstructorCourses from "./pages/InstructorCourses";
import InstructorSubmissions from "./pages/InstructorSubmissions";
import AddLesson from "./pages/AddLesson";
import AdminEnrollmentCodes from "./pages/AdminEnrollmentCodes";
import AdminStudents from "./pages/AdminStudents";
import AdminCourses from "./pages/AdminCourses";
import AdminInstructors from "./pages/AdminInstructors";
import PaymentCallback from "./pages/PaymentCallback";
import Wishlist from "./pages/Wishlist";
import ProjectDetail from "./pages/ProjectDetail";
import NotFound from "./pages/NotFound";

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
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/course/:id" element={<CourseDetail />} />
            <Route path="/auth" element={<Auth />} />
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
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
  </GoogleOAuthProvider>
);

export default App;
