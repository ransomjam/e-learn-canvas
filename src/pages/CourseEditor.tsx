import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft, Save, Upload, Image, Video, Plus, Trash2, GripVertical,
    ChevronDown, ChevronRight, Eye, Play, FileText, HelpCircle, Loader2,
    X, Check, BookOpen, Settings2, Layers, Globe, DollarSign, Tag, Paperclip
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { coursesService, Course, Section, Lesson } from '@/services/courses.service';
import { instructorService } from '@/services/instructor.service';
import { projectsService, Project } from '@/services/projects.service';
import { resolveMediaUrl } from '@/lib/media';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const CourseEditor = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { user } = useAuth();
    const isNewCourse = !id || id === 'new';
    const thumbnailInputRef = useRef<HTMLInputElement>(null);

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        shortDescription: '',
        description: '',
        price: 0,
        discountPrice: undefined as number | undefined,
        level: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
        currency: 'USD',
        thumbnailUrl: '',
        objectives: [''] as string[],
        requirements: [''] as string[],
        categoryId: '',
        language: 'English',
        isFree: false,
    });

    const [activeTab, setActiveTab] = useState('details');
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Section/Lesson management state
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [newSectionTitle, setNewSectionTitle] = useState('');
    const [editingLesson, setEditingLesson] = useState<string | null>(null);
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

    // Fetch existing course
    const { data: course, isLoading: courseLoading } = useQuery({
        queryKey: ['course', id],
        queryFn: () => coursesService.getCourseById(id!),
        enabled: !isNewCourse,
    });

    // Fetch sections
    const { data: sections = [], isLoading: sectionsLoading } = useQuery({
        queryKey: ['courseLessons', id],
        queryFn: () => coursesService.getCourseLessons(id!),
        enabled: !isNewCourse,
    });

    // Fetch categories
    const { data: categories = [] } = useQuery({
        queryKey: ['categories'],
        queryFn: () => coursesService.getCategories(),
    });

    // Populate form data from fetched course
    useEffect(() => {
        if (course) {
            setFormData({
                title: course.title || '',
                shortDescription: course.shortDescription || '',
                description: course.description || '',
                price: course.price || 0,
                discountPrice: course.discountPrice,
                level: course.level || 'beginner',
                currency: course.currency || 'USD',
                thumbnailUrl: course.thumbnailUrl || '',
                objectives: course.objectives?.length ? course.objectives : [''],
                requirements: course.requirements?.length ? course.requirements : [''],
                categoryId: course.category?.id || '',
                language: course.language || 'English',
                isFree: course.isFree || false,
            });
            if (course.thumbnailUrl) {
                setThumbnailPreview(resolveMediaUrl(course.thumbnailUrl));
            }
        }
    }, [course]);

    // Create course mutation
    const createCourseMutation = useMutation({
        mutationFn: (data: Partial<Course>) => coursesService.createCourse(data),
        onSuccess: (newCourse) => {
            toast({ title: 'Course created!', description: 'Now add sections and lessons.' });
            queryClient.invalidateQueries({ queryKey: ['instructorCourses'] });
            navigate(`/instructor/courses/${newCourse.id}/edit`, { replace: true });
        },
        onError: (error: any) => {
            toast({
                title: 'Failed to create course',
                description: error.response?.data?.message || 'Please try again.',
                variant: 'destructive',
            });
        },
    });

    // Update course mutation
    const updateCourseMutation = useMutation({
        mutationFn: (data: Partial<Course>) => coursesService.updateCourse(id!, data),
        onSuccess: () => {
            toast({ title: 'Course updated!', description: 'Changes have been saved.' });
            queryClient.invalidateQueries({ queryKey: ['course', id] });
            queryClient.invalidateQueries({ queryKey: ['instructorCourses'] });
        },
        onError: (error: any) => {
            toast({
                title: 'Failed to update course',
                description: error.response?.data?.message || 'Please try again.',
                variant: 'destructive',
            });
        },
    });

    // Publish course mutation
    const publishCourseMutation = useMutation({
        mutationFn: () => coursesService.publishCourse(id!),
        onSuccess: () => {
            toast({ title: 'Course published!', description: 'Students can now enroll.' });
            queryClient.invalidateQueries({ queryKey: ['course', id] });
            queryClient.invalidateQueries({ queryKey: ['instructorCourses'] });
        },
        onError: (error: any) => {
            toast({
                title: 'Failed to publish',
                description: error.response?.data?.message || 'Please try again.',
                variant: 'destructive',
            });
        },
    });

    // Section mutations
    const createSectionMutation = useMutation({
        mutationFn: (data: { title: string }) => instructorService.createSection(id!, data),
        onSuccess: () => {
            toast({ title: 'Section added!' });
            setNewSectionTitle('');
            queryClient.invalidateQueries({ queryKey: ['courseLessons', id] });
        },
        onError: () => {
            toast({ title: 'Failed to add section', variant: 'destructive' });
        },
    });

    const deleteSectionMutation = useMutation({
        mutationFn: (sectionId: string) => instructorService.deleteSection(sectionId),
        onSuccess: () => {
            toast({ title: 'Section deleted' });
            queryClient.invalidateQueries({ queryKey: ['courseLessons', id] });
        },
        onError: () => {
            toast({ title: 'Failed to delete section', variant: 'destructive' });
        },
    });

    // Lesson mutations
    const createLessonMutation = useMutation({
        mutationFn: (data: any) => instructorService.createLesson(data),
        onSuccess: () => {
            toast({ title: 'Lesson added!' });
            resetLessonForm();
            queryClient.invalidateQueries({ queryKey: ['courseLessons', id] });
        },
        onError: (error: any) => {
            toast({
                title: 'Failed to add lesson',
                description: error.response?.data?.message || error.response?.data?.errors?.[0]?.msg || 'Please try again.',
                variant: 'destructive',
            });
        },
    });

    const updateLessonMutation = useMutation({
        mutationFn: ({ lessonId, data }: { lessonId: string; data: any }) =>
            instructorService.updateLesson(lessonId, data),
        onSuccess: () => {
            toast({ title: 'Lesson updated!' });
            setEditingLesson(null);
            queryClient.invalidateQueries({ queryKey: ['courseLessons', id] });
        },
        onError: () => {
            toast({ title: 'Failed to update lesson', variant: 'destructive' });
        },
    });

    const deleteLessonMutation = useMutation({
        mutationFn: (lessonId: string) => instructorService.deleteLesson(lessonId),
        onSuccess: () => {
            toast({ title: 'Lesson deleted' });
            queryClient.invalidateQueries({ queryKey: ['courseLessons', id] });
        },
        onError: () => {
            toast({ title: 'Failed to delete lesson', variant: 'destructive' });
        },
    });

    const resetLessonForm = () => {
        setLessonForm({
            title: '',
            type: 'video',
            content: '',
            videoUrl: '',
            duration: 0,
            isFree: false,
            resources: [],
            targetSectionId: '',
        });
    };

    // Handle thumbnail upload
    const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Show preview immediately
        const reader = new FileReader();
        reader.onloadend = () => setThumbnailPreview(reader.result as string);
        reader.readAsDataURL(file);

        setIsUploading(true);
        try {
            const result = await instructorService.uploadFile(file);
            setFormData((prev) => ({ ...prev, thumbnailUrl: result.url }));
            toast({ title: 'Thumbnail uploaded!' });
        } catch {
            toast({ title: 'Upload failed', variant: 'destructive' });
            setThumbnailPreview(null);
        } finally {
            setIsUploading(false);
        }
    };

    // Helper: get accepted file types for a lesson type
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

    // Helper: get label for a lesson type
    const getLessonTypeLabel = (type: string) => {
        switch (type) {
            case 'video': return 'Video';
            case 'pdf': return 'PDF';
            case 'ppt': return 'PowerPoint';
            case 'doc': return 'Word Doc';
            case 'document': return 'Document';
            case 'text': return 'Article';
            case 'quiz': return 'Quiz';
            case 'assignment': return 'Assignment';
            default: return type;
        }
    };

    // Helper: check if a lesson type supports file upload
    const isFileType = (type: string) => ['video', 'pdf', 'ppt', 'doc', 'document'].includes(type);

    // Handle file upload for lessons (video, pdf, ppt, doc)
    const getLessonResourceIcon = (type: string) => {
        switch (type) {
            case 'pdf': return <FileText className="h-4 w-4 text-red-400" />;
            case 'ppt': return <FileText className="h-4 w-4 text-orange-400" />;
            case 'doc': return <FileText className="h-4 w-4 text-blue-400" />;
            case 'video': return <Video className="h-4 w-4 text-purple-400" />;
            default: return <Paperclip className="h-4 w-4 text-primary" />;
        }
    };

    const handleVideoUpload = async (file: File) => {
        setIsUploading(true);
        try {
            const result = await instructorService.uploadFile(file);
            const newState: Partial<typeof lessonForm> = { videoUrl: result.url };

            // Auto-detect and set the lesson type based on the uploaded file
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
            }

            const newResource = {
                title: file.name,
                url: result.url,
                type: type
            };

            setLessonForm((prev) => ({
                ...prev,
                resources: [...(prev.resources || []), newResource]
            }));

            toast({ title: 'Resource uploaded!' });
        } catch {
            toast({ title: 'Upload failed', variant: 'destructive' });
        } finally {
            setIsUploading(false);
        }
    };

    const removeLessonResource = (index: number) => {
        setLessonForm((prev) => ({
            ...prev,
            resources: (prev.resources || []).filter((_, i) => i !== index),
        }));
    };

    // Handle form submission
    const handleSaveCourse = () => {
        const data: any = {
            title: formData.title,
            shortDescription: formData.shortDescription,
            description: formData.description,
            price: formData.isFree ? 0 : formData.price,
            level: formData.level,
            currency: formData.currency,
            thumbnailUrl: formData.thumbnailUrl,
            objectives: formData.objectives.filter((o) => o.trim()),
            requirements: formData.requirements.filter((r) => r.trim()),
            language: formData.language,
            isFree: formData.isFree,
        };

        if (!formData.isFree && formData.discountPrice !== undefined && formData.discountPrice > 0) {
            data.discountPrice = formData.discountPrice;
        }

        if (formData.categoryId) {
            data.categoryId = formData.categoryId;
        }

        if (isNewCourse) {
            createCourseMutation.mutate(data);
        } else {
            updateCourseMutation.mutate(data);
        }
    };

    // Objectives / Requirements helpers
    const addObjective = () => setFormData((prev) => ({ ...prev, objectives: [...prev.objectives, ''] }));
    const removeObjective = (index: number) =>
        setFormData((prev) => ({
            ...prev,
            objectives: prev.objectives.filter((_, i) => i !== index),
        }));
    const updateObjective = (index: number, value: string) =>
        setFormData((prev) => ({
            ...prev,
            objectives: prev.objectives.map((o, i) => (i === index ? value : o)),
        }));

    const addRequirement = () => setFormData((prev) => ({ ...prev, requirements: [...prev.requirements, ''] }));
    const removeRequirement = (index: number) =>
        setFormData((prev) => ({
            ...prev,
            requirements: prev.requirements.filter((_, i) => i !== index),
        }));
    const updateRequirement = (index: number, value: string) =>
        setFormData((prev) => ({
            ...prev,
            requirements: prev.requirements.map((r, i) => (i === index ? value : r)),
        }));

    // Toggle section expansion
    const toggleSection = (sectionId: string) => {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(sectionId)) next.delete(sectionId);
            else next.add(sectionId);
            return next;
        });
    };

    // Add lesson to section
    const handleAddLesson = (sectionId: string) => {
        if (!lessonForm.title.trim()) {
            toast({ title: 'Lesson title is required', variant: 'destructive' });
            return;
        }
        createLessonMutation.mutate({
            sectionId: lessonForm.targetSectionId || sectionId,
            courseId: id!,
            title: lessonForm.title,
            type: lessonForm.type,
            content: lessonForm.content,
            videoUrl: lessonForm.videoUrl || undefined,
            videoDuration: lessonForm.duration,
            isFree: lessonForm.isFree,
            resources: lessonForm.resources,
        });
    };

    const isSaving = createCourseMutation.isPending || updateCourseMutation.isPending;

    if (!isNewCourse && courseLoading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="py-6 lg:py-10">
                <div className="container mx-auto px-4">
                    {/* Header */}
                    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" onClick={() => navigate('/instructor')}>
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h1 className="font-display text-2xl font-bold text-foreground">
                                    {isNewCourse ? 'Create New Course' : 'Edit Course'}
                                </h1>
                                {!isNewCourse && course && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant={course.status === 'published' ? 'default' : 'outline'}>
                                            {course.status}
                                        </Badge>
                                        {course.status === 'draft' && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => publishCourseMutation.mutate()}
                                                disabled={publishCourseMutation.isPending}
                                                className="text-xs"
                                            >
                                                {publishCourseMutation.isPending ? (
                                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                                ) : null}
                                                Publish
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-3">
                            {!isNewCourse && (
                                <Link to={`/course/${id}`} target="_blank">
                                    <Button variant="outline" size="sm">
                                        <Eye className="mr-2 h-4 w-4" />
                                        Preview
                                    </Button>
                                </Link>
                            )}
                            <Button onClick={handleSaveCourse} disabled={isSaving}>
                                {isSaving ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="mr-2 h-4 w-4" />
                                )}
                                {isNewCourse ? 'Create Course' : 'Save Changes'}
                            </Button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                        <TabsList className="grid w-full max-w-lg grid-cols-4">
                            <TabsTrigger value="details" className="gap-2">
                                <Settings2 className="h-4 w-4" />
                                Details
                            </TabsTrigger>
                            <TabsTrigger value="content" className="gap-2" disabled={isNewCourse}>
                                <Layers className="h-4 w-4" />
                                Content
                            </TabsTrigger>
                            <TabsTrigger value="resources" className="gap-2" disabled={isNewCourse}>
                                <FileText className="h-4 w-4" />
                                Resources
                            </TabsTrigger>
                            <TabsTrigger value="projects" className="gap-2" disabled={isNewCourse}>
                                <BookOpen className="h-4 w-4" />
                                Projects
                            </TabsTrigger>
                        </TabsList>

                        {/* ========== DETAILS TAB ========== */}
                        <TabsContent value="details" className="space-y-6">
                            <div className="grid gap-6 lg:grid-cols-3">
                                {/* Main Form */}
                                <div className="lg:col-span-2 space-y-6">
                                    {/* Course Title */}
                                    <div className="rounded-xl border border-border bg-card p-6">
                                        <h3 className="font-semibold text-foreground mb-4">Basic Information</h3>
                                        <div className="space-y-4">
                                            <div>
                                                <Label htmlFor="title">Course Title *</Label>
                                                <Input
                                                    id="title"
                                                    value={formData.title}
                                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                                    placeholder="e.g., Complete React Developer Course"
                                                    className="mt-2"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="shortDescription">Short Description</Label>
                                                <Input
                                                    id="shortDescription"
                                                    value={formData.shortDescription}
                                                    onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                                                    placeholder="A brief summary of the course"
                                                    className="mt-2"
                                                    maxLength={500}
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="description">Full Description</Label>
                                                <textarea
                                                    id="description"
                                                    rows={6}
                                                    value={formData.description}
                                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                    placeholder="Detailed course description..."
                                                    className="mt-2 w-full rounded-lg border border-border bg-secondary px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Objectives */}
                                    <div className="rounded-xl border border-border bg-card p-6">
                                        <h3 className="font-semibold text-foreground mb-4">What Students Will Learn</h3>
                                        <div className="space-y-3">
                                            {formData.objectives.map((obj, index) => (
                                                <div key={index} className="flex items-center gap-2">
                                                    <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                                    <Input
                                                        value={obj}
                                                        onChange={(e) => updateObjective(index, e.target.value)}
                                                        placeholder={`Learning objective ${index + 1}`}
                                                        className="flex-1"
                                                    />
                                                    {formData.objectives.length > 1 && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeObjective(index)}
                                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                            <Button variant="outline" size="sm" onClick={addObjective} className="gap-2">
                                                <Plus className="h-4 w-4" />
                                                Add Objective
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Requirements */}
                                    <div className="rounded-xl border border-border bg-card p-6">
                                        <h3 className="font-semibold text-foreground mb-4">Requirements</h3>
                                        <div className="space-y-3">
                                            {formData.requirements.map((req, index) => (
                                                <div key={index} className="flex items-center gap-2">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                                                    <Input
                                                        value={req}
                                                        onChange={(e) => updateRequirement(index, e.target.value)}
                                                        placeholder={`Requirement ${index + 1}`}
                                                        className="flex-1"
                                                    />
                                                    {formData.requirements.length > 1 && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeRequirement(index)}
                                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                            <Button variant="outline" size="sm" onClick={addRequirement} className="gap-2">
                                                <Plus className="h-4 w-4" />
                                                Add Requirement
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Sidebar */}
                                <div className="space-y-6">
                                    {/* Thumbnail */}
                                    <div className="rounded-xl border border-border bg-card p-6">
                                        <h3 className="font-semibold text-foreground mb-4">Course Thumbnail</h3>
                                        <div
                                            className="relative cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-border bg-secondary transition-colors hover:border-primary/50"
                                            onClick={() => thumbnailInputRef.current?.click()}
                                        >
                                            {thumbnailPreview ? (
                                                <img
                                                    src={thumbnailPreview}
                                                    alt="Thumbnail preview"
                                                    className="aspect-video w-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex aspect-video flex-col items-center justify-center gap-2 text-muted-foreground">
                                                    <Image className="h-8 w-8" />
                                                    <p className="text-sm">Click to upload thumbnail</p>
                                                    <p className="text-xs">16:9 ratio recommended</p>
                                                </div>
                                            )}
                                            {isUploading && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                                </div>
                                            )}
                                        </div>
                                        <input
                                            ref={thumbnailInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleThumbnailUpload}
                                        />
                                    </div>

                                    {/* Pricing */}
                                    <div className="rounded-xl border border-border bg-card p-6">
                                        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                                            <DollarSign className="h-4 w-4" />
                                            Pricing
                                        </h3>
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    id="isFree"
                                                    checked={formData.isFree}
                                                    onChange={(e) => setFormData({ ...formData, isFree: e.target.checked, price: e.target.checked ? 0 : formData.price })}
                                                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                                />
                                                <Label htmlFor="isFree" className="cursor-pointer font-medium">
                                                    Make this course free
                                                </Label>
                                            </div>
                                            {formData.isFree && (
                                                <p className="text-sm text-accent bg-accent/10 px-3 py-2 rounded-lg">
                                                    This course will be available for free enrollment without payment or enrollment codes.
                                                </p>
                                            )}
                                            {!formData.isFree && (
                                                <>
                                                    <div>
                                                        <Label htmlFor="price">Price ($)</Label>
                                                        <Input
                                                            id="price"
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={formData.price || ''}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                                                                    setFormData({ ...formData, price: val === '' ? 0 : parseFloat(val) || 0 });
                                                                }
                                                            }}
                                                            placeholder="0.00"
                                                            className="mt-2"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label htmlFor="discountPrice">Discount Price ($)</Label>
                                                        <Input
                                                            id="discountPrice"
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={formData.discountPrice || ''}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                                                                    setFormData({
                                                                        ...formData,
                                                                        discountPrice: val === '' ? undefined : parseFloat(val) || undefined,
                                                                    });
                                                                }
                                                            }}
                                                            placeholder="Optional"
                                                            className="mt-2"
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Category & Level */}
                                    <div className="rounded-xl border border-border bg-card p-6">
                                        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                                            <Tag className="h-4 w-4" />
                                            Category & Level
                                        </h3>
                                        <div className="space-y-4">
                                            <div>
                                                <Label htmlFor="category">Category</Label>
                                                <select
                                                    id="category"
                                                    value={formData.categoryId}
                                                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                                                    className="mt-2 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                                >
                                                    <option value="">Select a category</option>
                                                    {categories.map((cat) => (
                                                        <option key={cat.id} value={cat.id}>
                                                            {cat.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <Label htmlFor="level">Level</Label>
                                                <select
                                                    id="level"
                                                    value={formData.level}
                                                    onChange={(e) =>
                                                        setFormData({ ...formData, level: e.target.value as any })
                                                    }
                                                    className="mt-2 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                                >
                                                    <option value="beginner">Beginner</option>
                                                    <option value="intermediate">Intermediate</option>
                                                    <option value="advanced">Advanced</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-border bg-card p-6">
                                        <h3 className="font-semibold text-foreground mb-4">Language</h3>
                                        <div>
                                            <Label htmlFor="language">Language</Label>
                                            <Input
                                                id="language"
                                                value={formData.language}
                                                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                                                placeholder="e.g. English"
                                                className="mt-2"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* ========== CONTENT TAB ========== */}
                        <TabsContent value="content" className="space-y-6">
                            <div className="rounded-xl border border-border bg-card p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="font-display text-xl font-bold text-foreground">Course Content</h3>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Organize your course into sections and lessons
                                        </p>
                                    </div>
                                </div>

                                {/* Sections */}
                                <div className="space-y-4">
                                    {sections.map((section: Section, sectionIndex: number) => (
                                        <div key={section.id} className="rounded-lg border border-border bg-secondary/30">
                                            {/* Section Header */}
                                            <div
                                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/60 transition-colors"
                                                onClick={() => toggleSection(section.id)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                                    {expandedSections.has(section.id) ? (
                                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                    <div>
                                                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                            Section {sectionIndex + 1}
                                                        </p>
                                                        <p className="font-semibold text-foreground">{section.title}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline">{section.lessons?.length || 0} lessons</Badge>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (window.confirm('Delete this section and all its lessons?')) {
                                                                deleteSectionMutation.mutate(section.id);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Section Content (Lessons) */}
                                            {expandedSections.has(section.id) && (
                                                <div className="border-t border-border p-4">
                                                    {/* Existing Lessons */}
                                                    {section.lessons && section.lessons.length > 0 && (
                                                        <div className="space-y-2 mb-4">
                                                            {section.lessons.map((lesson: Lesson, lessonIndex: number) => (
                                                                <div
                                                                    key={lesson.id}
                                                                    className="flex items-center justify-between rounded-lg border border-border bg-card p-3 hover:border-primary/30 transition-colors"
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <GripVertical className="h-3 w-3 text-muted-foreground" />
                                                                        {lesson.type === 'video' ? (
                                                                            <Play className="h-4 w-4 text-primary" />
                                                                        ) : lesson.type === 'pdf' ? (
                                                                            <FileText className="h-4 w-4 text-red-500" />
                                                                        ) : lesson.type === 'ppt' ? (
                                                                            <FileText className="h-4 w-4 text-orange-500" />
                                                                        ) : lesson.type === 'doc' ? (
                                                                            <FileText className="h-4 w-4 text-blue-500" />
                                                                        ) : lesson.type === 'document' ? (
                                                                            <FileText className="h-4 w-4 text-primary" />
                                                                        ) : lesson.type === 'quiz' ? (
                                                                            <HelpCircle className="h-4 w-4 text-accent" />
                                                                        ) : (
                                                                            <FileText className="h-4 w-4 text-primary" />
                                                                        )}
                                                                        <div>
                                                                            <p className="text-sm font-medium text-foreground">{lesson.title}</p>
                                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                                <Badge variant="outline" className="text-[10px] h-4">
                                                                                    {getLessonTypeLabel(lesson.type)}
                                                                                </Badge>
                                                                                {lesson.duration && (
                                                                                    <span className="text-xs text-muted-foreground">
                                                                                        {lesson.duration} min
                                                                                    </span>
                                                                                )}
                                                                                {lesson.isFree && (
                                                                                    <Badge className="text-[10px] h-4 bg-emerald-500/20 text-emerald-400">
                                                                                        Free
                                                                                    </Badge>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-7 w-7"
                                                                            onClick={() => {
                                                                                setEditingLesson(editingLesson === lesson.id ? null : lesson.id);
                                                                                if (editingLesson !== lesson.id) {
                                                                                    let practiceFiles: any[] = [];
                                                                                    try {
                                                                                        let raw = lesson.practiceFiles;
                                                                                        // Check if practiceFiles is effectively empty
                                                                                        const isEmpty = !raw || (Array.isArray(raw) && raw.length === 0) || raw === '[]';

                                                                                        if (isEmpty && lesson.resources) {
                                                                                            raw = lesson.resources;
                                                                                        }

                                                                                        practiceFiles = typeof raw === 'string'
                                                                                            ? JSON.parse(raw || '[]')
                                                                                            : (raw || []);
                                                                                    } catch (e) {
                                                                                        console.error('Error parsing practice files', e);
                                                                                        practiceFiles = [];
                                                                                    }

                                                                                    setLessonForm({
                                                                                        title: lesson.title,
                                                                                        type: lesson.type,
                                                                                        content: lesson.content || '',
                                                                                        videoUrl: lesson.videoUrl || '',
                                                                                        duration: lesson.duration || 0,
                                                                                        isFree: lesson.isFree,
                                                                                        resources: Array.isArray(practiceFiles) ? practiceFiles : [],
                                                                                        targetSectionId: '',
                                                                                    });
                                                                                }
                                                                            }}
                                                                        >
                                                                            <Settings2 className="h-3 w-3" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                                            onClick={() => {
                                                                                if (window.confirm('Delete this lesson?')) {
                                                                                    deleteLessonMutation.mutate(lesson.id);
                                                                                }
                                                                            }}
                                                                        >
                                                                            <Trash2 className="h-3 w-3" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ))}

                                                            {/* Lesson Edit Form (inline) */}
                                                            {editingLesson &&
                                                                section.lessons.some((l: Lesson) => l.id === editingLesson) && (
                                                                    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                                                                        <h4 className="text-sm font-semibold text-foreground">Edit Lesson</h4>
                                                                        <div className="grid gap-3 sm:grid-cols-2">
                                                                            <div>
                                                                                <Label className="text-xs">Title</Label>
                                                                                <Input
                                                                                    value={lessonForm.title}
                                                                                    onChange={(e) =>
                                                                                        setLessonForm((p) => ({ ...p, title: e.target.value }))
                                                                                    }
                                                                                    className="mt-1"
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <Label className="text-xs">Lesson Type</Label>
                                                                                <div className="relative mt-1">
                                                                                    <select
                                                                                        value={lessonForm.type}
                                                                                        onChange={(e) =>
                                                                                            setLessonForm((p) => ({ ...p, type: e.target.value }))
                                                                                        }
                                                                                        className="w-full appearance-none rounded-lg border border-border bg-secondary px-3 py-2 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
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
                                                                        </div>
                                                                        {isFileType(lessonForm.type) && (
                                                                            <div>
                                                                                <Label className="text-xs">{lessonForm.type === 'video' ? 'Video URL' : `${getLessonTypeLabel(lessonForm.type)} URL`}</Label>
                                                                                <div className="flex gap-2 mt-1">
                                                                                    <Input
                                                                                        value={lessonForm.videoUrl}
                                                                                        onChange={(e) =>
                                                                                            setLessonForm((p) => ({ ...p, videoUrl: e.target.value }))
                                                                                        }
                                                                                        placeholder={`Paste URL or upload a ${getLessonTypeLabel(lessonForm.type).toLowerCase()} file`}
                                                                                        className="flex-1"
                                                                                    />
                                                                                    <Button
                                                                                        variant="outline"
                                                                                        size="sm"
                                                                                        className="gap-2"
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
                                                                                    >
                                                                                        {isUploading ? (
                                                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                                                        ) : (
                                                                                            <>
                                                                                                {lessonForm.type === 'video' ? <Video className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                                                                                                {lessonForm.type === 'video' ? 'Replace Video' : 'Replace File'}
                                                                                            </>
                                                                                        )}
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        <div>
                                                                            <Label className="text-xs">Content / Description</Label>
                                                                            <textarea
                                                                                value={lessonForm.content}
                                                                                onChange={(e) =>
                                                                                    setLessonForm((p) => ({ ...p, content: e.target.value }))
                                                                                }
                                                                                rows={3}
                                                                                className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground resize-y"
                                                                                placeholder="Lesson content or description..."
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <div>
                                                                                <Label className="text-xs">Duration (minutes)</Label>
                                                                                <Input
                                                                                    type="text"
                                                                                    inputMode="numeric"
                                                                                    value={lessonForm.duration || ''}
                                                                                    onChange={(e) => {
                                                                                        const val = e.target.value;
                                                                                        if (val === '' || /^\d+$/.test(val)) {
                                                                                            setLessonForm((p) => ({
                                                                                                ...p,
                                                                                                duration: val === '' ? 0 : parseInt(val) || 0,
                                                                                            }));
                                                                                        }
                                                                                    }}
                                                                                    placeholder="e.g. 15"
                                                                                    className="mt-1"
                                                                                />
                                                                            </div>
                                                                        </div>

                                                                        {/* Resources */}
                                                                        <div className="space-y-3 pt-4 border-t border-border">
                                                                            <div className="flex items-center justify-between">
                                                                                <Label className="text-xs font-semibold">Resources</Label>
                                                                                <span className="text-[10px] text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
                                                                                    {lessonForm.resources.length} resource{lessonForm.resources.length === 1 ? '' : 's'}
                                                                                </span>
                                                                            </div>
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="w-full gap-2 border-dashed h-8 text-xs"
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
                                                                                {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                                                                Add Resource
                                                                            </Button>
                                                                            {lessonForm.resources && lessonForm.resources.length > 0 ? (
                                                                                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                                                                    {lessonForm.resources.map((res: any, idx: number) => (
                                                                                        <div key={idx} className="flex items-center justify-between rounded bg-secondary/50 p-2 text-xs">
                                                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                                                {getLessonResourceIcon(res.type)}
                                                                                                <span className="truncate">{res.title}</span>
                                                                                            </div>
                                                                                            <Button
                                                                                                variant="ghost"
                                                                                                size="icon"
                                                                                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                                                                onClick={() => removeLessonResource(idx)}
                                                                                            >
                                                                                                <X className="h-3 w-3" />
                                                                                            </Button>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            ) : (
                                                                                <p className="text-xs text-muted-foreground">
                                                                                    No resources added for this lesson yet.
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex gap-2">
                                                                            <Button
                                                                                size="sm"
                                                                                onClick={() =>
                                                                                    updateLessonMutation.mutate({
                                                                                        lessonId: editingLesson!,
                                                                                        data: {
                                                                                            title: lessonForm.title,
                                                                                            type: lessonForm.type,
                                                                                            content: lessonForm.content,
                                                                                            videoUrl: lessonForm.videoUrl || undefined,
                                                                                            videoDuration: lessonForm.duration,
                                                                                            isFree: lessonForm.isFree,
                                                                                            practiceFiles: lessonForm.resources,
                                                                                            resources: [],
                                                                                        },
                                                                                    })
                                                                                }
                                                                                disabled={updateLessonMutation.isPending || isUploading}
                                                                            >
                                                                                {updateLessonMutation.isPending ? (
                                                                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                                                                ) : (
                                                                                    <Save className="mr-1 h-3 w-3" />
                                                                                )}
                                                                                Save
                                                                            </Button>
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={() => {
                                                                                    setEditingLesson(null);
                                                                                    resetLessonForm();
                                                                                }}
                                                                            >
                                                                                Cancel
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}


                                    {/* Add New Lesson Button */}
                                    <div className="mb-6 rounded-lg border border-dashed border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-semibold text-foreground">Add New Lesson</h4>
                                            <p className="text-xs text-muted-foreground">Create a new lesson and assign it to a section.</p>
                                        </div>
                                        <Button onClick={() => navigate(`/instructor/courses/${id}/lessons/new`)}>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Add Lesson
                                        </Button>
                                    </div>

                                    {/* Add New Section */}
                                    <div className="rounded-lg border-2 border-dashed border-border bg-secondary/10 p-4">
                                        <h4 className="text-sm font-semibold text-foreground mb-3">
                                            Add New Section
                                        </h4>
                                        <div className="flex gap-2">
                                            <Input
                                                value={newSectionTitle}
                                                onChange={(e) => setNewSectionTitle(e.target.value)}
                                                placeholder="Section title (e.g., Introduction)"
                                                className="flex-1"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && newSectionTitle.trim()) {
                                                        createSectionMutation.mutate({ title: newSectionTitle });
                                                    }
                                                }}
                                            />
                                            <Button
                                                onClick={() => {
                                                    if (newSectionTitle.trim()) {
                                                        createSectionMutation.mutate({ title: newSectionTitle });
                                                    }
                                                }}
                                                disabled={createSectionMutation.isPending || !newSectionTitle.trim()}
                                            >
                                                {createSectionMutation.isPending ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Plus className="mr-2 h-4 w-4" />
                                                )}
                                                Add Section
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* ========== RESOURCES TAB ========== */}
                        <TabsContent value="resources" className="space-y-6">
                            <ResourcesManager courseId={id!} />
                        </TabsContent>

                        {/* ========== PROJECTS TAB ========== */}
                        <TabsContent value="projects" className="space-y-6">
                            <ProjectsManager courseId={id!} />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </AdminLayout>
    );
};

// Resources Manager Sub-component
const ResourcesManager = ({ courseId }: { courseId: string }) => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [resourceForm, setResourceForm] = useState({
        title: '',
        url: '',
        type: 'link',
        description: '',
    });

    const { data: resources = [], isLoading } = useQuery({
        queryKey: ['courseResources', courseId],
        queryFn: () => coursesService.getResources(courseId),
        enabled: !!courseId,
    });

    const addResourceMutation = useMutation({
        mutationFn: (data: { title: string; url: string; type?: string; description?: string }) =>
            coursesService.addResource(courseId, data),
        onSuccess: () => {
            toast({ title: 'Resource added!' });
            setResourceForm({ title: '', url: '', type: 'link', description: '' });
            queryClient.invalidateQueries({ queryKey: ['courseResources', courseId] });
        },
        onError: () => {
            toast({ title: 'Failed to add resource', variant: 'destructive' });
        },
    });

    const deleteResourceMutation = useMutation({
        mutationFn: (resourceId: string) => coursesService.deleteResource(courseId, resourceId),
        onSuccess: () => {
            toast({ title: 'Resource deleted' });
            queryClient.invalidateQueries({ queryKey: ['courseResources', courseId] });
        },
        onError: () => {
            toast({ title: 'Failed to delete resource', variant: 'destructive' });
        },
    });

    const handleUploadResource = async (file: File) => {
        try {
            const result = await instructorService.uploadFile(file);
            let resourceType = 'file';
            if (result.fileType) {
                if (result.fileType === 'pdf') resourceType = 'pdf';
                else if (result.fileType === 'ppt') resourceType = 'ppt';
                else if (result.fileType === 'doc') resourceType = 'doc';
                else if (result.fileType === 'image') resourceType = 'image';
                else if (result.fileType === 'video') resourceType = 'video';
            }

            setResourceForm((prev) => ({
                ...prev,
                url: result.url,
                title: prev.title || result.originalName || file.name,
                type: resourceType !== 'file' ? resourceType : prev.type,
            }));
            toast({ title: 'File uploaded!' });
        } catch {
            toast({ title: 'Upload failed', variant: 'destructive' });
        }
    };

    return (
        <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-display text-xl font-bold text-foreground mb-6">
                Course Resources
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
                Add supplementary materials like PDFs, links, or downloads for students.
            </p>

            {/* Existing Resources */}
            {isLoading ? (
                <div className="flex justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            ) : resources.length > 0 ? (
                <div className="space-y-3 mb-6">
                    {resources.map((resource: any) => (
                        <div
                            key={resource.id}
                            className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="font-medium text-foreground text-sm truncate">{resource.title}</p>
                                    {resource.description && (
                                        <p className="text-xs text-muted-foreground truncate">{resource.description}</p>
                                    )}
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                                onClick={() => {
                                    if (window.confirm('Delete this resource?')) {
                                        deleteResourceMutation.mutate(resource.id);
                                    }
                                }}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            ) : null}

            {/* Add Resource Form */}
            <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">Add Resource</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                        <Label className="text-xs">Title *</Label>
                        <Input
                            value={resourceForm.title}
                            onChange={(e) => setResourceForm((p) => ({ ...p, title: e.target.value }))}
                            placeholder="Resource name"
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <Label className="text-xs">Type</Label>
                        <select
                            value={resourceForm.type}
                            onChange={(e) => setResourceForm((p) => ({ ...p, type: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground"
                        >
                            <option value="link">Link</option>
                            <option value="pdf">PDF</option>
                            <option value="ppt">Presentation (PPT/PPTX)</option>
                            <option value="doc">Document (DOC/DOCX)</option>
                            <option value="file">Other File</option>
                        </select>
                    </div>
                </div>
                <div>
                    <Label className="text-xs">URL / File</Label>
                    <div className="flex gap-2 mt-1">
                        <Input
                            value={resourceForm.url}
                            onChange={(e) => setResourceForm((p) => ({ ...p, url: e.target.value }))}
                            placeholder="URL or upload a file"
                            className="flex-1"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.onchange = (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (file) handleUploadResource(file);
                                };
                                input.click();
                            }}
                        >
                            <Upload className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <div>
                    <Label className="text-xs">Description</Label>
                    <Input
                        value={resourceForm.description}
                        onChange={(e) => setResourceForm((p) => ({ ...p, description: e.target.value }))}
                        placeholder="Optional description"
                        className="mt-1"
                    />
                </div>
                <Button
                    size="sm"
                    onClick={() => {
                        if (!resourceForm.title.trim() || !resourceForm.url.trim()) {
                            toast({ title: 'Title and URL are required', variant: 'destructive' });
                            return;
                        }
                        addResourceMutation.mutate(resourceForm);
                    }}
                    disabled={addResourceMutation.isPending}
                >
                    {addResourceMutation.isPending ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : (
                        <Plus className="mr-2 h-3 w-3" />
                    )}
                    Add Resource
                </Button>
            </div>
        </div>
    );
};


export default CourseEditor;

// Projects Manager Sub-component
const ProjectsManager = ({ courseId }: { courseId: string }) => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    const [form, setForm] = useState({
        title: '',
        description: '',
        instructions: '',
        dueDate: '',
    });

    const { data: projects = [], isLoading } = useQuery({
        queryKey: ['courseProjects', courseId],
        queryFn: () => projectsService.getCourseProjects(courseId),
        enabled: !!courseId,
    });

    const createMutation = useMutation({
        mutationFn: (data: { form: typeof form; file?: File }) => projectsService.createProject(courseId, data.form, data.file),
        onSuccess: () => {
            toast({ title: 'Project created!' });
            resetForm();
            queryClient.invalidateQueries({ queryKey: ['courseProjects', courseId] });
        },
        onError: () => toast({ title: 'Failed to create project', variant: 'destructive' }),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data, file }: { id: string; data: typeof form; file?: File }) => projectsService.updateProject(id, data, file),
        onSuccess: () => {
            toast({ title: 'Project updated!' });
            resetForm();
            queryClient.invalidateQueries({ queryKey: ['courseProjects', courseId] });
        },
        onError: () => toast({ title: 'Failed to update project', variant: 'destructive' }),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => projectsService.deleteProject(id),
        onSuccess: () => {
            toast({ title: 'Project deleted' });
            queryClient.invalidateQueries({ queryKey: ['courseProjects', courseId] });
        },
        onError: () => toast({ title: 'Failed to delete project', variant: 'destructive' }),
    });

    const resetForm = () => {
        setForm({ title: '', description: '', instructions: '', dueDate: '' });
        setAttachmentFile(null);
        setIsCreating(false);
        setEditingId(null);
    };

    const startEdit = (project: any) => {
        setForm({
            title: project.title || '',
            description: project.description || '',
            instructions: project.instructions || '',
            dueDate: project.due_date ? new Date(project.due_date).toISOString().split('T')[0] : '',
        });
        setEditingId(project.id);
        setIsCreating(true);
    };

    const handleSubmit = () => {
        if (!form.title.trim()) {
            toast({ title: 'Project title is required', variant: 'destructive' });
            return;
        }
        if (editingId) {
            updateMutation.mutate({ id: editingId, data: form, file: attachmentFile || undefined });
        } else {
            createMutation.mutate({ form, file: attachmentFile || undefined });
        }
    };

    const isSaving = createMutation.isPending || updateMutation.isPending;

    return (
        <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="font-semibold text-foreground">Course Projects</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Create assignments and projects for students to submit.
                        </p>
                    </div>
                    {!isCreating && (
                        <Button size="sm" onClick={() => setIsCreating(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Project
                        </Button>
                    )}
                </div>

                {/* Create / Edit form */}
                {isCreating && (
                    <div className="rounded-lg border border-dashed border-border p-4 space-y-4 mb-6 bg-muted/20">
                        <h4 className="text-sm font-semibold">
                            {editingId ? 'Edit Project' : 'New Project'}
                        </h4>
                        <div className="space-y-3">
                            <div>
                                <Label className="text-xs">Title *</Label>
                                <Input
                                    value={form.title}
                                    onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
                                    placeholder="e.g., Build a Portfolio Website"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Description</Label>
                                <Input
                                    value={form.description}
                                    onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
                                    placeholder="Brief overview of the project"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Instructions</Label>
                                <textarea
                                    value={form.instructions}
                                    onChange={(e) => setForm(p => ({ ...p, instructions: e.target.value }))}
                                    placeholder="Detailed instructions for students..."
                                    rows={5}
                                    className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground resize-y"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Due Date (optional)</Label>
                                <Input
                                    type="date"
                                    value={form.dueDate}
                                    onChange={(e) => setForm(p => ({ ...p, dueDate: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Attachment (optional)</Label>
                                <div className="mt-1 flex items-center gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
                                        <Paperclip className="h-4 w-4" />
                                        {attachmentFile ? attachmentFile.name : 'Choose file'}
                                        <input
                                            type="file"
                                            className="hidden"
                                            onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                                        />
                                    </label>
                                    {attachmentFile && (
                                        <Button type="button" size="sm" variant="ghost" onClick={() => setAttachmentFile(null)}>
                                            Remove
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button size="sm" onClick={handleSubmit} disabled={isSaving}>
                                {isSaving ? (
                                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                ) : editingId ? (
                                    <Check className="mr-2 h-3 w-3" />
                                ) : (
                                    <Plus className="mr-2 h-3 w-3" />
                                )}
                                {editingId ? 'Save Changes' : 'Create Project'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={resetForm}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}

                {/* Projects list */}
                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : projects.length === 0 && !isCreating ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">No projects yet</p>
                        <p className="text-xs mt-1">Click "New Project" to create an assignment for students.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {projects.map((project: any) => (
                            <div
                                key={project.id}
                                className="rounded-lg border border-border p-4 flex items-start justify-between gap-4 hover:bg-accent/5 transition-colors"
                            >
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-medium text-sm text-foreground">{project.title}</h4>
                                    {project.description && (
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                            {project.description}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                        {project.due_date && (
                                            <span>Due: {new Date(project.due_date).toLocaleDateString()}</span>
                                        )}
                                        <span>{project.submission_count || 0} submissions</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => startEdit(project)}
                                    >
                                        <Settings2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        onClick={() => {
                                            if (window.confirm('Delete this project? Student submissions will also be removed.')) {
                                                deleteMutation.mutate(project.id);
                                            }
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
