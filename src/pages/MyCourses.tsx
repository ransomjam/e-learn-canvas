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
                    {/* Header */}
                    <div className="mb-8">
                        <p className="text-sm font-medium text-primary">My Learning</p>
                        <h1 className="font-display text-3xl font-bold text-foreground">My Courses</h1>
                        <p className="mt-1 text-muted-foreground">
                            Track your learning progress and continue where you left off.
                        </p>
                    </div>

                    {/* Stats */}
                    <div className="mb-8 grid grid-cols-3 gap-3">
                        <div className="rounded-xl border border-border bg-card p-4 text-center">
                            <BookOpen className="mx-auto h-5 w-5 text-primary" />
                            <p className="mt-2 font-display text-2xl font-bold text-foreground">
                                {enrollments.length}
                            </p>
                            <p className="text-xs text-muted-foreground">Enrolled</p>
                        </div>
                        <div className="rounded-xl border border-border bg-card p-4 text-center">
                            <TrendingUp className="mx-auto h-5 w-5 text-blue-500" />
                            <p className="mt-2 font-display text-2xl font-bold text-foreground">
                                {inProgressCount}
                            </p>
                            <p className="text-xs text-muted-foreground">In Progress</p>
                        </div>
                        <div className="rounded-xl border border-border bg-card p-4 text-center">
                            <Award className="mx-auto h-5 w-5 text-emerald-500" />
                            <p className="mt-2 font-display text-2xl font-bold text-foreground">
                                {completedCount}
                            </p>
                            <p className="text-xs text-muted-foreground">Completed</p>
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
