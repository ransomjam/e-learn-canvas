import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    BookOpen, Users, DollarSign, Star, Plus, BarChart3, Clock,
    TrendingUp, ChevronRight, Loader2, Bell, GraduationCap, Settings, LogOut, Eye, ArrowUpRight
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { instructorService } from '@/services/instructor.service';
import { coursesService, Course } from '@/services/courses.service';
import { resolveMediaUrl } from '@/lib/media';

const InstructorDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [earningsPeriod, setEarningsPeriod] = useState('30d');

    // Fetch dashboard stats
    const { data: dashboard, isLoading: dashboardLoading } = useQuery({
        queryKey: ['instructorDashboard'],
        queryFn: () => instructorService.getDashboard(),
    });

    // Fetch instructor's courses
    const { data: courses = [], isLoading: coursesLoading } = useQuery({
        queryKey: ['instructorCourses'],
        queryFn: () => coursesService.getInstructorCourses(),
    });

    // Fetch recent students
    const { data: studentsData } = useQuery({
        queryKey: ['instructorStudents'],
        queryFn: () => instructorService.getStudents({ limit: 5 }),
    });

    const isLoading = dashboardLoading || coursesLoading;

    const statCards = [
        {
            icon: BookOpen,
            value: dashboard?.totalCourses || 0,
            label: 'Total Courses',
            color: 'from-violet-500 to-purple-600',
            iconColor: 'text-violet-500',
        },
        {
            icon: Users,
            value: dashboard?.totalStudents || 0,
            label: 'Total Students',
            color: 'from-blue-500 to-cyan-500',
            iconColor: 'text-blue-500',
        },
        {
            icon: DollarSign,
            value: `$${(dashboard?.totalRevenue || 0).toLocaleString()}`,
            label: 'Total Revenue',
            color: 'from-emerald-500 to-green-500',
            iconColor: 'text-emerald-500',
        },
        {
            icon: Star,
            value: dashboard?.averageRating || '0.0',
            label: 'Avg. Rating',
            color: 'from-amber-500 to-orange-500',
            iconColor: 'text-amber-500',
        },
    ];

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'published':
                return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Published</Badge>;
            case 'draft':
                return <Badge variant="outline" className="text-yellow-400 border-yellow-500/30">Draft</Badge>;
            case 'archived':
                return <Badge variant="outline" className="text-muted-foreground">Archived</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <AdminLayout>
            <div className="space-y-8">
                {/* Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="font-display text-3xl font-bold text-foreground">
                            Dashboard
                        </h1>
                        <p className="mt-1 text-muted-foreground">
                            Welcome back, {user?.firstName}! Here's what's happening today.
                        </p>
                    </div>
                    <div>
                        <Link to="/instructor/courses/new">
                            <Button className="gap-2">
                                <Plus className="h-4 w-4" />
                                Create New Course
                            </Button>
                        </Link>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <>
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {statCards.map((stat, index) => (
                                <div
                                    key={index}
                                    className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/50 ${stat.iconColor}`}>
                                            <stat.icon className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                                            <h3 className="font-display text-2xl font-bold text-foreground">{stat.value}</h3>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid gap-6 lg:grid-cols-3">
                            {/* Main Content Column */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Recent Enrollments / Students */}
                                <div className="rounded-xl border border-border bg-card shadow-sm">
                                    <div className="flex items-center justify-between border-b border-border p-6">
                                        <h2 className="font-display text-lg font-bold text-foreground">
                                            Recent Students
                                        </h2>
                                        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                                            View All <ArrowUpRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="p-0">
                                        {studentsData?.students && studentsData.students.length > 0 ? (
                                            <div className="divide-y divide-border">
                                                {studentsData.students.map((student) => (
                                                    <div key={`${student.id}-${student.course?.id}`} className="flex items-center gap-4 p-4 hover:bg-secondary/20">
                                                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                                                            {student.firstName?.[0]}{student.lastName?.[0]}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-medium text-foreground truncate">
                                                                {student.firstName} {student.lastName}
                                                            </p>
                                                            <p className="text-sm text-muted-foreground truncate">
                                                                Enrolled in {student.course?.title}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm font-medium text-foreground">{student.progressPercentage}%</p>
                                                            <Progress value={student.progressPercentage} className="h-1.5 w-16" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-8 text-center text-muted-foreground">
                                                No students enrolled yet.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Top Performing Courses */}
                                <div className="rounded-xl border border-border bg-card shadow-sm">
                                    <div className="flex items-center justify-between border-b border-border p-6">
                                        <h2 className="font-display text-lg font-bold text-foreground">
                                            Top Courses
                                        </h2>
                                        <Link to="/instructor/courses">
                                            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                                                View All <ArrowUpRight className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                    </div>
                                    <div className="p-0">
                                        {courses.slice(0, 3).map((course) => (
                                            <div key={course.id} className="flex items-center gap-4 border-b border-border p-4 last:border-0 hover:bg-secondary/20">
                                                <img
                                                    src={resolveMediaUrl(course.thumbnailUrl)}
                                                    alt={course.title}
                                                    className="h-12 w-20 rounded object-cover"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = '';
                                                        (e.target as HTMLImageElement).className = 'h-12 w-20 rounded bg-secondary';
                                                    }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-medium text-foreground truncate">{course.title}</h3>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            <Users className="h-3 w-3" /> {course.enrollmentCount} students
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Star className="h-3 w-3 text-amber-500" /> {course.ratingAvg?.toFixed(1) || '0.0'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-medium text-foreground">${course.price}</p>
                                                    {getStatusBadge(course.status)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column */}
                            <div className="space-y-6">
                                {/* Earnings Chart Placeholder */}
                                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                                    <div className="mb-4 flex items-center justify-between">
                                        <h3 className="font-semibold text-foreground">Earnings Overview</h3>
                                        <select
                                            className="rounded-md border border-border bg-secondary px-2 py-1 text-xs"
                                            value={earningsPeriod}
                                            onChange={(e) => setEarningsPeriod(e.target.value)}
                                        >
                                            <option value="7d">Last 7 days</option>
                                            <option value="30d">Last 30 days</option>
                                            <option value="90d">Last 90 days</option>
                                        </select>
                                    </div>
                                    <div className="flex h-48 items-center justify-center rounded-lg bg-secondary/30 border border-dashed border-border">
                                        <div className="text-center text-muted-foreground">
                                            <BarChart3 className="mx-auto h-8 w-8 opacity-50 mb-2" />
                                            <p className="text-sm">Chart visualization coming soon</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-4">
                                        <div className="rounded-lg bg-secondary/30 p-3">
                                            <p className="text-xs text-muted-foreground">Revenue</p>
                                            <p className="font-bold text-foreground">${(dashboard?.totalRevenue || 0).toLocaleString()}</p>
                                        </div>
                                        <div className="rounded-lg bg-secondary/30 p-3">
                                            <p className="text-xs text-muted-foreground">Sales</p>
                                            <p className="font-bold text-foreground">{dashboard?.totalStudents || 0}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </AdminLayout>
    );
};

export default InstructorDashboard;
