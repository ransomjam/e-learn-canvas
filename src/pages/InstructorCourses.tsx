import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    BookOpen, Users, Star, Plus, Eye, MoreVertical, Edit, Trash2
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { coursesService, Course } from '@/services/courses.service';
import { resolveMediaUrl } from '@/lib/media';
import { Loader2 } from 'lucide-react';

const InstructorCourses = () => {
    const navigate = useNavigate();

    // Fetch instructor's courses
    const { data: courses = [], isLoading } = useQuery({
        queryKey: ['instructorCourses'],
        queryFn: () => coursesService.getInstructorCourses(),
    });

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
            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="font-display text-3xl font-bold text-foreground">My Courses</h1>
                        <p className="text-muted-foreground mt-1">
                            Manage your courses and content
                        </p>
                    </div>
                    <Link to="/instructor/courses/new">
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Create New Course
                        </Button>
                    </Link>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : courses.length > 0 ? (
                    <div className="grid gap-4">
                        {courses.map((course: Course) => (
                            <div
                                key={course.id}
                                className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 sm:flex-row sm:items-center"
                            >
                                <img
                                    src={resolveMediaUrl(course.thumbnailUrl)}
                                    alt={course.title}
                                    className="h-32 w-full rounded-lg object-cover sm:h-24 sm:w-40"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = '';
                                        (e.target as HTMLImageElement).className = 'h-32 w-full rounded-lg bg-secondary sm:h-24 sm:w-40';
                                    }}
                                />
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-display text-lg font-bold text-foreground truncate">
                                        {course.title}
                                    </h3>
                                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Users className="h-4 w-4" />
                                            {course.enrollmentCount} students
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Star className="h-4 w-4 text-amber-500" />
                                            {course.ratingAvg?.toFixed(1) || '0.0'}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <BookOpen className="h-4 w-4" />
                                            {course.lessonCount} lessons
                                        </span>
                                        {course.price > 0 ? (
                                            <span className="font-medium text-foreground">${course.price}</span>
                                        ) : (
                                            <span className="font-medium text-emerald-500">Free</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {getStatusBadge(course.status)}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => navigate(`/instructor/courses/${course.id}/edit`)}>
                                                <Edit className="mr-2 h-4 w-4" />
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => window.open(`/course/${course.id}`, '_blank')}>
                                                <Eye className="mr-2 h-4 w-4" />
                                                Preview
                                            </DropdownMenuItem>
                                            {/* Add delete option if needed */}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
                        <BookOpen className="h-12 w-12 text-muted-foreground/30" />
                        <h3 className="mt-4 font-semibold text-foreground">No courses yet</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Create your first course to start teaching.
                        </p>
                        <Link to="/instructor/courses/new">
                            <Button className="mt-4" variant="outline">
                                Create Course
                            </Button>
                        </Link>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default InstructorCourses;
