import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { enrollmentsService } from '@/services/enrollments.service';
import { resolveMediaUrl } from '@/lib/media';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
    Ticket,
    BookOpen,
    CheckCircle,
    Loader2,
    ArrowRight,
    Sparkles,
    GraduationCap,
    AlertCircle,
} from 'lucide-react';

const EnrollmentClaim = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());

    const { data: courses = [], isLoading, error } = useQuery({
        queryKey: ['available-codes'],
        queryFn: () => enrollmentsService.getAvailableCodes(),
        enabled: !!user,
    });

    const claimMutation = useMutation({
        mutationFn: (codeId: string) => enrollmentsService.claimCode(codeId),
        onSuccess: (data, codeId) => {
            setClaimedIds(prev => new Set(prev).add(codeId));
            toast({
                title: '🎉 Enrolled successfully!',
                description: `You are now enrolled in "${data.courseTitle}"`,
            });
            queryClient.invalidateQueries({ queryKey: ['available-codes'] });
            queryClient.invalidateQueries({ queryKey: ['enrollments'] });
        },
        onError: (err: any) => {
            toast({
                title: 'Could not claim code',
                description: err?.response?.data?.message || 'Something went wrong',
                variant: 'destructive',
            });
        },
    });

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <div className="text-center space-y-4 max-w-md">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
                        <Ticket className="h-8 w-8 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground">Sign in to claim codes</h1>
                    <p className="text-muted-foreground">
                        You need to be logged in to view and claim enrollment codes.
                    </p>
                    <Button onClick={() => navigate('/auth')} className="gap-2">
                        Sign In <ArrowRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Hero Header */}
            <div className="relative overflow-hidden border-b border-border">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
                <div className="relative max-w-5xl mx-auto px-4 py-12 sm:py-16">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                            <Ticket className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-foreground font-display">
                                Enrollment Codes
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Claim a code to instantly enroll in a course
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-8">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-muted-foreground text-sm">Loading available codes...</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                        <AlertCircle className="h-10 w-10 text-destructive/60" />
                        <p className="text-muted-foreground">Failed to load enrollment codes. Please try again.</p>
                        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['available-codes'] })}>
                            Retry
                        </Button>
                    </div>
                ) : courses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted">
                            <Sparkles className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <h2 className="text-xl font-semibold text-foreground">No codes available</h2>
                        <p className="text-muted-foreground max-w-sm">
                            There are no enrollment codes available right now. Check back later or browse our courses directly.
                        </p>
                        <Button onClick={() => navigate('/courses')} variant="outline" className="gap-2">
                            <BookOpen className="h-4 w-4" />
                            Browse Courses
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <p className="text-sm text-muted-foreground">
                            {courses.length} course{courses.length !== 1 ? 's' : ''} with available codes
                        </p>

                        {courses.map((course) => (
                            <div
                                key={course.courseId}
                                className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-all duration-300"
                            >
                                <div className="flex flex-col sm:flex-row">
                                    {/* Thumbnail */}
                                    {course.thumbnailUrl && (
                                        <div className="sm:w-48 sm:flex-shrink-0">
                                            <img
                                                src={resolveMediaUrl(course.thumbnailUrl)}
                                                alt={course.courseTitle}
                                                className="w-full h-36 sm:h-full object-cover"
                                            />
                                        </div>
                                    )}

                                    {/* Content */}
                                    <div className="flex-1 p-5 sm:p-6">
                                        <div className="flex items-start justify-between gap-4 mb-2">
                                            <div>
                                                <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                                                    {course.courseTitle}
                                                </h3>
                                                {course.shortDescription && (
                                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                                        {course.shortDescription}
                                                    </p>
                                                )}
                                            </div>
                                            {course.level && (
                                                <Badge variant="outline" className="text-xs capitalize flex-shrink-0">
                                                    {course.level}
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3 mt-4">
                                            <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-0 text-xs gap-1">
                                                <Ticket className="h-3 w-3" />
                                                {course.availableCount} code{course.availableCount !== 1 ? 's' : ''} available
                                            </Badge>

                                            {course.alreadyEnrolled && (
                                                <Badge className="bg-emerald-500/10 text-emerald-400 border-0 text-xs gap-1">
                                                    <CheckCircle className="h-3 w-3" />
                                                    Already enrolled
                                                </Badge>
                                            )}
                                        </div>

                                        {/* Codes list */}
                                        {!course.alreadyEnrolled && (
                                            <div className="mt-4 space-y-2">
                                                {course.codes.slice(0, 3).map((code) => {
                                                    const isClaimed = claimedIds.has(code.id);
                                                    const isClaimingThis = claimMutation.isPending && claimMutation.variables === code.id;

                                                    return (
                                                        <div
                                                            key={code.id}
                                                            className="flex items-center justify-between rounded-lg bg-secondary/40 px-4 py-2.5"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <code className="text-sm font-mono font-medium text-foreground tracking-wider blur-sm select-none pointer-events-none">
                                                                    {code.code}
                                                                </code>
                                                                {code.expiresAt && (
                                                                    <span className="text-[10px] text-muted-foreground">
                                                                        Expires {new Date(code.expiresAt).toLocaleDateString()}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {isClaimed ? (
                                                                <div className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium">
                                                                    <CheckCircle className="h-4 w-4" />
                                                                    Claimed
                                                                </div>
                                                            ) : (
                                                                <Button
                                                                    size="sm"
                                                                    variant="default"
                                                                    className="h-8 gap-1.5 text-xs"
                                                                    onClick={() => claimMutation.mutate(code.id)}
                                                                    disabled={claimMutation.isPending}
                                                                >
                                                                    {isClaimingThis ? (
                                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                    ) : (
                                                                        <GraduationCap className="h-3.5 w-3.5" />
                                                                    )}
                                                                    Claim & Enroll
                                                                </Button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {course.codes.length > 3 && (
                                                    <p className="text-xs text-muted-foreground pl-4">
                                                        +{course.codes.length - 3} more code{course.codes.length - 3 !== 1 ? 's' : ''}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {course.alreadyEnrolled && (
                                            <div className="mt-4">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-2 text-xs"
                                                    onClick={() => navigate(`/course/${course.courseId}`)}
                                                >
                                                    <ArrowRight className="h-3.5 w-3.5" />
                                                    Go to Course
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div >
    );
};

export default EnrollmentClaim;
