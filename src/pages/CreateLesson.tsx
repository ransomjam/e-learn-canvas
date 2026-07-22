import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { marked } from 'marked';
import {
    ArrowLeft, Lightbulb, ClipboardPaste, FileText, FileType2, Presentation,
    Mic, Video, PenLine, Loader2, Sparkles, Upload, CheckCircle2, XCircle,
    ChevronDown, Square, RefreshCcw, AlertTriangle, Save, Wand2,
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { coursesService, Section } from '@/services/courses.service';
import { aiStudioService } from '@/services/aiStudio.service';
import { instructorService } from '@/services/instructor.service';
import WhiteboardPlayer from '@/components/ai-studio/WhiteboardPlayer';
import AIAssistantPanel from '@/components/ai-studio/AIAssistantPanel';
import type { AIJob, LessonPack, SourceType } from '@/types/aiStudio';

/**
 * Create Lesson — the AI Course Studio entry point.
 *
 * The instructor only answers "What would you like to start with?".
 * Everything else (understanding, structuring, generating the lesson,
 * quiz, flashcards, slides, assignment and whiteboard video) happens
 * automatically in a background pipeline.
 */

type Step = 'pick' | 'input' | 'progress' | 'review';

interface SourceOption {
    type: SourceType | 'manual';
    icon: React.ElementType;
    title: string;
    description: string;
    accept?: string;
}

const SOURCE_OPTIONS: SourceOption[] = [
    { type: 'idea', icon: Lightbulb, title: 'Start with an Idea', description: 'Describe your lesson in a sentence — we build the rest' },
    { type: 'text', icon: ClipboardPaste, title: 'Paste Text', description: 'From ChatGPT, Claude, Gemini, Word, Docs or Notion' },
    { type: 'pdf', icon: FileText, title: 'Upload PDF', description: 'Books, papers, notes — any size' },
    { type: 'doc', icon: FileType2, title: 'Upload Word Document', description: '.doc and .docx files', accept: '.doc,.docx' },
    { type: 'ppt', icon: Presentation, title: 'Upload PowerPoint', description: '.ppt and .pptx slide decks', accept: '.ppt,.pptx' },
    { type: 'audio', icon: Mic, title: 'Record Voice', description: 'Just explain the lesson out loud' },
    { type: 'video', icon: Video, title: 'Upload Video', description: 'An existing lecture recording' },
    { type: 'manual', icon: PenLine, title: 'Write Manually', description: 'The classic lesson editor' },
];

const INCLUDE_OPTIONS = [
    { key: 'quiz', label: 'Quiz' },
    { key: 'flashcards', label: 'Flashcards' },
    { key: 'slides', label: 'Slides' },
    { key: 'assignment', label: 'Assignment' },
    { key: 'whiteboard', label: 'Whiteboard video' },
] as const;

const PROGRESS_STEPS = [
    'Reading your content...',
    'Understanding content...',
    'Generating lesson...',
    'Creating quiz...',
    'Creating flashcards...',
    'Generating slides...',
    'Creating assignment...',
    'Creating storyboard...',
    'Rendering whiteboard video...',
];

const CreateLesson = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [step, setStep] = useState<Step>('pick');
    const [sourceType, setSourceType] = useState<SourceType>('idea');
    const [textInput, setTextInput] = useState('');
    const [include, setInclude] = useState<Record<string, boolean>>({
        quiz: true, flashcards: true, slides: true, assignment: true, whiteboard: true,
    });

    // File upload state
    const [uploading, setUploading] = useState(false);
    const [uploadPercent, setUploadPercent] = useState(0);
    const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string; mimeType: string } | null>(null);

    // Voice recorder state
    const [recording, setRecording] = useState(false);
    const [recordSeconds, setRecordSeconds] = useState(0);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordTimerRef = useRef<ReturnType<typeof setInterval>>();

    // Job state
    const [job, setJob] = useState<AIJob | null>(null);
    const pollStopRef = useRef<(() => void) | null>(null);

    // Review state
    const [pack, setPack] = useState<LessonPack | null>(null);
    const [lessonTitle, setLessonTitle] = useState('');
    const [lessonMarkdown, setLessonMarkdown] = useState('');
    // '' = none selected, '__new__' = create a brand new section, otherwise a section id
    const [targetSectionId, setTargetSectionId] = useState('');
    const [newSectionName, setNewSectionName] = useState('');
    const [createQuizLesson, setCreateQuizLesson] = useState(true);
    const [saving, setSaving] = useState(false);

    const { data: course } = useQuery({
        queryKey: ['course', courseId],
        queryFn: () => coursesService.getCourseById(courseId!),
        enabled: !!courseId,
    });
    const { data: sections = [] } = useQuery({
        queryKey: ['courseLessons', courseId],
        queryFn: () => coursesService.getCourseLessons(courseId!),
        enabled: !!courseId,
    });
    const availableSections: Section[] = sections.length > 0 ? sections : ((course?.sections as Section[]) || []);

    useEffect(() => () => {
        pollStopRef.current?.();
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    }, []);

    // ── source selection ───────────────────────────────────────────────────
    const pickSource = (option: SourceOption) => {
        if (option.type === 'manual') {
            navigate(`/instructor/courses/${courseId}/lessons/manual`);
            return;
        }
        setSourceType(option.type as SourceType);
        setTextInput('');
        setUploadedFile(null);
        setRecordedBlob(null);
        setStep('input');
    };

    const currentOption = SOURCE_OPTIONS.find((o) => o.type === sourceType)!;

    // ── file upload ────────────────────────────────────────────────────────
    const handleFilePick = (accept: string) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            setUploading(true);
            setUploadPercent(0);
            try {
                const result = await aiStudioService.uploadSourceFile(file, setUploadPercent);
                setUploadedFile({ name: file.name, url: result.url, mimeType: result.mimeType });
            } catch (error: any) {
                toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
            } finally {
                setUploading(false);
            }
        };
        input.click();
    };

    // ── voice recording ────────────────────────────────────────────────────
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            const chunks: Blob[] = [];
            recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
            recorder.onstop = () => {
                setRecordedBlob(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
                stream.getTracks().forEach((t) => t.stop());
            };
            recorder.start();
            mediaRecorderRef.current = recorder;
            setRecordedBlob(null);
            setRecordSeconds(0);
            setRecording(true);
            recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
        } catch {
            toast({ title: 'Microphone access denied', description: 'Allow microphone access to record your lesson.', variant: 'destructive' });
        }
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setRecording(false);
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };

    // ── generation ─────────────────────────────────────────────────────────
    const canGenerate = () => {
        if (sourceType === 'idea' || sourceType === 'text') return textInput.trim().length > 0;
        if (sourceType === 'audio') return !!recordedBlob || !!uploadedFile;
        return !!uploadedFile;
    };

    const startGeneration = async () => {
        try {
            let fileUrl = uploadedFile?.url;
            let mimeType = uploadedFile?.mimeType;

            // Upload the voice recording lazily, right before generating
            if (sourceType === 'audio' && recordedBlob && !fileUrl) {
                setUploading(true);
                const ext = (recordedBlob.type || 'audio/webm').includes('mp4') ? 'm4a' : 'webm';
                const file = new File([recordedBlob], `voice-lesson-${Date.now()}.${ext}`, { type: recordedBlob.type || 'audio/webm' });
                const result = await aiStudioService.uploadSourceFile(file);
                fileUrl = result.url;
                mimeType = result.mimeType;
                setUploading(false);
            }

            setStep('progress');
            setJob(null);
            const { jobId } = await aiStudioService.generateLessonPack({
                courseId: courseId!,
                source: {
                    sourceType,
                    text: textInput.trim() || undefined,
                    fileUrl,
                    mimeType,
                },
                include,
            });

            const { promise, stop } = aiStudioService.pollJob(jobId, setJob);
            pollStopRef.current = stop;
            const finished = await promise;
            const result = finished.result as LessonPack;
            setPack(result);
            setLessonTitle(result.lesson?.title || result.structured?.title || '');
            setLessonMarkdown(result.lesson?.markdown || '');
            // Pre-select a destination so the lesson can always be saved:
            // the only section if there's one, else default to creating a new
            // section (so a course with no sections is never a dead end).
            if (availableSections.length === 1) {
                setTargetSectionId(availableSections[0].id);
            } else if (availableSections.length === 0) {
                setTargetSectionId('__new__');
                setNewSectionName('Lessons');
            }
            setStep('review');
        } catch (error: any) {
            setUploading(false);
            toast({
                title: 'Generation failed',
                description: error.response?.data?.message || error.message || 'Please try again.',
                variant: 'destructive',
            });
            setStep('input');
        }
    };

    const cancelGeneration = async () => {
        pollStopRef.current?.();
        if (job?.id) await aiStudioService.cancelJob(job.id).catch(() => undefined);
        setStep('input');
    };

    // ── save ───────────────────────────────────────────────────────────────
    const creatingNewSection = targetSectionId === '__new__';

    const saveLesson = async () => {
        if (!job?.id || !pack) return;
        if (creatingNewSection && !newSectionName.trim()) {
            toast({ title: 'Name the new section for this lesson', variant: 'destructive' });
            return;
        }
        if (!targetSectionId) {
            toast({ title: 'Choose where to save the lesson', variant: 'destructive' });
            return;
        }
        setSaving(true);
        try {
            // Create the destination section on the fly when needed, so an
            // instructor never has to leave the studio to make one first.
            let sectionId = targetSectionId;
            if (creatingNewSection) {
                const section = await instructorService.createSection(courseId!, { title: newSectionName.trim() });
                sectionId = section.id;
            }

            await aiStudioService.applyJob(job.id, {
                sectionId,
                title: lessonTitle,
                include: { quizLesson: createQuizLesson && !!pack.quiz?.length },
                overrides: lessonMarkdown !== pack.lesson?.markdown ? { markdown: lessonMarkdown } : undefined,
            });
            queryClient.invalidateQueries({ queryKey: ['course', courseId] });
            queryClient.invalidateQueries({ queryKey: ['courseLessons', courseId] });
            toast({ title: 'Lesson created!', description: 'Your AI-generated lesson has been added to the course.' });
            navigate(`/instructor/courses/${courseId}/edit`);
        } catch (error: any) {
            toast({
                title: 'Could not save the lesson',
                description: error.response?.data?.message || error.message,
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    // ── render helpers ─────────────────────────────────────────────────────
    const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    const renderFileUpload = (accept: string) => (
        <div className="space-y-3">
            <Button
                variant="outline"
                className="w-full gap-2 border-dashed py-10 hover:border-primary/50 hover:bg-primary/5"
                onClick={() => handleFilePick(accept)}
                disabled={uploading}
            >
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                {uploading ? `Uploading... ${uploadPercent}%` : uploadedFile ? 'Choose a different file' : `Select ${currentOption.title.replace('Upload ', '')}`}
            </Button>
            {uploadedFile && !uploading && (
                <p className="text-sm text-emerald-500 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> {uploadedFile.name} uploaded
                </p>
            )}
        </div>
    );

    const stepLabel = job?.stepLabel || 'Starting...';
    const activeStepIndex = PROGRESS_STEPS.findIndex((s) => s === stepLabel);

    return (
        <AdminLayout>
            <div className="space-y-6 max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            if (step === 'input') setStep('pick');
                            else navigate(`/instructor/courses/${courseId}/edit`);
                        }}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
                            Create Lesson
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            for <span className="text-primary font-medium">{course?.title}</span>
                        </p>
                    </div>
                </div>

                {/* ── STEP 1: source picker ── */}
                {step === 'pick' && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-foreground">What would you like to start with?</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {SOURCE_OPTIONS.map((option) => (
                                <button
                                    key={option.type}
                                    onClick={() => pickSource(option)}
                                    className="group flex items-start gap-4 rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/60 hover:shadow-md hover:-translate-y-0.5"
                                >
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                        <option.icon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-foreground">{option.title}</h3>
                                        <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── STEP 2: input ── */}
                {step === 'input' && (
                    <div className="rounded-xl border border-border bg-card p-6 space-y-6 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <currentOption.icon className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-foreground">{currentOption.title}</h2>
                                <p className="text-xs text-muted-foreground">{currentOption.description}</p>
                            </div>
                        </div>

                        {(sourceType === 'idea' || sourceType === 'text') && (
                            <textarea
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                rows={sourceType === 'idea' ? 4 : 12}
                                autoFocus
                                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                                placeholder={
                                    sourceType === 'idea'
                                        ? 'e.g. "How compound interest works, with a savings example for beginners"'
                                        : 'Paste your lesson content here — from ChatGPT, Claude, Gemini, Word, Google Docs, Notion...'
                                }
                            />
                        )}

                        {sourceType === 'pdf' && renderFileUpload('.pdf')}
                        {sourceType === 'doc' && renderFileUpload('.doc,.docx')}
                        {sourceType === 'ppt' && renderFileUpload('.ppt,.pptx')}
                        {sourceType === 'video' && renderFileUpload('video/*')}

                        {sourceType === 'audio' && (
                            <div className="space-y-4">
                                <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-8">
                                    {recording ? (
                                        <>
                                            <div className="flex items-center gap-2 text-destructive">
                                                <span className="relative flex h-3 w-3">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
                                                </span>
                                                <span className="font-mono text-lg">{fmtTime(recordSeconds)}</span>
                                            </div>
                                            <Button variant="destructive" onClick={stopRecording} className="gap-2">
                                                <Square className="h-4 w-4" /> Stop Recording
                                            </Button>
                                            <p className="text-xs text-muted-foreground">Just explain the lesson as if a student were sitting next to you.</p>
                                        </>
                                    ) : recordedBlob ? (
                                        <>
                                            <audio controls src={URL.createObjectURL(recordedBlob)} className="w-full max-w-sm" />
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" onClick={startRecording} className="gap-2">
                                                    <RefreshCcw className="h-4 w-4" /> Re-record
                                                </Button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <Button onClick={startRecording} className="gap-2" size="lg">
                                                <Mic className="h-5 w-5" /> Start Recording
                                            </Button>
                                            <p className="text-xs text-muted-foreground">or upload an existing audio file below</p>
                                        </>
                                    )}
                                </div>
                                {!recording && !recordedBlob && renderFileUpload('audio/*')}
                            </div>
                        )}

                        {/* What to create */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Also create</Label>
                            <div className="flex flex-wrap gap-2">
                                {INCLUDE_OPTIONS.map(({ key, label }) => (
                                    <button
                                        key={key}
                                        onClick={() => setInclude((p) => ({ ...p, [key]: !p[key] }))}
                                        className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${include[key]
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border bg-secondary/40 text-muted-foreground hover:bg-secondary'
                                            }`}
                                    >
                                        {include[key] ? '✓ ' : ''}{label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">The lesson itself is always created. Everything stays editable before saving.</p>
                        </div>

                        <div className="flex justify-end gap-3 pt-2 border-t border-border">
                            <Button variant="outline" onClick={() => setStep('pick')}>Back</Button>
                            <Button onClick={startGeneration} disabled={!canGenerate() || uploading} className="gap-2 min-w-[140px]">
                                <Sparkles className="h-4 w-4" />
                                Create Lesson
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── STEP 3: progress ── */}
                {step === 'progress' && (
                    <div className="rounded-xl border border-border bg-card p-8 space-y-6 shadow-sm">
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                                <Wand2 className="h-8 w-8 text-primary animate-pulse" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-foreground">Building your lesson</h2>
                                <p className="text-sm text-muted-foreground mt-1">{stepLabel}</p>
                            </div>
                        </div>

                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-700"
                                style={{ width: `${job?.progress ?? 2}%` }}
                            />
                        </div>

                        <div className="space-y-1.5 max-w-sm mx-auto">
                            {PROGRESS_STEPS.filter((_, i) => {
                                // Only show steps for enabled artifacts
                                if (i === 3 && !include.quiz) return false;
                                if (i === 4 && !include.flashcards) return false;
                                if (i === 5 && !include.slides) return false;
                                if (i === 6 && !include.assignment) return false;
                                if ((i === 7 || i === 8) && !include.whiteboard) return false;
                                return true;
                            }).map((label) => {
                                const idx = PROGRESS_STEPS.indexOf(label);
                                const done = activeStepIndex > idx || (job?.progress ?? 0) === 100;
                                const active = label === stepLabel;
                                return (
                                    <div key={label} className={`flex items-center gap-2 text-sm ${active ? 'text-foreground font-medium' : done ? 'text-emerald-500' : 'text-muted-foreground/50'}`}>
                                        {done ? <CheckCircle2 className="h-4 w-4" />
                                            : active ? <Loader2 className="h-4 w-4 animate-spin" />
                                                : <div className="h-4 w-4 rounded-full border border-border" />}
                                        {label}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex justify-center">
                            <Button variant="ghost" size="sm" onClick={cancelGeneration} className="text-muted-foreground">
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── STEP 4: review & save ── */}
                {step === 'review' && pack && (
                    <div className="space-y-4">
                        {pack.warnings?.length > 0 && (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
                                {pack.warnings.map((w, i) => (
                                    <p key={i} className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
                                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {w}
                                    </p>
                                ))}
                            </div>
                        )}

                        <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium">Lesson title</Label>
                                    <Input value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium">Save to section</Label>
                                    <div className="relative">
                                        <select
                                            value={targetSectionId}
                                            onChange={(e) => setTargetSectionId(e.target.value)}
                                            className="w-full appearance-none rounded-lg border border-border bg-secondary px-3 py-2 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                                        >
                                            <option value="" disabled>Select where to save...</option>
                                            {availableSections.map((s) => (
                                                <option key={s.id} value={s.id}>{s.title}</option>
                                            ))}
                                            <option value="__new__">+ Create a new section</option>
                                        </select>
                                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    </div>
                                    {creatingNewSection && (
                                        <Input
                                            value={newSectionName}
                                            onChange={(e) => setNewSectionName(e.target.value)}
                                            placeholder="New section name, e.g. Introduction"
                                            className="mt-2"
                                            autoFocus
                                        />
                                    )}
                                </div>
                            </div>

                            {pack.quiz?.length ? (
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={createQuizLesson}
                                        onChange={(e) => setCreateQuizLesson(e.target.checked)}
                                        className="w-4 h-4 text-primary bg-secondary border-border rounded focus:ring-primary"
                                    />
                                    Also add a quiz lesson right after this lesson ({pack.quiz.length} questions)
                                </label>
                            ) : null}
                        </div>

                        <Tabs defaultValue="lesson">
                            <TabsList className="flex flex-wrap h-auto">
                                <TabsTrigger value="lesson">Lesson</TabsTrigger>
                                {pack.quiz?.length ? <TabsTrigger value="quiz">Quiz ({pack.quiz.length})</TabsTrigger> : null}
                                {pack.flashcards?.length ? <TabsTrigger value="flashcards">Flashcards ({pack.flashcards.length})</TabsTrigger> : null}
                                {pack.slides?.slides?.length ? <TabsTrigger value="slides">Slides ({pack.slides.slides.length})</TabsTrigger> : null}
                                {pack.assignment ? <TabsTrigger value="assignment">Assignment</TabsTrigger> : null}
                                {pack.sceneGraph ? <TabsTrigger value="whiteboard">Whiteboard</TabsTrigger> : null}
                            </TabsList>

                            <TabsContent value="lesson" className="space-y-4">
                                <AIAssistantPanel
                                    content={lessonMarkdown}
                                    onResult={(markdown) => setLessonMarkdown(markdown)}
                                />
                                <div className="rounded-xl border border-border bg-card p-6">
                                    <div
                                        className="prose prose-sm dark:prose-invert max-w-none"
                                        dangerouslySetInnerHTML={{ __html: marked.parse(lessonMarkdown || '') as string }}
                                    />
                                </div>
                            </TabsContent>

                            {pack.quiz?.length ? (
                                <TabsContent value="quiz" className="space-y-3">
                                    {pack.quiz.map((q, i) => (
                                        <div key={i} className="rounded-lg border border-border bg-card p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <p className="font-medium text-sm">{i + 1}. {q.question}</p>
                                                <span className="shrink-0 text-[10px] uppercase tracking-wide rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
                                                    {q.type.replace('_', ' ')} · {q.difficulty}
                                                </span>
                                            </div>
                                            {q.options?.length ? (
                                                <div className="mt-2 space-y-1">
                                                    {q.options.map((opt, j) => (
                                                        <div key={j} className={`text-xs p-1.5 rounded ${j === q.correctAnswer ? 'bg-emerald-500/10 text-emerald-500 font-medium' : 'text-muted-foreground'}`}>
                                                            {opt}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="mt-2 text-xs text-emerald-500">Answer: {String(q.correctAnswer)}</p>
                                            )}
                                            {q.explanation && <p className="mt-2 text-xs text-muted-foreground italic">{q.explanation}</p>}
                                        </div>
                                    ))}
                                </TabsContent>
                            ) : null}

                            {pack.flashcards?.length ? (
                                <TabsContent value="flashcards">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {pack.flashcards.map((card, i) => (
                                            <FlashcardView key={i} question={card.question} answer={card.answer} category={card.category} />
                                        ))}
                                    </div>
                                </TabsContent>
                            ) : null}

                            {pack.slides?.slides?.length ? (
                                <TabsContent value="slides" className="space-y-3">
                                    {pack.slides.slides.map((slide, i) => (
                                        <div key={i} className="rounded-lg border border-border bg-card overflow-hidden">
                                            <div className="p-5 bg-secondary/30">
                                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Slide {i + 1} · {slide.layout}</p>
                                                <h3 className={`font-display font-bold text-foreground ${slide.layout === 'title' || slide.layout === 'statement' ? 'text-xl' : 'text-lg'}`}>
                                                    {slide.heading || slide.statement || slide.term}
                                                </h3>
                                                {slide.subtitle && <p className="text-sm text-muted-foreground mt-1">{slide.subtitle}</p>}
                                                {slide.definition && <p className="text-sm mt-2">{slide.definition}</p>}
                                                {slide.bullets?.length ? (
                                                    <ul className="mt-2 space-y-1">
                                                        {slide.bullets.map((b, j) => (
                                                            <li key={j} className="text-sm text-foreground/90 flex gap-2"><span className="text-primary">•</span>{b}</li>
                                                        ))}
                                                    </ul>
                                                ) : null}
                                            </div>
                                            {slide.speakerNotes && (
                                                <div className="px-5 py-2.5 border-t border-border">
                                                    <p className="text-xs text-muted-foreground"><span className="font-medium">Notes:</span> {slide.speakerNotes}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </TabsContent>
                            ) : null}

                            {pack.assignment ? (
                                <TabsContent value="assignment">
                                    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
                                        <div>
                                            <h3 className="font-semibold text-foreground">{pack.assignment.title}</h3>
                                            <p className="text-sm text-muted-foreground mt-1">{pack.assignment.objective}</p>
                                        </div>
                                        <div
                                            className="prose prose-sm dark:prose-invert max-w-none"
                                            dangerouslySetInnerHTML={{ __html: marked.parse(pack.assignment.instructions || '') as string }}
                                        />
                                        {pack.assignment.submissionRequirements?.length ? (
                                            <div>
                                                <h4 className="text-sm font-medium mb-1">Submission requirements</h4>
                                                <ul className="space-y-1">
                                                    {pack.assignment.submissionRequirements.map((r, i) => (
                                                        <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-primary">•</span>{r}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ) : null}
                                        {pack.assignment.rubric?.length ? (
                                            <div>
                                                <h4 className="text-sm font-medium mb-2">Rubric</h4>
                                                <div className="space-y-2">
                                                    {pack.assignment.rubric.map((r, i) => (
                                                        <div key={i} className="rounded-md border border-border p-3 text-xs">
                                                            <div className="flex justify-between font-medium text-foreground">
                                                                <span>{r.criterion}</span><span>{r.points} pts</span>
                                                            </div>
                                                            <p className="text-muted-foreground mt-1">Excellent: {r.excellent}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                        <p className="text-xs text-muted-foreground">Estimated time: ~{pack.assignment.estimatedTimeMinutes} min</p>
                                    </div>
                                </TabsContent>
                            ) : null}

                            {pack.sceneGraph ? (
                                <TabsContent value="whiteboard">
                                    <WhiteboardPlayer sceneGraph={pack.sceneGraph} />
                                </TabsContent>
                            ) : null}
                        </Tabs>

                        <div className="flex justify-end gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sticky bottom-4">
                            <Button variant="outline" onClick={() => setStep('pick')} disabled={saving}>
                                Start Over
                            </Button>
                            <Button
                                onClick={saveLesson}
                                disabled={saving || !targetSectionId || (creatingNewSection && !newSectionName.trim())}
                                className="min-w-[160px] gap-2"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save to Course
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

/** Simple click-to-flip flashcard preview. */
const FlashcardView = ({ question, answer, category }: { question: string; answer: string; category: string }) => {
    const [flipped, setFlipped] = useState(false);
    return (
        <button
            onClick={() => setFlipped((f) => !f)}
            className="rounded-lg border border-border bg-card p-4 text-left min-h-[110px] hover:border-primary/50 transition-colors"
        >
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                {category} · {flipped ? 'answer' : 'question'} — tap to flip
            </p>
            <p className={`text-sm ${flipped ? 'text-primary' : 'text-foreground font-medium'}`}>
                {flipped ? answer : question}
            </p>
        </button>
    );
};

export default CreateLesson;
