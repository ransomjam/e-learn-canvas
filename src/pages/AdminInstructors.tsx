import { useQuery } from '@tanstack/react-query';
import { Users, BookOpen, Star, Heart, Search, Loader2 } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { resolveMediaUrl } from '@/lib/media';
import { useState } from 'react';
import api from '@/lib/api';

interface InstructorInfo {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
    bio?: string;
    courseCount: number;
    totalStudents: number;
    totalLikes: number;
    avgRating: number;
    courses: {
        id: string;
        title: string;
        status: string;
        enrollmentCount: number;
        likesCount: number;
        ratingAvg: number;
        thumbnailUrl?: string;
    }[];
}

const AdminInstructors = () => {
    const [searchQuery, setSearchQuery] = useState('');

    const { data: instructors = [], isLoading } = useQuery({
        queryKey: ['adminInstructors', searchQuery],
        queryFn: async () => {
            const response = await api.get('/admin/instructors', {
                params: { search: searchQuery || undefined },
            });
            return response.data.data as InstructorInfo[];
        },
    });

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="font-display text-2xl font-bold text-foreground">Instructors</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        View all instructors and their courses
                    </p>
                </div>

                {/* Search */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search instructors..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {/* Instructor Cards */}
                {isLoading ? (
                    <div className="space-y-6">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="rounded-xl border border-border bg-card p-6">
                                <div className="flex items-center gap-4 mb-4">
                                    <Skeleton className="h-12 w-12 rounded-full" />
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-40" />
                                        <Skeleton className="h-3 w-28" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Skeleton className="h-20 rounded-lg" />
                                    <Skeleton className="h-20 rounded-lg" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : instructors.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-12 text-center">
                        <Users className="mx-auto h-12 w-12 text-muted-foreground/30" />
                        <p className="mt-4 text-muted-foreground">No instructors found</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {instructors.map((instructor) => (
                            <div key={instructor.id} className="rounded-xl border border-border bg-card overflow-hidden">
                                {/* Instructor Header */}
                                <div className="flex items-center gap-4 p-5 border-b border-border bg-card/80">
                                    <Avatar className="h-12 w-12">
                                        <AvatarImage src={resolveMediaUrl(instructor.avatarUrl)} />
                                        <AvatarFallback className="bg-gradient-to-br from-primary/30 to-accent/30 text-primary font-bold">
                                            {instructor.firstName?.[0]}{instructor.lastName?.[0]}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-base font-semibold text-foreground">
                                            {instructor.firstName} {instructor.lastName}
                                        </h3>
                                        <p className="text-xs text-muted-foreground truncate">{instructor.email}</p>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <span className="flex items-center gap-1.5">
                                            <BookOpen className="h-4 w-4 text-primary" />
                                            <span className="font-medium text-foreground">{instructor.courseCount}</span> courses
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <Users className="h-4 w-4 text-blue-500" />
                                            <span className="font-medium text-foreground">{instructor.totalStudents}</span> students
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <Heart className="h-4 w-4 fill-red-400 text-red-400" />
                                            <span className="font-medium text-foreground">{instructor.totalLikes}</span> likes
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <Star className="h-4 w-4 fill-accent text-accent" />
                                            <span className="font-medium text-foreground">{instructor.avgRating?.toFixed(1) || '0.0'}</span>
                                        </span>
                                    </div>
                                </div>

                                {/* Courses Grid */}
                                {instructor.courses.length > 0 ? (
                                    <div className="p-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        {instructor.courses.map((course) => (
                                            <div
                                                key={course.id}
                                                className="flex gap-3 rounded-lg border border-border/50 bg-background/50 p-3 hover:border-primary/30 transition-colors cursor-pointer"
                                                onClick={() => window.open(`/course/${course.id}`, '_blank')}
                                            >
                                                <div className="h-14 w-20 flex-shrink-0 overflow-hidden rounded-md bg-secondary">
                                                    {resolveMediaUrl(course.thumbnailUrl) ? (
                                                        <img
                                                            src={resolveMediaUrl(course.thumbnailUrl)}
                                                            alt={course.title}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                                                            <BookOpen className="h-4 w-4 text-muted-foreground/30" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-xs font-medium text-foreground truncate">{course.title}</h4>
                                                    <div className="mt-1 flex items-center gap-2">
                                                        <Badge
                                                            variant={course.status === 'published' ? 'default' : 'outline'}
                                                            className={`text-[10px] ${course.status === 'published' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : ''}`}
                                                        >
                                                            {course.status}
                                                        </Badge>
                                                    </div>
                                                    <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                                                        <span className="flex items-center gap-0.5">
                                                            <Users className="h-2.5 w-2.5" />{course.enrollmentCount}
                                                        </span>
                                                        <span className="flex items-center gap-0.5">
                                                            <Heart className="h-2.5 w-2.5 fill-red-400 text-red-400" />{course.likesCount}
                                                        </span>
                                                        <span className="flex items-center gap-0.5">
                                                            <Star className="h-2.5 w-2.5 fill-accent text-accent" />{course.ratingAvg?.toFixed(1) || '0'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-5 text-center text-xs text-muted-foreground">
                                        No courses yet
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default AdminInstructors;
