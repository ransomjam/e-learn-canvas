import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
    BookOpen, Search, Eye, EyeOff, Trash2, Edit, MoreVertical,
    Users, Star, Heart, Filter, ChevronDown, Loader2, CheckCircle, XCircle
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { coursesService, Course } from '@/services/courses.service';
import { resolveMediaUrl } from '@/lib/media';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const AdminCourses = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);

    const { data: coursesData, isLoading } = useQuery({
        queryKey: ['adminCourses', { search: searchQuery, status: statusFilter }],
        queryFn: () => coursesService.getAllCoursesAdmin({
            search: searchQuery || undefined,
            status: statusFilter || undefined,
            limit: 100,
        }),
    });

    const unpublishMutation = useMutation({
        mutationFn: (courseId: string) => coursesService.unpublishCourse(courseId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminCourses'] });
            toast({ title: 'Course unpublished', description: 'The course has been set to draft.' });
        },
        onError: () => {
            toast({ title: 'Error', description: 'Failed to unpublish course.', variant: 'destructive' });
        },
    });

    const publishMutation = useMutation({
        mutationFn: (courseId: string) => coursesService.publishCourse(courseId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminCourses'] });
            toast({ title: 'Course published', description: 'The course is now visible to students.' });
        },
        onError: () => {
            toast({ title: 'Error', description: 'Failed to publish course.', variant: 'destructive' });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (courseId: string) => coursesService.deleteCourse(courseId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminCourses'] });
            toast({ title: 'Course deleted', description: 'The course has been permanently removed.' });
            setDeleteDialogOpen(false);
            setCourseToDelete(null);
        },
        onError: () => {
            toast({ title: 'Error', description: 'Failed to delete course.', variant: 'destructive' });
        },
    });

    const courses = coursesData?.data || [];

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'published':
                return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle className="mr-1 h-3 w-3" />Published</Badge>;
            case 'draft':
                return <Badge variant="outline" className="text-yellow-400 border-yellow-500/30"><EyeOff className="mr-1 h-3 w-3" />Draft</Badge>;
            case 'archived':
                return <Badge variant="outline" className="text-muted-foreground"><XCircle className="mr-1 h-3 w-3" />Archived</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="font-display text-2xl font-bold text-foreground">All Courses</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Manage all courses on the platform ({coursesData?.pagination?.total || 0} total)
                        </p>
                    </div>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search courses..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Filter className="mr-2 h-4 w-4" />
                                {statusFilter ? statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) : 'All Status'}
                                <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => setStatusFilter('')}>All Status</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusFilter('published')}>Published</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusFilter('draft')}>Draft</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusFilter('archived')}>Archived</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Course List */}
                {isLoading ? (
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex gap-4 rounded-xl border border-border bg-card p-4">
                                <Skeleton className="h-20 w-32 rounded-lg flex-shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                    <Skeleton className="h-3 w-1/4" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : courses.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-12 text-center">
                        <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/30" />
                        <p className="mt-4 text-muted-foreground">No courses found</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {courses.map((course) => (
                            <div
                                key={course.id}
                                className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30 sm:flex-row sm:items-center"
                            >
                                {/* Thumbnail */}
                                <div className="h-20 w-32 flex-shrink-0 overflow-hidden rounded-lg bg-secondary">
                                    {resolveMediaUrl(course.thumbnailUrl) ? (
                                        <img
                                            src={resolveMediaUrl(course.thumbnailUrl)}
                                            alt={course.title}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                                            <BookOpen className="h-6 w-6 text-muted-foreground/30" />
                                        </div>
                                    )}
                                </div>

                                {/* Course Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <h3 className="text-sm font-semibold text-foreground truncate">{course.title}</h3>
                                        {getStatusBadge(course.status)}
                                    </div>
                                    <p className="text-xs text-muted-foreground mb-2">
                                        by {course.instructor.firstName} {course.instructor.lastName}
                                        {course.category && ` • ${course.category.name}`}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Users className="h-3.5 w-3.5" />
                                            {course.enrollmentCount} students
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                                            {course.ratingAvg?.toFixed(1) || '0.0'}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Heart className="h-3.5 w-3.5 fill-red-400 text-red-400" />
                                            {course.likesCount || 0} likes
                                        </span>
                                        <span className="font-medium text-foreground">
                                            {course.price === 0 ? 'Free' : `${course.price?.toLocaleString()} CFA`}
                                        </span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => window.open(`/course/${course.id}`, '_blank')}>
                                                <Eye className="mr-2 h-4 w-4" />
                                                View Course
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => navigate(`/instructor/courses/${course.id}/edit`)}>
                                                <Edit className="mr-2 h-4 w-4" />
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            {course.status === 'published' ? (
                                                <DropdownMenuItem
                                                    onClick={() => unpublishMutation.mutate(course.id)}
                                                    className="text-yellow-500"
                                                >
                                                    <EyeOff className="mr-2 h-4 w-4" />
                                                    Unpublish
                                                </DropdownMenuItem>
                                            ) : (
                                                <DropdownMenuItem
                                                    onClick={() => publishMutation.mutate(course.id)}
                                                    className="text-emerald-500"
                                                >
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    Publish
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={() => {
                                                    setCourseToDelete(course);
                                                    setDeleteDialogOpen(true);
                                                }}
                                                className="text-destructive"
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Course</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>"{courseToDelete?.title}"</strong>? This action cannot be undone and will remove all associated content, enrollments, and student progress.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => courseToDelete && deleteMutation.mutate(courseToDelete.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleteMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                'Delete Course'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AdminLayout>
    );
};

export default AdminCourses;
