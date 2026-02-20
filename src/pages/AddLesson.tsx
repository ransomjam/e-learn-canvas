import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft, Save, Upload, FileText, Loader2, Video,
    X, Paperclip, Plus, ChevronDown
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { coursesService, Section } from '@/services/courses.service';
import { instructorService } from '@/services/instructor.service';

const AddLesson = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [isUploading, setIsUploading] = useState(false);
    const [lessonForm, setLessonForm] = useState({
        title: '',
        type: 'video' as string,
        content: '',
        videoUrl: '',
        duration: 0,
        isFree: false,
        resources: [] as any[],
        targetSectionId: '',
    });

    // Fetch course info (title, etc.)
    const { data: course, isLoading: courseLoading } = useQuery({
        queryKey: ['course', courseId],
        queryFn: () => coursesService.getCourseById(courseId!),
        enabled: !!courseId,
    });

    // Fetch sections from the lessons endpoint (more reliable for section list)
    const { data: sections = [], isLoading: sectionsLoading } = useQuery({
        queryKey: ['courseLessons', courseId],
        queryFn: () => coursesService.getCourseLessons(courseId!),
        enabled: !!courseId,
    });

    // Fallback to course.sections if the lessons endpoint returns empty
    const availableSections: Section[] = sections.length > 0
        ? sections
        : (course?.sections as Section[] || []);

    // Use instructorService.createLesson (the correct service)
    const createLessonMutation = useMutation({
        mutationFn: (data: any) => instructorService.createLesson(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course', courseId] });
            queryClient.invalidateQueries({ queryKey: ['courseLessons', courseId] });
            toast({ title: 'Lesson created successfully!' });
            navigate(`/instructor/courses/${courseId}/edit`);
        },
        onError: (error: any) => {
            toast({
                title: 'Failed to create lesson',
                description: error.response?.data?.message || error.response?.data?.errors?.[0]?.msg || 'Please try again.',
                variant: 'destructive',
            });
        },
    });

    const handleVideoUpload = async (file: File) => {
        setIsUploading(true);
        try {
            const result = await instructorService.uploadFile(file);
            const newState: Partial<typeof lessonForm> = { videoUrl: result.url };

            if (result.fileType) {
                if (result.fileType === 'pdf') newState.type = 'pdf';
                else if (result.fileType === 'ppt') newState.type = 'ppt';
                else if (result.fileType === 'doc') newState.type = 'doc';
                else if (result.fileType === 'video') newState.type = 'video';
            }

            setLessonForm((prev) => ({ ...prev, ...newState }));
            toast({ title: 'File uploaded!' });
        } catch {
            toast({ title: 'File upload failed', variant: 'destructive' });
        } finally {
            setIsUploading(false);
        }
    };

    const handlePracticeResourceUpload = async (file: File) => {
        setIsUploading(true);
        try {
            const result = await instructorService.uploadFile(file);
            let type = 'file';
            if (result.fileType) {
                if (result.fileType === 'pdf') type = 'pdf';
                else if (result.fileType === 'ppt') type = 'ppt';
                else if (result.fileType === 'doc') type = 'doc';
                else if (result.fileType === 'video') type = 'video';
                else if (result.fileType === 'image') type = 'image';
            }

            const newResource = {
                title: file.name,
                url: result.url,
                type: type,
            };

            setLessonForm((prev) => ({
                ...prev,
                resources: [...(prev.resources || []), newResource],
            }));

            toast({ title: 'Practice file uploaded!' });
        } catch {
            toast({ title: 'Upload failed', variant: 'destructive' });
        } finally {
            setIsUploading(false);
        }
    };

    const removeResource = (index: number) => {
        setLessonForm((prev) => ({
            ...prev,
            resources: prev.resources.filter((_, i) => i !== index),
        }));
    };

    const handleAddLesson = () => {
        if (!lessonForm.title.trim()) {
            toast({ title: 'Lesson title is required', variant: 'destructive' });
            return;
        }
        if (!lessonForm.targetSectionId) {
            toast({ title: 'Please select a section', variant: 'destructive' });
            return;
        }

        createLessonMutation.mutate({
            sectionId: lessonForm.targetSectionId,
            courseId: courseId!,
            title: lessonForm.title,
            type: lessonForm.type,
            content: lessonForm.content,
            videoUrl: lessonForm.videoUrl || undefined,
            videoDuration: lessonForm.duration,
            isFree: lessonForm.isFree,
            resources: lessonForm.resources,
        });
    };

    const isFileType = (type: string) => ['video', 'pdf', 'ppt', 'doc', 'document'].includes(type);

    const getAcceptForType = (type: string) => {
        switch (type) {
            case 'video': return 'video/*';
            case 'pdf': return '.pdf';
            case 'ppt': return '.ppt,.pptx';
            case 'doc': return '.doc,.docx';
            case 'document': return '.pdf,.ppt,.pptx,.doc,.docx';
            default: return '*/*';
        }
    };

    const getLessonTypeLabel = (type: string) => {
        switch (type) {
            case 'video': return 'Video';
            case 'pdf': return 'PDF Document';
            case 'ppt': return 'Presentation';
            case 'doc': return 'Document';
            case 'document': return 'Other Document';
            case 'text': return 'Article';
            case 'quiz': return 'Quiz';
            case 'assignment': return 'Assignment';
            default: return 'File';
        }
    };

    const getResourceIcon = (type: string) => {
        switch (type) {
            case 'pdf': return <FileText className="h-4 w-4 text-red-400" />;
            case 'ppt': return <FileText className="h-4 w-4 text-orange-400" />;
            case 'doc': return <FileText className="h-4 w-4 text-blue-400" />;
            case 'video': return <Video className="h-4 w-4 text-purple-400" />;
            default: return <Paperclip className="h-4 w-4 text-primary" />;
        }
    };

    const isLoading = courseLoading || sectionsLoading;

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="flex h-[50vh] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6 max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/instructor/courses/${courseId}/edit`)}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="font-display text-2xl font-bold text-foreground">Add Lesson</h1>
                            <p className="text-muted-foreground text-sm">
                                Create a new lesson for <span className="text-primary font-medium">{course?.title}</span>
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/instructor/courses/${courseId}/edit`)}
                        className="gap-1"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back
                    </Button>
                </div>

                {/* Form Card */}
                <div className="rounded-xl border border-border bg-card p-6 space-y-6 shadow-sm">
                    {/* Section Selection Dropdown */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Section Title (or select existing)</Label>
                        <div className="relative">
                            <select
                                value={lessonForm.targetSectionId}
                                onChange={(e) =>
                                    setLessonForm((p) => ({ ...p, targetSectionId: e.target.value }))
                                }
                                className="w-full appearance-none rounded-lg border border-border bg-secondary px-3 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                            >
                                <option value="" disabled>
                                    {availableSections.length > 0
                                        ? 'Select a section...'
                                        : 'No sections available — create one in Course Editor'}
                                </option>
                                {availableSections.map((s: Section) => (
                                    <option key={s.id} value={s.id}>
                                        {s.title}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            The lesson will be added to the selected section.
                        </p>
                    </div>

                    {/* Lesson Title */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Lesson Title *</Label>
                        <Input
                            value={lessonForm.title}
                            onChange={(e) =>
                                setLessonForm((p) => ({ ...p, title: e.target.value }))
                            }
                            placeholder="e.g., Introduction to the course"
                        />
                    </div>

                    {/* Lesson Type */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Lesson Type *</Label>
                        <div className="relative">
                            <select
                                value={lessonForm.type}
                                onChange={(e) =>
                                    setLessonForm((p) => ({ ...p, type: e.target.value }))
                                }
                                className="w-full appearance-none rounded-lg border border-border bg-secondary px-3 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                            >
                                <option value="video">Video</option>
                                <option value="pdf">PDF Document</option>
                                <option value="ppt">PowerPoint (PPT/PPTX)</option>
                                <option value="doc">Word Document (DOC/DOCX)</option>
                                <option value="document">Other Document</option>
                                <option value="text">Article</option>
                                <option value="quiz">Quiz</option>
                                <option value="assignment">Assignment</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                    </div>

                    {/* File/Video Upload */}
                    {isFileType(lessonForm.type) && (
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">
                                {lessonForm.type === 'video' ? 'Video URL' : `${getLessonTypeLabel(lessonForm.type)} URL`}
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    value={lessonForm.videoUrl}
                                    onChange={(e) =>
                                        setLessonForm((p) => ({ ...p, videoUrl: e.target.value }))
                                    }
                                    placeholder="Paste URL or upload a file"
                                    className="flex-1"
                                />
                                <Button
                                    variant="default"
                                    onClick={() => {
                                        const input = document.createElement('input');
                                        input.type = 'file';
                                        input.accept = getAcceptForType(lessonForm.type);
                                        input.onchange = (e) => {
                                            const file = (e.target as HTMLInputElement).files?.[0];
                                            if (file) handleVideoUpload(file);
                                        };
                                        input.click();
                                    }}
                                    disabled={isUploading}
                                    className="gap-2"
                                >
                                    {isUploading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Upload className="h-4 w-4" />
                                            {lessonForm.type === 'video' ? 'Upload Video' : 'Upload File'}
                                        </>
                                    )}
                                </Button>
                            </div>
                            {lessonForm.videoUrl && (
                                <p className="text-xs text-emerald-500 flex items-center gap-1">
                                    ✓ File uploaded successfully
                                </p>
                            )}
                            {lessonForm.type === 'video' && (
                                <p className="text-xs text-muted-foreground">
                                    For Google Drive: Share link → Copy link
                                </p>
                            )}
                        </div>
                    )}

                    {/* Content / Description */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Content/Description</Label>
                        <textarea
                            value={lessonForm.content}
                            onChange={(e) =>
                                setLessonForm((p) => ({ ...p, content: e.target.value }))
                            }
                            rows={4}
                            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Lesson description or text content..."
                        />
                    </div>

                    {/* Duration */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Duration (minutes)</Label>
                        <Input
                            type="number"
                            value={lessonForm.duration}
                            onChange={(e) =>
                                setLessonForm((p) => ({
                                    ...p,
                                    duration: parseInt(e.target.value) || 0,
                                }))
                            }
                        />
                    </div>

                    {/* Practice Files Section */}
                    <div className="space-y-3 pt-4 border-t border-border">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-base font-semibold">Resources</Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Upload supplementary resources (PDFs, code files, etc.) for students to download.
                                </p>
                            </div>
                            <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2.5 py-0.5">
                                {lessonForm.resources.length} resource{lessonForm.resources.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {/* Add Practice File Button */}
                        <Button
                            variant="outline"
                            className="w-full gap-2 border-dashed py-6 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                            onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.multiple = true;
                                input.onchange = (e) => {
                                    const files = (e.target as HTMLInputElement).files;
                                    if (files) {
                                        Array.from(files).forEach((file) =>
                                            handlePracticeResourceUpload(file)
                                        );
                                    }
                                };
                                input.click();
                            }}
                            disabled={isUploading}
                        >
                            {isUploading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Plus className="h-4 w-4" />
                            )}
                            Add Resource
                        </Button>

                        {/* Uploaded Resources List */}
                        {lessonForm.resources.length > 0 && (
                            <div className="space-y-2">
                                {lessonForm.resources.map((res: any, idx: number) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-3 text-sm transition-colors hover:bg-secondary/80"
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background border border-border">
                                                {getResourceIcon(res.type)}
                                            </div>
                                            <div className="min-w-0">
                                                <span className="truncate font-medium text-foreground block">{res.title}</span>
                                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{res.type}</span>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                                            onClick={() => removeResource(idx)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-border">
                        <Button
                            variant="outline"
                            onClick={() => navigate(`/instructor/courses/${courseId}/edit`)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddLesson}
                            disabled={createLessonMutation.isPending || isUploading}
                            className="min-w-[120px] gap-2"
                        >
                            {createLessonMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            Add Lesson
                        </Button>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default AddLesson;
