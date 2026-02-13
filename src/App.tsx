import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Courses from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Player from "./pages/Player";

import Profile from "./pages/Profile";
import InstructorDashboard from "./pages/InstructorDashboard";
import CourseEditor from "./pages/CourseEditor";
import MyCourses from "./pages/MyCourses";
import InstructorCourses from "./pages/InstructorCourses";
import AddLesson from "./pages/AddLesson";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

const App = () => (
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


            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
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
              path="/course/:id/learn"
              element={
                <ProtectedRoute>
                  <Player />
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

            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
