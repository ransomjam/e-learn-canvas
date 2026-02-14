import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    FileText, User, Calendar, CheckCircle, Clock, Loader2,
    Download, Paperclip, ChevronDown, MessageSquare, Filter, Search
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { instructorService } from '@/services/instructor.service';
import { projectsService } from '@/services/projects.service';
import { coursesService, Course } from '@/services/courses.service';
import { API_BASE_URL } from '@/lib/api';

const API_ROOT = API_BASE_URL.replace('/api/v1', '');

const InstructorSubmissions = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [filterCourse, setFilterCourse] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [gradingId, setGradingId] = useState<string | null>(null);
    const [gradeValue, setGradeValue] = useState('');
    const [feedbackValue, setFeedbackValue] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Fetch instructor's courses for filter dropdown
    const { data: courses = [] } = useQuery({
        queryKey: ['instructorCourses'],
        queryFn: () => coursesService.getInstructorCourses(),
    });

    // Fetch all submissions
    const { data: submissionsData, isLoading } = useQuery({
        queryKey: ['instructorSubmissions', filterCourse, filterStatus, page],
        queryFn: () => instructorService.getAllSubmissions({
            courseId: filterCourse || undefined,
            status: filterStatus || undefined,
            page,
            limit: 20,
        }),
    });

    const gradeMutation = useMutation({
        mutationFn: ({ submissionId, grade, feedback }: { submissionId: string; grade: number; feedback: string }) =>
            projectsService.gradeSubmission(submissionId, { grade, feedback }),
        onSuccess: () => {
            toast({ title: 'Submission graded successfully!' });
            setGradingId(null);
            setGradeValue('');
            setFeedbackValue('');
            queryClient.invalidateQueries({ queryKey: ['instructorSubmissions'] });
        },
        onError: () => {
            toast({ title: 'Failed to grade submission', variant: 'destructive' });
        },
    });

    const handleGrade = (submissionId: string) => {
        const grade = parseInt(gradeValue);
        if (isNaN(grade) || grade < 0 || grade > 100) {
            toast({ title: 'Grade must be between 0 and 100', variant: 'destructive' });
            return;
        }
        gradeMutation.mutate({ submissionId, grade, feedback: feedbackValue });
    };

    const submissions = submissionsData?.submissions || [];
    const pagination = submissionsData?.pagination;

    // Client-side search filter
    const filteredSubmissions = submissions.filter((sub: any) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            (sub.first_name + ' ' + sub.last_name).toLowerCase().includes(term) ||
            sub.email?.toLowerCase().includes(term) ||
            sub.project_title?.toLowerCase().includes(term) ||
            sub.course_title?.toLowerCase().includes(term)
        );
    });

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="font-display text-3xl font-bold text-foreground">
                        Project Submissions
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Review and grade student project submissions across all your courses.
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by student, project..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <select
                        value={filterCourse}
                        onChange={(e) => { setFilterCourse(e.target.value); setPage(1); }}
                        className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground"
                    >
                        <option value="">All Courses</option>
                        {courses.map((c: Course) => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                    </select>
                    <select
                        value={filterStatus}
                        onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                        className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground"
                    >
                        <option value="">All Statuses</option>
                        <option value="submitted">Pending</option>
                        <option value="graded">Graded</option>
                    </select>
                </div>

                {/* Stats summary */}
                {pagination && (
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{pagination.total} total submission{pagination.total !== 1 ? 's' : ''}</span>
                    </div>
                )}

                {/* Submissions list */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : filteredSubmissions.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-12 text-center">
                        <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                        <h3 className="font-semibold text-foreground mb-1">No submissions found</h3>
                        <p className="text-sm text-muted-foreground">
                            {filterCourse || filterStatus || searchTerm
                                ? 'Try adjusting your filters.'
                                : 'Students haven\'t submitted any projects yet.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredSubmissions.map((sub: any) => {
                            const isExpanded = expandedId === sub.id;
                            const isGrading = gradingId === sub.id;

                            return (
                                <div
                                    key={sub.id}
                                    className="rounded-xl border border-border bg-card overflow-hidden transition-all hover:border-primary/20"
                                >
                                    {/* Main row */}
                                    <div
                                        className="flex items-center gap-4 p-4 cursor-pointer"
                                        onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                                    >
                                        {/* Student avatar */}
                                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary text-sm">
                                            {sub.first_name?.[0]}{sub.last_name?.[0]}
                                        </div>

                                        {/* Student & project info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-medium text-foreground">
                                                    {sub.first_name} {sub.last_name}
                                                </span>
                                                <span className="text-xs text-muted-foreground">{sub.email}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                                <span className="font-medium text-foreground/80">{sub.project_title}</span>
                                                <span>•</span>
                                                <span>{sub.course_title}</span>
                                            </div>
                                        </div>

                                        {/* Status & date */}
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <div className="text-right hidden sm:block">
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(sub.submitted_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            {sub.status === 'graded' ? (
                                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                                    <CheckCircle className="h-3 w-3 mr-1" />
                                                    {sub.grade}%
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-yellow-400 border-yellow-500/30">
                                                    <Clock className="h-3 w-3 mr-1" />
                                                    Pending
                                                </Badge>
                                            )}
                                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                    </div>

                                    {/* Expanded details */}
                                    {isExpanded && (
                                        <div className="border-t border-border p-4 bg-muted/10 space-y-4">
                                            {/* Submitted file */}
                                            {sub.submission_url && sub.file_name && (
                                                <div className="flex items-center gap-3">
                                                    <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                    <a
                                                        href={`${API_ROOT}${sub.submission_url}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm text-primary hover:underline flex items-center gap-1"
                                                    >
                                                        {sub.file_name}
                                                        <Download className="h-3 w-3" />
                                                    </a>
                                                    {sub.file_size && (
                                                        <span className="text-xs text-muted-foreground">
                                                            ({(sub.file_size / 1024 / 1024).toFixed(2)} MB)
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Submission text */}
                                            {sub.submission_text && (
                                                <div>
                                                    <span className="text-xs font-medium text-muted-foreground block mb-1">Description</span>
                                                    <p className="text-sm text-foreground whitespace-pre-wrap bg-background rounded-lg p-3">
                                                        {sub.submission_text}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Existing grade & feedback */}
                                            {sub.status === 'graded' && !isGrading && (
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-center gap-4">
                                                        <div>
                                                            <span className="text-xs font-medium text-muted-foreground">Grade</span>
                                                            <p className="text-lg font-bold text-primary">{sub.grade}%</p>
                                                        </div>
                                                        {sub.graded_at && (
                                                            <div>
                                                                <span className="text-xs font-medium text-muted-foreground">Graded on</span>
                                                                <p className="text-sm text-foreground">{new Date(sub.graded_at).toLocaleDateString()}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {sub.instructor_feedback && (
                                                        <div>
                                                            <span className="text-xs font-medium text-muted-foreground block mb-1">Your Feedback</span>
                                                            <p className="text-sm text-foreground whitespace-pre-wrap bg-background rounded-lg p-3">
                                                                {sub.instructor_feedback}
                                                            </p>
                                                        </div>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="w-fit mt-1"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setGradingId(sub.id);
                                                            setGradeValue(sub.grade?.toString() || '');
                                                            setFeedbackValue(sub.instructor_feedback || '');
                                                        }}
                                                    >
                                                        Re-grade
                                                    </Button>
                                                </div>
                                            )}

                                            {/* Grading form */}
                                            {(isGrading || sub.status !== 'graded') && (
                                                <div className="rounded-lg border border-dashed border-border p-4 bg-background space-y-3">
                                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                                        <MessageSquare className="h-4 w-4" />
                                                        {sub.status === 'graded' ? 'Update Grade' : 'Grade Submission'}
                                                    </h4>
                                                    <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                                                        <div>
                                                            <Label className="text-xs">Grade (0-100)</Label>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                max={100}
                                                                value={gradingId === sub.id ? gradeValue : ''}
                                                                onChange={(e) => {
                                                                    if (gradingId !== sub.id) {
                                                                        setGradingId(sub.id);
                                                                    }
                                                                    setGradeValue(e.target.value);
                                                                }}
                                                                onFocus={() => {
                                                                    if (gradingId !== sub.id) {
                                                                        setGradingId(sub.id);
                                                                        setGradeValue('');
                                                                        setFeedbackValue('');
                                                                    }
                                                                }}
                                                                placeholder="85"
                                                                className="mt-1"
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label className="text-xs">Feedback</Label>
                                                            <Textarea
                                                                value={gradingId === sub.id ? feedbackValue : ''}
                                                                onChange={(e) => {
                                                                    if (gradingId !== sub.id) {
                                                                        setGradingId(sub.id);
                                                                    }
                                                                    setFeedbackValue(e.target.value);
                                                                }}
                                                                onFocus={() => {
                                                                    if (gradingId !== sub.id) {
                                                                        setGradingId(sub.id);
                                                                        setGradeValue('');
                                                                        setFeedbackValue('');
                                                                    }
                                                                }}
                                                                placeholder="Great work! Here's some feedback..."
                                                                rows={3}
                                                                className="mt-1"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleGrade(sub.id);
                                                            }}
                                                            disabled={gradeMutation.isPending}
                                                        >
                                                            {gradeMutation.isPending ? (
                                                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                                            ) : (
                                                                <CheckCircle className="mr-2 h-3 w-3" />
                                                            )}
                                                            {sub.status === 'graded' ? 'Update Grade' : 'Submit Grade'}
                                                        </Button>
                                                        {isGrading && sub.status === 'graded' && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setGradingId(null);
                                                                    setGradeValue('');
                                                                    setFeedbackValue('');
                                                                }}
                                                            >
                                                                Cancel
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {pagination && pagination.pages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-4">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage(p => p - 1)}
                        >
                            Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            Page {page} of {pagination.pages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= pagination.pages}
                            onClick={() => setPage(p => p + 1)}
                        >
                            Next
                        </Button>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default InstructorSubmissions;
