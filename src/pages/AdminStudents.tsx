import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Users, Search, Loader2, BookOpen, GraduationCap, ChevronDown, ChevronRight, Ticket
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { adminService, UserWithEnrollments } from '@/services/admin.service';

const AdminStudents = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [expandedUser, setExpandedUser] = useState<string | null>(null);

    const { data: usersData, isLoading } = useQuery({
        queryKey: ['adminUsersEnrollments', page, searchQuery],
        queryFn: () => adminService.getUsersWithEnrollments({
            page,
            limit: 20,
            search: searchQuery || undefined,
        }),
    });

    const toggleExpand = (userId: string) => {
        setExpandedUser(expandedUser === userId ? null : userId);
    };

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="font-display text-3xl font-bold text-foreground">
                        Students
                    </h1>
                    <p className="mt-1 text-muted-foreground">
                        View student enrollments, progress, and enrollment codes used.
                    </p>
                </div>

                {/* Search */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name or email..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                        className="pl-10"
                    />
                </div>

                {/* Students List */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : usersData?.users && usersData.users.length > 0 ? (
                    <div className="space-y-3">
                        {usersData.users.map((user: UserWithEnrollments) => (
                            <div
                                key={user.id}
                                className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
                            >
                                {/* User Header */}
                                <button
                                    className="w-full flex items-center gap-4 p-4 hover:bg-secondary/20 transition-colors"
                                    onClick={() => toggleExpand(user.id)}
                                >
                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                                        {user.firstName?.[0]}{user.lastName?.[0]}
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <p className="font-medium text-foreground">
                                            {user.firstName} {user.lastName}
                                        </p>
                                        <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <BookOpen className="h-4 w-4" />
                                            <span>{user.enrollments.length} course{user.enrollments.length !== 1 ? 's' : ''}</span>
                                        </div>
                                        {user.enrollmentCodes.length > 0 && (
                                            <div className="flex items-center gap-1">
                                                <Ticket className="h-4 w-4" />
                                                <span>{user.enrollmentCodes.length} code{user.enrollmentCodes.length !== 1 ? 's' : ''}</span>
                                            </div>
                                        )}
                                        {expandedUser === user.id ? (
                                            <ChevronDown className="h-5 w-5" />
                                        ) : (
                                            <ChevronRight className="h-5 w-5" />
                                        )}
                                    </div>
                                </button>

                                {/* Expanded Details */}
                                {expandedUser === user.id && (
                                    <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
                                        {/* Enrollments */}
                                        {user.enrollments.length > 0 ? (
                                            <div>
                                                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                                                    <GraduationCap className="h-4 w-4" />
                                                    Enrolled Courses
                                                </h4>
                                                <div className="space-y-2">
                                                    {user.enrollments.map((enrollment) => (
                                                        <div
                                                            key={enrollment.id}
                                                            className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg bg-secondary/30 p-3"
                                                        >
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-medium text-foreground text-sm truncate">
                                                                    {enrollment.courseTitle}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Enrolled {new Date(enrollment.enrolledAt).toLocaleDateString()}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <Badge variant={
                                                                    enrollment.status === 'completed' ? 'default' :
                                                                        enrollment.status === 'active' ? 'outline' : 'secondary'
                                                                }>
                                                                    {enrollment.status}
                                                                </Badge>
                                                                <div className="text-right min-w-[120px]">
                                                                    <p className="text-xs text-muted-foreground mb-0.5">
                                                                        {enrollment.lessonsCompleted}/{enrollment.totalLessons} lessons
                                                                    </p>
                                                                    <Progress value={enrollment.progressPercentage} className="h-1.5" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">No course enrollments.</p>
                                        )}

                                        {/* Enrollment Codes Used */}
                                        {user.enrollmentCodes.length > 0 && (
                                            <div>
                                                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                                                    <Ticket className="h-4 w-4" />
                                                    Enrollment Codes Used
                                                </h4>
                                                <div className="space-y-1.5">
                                                    {user.enrollmentCodes.map((ec, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="flex items-center gap-3 rounded-lg bg-secondary/30 p-2.5 text-sm"
                                                        >
                                                            <code className="rounded bg-secondary px-2 py-0.5 font-mono text-xs font-bold">
                                                                {ec.code}
                                                            </code>
                                                            <span className="text-muted-foreground flex-1 truncate">
                                                                {ec.courseTitle}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {new Date(ec.usedAt).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Pagination */}
                        {usersData.pagination && usersData.pagination.pages > 1 && (
                            <div className="flex items-center justify-between pt-2">
                                <p className="text-sm text-muted-foreground">
                                    Page {usersData.pagination.page} of {usersData.pagination.pages}
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page <= 1}
                                        onClick={() => setPage(p => p - 1)}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page >= usersData.pagination.pages}
                                        onClick={() => setPage(p => p + 1)}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="rounded-xl border border-border bg-card py-16 text-center">
                        <Users className="mx-auto h-12 w-12 text-muted-foreground/30" />
                        <p className="mt-4 text-muted-foreground">No students found.</p>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default AdminStudents;
