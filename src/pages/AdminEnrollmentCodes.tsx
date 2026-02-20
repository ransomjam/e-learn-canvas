import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Ticket, Plus, Trash2, Loader2, Search, Copy, CheckCircle, XCircle,
    Filter, Share2, ExternalLink, Link2
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { adminService, EnrollmentCode } from '@/services/admin.service';
import { coursesService } from '@/services/courses.service';

const AdminEnrollmentCodes = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [showGenerateDialog, setShowGenerateDialog] = useState(false);
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [codeCount, setCodeCount] = useState(1);
    const [isGenerating, setIsGenerating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterUsed, setFilterUsed] = useState<string | undefined>(undefined);
    const [filterCourseId, setFilterCourseId] = useState<string | undefined>(undefined);
    const [page, setPage] = useState(1);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [copiedClaimLink, setCopiedClaimLink] = useState(false);

    // Fetch enrollment codes
    const { data: codesData, isLoading: codesLoading, error: codesError } = useQuery({
        queryKey: ['enrollmentCodes', page, searchQuery, filterUsed, filterCourseId],
        queryFn: () => adminService.getEnrollmentCodes({
            page,
            limit: 20,
            search: searchQuery || undefined,
            isUsed: filterUsed,
            courseId: filterCourseId,
        }),
    });

    // Fetch courses for dropdown
    const { data: courses = [] } = useQuery({
        queryKey: ['adminCoursesList'],
        queryFn: () => adminService.getAllCourses(),
    });

    const handleGenerate = async () => {
        if (!selectedCourseId) {
            toast({
                title: 'Select a course',
                description: 'Please select a course to generate codes for.',
                variant: 'destructive',
            });
            return;
        }

        setIsGenerating(true);
        try {
            const result = await adminService.generateEnrollmentCodes(selectedCourseId, codeCount);
            toast({
                title: 'Codes generated!',
                description: `${result.codes.length} enrollment code(s) created for ${result.course.title}.`,
            });
            setShowGenerateDialog(false);
            setSelectedCourseId('');
            setCodeCount(1);
            queryClient.invalidateQueries({ queryKey: ['enrollmentCodes'] });
        } catch (error: any) {
            toast({
                title: 'Generation failed',
                description: error.response?.data?.message || 'Failed to generate codes.',
                variant: 'destructive',
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this enrollment code?')) return;
        try {
            await adminService.deleteEnrollmentCode(id);
            toast({ title: 'Code deleted' });
            queryClient.invalidateQueries({ queryKey: ['enrollmentCodes'] });
        } catch (error: any) {
            toast({
                title: 'Delete failed',
                description: error.response?.data?.message || 'Failed to delete code.',
                variant: 'destructive',
            });
        }
    };

    const copyToClipboard = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="font-display text-3xl font-bold text-foreground">
                            Enrollment Codes
                        </h1>
                        <p className="mt-1 text-muted-foreground">
                            Generate and manage enrollment codes for student course access.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => {
                                const url = `${window.location.origin}/enrollment`;
                                navigator.clipboard.writeText(url);
                                setCopiedClaimLink(true);
                                setTimeout(() => setCopiedClaimLink(false), 2000);
                                toast({ title: 'Claim link copied!', description: url });
                            }}
                        >
                            {copiedClaimLink ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Link2 className="h-4 w-4" />}
                            {copiedClaimLink ? 'Copied!' : 'Copy Claim Link'}
                        </Button>
                        <Button className="gap-2" onClick={() => setShowGenerateDialog(true)}>
                            <Plus className="h-4 w-4" />
                            Generate Codes
                        </Button>
                    </div>
                </div>

                {/* Public Claim Link Info */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                        <Share2 className="h-5 w-5 text-primary flex-shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-foreground">Public Enrollment Page</p>
                            <p className="text-xs text-muted-foreground">
                                Students can browse and claim available codes at{' '}
                                <code className="text-primary font-mono">/enrollment</code>.
                                Share the link so students can self-enroll.
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 flex-shrink-0"
                        onClick={() => window.open('/enrollment', '_blank')}
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open Page
                    </Button>
                </div>

                {/* Filters */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search codes..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                            className="pl-10"
                        />
                    </div>
                    <select
                        className="rounded-md border border-border bg-card px-3 py-2 text-sm"
                        value={filterUsed ?? ''}
                        onChange={(e) => { setFilterUsed(e.target.value || undefined); setPage(1); }}
                    >
                        <option value="">All Status</option>
                        <option value="false">Available</option>
                        <option value="true">Used</option>
                    </select>
                    <select
                        className="rounded-md border border-border bg-card px-3 py-2 text-sm"
                        value={filterCourseId ?? ''}
                        onChange={(e) => { setFilterCourseId(e.target.value || undefined); setPage(1); }}
                    >
                        <option value="">All Courses</option>
                        {courses.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                    </select>
                </div>

                {/* Codes Table */}
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                    {codesLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : codesError ? (
                        <div className="py-16 text-center">
                            <XCircle className="mx-auto h-12 w-12 text-red-400/50" />
                            <p className="mt-4 text-red-400 font-medium">Failed to load enrollment codes</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {(codesError as any)?.response?.data?.message || (codesError as Error)?.message || 'An unexpected error occurred.'}
                            </p>
                            <Button
                                variant="outline"
                                className="mt-4"
                                onClick={() => queryClient.invalidateQueries({ queryKey: ['enrollmentCodes'] })}
                            >
                                Retry
                            </Button>
                        </div>
                    ) : codesData?.codes && codesData.codes.length > 0 ? (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-border bg-secondary/30">
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Code</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Course</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Status</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Used By</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Created</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {codesData.codes.map((code: EnrollmentCode) => (
                                            <tr key={code.id} className="hover:bg-secondary/20">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <code className="rounded bg-secondary px-2 py-0.5 text-sm font-mono font-bold">
                                                            {code.code}
                                                        </code>
                                                        <button
                                                            onClick={() => copyToClipboard(code.code)}
                                                            className="text-muted-foreground hover:text-foreground"
                                                        >
                                                            {copiedCode === code.code ?
                                                                <CheckCircle className="h-4 w-4 text-green-500" /> :
                                                                <Copy className="h-4 w-4" />
                                                            }
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-foreground max-w-[200px] truncate">
                                                    {code.courseTitle}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {code.isUsed ? (
                                                        <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">
                                                            Used
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                                            Available
                                                        </Badge>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                                    {code.usedBy ? (
                                                        <div>
                                                            <p className="text-foreground">{code.usedBy.name}</p>
                                                            <p className="text-xs">{code.usedBy.email}</p>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground/50">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                                    {new Date(code.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {!code.isUsed && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDelete(code.id)}
                                                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {codesData.pagination && codesData.pagination.pages > 1 && (
                                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                                    <p className="text-sm text-muted-foreground">
                                        Page {codesData.pagination.page} of {codesData.pagination.pages} ({codesData.pagination.total} total)
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
                                            disabled={page >= codesData.pagination.pages}
                                            onClick={() => setPage(p => p + 1)}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="py-16 text-center">
                            <Ticket className="mx-auto h-12 w-12 text-muted-foreground/30" />
                            <p className="mt-4 text-muted-foreground">No enrollment codes found.</p>
                            <Button className="mt-4 gap-2" onClick={() => setShowGenerateDialog(true)}>
                                <Plus className="h-4 w-4" />
                                Generate Codes
                            </Button>
                        </div>
                    )}
                </div>

                {/* Generate Dialog */}
                <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Generate Enrollment Codes</DialogTitle>
                            <DialogDescription>
                                Create enrollment codes that students can use to access a course.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1.5 block">Course</label>
                                <select
                                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                                    value={selectedCourseId}
                                    onChange={(e) => setSelectedCourseId(e.target.value)}
                                >
                                    <option value="">Select a course...</option>
                                    {courses.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.title}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1.5 block">
                                    Number of Codes
                                </label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={codeCount}
                                    onChange={(e) => setCodeCount(parseInt(e.target.value) || 1)}
                                />
                                <p className="mt-1 text-xs text-muted-foreground">Max 100 codes at a time</p>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setShowGenerateDialog(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !selectedCourseId}
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Generate {codeCount} Code{codeCount > 1 ? 's' : ''}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </AdminLayout>
    );
};

export default AdminEnrollmentCodes;
