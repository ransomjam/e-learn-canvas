import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    BookOpen, Clock, CheckCircle2, Play, Loader2, Search, Filter,
    TrendingUp, Award, GraduationCap
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { enrollmentsService } from '@/services/enrollments.service';
import { resolveMediaUrl } from '@/lib/media';

const MyCourses = () => {
    const { user } = useAuth();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');

    const { data: enrollments = [], isLoading } = useQuery({
        queryKey: ['myEnrollments'],
        queryFn: () => enrollmentsService.getMyEnrollments(),
    });

    const filtered = enrollments.filter((enrollment: any) => {
        const matchesSearch =
            !search ||
            enrollment.course?.title?.toLowerCase().includes(search.toLowerCase());
        const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'completed' && enrollment.progressPercentage >= 100) ||
            (statusFilter === 'active' && enrollment.progressPercentage < 100);
        return matchesSearch && matchesStatus;
    });

    const completedCount = enrollments.filter((e: any) => e.progressPercentage >= 100).length;
    const inProgressCount = enrollments.filter((e: any) => e.progressPercentage > 0 && e.progressPercentage < 100).length;

    return (
        <Layout>
            <div className="py-8 lg:py-12">
                <div className="container mx-auto px-4">
                    {/* Header & Stats Section */}
                    <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between border-b border-border/50 pb-6">
                        {/* Header */}
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <GraduationCap className="h-4 w-4 text-primary" />
                                </div>
                                <span className="text-sm font-semibold tracking-wider text-primary uppercase">My Learning</span>
                            </div>
                            <h1 className="font-display text-3xl font-bold text-foreground">My Courses</h1>
                            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
                                Track your learning progress and continue where you left off.
                            </p>
                        </div>

                        {/* Stats */}
                        <div className="flex w-full sm:w-auto items-center justify-between gap-1.5 sm:gap-3">
                            <div className="flex flex-1 sm:flex-none items-center justify-center sm:justify-start gap-1.5 sm:gap-3 rounded-lg border border-border/50 bg-card/40 p-2 sm:px-4 sm:py-2.5 shadow-sm transition-colors hover:bg-card/60 hover:border-border min-w-0">
                                <div className="flex h-6 w-6 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                    <BookOpen className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <p className="text-[8px] sm:text-[10px] font-medium uppercase tracking-normal sm:tracking-wider text-muted-foreground truncate">Enrolled</p>
                                    <p className="font-display text-sm sm:text-lg font-bold leading-none text-foreground mt-0.5">
                                        {enrollments.length}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-1 sm:flex-none items-center justify-center sm:justify-start gap-1.5 sm:gap-3 rounded-lg border border-border/50 bg-card/40 p-2 sm:px-4 sm:py-2.5 shadow-sm transition-colors hover:bg-card/60 hover:border-border min-w-0">
                                <div className="flex h-6 w-6 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                                    <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <p className="text-[8px] sm:text-[10px] font-medium uppercase tracking-normal sm:tracking-wider text-muted-foreground truncate">In Progress</p>
                                    <p className="font-display text-sm sm:text-lg font-bold leading-none text-foreground mt-0.5">
                                        {inProgressCount}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-1 sm:flex-none items-center justify-center sm:justify-start gap-1.5 sm:gap-3 rounded-lg border border-border/50 bg-card/40 p-2 sm:px-4 sm:py-2.5 shadow-sm transition-colors hover:bg-card/60 hover:border-border min-w-0">
                                <div className="flex h-6 w-6 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                                    <Award className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-500" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <p className="text-[8px] sm:text-[10px] font-medium uppercase tracking-normal sm:tracking-wider text-muted-foreground truncate">Completed</p>
                                    <p className="font-display text-sm sm:text-lg font-bold leading-none text-foreground mt-0.5">
                                        {completedCount}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search courses..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="flex gap-2">
                            {(['all', 'active', 'completed'] as const).map((status) => (
                                <Button
                                    key={status}
                                    variant={statusFilter === status ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setStatusFilter(status)}
                                    className="capitalize"
                                >
                                    {status}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Course List */}
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : filtered.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {filtered.map((enrollment: any) => {
                                const course = enrollment.course;
                                const progress = enrollment.progressPercentage || 0;
                                const isComplete = progress >= 100;

                                return (
                                    <Link
                                        key={enrollment.id}
                                        to={`/course/${course?.id || enrollment.courseId}/learn`}
                                        className="group rounded-xl border border-border bg-card overflow-hidden transition-all hover:border-primary/30 hover:shadow-lg"
                                    >
                                        {/* Thumbnail */}
                                        <div className="relative aspect-video overflow-hidden bg-secondary">
                                            {course?.thumbnailUrl ? (
                                                <img
                                                    src={resolveMediaUrl(course.thumbnailUrl)}
                                                    alt={course.title}
                                                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                                                    <GraduationCap className="h-12 w-12 text-muted-foreground/20" />
                                                </div>
                                            )}
                                            {isComplete && (
                                                <div className="absolute top-3 right-3">
                                                    <Badge className="bg-emerald-500/90 text-white gap-1">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Complete
                                                    </Badge>
                                                </div>
                                            )}
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                                    <Play className="h-5 w-5" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="p-4">
                                            <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                                                {course?.title || 'Course'}
                                            </h3>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {course?.instructor
                                                    ? `${course.instructor.firstName} ${course.instructor.lastName}`
                                                    : ''}
                                            </p>

                                            {/* Progress */}
                                            <div className="mt-3">
                                                <div className="flex items-center justify-between text-xs mb-1">
                                                    <span className="text-muted-foreground">Progress</span>
                                                    <span className={`font-medium ${isComplete ? 'text-emerald-500' : 'text-primary'}`}>
                                                        {Math.round(progress)}%
                                                    </span>
                                                </div>
                                                <Progress value={progress} className="h-1.5" />
                                            </div>

                                            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {enrollment.lastAccessedAt
                                                        ? `Last: ${new Date(enrollment.lastAccessedAt).toLocaleDateString()}`
                                                        : 'Not started'}
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-16 text-center">
                            <GraduationCap className="mx-auto h-16 w-16 text-muted-foreground/20" />
                            <h3 className="mt-4 font-display text-xl font-bold text-foreground">
                                {enrollments.length > 0 ? 'No matching courses' : "You haven't enrolled in any courses yet"}
                            </h3>
                            <p className="mt-2 text-muted-foreground">
                                {enrollments.length > 0
                                    ? 'Try adjusting your search or filters.'
                                    : 'Browse our catalog and start learning today.'}
                            </p>
                            {enrollments.length === 0 && (
                                <Link to="/courses">
                                    <Button className="mt-6">Browse Courses</Button>
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default MyCourses;
