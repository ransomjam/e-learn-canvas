import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    BookOpen, Users, DollarSign, Star, Plus, BarChart3, Clock,
    TrendingUp, ChevronRight, Loader2, Bell, GraduationCap, Settings, LogOut, Eye
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { instructorService } from '@/services/instructor.service';
import { coursesService, Course } from '@/services/courses.service';
import { resolveMediaUrl } from '@/lib/media';

const InstructorDashboard = () => {
    const { user, logout } = useAuth();
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

    // Fetch recent reviews
    const { data: reviewsData } = useQuery({
        queryKey: ['instructorReviews'],
        queryFn: () => instructorService.getReviews({ limit: 5 }),
    });

    // Fetch earnings
    const { data: earningsData } = useQuery({
        queryKey: ['instructorEarnings', earningsPeriod],
        queryFn: () => instructorService.getEarnings(earningsPeriod),
    });

    // Fetch notifications
    const { data: notificationsData } = useQuery({
        queryKey: ['instructorNotifications'],
        queryFn: () => instructorService.getNotifications(),
    });

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

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
        <Layout>
            <div className="py-8 lg:py-12">
                <div className="container mx-auto px-4">
                    {/* Header */}
                    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-sm font-medium text-primary">Instructor Dashboard</p>
                            <h1 className="font-display text-3xl font-bold text-foreground">
                                Welcome, {user?.firstName}! 🎓
                            </h1>
                            <p className="mt-1 text-muted-foreground">
                                Manage your courses and track your teaching progress.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <Link to="/instructor/courses/new">
                                <Button className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    Create Course
                                </Button>
                            </Link>
                            <Link to="/profile">
                                <Button variant="outline" size="icon">
                                    <Settings className="h-4 w-4" />
                                </Button>
                            </Link>
                            <Button variant="ghost" size="icon" onClick={handleLogout}>
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <>
                            {/* Stats Grid */}
                            <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                                {statCards.map((stat, index) => (
                                    <div
                                        key={index}
                                        className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-lg lg:p-6"
                                    >
                                        <div className={`absolute top-0 right-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-gradient-to-br ${stat.color} opacity-10 transition-transform group-hover:scale-150`} />
                                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-secondary ${stat.iconColor}`}>
                                            <stat.icon className="h-5 w-5" />
                                        </div>
                                        <p className="mt-3 font-display text-2xl font-bold text-foreground lg:text-3xl">
                                            {stat.value}
                                        </p>
                                        <p className="text-xs text-muted-foreground lg:text-sm">{stat.label}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="grid gap-6 lg:grid-cols-3">
                                {/* Left Column - My Courses */}
                                <div className="lg:col-span-2 space-y-6">
                                    {/* My Courses Section */}
                                    <div className="rounded-xl border border-border bg-card">
                                        <div className="flex items-center justify-between border-b border-border p-4 lg:p-6">
                                            <h2 className="font-display text-xl font-bold text-foreground">
                                                My Courses
                                            </h2>
                                            <Link to="/instructor/courses/new" className="text-sm text-primary hover:underline">
                                                + New Course
                                            </Link>
                                        </div>

                                        {courses.length > 0 ? (
                                            <div className="divide-y divide-border">
                                                {courses.slice(0, 5).map((course: Course) => (
                                                    <div
                                                        key={course.id}
                                                        className="flex flex-col gap-3 p-4 transition-colors hover:bg-secondary/30 sm:flex-row sm:items-center lg:p-6"
                                                    >
                                                        <img
                                                            src={resolveMediaUrl(course.thumbnailUrl) || ''}
                                                            alt={course.title}
                                                            className="h-16 w-28 flex-shrink-0 rounded-lg object-cover"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src = '';
                                                                (e.target as HTMLImageElement).className = 'h-16 w-28 flex-shrink-0 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20';
                                                            }}
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="font-semibold text-foreground truncate">
                                                                {course.title}
                                                            </h3>
                                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                                                <span className="flex items-center gap-1">
                                                                    <Users className="h-3 w-3" />
                                                                    {course.enrollmentCount || 0}
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <Star className="h-3 w-3 text-amber-500" />
                                                                    {(course.ratingAvg || 0).toFixed(1)}
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <BookOpen className="h-3 w-3" />
                                                                    {course.lessonCount || 0} lessons
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {getStatusBadge(course.status)}
                                                            <Link to={`/instructor/courses/${course.id}/edit`}>
                                                                <Button variant="ghost" size="sm">
                                                                    Edit
                                                                </Button>
                                                            </Link>
                                                            <Link to={`/course/${course.id}`}>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                    <Eye className="h-4 w-4" />
                                                                </Button>
                                                            </Link>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-8 text-center">
                                                <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground/30" />
                                                <h3 className="mt-4 font-semibold text-foreground">No courses yet</h3>
                                                <p className="mt-2 text-sm text-muted-foreground">
                                                    Create your first course and start teaching.
                                                </p>
                                                <Link to="/instructor/courses/new">
                                                    <Button className="mt-4">Create Your First Course</Button>
                                                </Link>
                                            </div>
                                        )}

                                        {courses.length > 5 && (
                                            <div className="border-t border-border p-4">
                                                <Button variant="ghost" className="w-full" onClick={() => navigate('/instructor/courses')}>
                                                    View All Courses
                                                    <ChevronRight className="ml-2 h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Recent Students */}
                                    <div className="rounded-xl border border-border bg-card">
                                        <div className="border-b border-border p-4 lg:p-6">
                                            <h2 className="font-display text-xl font-bold text-foreground">
                                                Recent Students
                                            </h2>
                                        </div>
                                        {studentsData?.students && studentsData.students.length > 0 ? (
                                            <div className="divide-y divide-border">
                                                {studentsData.students.map((student) => (
                                                    <div key={`${student.id}-${student.course?.id}`} className="flex items-center gap-3 p-4 lg:p-5">
                                                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20 font-semibold text-primary">
                                                            {student.firstName?.[0]}{student.lastName?.[0]}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-foreground truncate">
                                                                {student.firstName} {student.lastName}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground truncate">
                                                                {student.course?.title}
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1">
                                                            <Progress value={student.progressPercentage || 0} className="h-1.5 w-16" />
                                                            <span className="text-xs text-muted-foreground">
                                                                {student.progressPercentage || 0}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-6 text-center text-muted-foreground text-sm">
                                                No students enrolled yet.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right Column - Sidebar */}
                                <div className="space-y-6">
                                    {/* Quick Actions */}
                                    <div className="rounded-xl border border-border bg-card p-4 lg:p-6">
                                        <h3 className="font-semibold text-foreground">Quick Actions</h3>
                                        <div className="mt-4 space-y-2">
                                            <Link to="/instructor/courses/new" className="block">
                                                <Button variant="outline" className="w-full justify-start gap-2">
                                                    <Plus className="h-4 w-4 text-primary" />
                                                    Create New Course
                                                </Button>
                                            </Link>
                                            <Link to="/courses" className="block">
                                                <Button variant="outline" className="w-full justify-start gap-2">
                                                    <Eye className="h-4 w-4 text-blue-400" />
                                                    Browse Marketplace
                                                </Button>
                                            </Link>
                                            <Link to="/profile" className="block">
                                                <Button variant="outline" className="w-full justify-start gap-2">
                                                    <Settings className="h-4 w-4 text-muted-foreground" />
                                                    Edit Profile
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>

                                    {/* Earnings Summary */}
                                    <div className="rounded-xl border border-border bg-card p-4 lg:p-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-semibold text-foreground">Earnings</h3>
                                            <TrendingUp className="h-5 w-5 text-emerald-500" />
                                        </div>
                                        <div className="mt-4">
                                            <p className="font-display text-3xl font-bold text-foreground">
                                                ${(earningsData?.total || 0).toLocaleString()}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {earningsData?.totalTransactions || 0} transactions
                                            </p>
                                            <div className="mt-4 flex gap-2">
                                                {['7d', '30d', '90d'].map((period) => (
                                                    <Button
                                                        key={period}
                                                        variant={earningsPeriod === period ? 'default' : 'outline'}
                                                        size="sm"
                                                        onClick={() => setEarningsPeriod(period)}
                                                        className="text-xs"
                                                    >
                                                        {period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : '90 Days'}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Recent Reviews */}
                                    <div className="rounded-xl border border-border bg-card p-4 lg:p-6">
                                        <h3 className="font-semibold text-foreground">Recent Reviews</h3>
                                        {reviewsData?.reviews && reviewsData.reviews.length > 0 ? (
                                            <div className="mt-4 space-y-4">
                                                {reviewsData.reviews.slice(0, 3).map((review) => (
                                                    <div key={review.id} className="border-b border-border pb-3 last:border-0">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex">
                                                                {[...Array(5)].map((_, i) => (
                                                                    <Star
                                                                        key={i}
                                                                        className={`h-3 w-3 ${i < review.rating ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/30'}`}
                                                                    />
                                                                ))}
                                                            </div>
                                                            <span className="text-xs text-muted-foreground">
                                                                {new Date(review.createdAt).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        {review.comment && (
                                                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                                                                {review.comment}
                                                            </p>
                                                        )}
                                                        <p className="mt-1 text-xs text-primary">
                                                            {review.user?.firstName} — {review.course?.title}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="mt-4 text-sm text-muted-foreground">No reviews yet.</p>
                                        )}
                                    </div>

                                    {/* Notifications */}
                                    <div className="rounded-xl border border-border bg-card p-4 lg:p-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-semibold text-foreground">Notifications</h3>
                                            {(notificationsData?.unreadCount || 0) > 0 && (
                                                <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                                                    {notificationsData?.unreadCount} new
                                                </Badge>
                                            )}
                                        </div>
                                        {notificationsData?.notifications && notificationsData.notifications.length > 0 ? (
                                            <div className="mt-4 space-y-3">
                                                {notificationsData.notifications.slice(0, 4).map((notification) => (
                                                    <div
                                                        key={notification.id}
                                                        className={`flex gap-3 rounded-lg p-2 text-sm ${!notification.isRead ? 'bg-primary/5' : ''}`}
                                                    >
                                                        <Bell className={`mt-0.5 h-4 w-4 flex-shrink-0 ${!notification.isRead ? 'text-primary' : 'text-muted-foreground'}`} />
                                                        <div className="min-w-0">
                                                            <p className="text-foreground line-clamp-2">{notification.message}</p>
                                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                                {new Date(notification.createdAt).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="mt-4 text-sm text-muted-foreground">No notifications.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default InstructorDashboard;
