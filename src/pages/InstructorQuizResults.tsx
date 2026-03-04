import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Search, Loader2, ChevronLeft, ChevronRight, Trophy, Users,
    BarChart3, CheckCircle2, XCircle, Eye, X, Clock, Award,
    TrendingUp, BookOpen, Filter
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { instructorService, QuizAttempt, QuizAttemptDetail } from '@/services/instructor.service';

const InstructorQuizResults = () => {
    const [page, setPage] = useState(1);
    const [courseFilter, setCourseFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedAttempt, setSelectedAttempt] = useState<string | null>(null);

    // Debounce search
    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        clearTimeout((window as any).__quizSearchTimeout);
        (window as any).__quizSearchTimeout = setTimeout(() => {
            setDebouncedSearch(value);
            setPage(1);
        }, 400);
    };

    // Fetch quiz attempts
    const { data, isLoading } = useQuery({
        queryKey: ['instructorQuizAttempts', page, courseFilter, debouncedSearch],
        queryFn: () => instructorService.getQuizAttempts({
            page,
            limit: 15,
            courseId: courseFilter || undefined,
            search: debouncedSearch || undefined
        }),
    });

    // Fetch attempt detail when modal is open
    const { data: attemptDetail, isLoading: detailLoading } = useQuery({
        queryKey: ['quizAttemptDetail', selectedAttempt],
        queryFn: () => instructorService.getQuizAttemptDetail(selectedAttempt!),
        enabled: !!selectedAttempt,
    });

    const attempts = data?.attempts || [];
    const stats = data?.stats;
    const courses = data?.courses || [];
    const pagination = data?.pagination;

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-emerald-400';
        if (score >= 60) return 'text-amber-400';
        return 'text-red-400';
    };

    const getScoreBg = (score: number) => {
        if (score >= 80) return 'bg-emerald-500/20 border-emerald-500/30';
        if (score >= 60) return 'bg-amber-500/20 border-amber-500/30';
        return 'bg-red-500/20 border-red-500/30';
    };

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
                            <Trophy className="h-8 w-8 text-amber-500" />
                            Quiz Results
                        </h1>
                        <p className="mt-1 text-muted-foreground">
                            View student quiz attempts and scores across your courses.
                        </p>
                    </div>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                                    <Users className="h-5 w-5 text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Students</p>
                                    <h3 className="font-display text-xl font-bold text-foreground">{stats.totalStudents}</h3>
                                </div>
                            </div>
                        </div>
                        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                                    <BarChart3 className="h-5 w-5 text-violet-500" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Attempts</p>
                                    <h3 className="font-display text-xl font-bold text-foreground">{stats.totalAttempts}</h3>
                                </div>
                            </div>
                        </div>
                        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                                    <TrendingUp className="h-5 w-5 text-amber-500" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Avg Score</p>
                                    <h3 className={`font-display text-xl font-bold ${getScoreColor(stats.avgScore)}`}>{stats.avgScore}%</h3>
                                </div>
                            </div>
                        </div>
                        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Passed</p>
                                    <h3 className="font-display text-xl font-bold text-emerald-400">{stats.passedCount}</h3>
                                </div>
                            </div>
                        </div>
                        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                                    <XCircle className="h-5 w-5 text-red-500" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Failed</p>
                                    <h3 className="font-display text-xl font-bold text-red-400">{stats.failedCount}</h3>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by student name or email..."
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <select
                            value={courseFilter}
                            onChange={(e) => {
                                setCourseFilter(e.target.value);
                                setPage(1);
                            }}
                            className="appearance-none rounded-lg border border-border bg-card pl-10 pr-8 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer min-w-[200px]"
                        >
                            <option value="">All Courses</option>
                            {courses.map(c => (
                                <option key={c.id} value={c.id}>{c.title}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Results Table */}
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : attempts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                            <Trophy className="h-12 w-12 mb-3 opacity-30" />
                            <p className="text-lg font-medium">No quiz attempts found</p>
                            <p className="text-sm mt-1">Students haven't taken any quizzes yet.</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-border bg-secondary/30">
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Student</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quiz</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Course</th>
                                            <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Score</th>
                                            <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                                            <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {attempts.map((attempt) => (
                                            <tr key={attempt.id} className="hover:bg-secondary/20 transition-colors">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                                            {attempt.student.firstName?.[0]}{attempt.student.lastName?.[0]}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-foreground truncate">
                                                                {attempt.student.firstName} {attempt.student.lastName}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground truncate">{attempt.student.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="text-sm text-foreground truncate max-w-[180px]">{attempt.quiz.title}</p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="text-sm text-muted-foreground truncate max-w-[180px]">{attempt.course.title}</p>
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    <span className={`font-display text-lg font-bold ${getScoreColor(attempt.score)}`}>
                                                        {attempt.score.toFixed(0)}%
                                                    </span>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                                        {attempt.totalQuestions} questions
                                                    </p>
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    <Badge className={`${attempt.passed ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                                                        {attempt.passed ? 'Passed' : 'Failed'}
                                                    </Badge>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="text-sm text-muted-foreground">{formatDate(attempt.attemptedAt)}</p>
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-muted-foreground hover:text-foreground"
                                                        onClick={() => setSelectedAttempt(attempt.id)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="md:hidden divide-y divide-border">
                                {attempts.map((attempt) => (
                                    <div key={attempt.id} className="p-4 hover:bg-secondary/20 transition-colors">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                                    {attempt.student.firstName?.[0]}{attempt.student.lastName?.[0]}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-foreground truncate">
                                                        {attempt.student.firstName} {attempt.student.lastName}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground truncate">{attempt.quiz.title}</p>
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <span className={`font-display text-lg font-bold ${getScoreColor(attempt.score)}`}>
                                                    {attempt.score.toFixed(0)}%
                                                </span>
                                                <div className="mt-0.5">
                                                    <Badge className={`text-[10px] ${attempt.passed ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                                                        {attempt.passed ? 'Passed' : 'Failed'}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                                            <span className="truncate">{attempt.course.title}</span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-muted-foreground hover:text-foreground h-7 px-2"
                                                onClick={() => setSelectedAttempt(attempt.id)}
                                            >
                                                <Eye className="h-3.5 w-3.5 mr-1" />
                                                View
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Pagination */}
                    {pagination && pagination.pages > 1 && (
                        <div className="flex items-center justify-between border-t border-border px-5 py-3">
                            <p className="text-sm text-muted-foreground">
                                Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={pagination.page <= 1}
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-sm text-muted-foreground px-2">
                                    Page {pagination.page} of {pagination.pages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={pagination.page >= pagination.pages}
                                    onClick={() => setPage(p => p + 1)}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Detail Modal */}
                {selectedAttempt && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedAttempt(null)}>
                        <div
                            className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {detailLoading ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : attemptDetail ? (
                                <>
                                    {/* Modal Header */}
                                    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur-sm px-6 py-4">
                                        <div>
                                            <h2 className="font-display text-lg font-bold text-foreground">
                                                Quiz Attempt Detail
                                            </h2>
                                            <p className="text-sm text-muted-foreground">
                                                {attemptDetail.student.firstName} {attemptDetail.student.lastName} — {attemptDetail.quiz.title}
                                            </p>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => setSelectedAttempt(null)}>
                                            <X className="h-5 w-5" />
                                        </Button>
                                    </div>

                                    {/* Score Summary */}
                                    <div className="px-6 py-5">
                                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                            <div className={`rounded-xl border p-4 text-center ${getScoreBg(attemptDetail.score)}`}>
                                                <Award className={`mx-auto h-6 w-6 mb-1 ${getScoreColor(attemptDetail.score)}`} />
                                                <p className={`font-display text-2xl font-bold ${getScoreColor(attemptDetail.score)}`}>
                                                    {attemptDetail.score.toFixed(0)}%
                                                </p>
                                                <p className="text-xs text-muted-foreground">Score</p>
                                            </div>
                                            <div className="rounded-xl border border-border bg-secondary/30 p-4 text-center">
                                                <BookOpen className="mx-auto h-6 w-6 mb-1 text-blue-400" />
                                                <p className="font-display text-2xl font-bold text-foreground">
                                                    {attemptDetail.totalQuestions}
                                                </p>
                                                <p className="text-xs text-muted-foreground">Questions</p>
                                            </div>
                                            <div className="rounded-xl border border-border bg-secondary/30 p-4 text-center">
                                                <CheckCircle2 className="mx-auto h-6 w-6 mb-1 text-emerald-400" />
                                                <p className="font-display text-2xl font-bold text-emerald-400">
                                                    {attemptDetail.answers?.filter(a => a.isCorrect).length || 0}
                                                </p>
                                                <p className="text-xs text-muted-foreground">Correct</p>
                                            </div>
                                            <div className="rounded-xl border border-border bg-secondary/30 p-4 text-center">
                                                <Clock className="mx-auto h-6 w-6 mb-1 text-muted-foreground" />
                                                <p className="font-display text-sm font-bold text-foreground mt-1">
                                                    {formatDate(attemptDetail.attemptedAt)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">Taken on</p>
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm text-muted-foreground">Overall Progress</span>
                                                <Badge className={`${attemptDetail.passed ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                                                    {attemptDetail.passed ? 'PASSED' : 'FAILED'}
                                                </Badge>
                                            </div>
                                            <Progress value={attemptDetail.score} className="h-2" />
                                        </div>
                                    </div>

                                    {/* Student Info */}
                                    <div className="px-6 pb-3">
                                        <div className="rounded-lg border border-border bg-secondary/20 p-4 flex items-center gap-4">
                                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                                                {attemptDetail.student.firstName?.[0]}{attemptDetail.student.lastName?.[0]}
                                            </div>
                                            <div>
                                                <p className="font-medium text-foreground">
                                                    {attemptDetail.student.firstName} {attemptDetail.student.lastName}
                                                </p>
                                                <p className="text-sm text-muted-foreground">{attemptDetail.student.email}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">Course: {attemptDetail.course.title}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Answers Detail */}
                                    <div className="px-6 pb-6">
                                        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                                            <BookOpen className="h-4 w-4" />
                                            Question Breakdown
                                        </h3>
                                        <div className="space-y-3">
                                            {attemptDetail.answers?.map((answer, idx) => {
                                                const question = attemptDetail.quiz.questions?.[idx];
                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`rounded-lg border p-4 ${answer.isCorrect
                                                            ? 'border-emerald-500/20 bg-emerald-500/5'
                                                            : 'border-red-500/20 bg-red-500/5'
                                                            }`}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${answer.isCorrect
                                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                                : 'bg-red-500/20 text-red-400'
                                                                }`}>
                                                                {answer.isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-foreground">
                                                                    Q{idx + 1}. {answer.question || question?.question}
                                                                </p>
                                                                {question?.options && (
                                                                    <div className="mt-2 space-y-1">
                                                                        {question.options.map((opt, oi) => (
                                                                            <div
                                                                                key={oi}
                                                                                className={`text-xs rounded px-2 py-1 ${oi === answer.correctAnswer
                                                                                        ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                                                                                        : oi === answer.userAnswer && !answer.isCorrect
                                                                                            ? 'bg-red-500/10 text-red-400 line-through'
                                                                                            : 'text-muted-foreground'
                                                                                    }`}
                                                                            >
                                                                                {String.fromCharCode(65 + oi)}. {opt}
                                                                                {oi === answer.correctAnswer && ' ✓'}
                                                                                {oi === answer.userAnswer && oi !== answer.correctAnswer && ' (student answer)'}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {question?.explanation && (
                                                                    <p className="mt-2 text-xs text-muted-foreground italic">
                                                                        💡 {question.explanation}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex items-center justify-center py-20 text-muted-foreground">
                                    <p>Could not load attempt details.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default InstructorQuizResults;
