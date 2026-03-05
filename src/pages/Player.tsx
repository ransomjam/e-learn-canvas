import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play, ChevronLeft, CheckCircle, Menu, X, FileText, Clock,
  Send, Download, ChevronRight, Lock, ThumbsUp, Paperclip, Upload, Calendar, Star,
  Trash2, Reply, CornerDownRight, Loader2,
  ClipboardCheck, Trophy // icon for quiz thumbnails
} from 'lucide-react';
import ParticleLoader from '@/components/ui/ParticleLoader';
import Logo from '@/components/common/Logo';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { coursesService, Section, Lesson } from '@/services/courses.service';
import { enrollmentsService } from '@/services/enrollments.service';
import { resolveMediaUrl, toDirectVideoUrl } from '@/lib/media';
import { resolveFileUrl } from '@/lib/download';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import DocumentViewer from '@/components/ui/DocumentViewer';
import { useIsMobile } from '@/hooks/use-mobile';
import { projectsService, Project } from '@/services/projects.service';
import { practiceSubmissionsService, PracticeSubmission } from '@/services/practiceSubmissions.service';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import CustomVideoPlayer from '@/components/ui/CustomVideoPlayer';
import QuizPlayer from '@/components/ui/QuizPlayer';
const renderMessageWithLinks = (text: string) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium" onClick={(e) => e.stopPropagation()}>
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
};

const Player = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('content');
  const [chatMessage, setChatMessage] = useState('');
  const [projectSubmissionText, setProjectSubmissionText] = useState('');
  const [projectSubmissionFile, setProjectSubmissionFile] = useState<File | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const [showRating, setShowRating] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const [replyTo, setReplyTo] = useState<{ id: string; userName: string; message: string } | null>(null);
  const [contentKey, setContentKey] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  // Custom practice file upload state
  const [customUploadLessonId, setCustomUploadLessonId] = useState<string>('');
  const [customUploadFile, setCustomUploadFile] = useState<File | null>(null);
  const [customUploadNotes, setCustomUploadNotes] = useState<string>('');
  const customUploadFileRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', id],
    queryFn: () => coursesService.getCourseById(id!),
    enabled: !!id,
  });

  const { data: sections = [], isLoading: lessonsLoading } = useQuery({
    queryKey: ['courseLessons', id],
    queryFn: () => coursesService.getCourseLessons(id!),
    enabled: !!id,
  });

  const { data: progress } = useQuery({
    queryKey: ['courseProgress', id],
    queryFn: () => enrollmentsService.getCourseProgress(id!),
    enabled: !!id,
  });

  const { data: resources = [] } = useQuery({
    queryKey: ['courseResources', id],
    queryFn: () => coursesService.getResources(id!),
    enabled: !!id,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['courseChat', id, currentLessonId],
    queryFn: () => coursesService.getChatMessages(id!, currentLessonId!),
    enabled: !!id && !!currentLessonId,
    refetchInterval: 5000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['courseProjects', id],
    queryFn: () => projectsService.getCourseProjects(id!),
    enabled: !!id,
  });

  // Custom practice file submissions by this user for this course
  const { data: myPracticeSubmissions = [] } = useQuery({
    queryKey: ['myPracticeSubmissions', id],
    queryFn: () => practiceSubmissionsService.getMy(id!),
    enabled: !!id,
    refetchInterval: 5000,
  });

  const { data: likesData } = useQuery({
    queryKey: ['lessonLikes', currentLessonId],
    queryFn: () => coursesService.getLessonLikes(currentLessonId!),
    enabled: !!currentLessonId,
  });

  const { data: userReview } = useQuery({
    queryKey: ['userReview', id],
    queryFn: () => coursesService.getUserReview(id!),
    enabled: !!id && !!progress,
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ['courseLeaderboard', id],
    queryFn: () => coursesService.getCourseLeaderboard(id!),
    enabled: !!id,
  });

  // Mutations
  const completeLessonMutation = useMutation({
    mutationFn: (lessonId: string) => enrollmentsService.completeLesson(lessonId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseProgress', id] });
      queryClient.invalidateQueries({ queryKey: ['courseLessons', id] });
      toast({ title: "Lesson completed!", description: "Great progress!" });
    },
    onError: () => {
      toast({ title: "Failed to save progress", variant: "destructive" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: ({ message, replyToId }: { message: string; replyToId?: string }) =>
      coursesService.postChatMessage(id!, message, replyToId, currentLessonId || undefined),
    onSuccess: () => {
      setChatMessage('');
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ['courseChat', id] });
    },
    onError: () => {
      toast({ title: 'Failed to send message', variant: 'destructive' });
    }
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (messageId: string) => coursesService.deleteChatMessage(id!, messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseChat', id] });
      toast({ title: 'Message deleted' });
    },
    onError: () => {
      toast({ title: 'Failed to delete message', variant: 'destructive' });
    }
  });

  const toggleLikeMutation = useMutation({
    mutationFn: (lessonId: string) => coursesService.toggleLessonLike(lessonId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessonLikes', currentLessonId] });
    },
    onError: () => {
      toast({ title: 'Failed to like lesson', variant: 'destructive' });
    }
  });

  const submitProjectMutation = useMutation({
    mutationFn: ({ projectId, text, file }: { projectId: string; text?: string; file?: File }) =>
      projectsService.submitProject(projectId, { submissionText: text }, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseProjects', id] });
      toast({ title: 'Project submitted successfully!' });
      setProjectSubmissionText('');
      setProjectSubmissionFile(null);
      setExpandedProjectId(null);
      if (projectFileInputRef.current) projectFileInputRef.current.value = '';
    },
    onError: () => {
      toast({ title: 'Failed to submit project', variant: 'destructive' });
    },
  });

  const submitCustomUploadMutation = useMutation({
    mutationFn: ({ lessonId, notes, file }: { lessonId: string; notes?: string; file?: File }) =>
      practiceSubmissionsService.submit({ lessonId, courseId: id!, notes }, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myPracticeSubmissions', id] });
      toast({ title: 'Practice file uploaded successfully!' });
      setCustomUploadLessonId('');
      setCustomUploadFile(null);
      setCustomUploadNotes('');
      if (customUploadFileRef.current) customUploadFileRef.current.value = '';
    },
    onError: () => {
      toast({ title: 'Failed to upload practice file', variant: 'destructive' });
    },
  });

  const ratingMutation = useMutation({
    mutationFn: (rating: number) => {
      if (userReview) {
        return coursesService.updateReview(id!, { rating });
      }
      return coursesService.addReview(id!, { rating });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userReview', id] });
      queryClient.invalidateQueries({ queryKey: ['course', id] });
      setShowRating(false);
      toast({ title: 'Rating submitted!', description: 'Thank you for your feedback.' });
    },
    onError: () => {
      toast({ title: 'Failed to submit rating', variant: 'destructive' });
    }
  });

  // Auto-select first incomplete lesson
  useEffect(() => {
    if (sections.length > 0 && !currentLessonId) {
      let firstLesson: Lesson | null = null;
      for (const section of sections) {
        for (const lesson of section.lessons) {
          if (!firstLesson) firstLesson = lesson;
          if (!lesson.isCompleted) {
            setCurrentLessonId(lesson.id);
            return;
          }
        }
      }
      if (firstLesson) setCurrentLessonId(firstLesson.id);
    }
  }, [sections, currentLessonId]);

  // Force content area re-render when lesson changes
  useEffect(() => {
    if (currentLessonId) {
      setContentKey(prev => prev + 1);
    }
  }, [currentLessonId]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const currentLesson = sections.flatMap(s => s.lessons).find(l => l.id === currentLessonId);

  const allResources = useMemo(() => {
    const items: any[] = [];

    // 1. Course-level resources (from the resources table)
    if (resources && resources.length > 0) {
      items.push(...resources.map((r: any) => ({
        ...r,
        url: resolveMediaUrl(r.url),
      })));
    }

    // 2. Lesson-level resources from all lessons (resources + practiceFiles JSON fields)
    for (const section of sections) {
      for (const lesson of (section.lessons || [])) {
        // lesson.resources (what AddLesson saves)
        if (lesson.resources) {
          try {
            const parsed = typeof lesson.resources === 'string'
              ? JSON.parse(lesson.resources)
              : lesson.resources;
            if (Array.isArray(parsed)) {
              items.push(...parsed.map((p: any) => ({
                ...p,
                title: p.title || p.name || 'Resource',
                url: resolveMediaUrl(p.url),
                lessonTitle: lesson.title,
                id: `${lesson.id}-res-${p.url}`
              })));
            }
          } catch { }
        }

        // lesson.practiceFiles (legacy field)
        if (lesson.practiceFiles) {
          try {
            const parsed = typeof lesson.practiceFiles === 'string'
              ? JSON.parse(lesson.practiceFiles)
              : lesson.practiceFiles;
            if (Array.isArray(parsed)) {
              items.push(...parsed.map((p: any) => ({
                ...p,
                title: p.title || p.name || 'Practice File',
                url: resolveMediaUrl(p.url),
                lessonTitle: lesson.title,
                id: `${lesson.id}-pf-${p.url}`
              })));
            }
          } catch { }
        }
      }
    }

    // Deduplicate by url
    const seen = new Set<string>();
    return items.filter(item => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
  }, [sections, resources]);

  const allLessons = sections.flatMap(s => s.lessons);
  let isSubsequentLocked = false;
  const processedLessonsLookup = new Map<string, boolean>();

  const completedLessonsList = Array.isArray(progress?.completedLessonIds) ? progress.completedLessonIds : [];
  const approvedSubmissionSet = new Set(
    myPracticeSubmissions
      .filter((s: any) => (s.status || 'pending') === 'approved')
      .map((s: any) => s.lessonId || s.lesson_id)
  );
  const pendingSubmissionSet = new Set(
    myPracticeSubmissions
      .filter((s: any) => (s.status || 'pending') === 'pending')
      .map((s: any) => s.lessonId || s.lesson_id)
  );

  allLessons.forEach(l => {
    processedLessonsLookup.set(l.id, isSubsequentLocked);
    const isCompleted = completedLessonsList.includes(l.id);
    const hasApprovedSubmission = approvedSubmissionSet.has(l.id);

    if (l.type === 'quiz' && l.isMandatory && !isCompleted) {
      isSubsequentLocked = true;
    }
    if (l.hasSubmission && l.submissionIsMandatory && !hasApprovedSubmission) {
      isSubsequentLocked = true;
    }
  });

  const getLockFeedback = (targetLessonId: string): { title: string; description: string; variant: 'destructive' | 'warning' } => {
    const targetIndex = allLessons.findIndex((lesson) => lesson.id === targetLessonId);
    if (targetIndex <= 0) {
      return {
        title: 'Lesson Locked',
        description: 'Please complete required quizzes or submissions from earlier lessons to continue.',
        variant: 'destructive',
      };
    }

    for (let i = 0; i < targetIndex; i += 1) {
      const lesson = allLessons[i];
      const isCompleted = completedLessonsList.includes(lesson.id);
      const hasApprovedSubmission = approvedSubmissionSet.has(lesson.id);

      if (lesson.type === 'quiz' && lesson.isMandatory && !isCompleted) {
        return {
          title: 'Quiz Required',
          description: 'Complete and submit the required quiz in an earlier lesson to unlock this content.',
          variant: 'default',
        };
      }

      if (lesson.hasSubmission && lesson.submissionIsMandatory && !hasApprovedSubmission) {
        if (pendingSubmissionSet.has(lesson.id)) {
          return {
            title: 'Pending Approval',
            description: 'Pending approval, notify the instructor to review your submission and approve it.',
            variant: 'warning',
          };
        }
        return {
          title: 'Submission Required',
          description: 'Submit the required assignment in an earlier lesson. Instructor approval is needed before the next lesson unlocks.',
          variant: 'destructive',
        };
      }
    }

    return {
      title: 'Lesson Locked',
      description: 'Please complete required quizzes or submissions from earlier lessons to continue.',
      variant: 'destructive',
    };
  };

  const isPrivileged = user?.role === 'instructor' || user?.role === 'admin';

  const currentIndex = allLessons.findIndex(l => l.id === currentLessonId);
  const totalLessons = allLessons.length;
  const completedLessons = typeof progress?.completedLessons === 'number' ? progress.completedLessons : 0;
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const isVideoLesson = currentLesson?.type === 'video';

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatMessage.trim()) {
      sendMessageMutation.mutate({ message: chatMessage, replyToId: replyTo?.id });
    }
  };

  const goToLesson = (direction: 'prev' | 'next') => {
    const idx = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (idx >= 0 && idx < allLessons.length) {
      const nextId = allLessons[idx].id;
      if (!processedLessonsLookup.get(nextId) || isPrivileged) {
        setCurrentLessonId(nextId);
        if (processedLessonsLookup.get(nextId) && isPrivileged) {
          toast({ title: 'Bypassing Lock', description: 'This lesson is locked for students, but accessible to you as an instructor.', variant: 'default' });
        }
      } else {
        const lockFeedback = getLockFeedback(nextId);
        toast(lockFeedback);
      }
    }
  };

  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    } else {
      setIsSidebarOpen(true);
    }
  }, [isMobile]);

  if (courseLoading || lessonsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <ParticleLoader size={40} />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">Course not found</p>
        <Link to="/courses"><Button>Browse Courses</Button></Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-card px-4 flex-shrink-0 w-full">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0 hover:opacity-80 transition-opacity">
            <Logo size="sm" className="h-8 w-8" />
            <span className="font-display font-bold text-primary text-base hidden sm:inline">Cradema</span>
          </Link>
          <span className="text-muted-foreground/40 hidden sm:inline">|</span>
          <Link to={`/course/${id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <p className="text-sm font-medium text-foreground truncate hidden sm:block">{course.title}</p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:block">
            {completedLessons}/{totalLessons} lessons
          </span>
          <Progress value={progressPercent} className="h-1.5 w-20 hidden sm:block" />
          <span className="text-xs font-medium text-primary hidden sm:block">{progressPercent}%</span>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-10 w-10 hover:bg-transparent hover:text-foreground transition-all active:scale-95"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? (
              <X className="h-7 w-7" />
            ) : (
              <Menu className="h-7 w-7" />
            )}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-auto">
          {/* Content Area (Video/Document/Quiz) */}
          <div
            className={cn(
              "relative w-full bg-black flex-shrink-0",
              isVideoLesson ? "aspect-video" : ""
            )}
            style={!isVideoLesson && !isMobile ? {
              height: 'clamp(340px, 62vh, 820px)',
            } : !isVideoLesson && isMobile ? {
              /* On mobile, let document content determine height */
            } : undefined}
          >
            <div key={contentKey} className={isVideoLesson ? "absolute inset-0" : "h-full w-full overflow-auto bg-background"}>
              {currentLesson ? (
                currentLesson.type === 'video' ? (
                  currentLesson.videoUrl ? (() => {
                    const resolvedVideoUrl = toDirectVideoUrl(resolveMediaUrl(currentLesson.videoUrl));
                    return (
                      <CustomVideoPlayer
                        key={`${currentLessonId}-${resolvedVideoUrl}`}
                        src={resolvedVideoUrl}
                        title={currentLesson.title}
                      />
                    );
                  })() : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <div className="text-center">
                        <Play className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                        <p className="mt-2 text-sm text-muted-foreground">No video for this lesson</p>
                      </div>
                    </div>
                  )
                ) : currentLesson.type === 'document' || currentLesson.type === 'pdf' || currentLesson.type === 'ppt' || currentLesson.type === 'doc' ? (
                  <div className="h-full w-full">
                    {currentLesson.videoUrl ? (
                      <DocumentViewer
                        key={`doc-${currentLessonId}`}
                        url={resolveMediaUrl(currentLesson.videoUrl)}
                        type={
                          currentLesson.type === 'pdf' ? 'pdf' :
                            currentLesson.type === 'ppt' ? 'ppt' :
                              currentLesson.type === 'doc' ? 'doc' :
                                currentLesson.videoUrl.match(/\.pdf$/i) ? 'pdf' :
                                  currentLesson.videoUrl.match(/\.pptx?$/i) ? 'ppt' :
                                    currentLesson.videoUrl.match(/\.docx?$/i) ? 'doc' :
                                      'doc'
                        }
                        title={currentLesson.title}
                        className="h-full"
                      />
                    ) : currentLesson.content ? (
                      <div className="h-full w-full p-8 overflow-auto bg-card rounded-lg shadow-sm">
                        <div className="max-w-3xl mx-auto prose dark:prose-invert">
                          <h1 className="mb-4 text-2xl font-bold">{currentLesson.title}</h1>
                          <div dangerouslySetInnerHTML={{ __html: currentLesson.content }} />
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-muted-foreground gap-4 min-h-[200px]">
                        <Lock className="h-12 w-12 text-muted-foreground/30" />
                        <p className="text-lg font-medium text-muted-foreground/70">
                          {progress ? "No content uploaded" : "This content is locked"}
                        </p>
                        {!progress && !currentLesson.isFree && (
                          <p className="text-sm text-muted-foreground/50">
                            Please enroll in the course to access this lesson.
                          </p>
                        )}
                        {progress && (
                          <p className="text-sm text-muted-foreground/50">
                            This lesson has no digital content available.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : currentLesson.type === 'quiz' ? (
                  <div className="h-full w-full overflow-auto bg-card">
                    <QuizPlayer
                      lessonId={currentLesson.id}
                      quizData={typeof currentLesson.quizData === 'string' ? JSON.parse(currentLesson.quizData) : currentLesson.quizData}
                      onComplete={() => {
                        completeLessonMutation.mutate(currentLesson.id, {
                          onSuccess: () => {
                            const nextLesson = allLessons[currentIndex + 1];
                            if (!nextLesson) {
                              return;
                            }

                            const hasBlockingRequirementBeforeNext = allLessons
                              .slice(0, currentIndex + 1)
                              .some((lesson) => {
                                if (lesson.id === currentLesson.id) {
                                  return false;
                                }
                                const isCompleted = completedLessonsList.includes(lesson.id);
                                const hasApprovedSubmission = approvedSubmissionSet.has(lesson.id);
                                const blocksByQuiz = lesson.type === 'quiz' && lesson.isMandatory && !isCompleted;
                                const blocksBySubmission = lesson.hasSubmission && lesson.submissionIsMandatory && !hasApprovedSubmission;
                                return blocksByQuiz || blocksBySubmission;
                              });

                            if (!hasBlockingRequirementBeforeNext || isPrivileged) {
                              setCurrentLessonId(nextLesson.id);
                              toast({
                                title: 'Next Lesson Unlocked',
                                description: 'Great work! You can continue to the next lesson now.',
                                variant: 'success',
                              });
                            }
                          },
                        });
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-full w-full p-8 overflow-auto">
                    <div className="max-w-3xl mx-auto prose dark:prose-invert">
                      <h1>{currentLesson.title}</h1>
                      <div dangerouslySetInnerHTML={{ __html: currentLesson.content || '' }} />
                    </div>
                  </div>
                )
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground min-h-[200px]">
                  Select a lesson to start
                </div>
              )}
            </div>
          </div>

          {/* Lesson info + controls + chats */}
          <div className="flex-shrink-0">
            <div className="max-w-5xl mx-auto p-5 space-y-4">
              {/* Lesson title and metadata */}
              {/* Lesson title and metadata */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-1">
                <div className="flex-1">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-3 drop-shadow-sm tracking-tight leading-tight">
                    {currentLesson?.title || 'Select a lesson'}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 text-xs sm:text-sm text-foreground/80 font-medium">
                    <span className="bg-secondary/80 px-2.5 py-1 rounded-full border border-border/40 shadow-sm">{((course?.enrollmentCount || 0) * 4) + (likesData?.likesCount || 0) * 2 + 156} plays</span>
                    <span className="bg-secondary/80 px-2.5 py-1 rounded-full border border-border/40 shadow-sm">{course?.enrollmentCount || 0} student{(course?.enrollmentCount === 1) ? '' : 's'}</span>
                    {currentLesson?.duration && (
                      <span className="flex items-center gap-1.5 bg-secondary/80 px-2.5 py-1 rounded-full border border-border/40 shadow-sm">
                        <Clock className="h-3.5 w-3.5" />
                        {currentLesson.duration} mins
                      </span>
                    )}
                    {currentLesson?.hasSubmission && (
                      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border shadow-sm ${currentLesson.submissionIsMandatory ? 'bg-primary/10 text-primary border-primary/20 font-bold' : 'bg-muted/50 text-muted-foreground border-border/50'}`}>
                        <Upload className="h-3.5 w-3.5" />
                        {currentLesson.submissionIsMandatory ? 'Submission Required' : 'Optional Project'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Rating Button Moved Here */}
                <div className="relative flex-shrink-0 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRating(!showRating)}
                    disabled={!progress}
                    className="gap-2 h-9 px-4 text-sm font-semibold rounded-full border-border/60 hover:border-yellow-500/40 hover:bg-yellow-500/5 transition-all duration-300 shadow-sm hover:shadow-md group"
                  >
                    <Star className={`h-4 w-4 transition-transform group-hover:scale-110 ${userReview?.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                    <span>Rate: {userReview?.rating || course?.ratingAvg?.toFixed(1) || '0.0'}</span>
                  </Button>

                  {/* Rating dropdown */}
                  {showRating && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowRating(false)}
                      />
                      <div className="absolute right-0 top-full mt-2 z-50 bg-card border border-border/50 rounded-2xl shadow-2xl p-4 min-w-[220px] animate-in fade-in slide-in-from-top-2 duration-300 backdrop-blur-xl">
                        <p className="text-sm font-bold text-foreground mb-3 text-center">Rate Course</p>
                        <div className="flex justify-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              className="p-1.5 hover:scale-125 hover:-translate-y-1 transition-all duration-200"
                              onMouseEnter={() => setHoverRating(star)}
                              onMouseLeave={() => setHoverRating(0)}
                              onClick={() => ratingMutation.mutate(star)}
                              disabled={ratingMutation.isPending}
                            >
                              <Star
                                className={`h-6 w-6 transition-colors ${star <= (hoverRating || userReview?.rating || 0)
                                  ? 'fill-yellow-400 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]'
                                  : 'text-muted-foreground/30'
                                  }`}
                              />
                            </button>
                          ))}
                        </div>
                        {ratingMutation.isPending && (
                          <div className="flex justify-center mt-3">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Action buttons row - YouTube style */}
              {/* Action buttons row - YouTube style */}
              <div className="flex items-center justify-between gap-1.5 sm:gap-3 py-3 sm:py-4 border-y border-border/40">
                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Like button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => currentLessonId && toggleLikeMutation.mutate(currentLessonId)}
                    disabled={!currentLessonId || toggleLikeMutation.isPending}
                    className="gap-2 h-9 px-4 text-sm font-semibold rounded-full border-border/60 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 shadow-sm group"
                  >
                    <ThumbsUp className={`h-4 w-4 transition-transform group-hover:-translate-y-0.5 ${likesData?.liked ? 'fill-primary text-primary' : ''}`} />
                    <span>{likesData?.likesCount || 0}</span>
                  </Button>

                  {/* Complete button */}
                  {currentLesson && !currentLesson.isCompleted && (
                    <Button
                      size="sm"
                      onClick={() => currentLessonId && completeLessonMutation.mutate(currentLessonId)}
                      disabled={completeLessonMutation.isPending}
                      className="gap-2 h-9 px-4 text-sm font-semibold rounded-full shadow-[0_0_12px_hsla(var(--primary)/0.2)] hover:shadow-[0_0_20px_hsla(var(--primary)/0.4)] hover:-translate-y-0.5 transition-all duration-300 bg-primary/95 hover:bg-primary text-primary-foreground group"
                    >
                      {completeLessonMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 transition-transform group-hover:scale-110" />
                      )}
                      <span className="hidden sm:inline tracking-tight">Mark as Complete</span>
                      <span className="sm:hidden tracking-tight">Complete</span>
                    </Button>
                  )}
                  {currentLesson?.isCompleted && (
                    <span className="flex items-center gap-2 text-sm text-emerald-500 font-bold px-4 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20 shadow-sm">
                      <CheckCircle className="h-4 w-4" /> <span className="hidden sm:inline">Completed</span><span className="sm:hidden">Done</span>
                    </span>
                  )}
                </div>

                {/* Navigation buttons */}
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToLesson('prev')}
                    disabled={currentIndex <= 0}
                    className="h-9 px-3 sm:px-4 rounded-full border-border/60 hover:border-foreground/30 hover:bg-secondary/50 transition-all duration-300 hover:-translate-x-0.5 group"
                  >
                    <ChevronLeft className="h-4 w-4 sm:mr-1 transition-transform group-hover:-translate-x-0.5" />
                    <span className="hidden sm:inline font-medium tracking-tight">Previous</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToLesson('next')}
                    disabled={currentIndex >= allLessons.length - 1}
                    className="h-9 px-3 sm:px-4 rounded-full border-border/60 hover:border-foreground/30 hover:bg-secondary/50 transition-all duration-300 hover:translate-x-0.5 group"
                  >
                    <span className="hidden sm:inline font-medium tracking-tight">Next</span>
                    <ChevronRight className="h-4 w-4 sm:ml-1 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </div>
              </div>

              {/* Lesson description */}
              {currentLesson?.content && (
                <div className="prose dark:prose-invert max-w-none">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {currentLesson.content}
                  </p>
                </div>
              )}

              {/* ─── Custom Project Submission for this Lesson ─── */}
              {currentLesson?.hasSubmission && (
                <div className="mt-6 pt-4 border-t border-border/40">
                  <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shadow-sm border border-primary/20">
                        <Upload className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-foreground leading-tight">Custom Project Submission</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">Please submit the required file or notes for this lesson</p>
                      </div>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!currentLessonId) return;
                        if (!customUploadFile && !customUploadNotes.trim()) {
                          toast({ title: 'Please upload a file or add notes', variant: 'destructive' });
                          return;
                        }
                        submitCustomUploadMutation.mutate({
                          lessonId: currentLessonId,
                          notes: customUploadNotes || undefined,
                          file: customUploadFile || undefined,
                        });
                      }}
                      className="space-y-4"
                    >
                      {/* File picker */}
                      <div>
                        <label className="text-sm font-semibold mb-1.5 block text-foreground">Upload File</label>
                        <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:bg-muted/30 transition-colors bg-background">
                          <input
                            ref={customUploadFileRef}
                            type="file"
                            onChange={(e) => setCustomUploadFile(e.target.files?.[0] || null)}
                            className="hidden"
                            id="custom-exercise-file"
                          />
                          <label htmlFor="custom-exercise-file" className="cursor-pointer block">
                            {customUploadFile ? (
                              <div className="flex flex-col items-center justify-center gap-2 text-sm text-primary">
                                <Paperclip className="h-6 w-6" />
                                <span className="font-medium">{customUploadFile.name}</span>
                                <span className="text-muted-foreground text-xs">
                                  ({(customUploadFile.size / 1024 / 1024).toFixed(2)} MB)
                                </span>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <Upload className="h-8 w-8 mx-auto text-muted-foreground/60" />
                                <p className="text-sm text-muted-foreground font-medium">Click to select a file</p>
                              </div>
                            )}
                          </label>
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="text-sm font-semibold mb-1.5 block text-foreground">Submission Notes <span className="font-normal text-muted-foreground">(Optional)</span></label>
                        <Textarea
                          value={customUploadNotes}
                          onChange={(e) => setCustomUploadNotes(e.target.value)}
                          placeholder="Describe what you built or add any relevant links..."
                          rows={3}
                          className="bg-background"
                        />
                      </div>

                      <Button
                        type="submit"
                        className="w-full h-10 font-semibold shadow-sm"
                        disabled={submitCustomUploadMutation.isPending}
                      >
                        {submitCustomUploadMutation.isPending ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>
                        ) : (
                          <><Send className="mr-2 h-4 w-4" />Submit Project</>
                        )}
                      </Button>
                    </form>

                    {/* My previous submissions for this lesson */}
                    {myPracticeSubmissions.filter((s: any) => s.lessonId === currentLessonId || s.lesson_id === currentLessonId).length > 0 && (
                      <div className="pt-4 mt-2 border-t border-border/50">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Your Submissions</p>
                        <div className="space-y-2">
                          {myPracticeSubmissions.filter((s: any) => s.lessonId === currentLessonId || s.lesson_id === currentLessonId).map((sub: PracticeSubmission) => (
                            <div
                              key={sub.id}
                              className="rounded-lg bg-background border border-border/60 px-4 py-3 shadow-sm flex items-center justify-between"
                            >
                              <div className="flex-1 min-w-0">
                                {(sub.file_name || sub.fileName) && (
                                  <div className="flex items-center gap-2 text-sm text-primary font-medium">
                                    <Paperclip className="h-4 w-4 flex-shrink-0" />
                                    <span className="truncate">{sub.file_name || sub.fileName}</span>
                                  </div>
                                )}
                                {sub.notes && (
                                  <p className="text-xs text-muted-foreground mt-1 truncate">{sub.notes}</p>
                                )}
                              </div>
                              <p className="text-xs flex-shrink-0 ml-3 font-medium">
                                {(sub.status || 'pending') === 'approved' ? (
                                  <><CheckCircle className="h-4 w-4 text-emerald-500 inline mr-1" /> <span className="text-emerald-600">Approved</span></>
                                ) : (sub.status || 'pending') === 'rejected' ? (
                                  <><Trash2 className="h-4 w-4 text-rose-500 inline mr-1" /> <span className="text-rose-500">Rejected</span></>
                                ) : (
                                  <><Clock className="h-4 w-4 text-yellow-500 inline mr-1" /> <span className="text-yellow-600">Pending approval</span></>
                                )}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Chats section - YouTube style comments */}
              <div className="pt-4">
                <h3 className="text-lg font-semibold mb-4">
                  {messages.length} {messages.length === 1 ? 'Chat' : 'Chats'}
                </h3>

                {/* Chat messages */}
                <div className="space-y-4 mb-6">
                  {messages.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No chats yet. Be the first to start a conversation!
                    </p>
                  )}
                  {messages.map((msg: any) => {
                    const isMe = msg.user.id === user?.id;
                    const isInstructor = user?.role === 'instructor' || user?.role === 'admin';
                    const canDelete = isMe || isInstructor;
                    return (
                      <div key={msg.id} className="group flex gap-3">
                        <div className="flex-shrink-0">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={resolveMediaUrl(msg.user.avatarUrl)} alt={msg.user.firstName} />
                            <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                              {msg.user.firstName[0]}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="font-semibold text-base text-foreground">
                              {msg.user.firstName} {msg.user.lastName}
                            </span>
                            <span className="text-xs text-muted-foreground/80">
                              {new Date(msg.createdAt).toLocaleDateString()} at {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {/* Reply context */}
                          {msg.replyTo && (
                            <div className="flex items-center gap-1.5 mb-1 px-2 py-1 bg-muted/40 rounded text-xs border-l-2 border-muted-foreground/30">
                              <CornerDownRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium text-muted-foreground">
                                {msg.replyTo.user?.firstName} {msg.replyTo.user?.lastName}
                              </span>
                              <span className="text-muted-foreground truncate">
                                {msg.replyTo.message?.substring(0, 80)}{msg.replyTo.message?.length > 80 ? '...' : ''}
                              </span>
                            </div>
                          )}
                          <p className="text-sm text-foreground/80 break-words whitespace-pre-wrap leading-relaxed">
                            {renderMessageWithLinks(msg.message)}
                          </p>
                          {/* Action buttons */}
                          <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
                              onClick={() => {
                                setReplyTo({
                                  id: msg.id,
                                  userName: `${msg.user.firstName} ${msg.user.lastName}`,
                                  message: msg.message
                                });
                                // Scroll down to chat input
                                setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                              }}
                            >
                              <Reply className="h-3.5 w-3.5 mr-1" />
                              Reply
                            </Button>
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                                onClick={() => deleteMessageMutation.mutate(msg.id)}
                                disabled={deleteMessageMutation.isPending}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                Delete
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat input */}
                <form onSubmit={handleSendMessage} className="mt-2 sticky bottom-0 bg-background/95 backdrop-blur-sm pt-4 border-t border-border/40 pb-2">
                  {/* Reply banner */}
                  {replyTo && (
                    <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-muted/50 rounded-md border-l-2 border-primary text-sm">
                      <CornerDownRight className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground">Replying to</span>
                      <span className="font-medium truncate">{replyTo.userName}</span>
                      <span className="text-muted-foreground truncate flex-1">— {replyTo.message}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 flex-shrink-0"
                        onClick={() => setReplyTo(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={resolveMediaUrl(user?.avatarUrl)} alt={user?.firstName} />
                        <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                          {user?.firstName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1">
                      <Input
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        placeholder={replyTo ? `Reply to ${replyTo.userName}...` : "Add a chat message..."}
                        className="mb-2"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => { setChatMessage(''); setReplyTo(null); }}
                          disabled={!chatMessage.trim() && !replyTo}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={!chatMessage.trim() || sendMessageMutation.isPending}
                        >
                          {sendMessageMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            replyTo ? 'Reply' : 'Chat'
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        {isSidebarOpen && isMobile && (
          <button
            type="button"
            aria-label="Close course content panel"
            className="fixed left-0 right-0 top-14 bottom-0 z-10 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        <div
          className={`flex flex-col min-h-0 border-l border-border/60 bg-gradient-to-b from-card to-card/95 shadow-2xl overflow-hidden
            ${isMobile ? (
              isSidebarOpen
                ? 'fixed left-0 right-0 top-14 bottom-0 z-20 w-full'
                : 'hidden'
            ) : (
              'lg:shadow-none static w-96'
            )}`}
        >
          <div className="flex items-center justify-between border-b border-border/40 bg-card/50 px-5 py-4">
            <h2 className="font-bold text-foreground tracking-tight">Course Content</h2>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col min-h-0 flex-1 overflow-hidden">
            <div className="border-b border-border/40 bg-muted/20 px-3 py-2.5">
              <TabsList className="grid w-full grid-cols-5 h-auto gap-1 bg-background/60 backdrop-blur-md p-1 rounded-xl border border-border/50 shadow-inner">
                <TabsTrigger value="content" className="rounded-lg text-[10px] sm:text-[11px] font-medium px-1 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-300">Lessons</TabsTrigger>
                <TabsTrigger value="resources" className="rounded-lg text-[10px] sm:text-[11px] font-medium px-1 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-300">Resources</TabsTrigger>
                <TabsTrigger value="projects" className="rounded-lg text-[10px] sm:text-[11px] font-medium px-1 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-300">Projects</TabsTrigger>
                <TabsTrigger value="assessment" className="rounded-lg text-[10px] sm:text-[11px] font-medium px-1 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-300">Quiz</TabsTrigger>
                <TabsTrigger value="leaderboard" className="rounded-lg text-[10px] sm:text-[11px] font-medium px-1 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-300">Top 10</TabsTrigger>
              </TabsList>
            </div>

            {/* Lessons tab */}
            <TabsContent
              value="content"
              className="mt-0 min-h-0 flex-1 overflow-hidden p-0"
              style={{ display: activeTab === 'content' ? 'flex' : 'none', flexDirection: 'column' }}
            >
              <ScrollArea className="h-full w-full">
                {(!sections || sections.length === 0) ? (
                  <div className="flex h-96 items-center justify-center p-4 text-center text-sm text-muted-foreground animate-sweep-up">
                    <p>No lessons available</p>
                  </div>
                ) : (
                  <div className="p-3 space-y-3 animate-sweep-up" style={{ animationFillMode: 'both' }}>
                    {sections.map((section, si) => (
                      <div key={section.id} className="space-y-1.5">
                        <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-foreground/60">
                          {section.title}
                        </p>
                        <div className="space-y-1">
                          {section.lessons && section.lessons.map((lesson) => {
                            const isActive = currentLessonId === lesson.id;
                            const isLocked = processedLessonsLookup.get(lesson.id);
                            return (
                              <button
                                key={lesson.id}
                                onClick={() => {
                                  if (isLocked) {
                                    if (!isPrivileged) {
                                      const lockFeedback = getLockFeedback(lesson.id);
                                      toast(lockFeedback);
                                      return;
                                    } else {
                                      toast({ title: 'Bypassing Lock', description: 'This lesson is locked for students, but accessible to you as an instructor.', variant: 'default' });
                                    }
                                  }
                                  setCurrentLessonId(lesson.id);
                                  if (isMobile) {
                                    setIsSidebarOpen(false);
                                  }
                                }}
                                className={`group w-full flex items-start gap-3.5 rounded-xl px-3 py-3 text-left transition-all duration-400 text-xs sm:text-sm border relative overflow-hidden backdrop-blur-md
                                  ${isActive
                                    ? 'bg-gradient-to-r from-primary/10 to-primary/5 border-primary/50 shadow-[0_8px_16px_-6px_rgba(var(--primary),0.4),inset_0_2px_0_rgba(255,255,255,0.2),inset_0_-3px_0_rgba(0,0,0,0.3)] translate-x-1'
                                    : 'bg-gradient-to-br from-card/90 to-card/50 border-border/50 shadow-[0_6px_15px_-5px_rgba(0,0,0,0.5),inset_0_2px_0_rgba(255,255,255,0.1),inset_0_-3px_0_rgba(0,0,0,0.4)] hover:shadow-[0_12px_25px_-8px_rgba(0,0,0,0.6),inset_0_2px_0_rgba(255,255,255,0.15),inset_0_-4px_0_rgba(0,0,0,0.5)] hover:border-primary/40 hover:-translate-y-1 hover:scale-[1.01]'
                                  }`}
                              >
                                {/* Subtle inner glow for active state glow */}
                                {isActive && <div className="absolute inset-0 rounded-xl shadow-[inset_0_0_15px_rgba(var(--primary),0.2)] pointer-events-none" />}

                                <div className={`flex-shrink-0 w-24 h-14 rounded-lg overflow-hidden relative flex items-center justify-center border transition-all duration-400 z-10 
                                  ${isActive
                                    ? 'border-primary/60 shadow-[0_6px_12px_rgba(59,130,246,0.4),inset_0_2px_0_rgba(255,255,255,0.3),inset_0_-2px_0_rgba(0,0,0,0.3)] bg-primary/20'
                                    : 'border-border/60 shadow-[0_4px_10px_rgba(0,0,0,0.4),inset_0_2px_0_rgba(255,255,255,0.2),inset_0_-2px_0_rgba(0,0,0,0.3)] group-hover:border-primary/40 group-hover:shadow-[0_8px_16px_rgba(0,0,0,0.5),inset_0_2px_0_rgba(255,255,255,0.25),inset_0_-2px_0_rgba(0,0,0,0.4)] bg-muted/80'} 
                                  ` + (lesson.type === 'quiz' ? (lesson.isCompleted ? 'bg-gradient-to-br from-yellow-500/20 to-amber-600/30 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'bg-gradient-to-br from-blue-500/20 to-indigo-600/20') : '')}>

                                  {/* Glossy image overlay */}
                                  <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/60 pointer-events-none z-10" />

                                  {lesson.type !== 'quiz' && (
                                    <img
                                      src={
                                        lesson.type === 'video' && lesson.videoUrl && lesson.videoUrl.includes('res.cloudinary.com')
                                          ? resolveMediaUrl(lesson.videoUrl).replace(/\.[^/.]+$/, ".jpg")
                                          : resolveMediaUrl(course.thumbnailUrl)
                                      }
                                      alt=""
                                      className={`absolute inset-0 w-full h-full object-cover transition-opacity ${isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                  )}

                                  {lesson.type === 'quiz' && (
                                    <div className="relative transform hover:scale-110 transition-all duration-500 z-20 flex flex-col items-center justify-center w-full h-full">
                                      <div className={`absolute inset-0 ${lesson.isCompleted ? 'bg-yellow-500/40 animate-pulse' : 'bg-blue-500/30'} blur-xl rounded-full`} />
                                      <span className="relative text-3xl drop-shadow-[0_5px_15px_rgba(0,0,0,0.6)] group-hover:rotate-12 transition-transform duration-300" role="img" aria-label="3D Trophy">
                                        {lesson.isCompleted ? '🏆' : '🏆'}
                                      </span>
                                    </div>
                                  )}

                                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                    {lesson.type === 'quiz' ? (
                                      isLocked && <div className="bg-background/90 backdrop-blur-md rounded-full p-1.5 shadow-sm border border-border/50"><Lock className="h-3 w-3 text-foreground" /></div>
                                    ) : lesson.isCompleted ? (
                                      <div className="bg-background/90 rounded-full p-0.5 shadow-[0_0_10px_rgba(16,185,129,0.3)] border border-emerald-500/20">
                                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                                      </div>
                                    ) : lesson.type === 'video' ? (
                                      <div className="bg-background/80 backdrop-blur-sm rounded-full p-1.5 shadow-sm">
                                        <Play className="h-3 w-3 text-foreground ml-0.5" />
                                      </div>
                                    ) : (
                                      <div className="bg-background/80 backdrop-blur-sm rounded-full p-1.5 shadow-sm">
                                        {isLocked ? <Lock className="h-3 w-3 text-foreground" /> : <FileText className="h-3 w-3 text-foreground" />}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0 mt-0.5">
                                  <p className="break-words line-clamp-2 leading-snug">{lesson.title}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {lesson.duration && (
                                      <span className="text-[9px] text-muted-foreground/70 block">
                                        {lesson.duration}m
                                      </span>
                                    )}
                                    {lesson.hasSubmission && (
                                      <span className={`text-[9px] flex items-center gap-1 px-1.5 py-0.5 rounded-sm font-semibold border ${lesson.submissionIsMandatory ? 'text-primary bg-primary/10 border-primary/20' : 'text-muted-foreground bg-muted/50 border-border/50'}`}>
                                        <Upload className="h-2.5 w-2.5" />
                                        {lesson.submissionIsMandatory ? 'Required' : 'Optional Project'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Files tab */}
            <TabsContent
              value="resources"
              className="mt-0 min-h-0 flex-1 overflow-hidden p-0"
              style={{ display: activeTab === 'resources' ? 'flex' : 'none', flexDirection: 'column' }}
            >
              <ScrollArea className="h-full w-full">
                <div className="p-3 space-y-2 animate-sweep-up w-full overflow-hidden" style={{ animationFillMode: 'both' }}>
                  {allResources.length === 0 ? (
                    <div className="py-12 text-center">
                      <FileText className="h-8 w-8 text-muted-foreground/20 mx-auto" />
                      <p className="mt-3 text-xs text-muted-foreground">No resources for this course.</p>
                    </div>
                  ) : (
                    allResources.map((res: any, idx: number) => {
                      const fileType = (res.type || '').toLowerCase();
                      const isCloudinary = res.url?.includes('res.cloudinary.com');
                      const isLink = fileType === 'link' || (!isCloudinary && res.url?.startsWith('http') && !res.url?.includes(window.location.hostname));

                      const itemId = res.id || String(idx);
                      const isDownloading = downloadingId === itemId;
                      const resolvedResourceUrl = resolveFileUrl(res.url || '');

                      const handleDownload = (e: React.MouseEvent) => {
                        // For plain links, let the browser handle navigation
                        if (isLink) return;
                        e.preventDefault();

                        // Determine the filename for download
                        const downloadName = res.originalName || res.title || 'download';

                        // Show loading state
                        setDownloadingId(itemId);

                        // Use the backend proxy for downloads — it handles CORS,
                        // Cloudinary raw files, and sets Content-Disposition correctly.
                        api
                          .get('/upload/download', {
                            params: { url: res.url, filename: downloadName },
                            responseType: 'blob',
                          })
                          .then((response) => {
                            const blob = response.data as Blob;
                            const blobUrl = URL.createObjectURL(blob);
                            // Check if iOS/iPhone — use window.open fallback for iOS Safari
                            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
                            if (isIOS) {
                              // On iOS, window.open with blob URL works better
                              const newWindow = window.open(blobUrl, '_blank');
                              if (!newWindow) {
                                // Fallback: use anchor click anyway
                                const a = document.createElement('a');
                                a.href = blobUrl;
                                a.download = downloadName;
                                a.target = '_blank';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                              }
                              // Delay revoke so iOS has time to process
                              setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
                            } else {
                              const a = document.createElement('a');
                              a.href = blobUrl;
                              a.download = downloadName;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(blobUrl);
                            }
                          })
                          .catch(() => {
                            // Fallback: open the original URL in a new tab
                            window.open(resolvedResourceUrl, '_blank');
                          })
                          .finally(() => {
                            setDownloadingId(null);
                          });
                      };

                      return (
                        <a
                          key={res.id || idx}
                          href={isLink ? res.url : resolvedResourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={handleDownload}
                          className="flex items-center gap-2 sm:gap-3 rounded-xl border border-border/60 bg-card p-3 relative overflow-hidden w-full max-w-full transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary/40 group cursor-pointer"
                        >
                          {isDownloading && (
                            <div className="absolute inset-0 bg-primary/10 animate-pulse pointer-events-none z-0" />
                          )}
                          <div className="relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-transform duration-300 group-hover:scale-110">
                            {fileType === 'pdf' ? (
                              <FileText className="h-4 w-4 text-red-400" />
                            ) : fileType === 'ppt' || fileType === 'pptx' ? (
                              <FileText className="h-4 w-4 text-orange-400" />
                            ) : fileType === 'doc' || fileType === 'docx' ? (
                              <FileText className="h-4 w-4 text-blue-400" />
                            ) : fileType === 'image' ? (
                              <FileText className="h-4 w-4 text-emerald-400" />
                            ) : fileType === 'video' ? (
                              <Play className="h-4 w-4 text-purple-400" />
                            ) : fileType === 'link' ? (
                              <Paperclip className="h-4 w-4 text-primary" />
                            ) : (
                              <Paperclip className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div className="relative z-10 flex-1 min-w-0 pr-1">
                            <p className="text-sm font-medium text-foreground truncate block">{res.title || 'Resource'}</p>
                            {res.description && (
                              <p className="text-xs text-muted-foreground truncate block">{res.description}</p>
                            )}
                            {res.lessonTitle && (
                              <p className="text-[10px] text-primary/70 truncate block mt-0.5">Lesson: {res.lessonTitle}</p>
                            )}
                          </div>
                          <div className="relative z-10 flex-shrink-0 flex items-center justify-center">
                            {isDownloading ? (
                              <div className="rounded-full bg-primary/20 p-1.5 shadow-[0_0_10px_rgba(var(--primary),0.3)]">
                                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                              </div>
                            ) : (
                              <div className="rounded-full bg-secondary/80 p-1.5 transition-colors duration-300 group-hover:bg-primary/10">
                                <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                              </div>
                            )}
                          </div>
                        </a>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Projects tab */}
            <TabsContent
              value="projects"
              className="mt-0 min-h-0 flex-1 overflow-hidden p-0"
              style={{ display: activeTab === 'projects' ? 'flex' : 'none', flexDirection: 'column' }}
            >
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-3 animate-sweep-up" style={{ animationFillMode: 'both' }}>
                  {projects.length === 0 ? (
                    <div className="py-8 text-center">
                      <FileText className="h-8 w-8 text-muted-foreground/20 mx-auto" />
                      <p className="mt-3 text-xs text-muted-foreground">
                        No projects assigned yet.
                      </p>
                    </div>
                  ) : (
                    projects.map((project: Project) => {
                      const isExpanded = expandedProjectId === project.id;
                      return (
                        <div
                          key={project.id}
                          className="group rounded-xl border border-border/60 bg-card hover:border-primary/40 transition-all duration-300 shadow-sm hover:shadow-lg hover:-translate-y-1 p-5 flex flex-col gap-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-4">
                              <div className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                                <FileText className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <h4 className="font-bold text-base text-foreground leading-tight">{project.title}</h4>
                                {(project.dueDate || project.due_date) && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5 font-medium">
                                    <Calendar className="h-3.5 w-3.5 text-primary/70" />
                                    Due: {new Date(project.dueDate || project.due_date!).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {project.description && (
                            <p className="text-sm text-muted-foreground/90 line-clamp-3 leading-relaxed">
                              {project.description}
                            </p>
                          )}

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border mt-auto">
                            <span className="text-xs font-medium text-muted-foreground bg-secondary/50 px-2.5 py-1.5 rounded-md inline-flex items-center flex-shrink-0 w-fit">
                              <span className="text-foreground font-semibold mr-1">{project.submissionCount || project.submission_count || 0}</span> submission{(project.submissionCount || project.submission_count || 0) !== 1 ? 's' : ''}
                            </span>
                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (isExpanded) {
                                    setExpandedProjectId(null);
                                    setProjectSubmissionText('');
                                    setProjectSubmissionFile(null);
                                    if (projectFileInputRef.current) projectFileInputRef.current.value = '';
                                  } else {
                                    setExpandedProjectId(project.id);
                                  }
                                }}
                                className={`h-9 shadow-sm transition-all flex-1 sm:flex-none ${isExpanded ? 'bg-secondary text-foreground hover:bg-secondary/80' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                              >
                                {isExpanded ? <X className="mr-1.5 h-4 w-4" /> : <Upload className="mr-1.5 h-4 w-4" />}
                                {isExpanded ? 'Cancel' : 'Submit Project'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  navigate(`/course/${id}/project/${project.id}`);
                                }}
                                className="h-9 hover:bg-secondary flex-1 sm:flex-none"
                              >
                                View Details
                              </Button>
                            </div>
                          </div>

                          {/* Inline submit form */}
                          {isExpanded && (
                            <form
                              className="space-y-3 pt-3 border-t border-border"
                              onSubmit={(e) => {
                                e.preventDefault();
                                if (!projectSubmissionText.trim() && !projectSubmissionFile) {
                                  toast({ title: 'Please upload a file or provide a description', variant: 'destructive' });
                                  return;
                                }
                                submitProjectMutation.mutate({
                                  projectId: project.id,
                                  text: projectSubmissionText || undefined,
                                  file: projectSubmissionFile || undefined,
                                });
                              }}
                            >
                              <div>
                                <label className="text-sm font-medium mb-1.5 block">Upload File</label>
                                <div className="border-2 border-dashed border-border rounded-lg p-3 text-center hover:bg-muted/20 transition-colors">
                                  <input
                                    ref={projectFileInputRef}
                                    type="file"
                                    onChange={(e) => setProjectSubmissionFile(e.target.files?.[0] || null)}
                                    className="hidden"
                                    id={`project-file-${project.id}`}
                                  />
                                  <label htmlFor={`project-file-${project.id}`} className="cursor-pointer">
                                    {projectSubmissionFile ? (
                                      <div className="flex items-center justify-center gap-2 text-sm text-primary">
                                        <Paperclip className="h-4 w-4" />
                                        {projectSubmissionFile.name}
                                        <span className="text-muted-foreground">
                                          ({(projectSubmissionFile.size / 1024 / 1024).toFixed(2)} MB)
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="space-y-1">
                                        <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                                        <p className="text-xs text-muted-foreground">Click to select a file</p>
                                      </div>
                                    )}
                                  </label>
                                </div>
                              </div>

                              <div>
                                <label className="text-sm font-medium mb-1.5 block">Description / Notes (Optional)</label>
                                <Textarea
                                  value={projectSubmissionText}
                                  onChange={(e) => setProjectSubmissionText(e.target.value)}
                                  placeholder="Describe your project submission..."
                                  rows={3}
                                />
                              </div>

                              <Button
                                type="submit"
                                disabled={submitProjectMutation.isPending}
                                className="w-full"
                                size="sm"
                              >
                                {submitProjectMutation.isPending ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Submitting...
                                  </>
                                ) : (
                                  <>
                                    <Send className="mr-2 h-4 w-4" />
                                    Submit Project
                                  </>
                                )}
                              </Button>
                            </form>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Assessment tab */}
            <TabsContent
              value="assessment"
              className="mt-0 min-h-0 flex-1 overflow-hidden p-0"
              style={{ display: activeTab === 'assessment' ? 'flex' : 'none', flexDirection: 'column' }}
            >
              <ScrollArea className="flex-1 min-h-0 p-3">
                <div className="space-y-3 animate-sweep-up" style={{ animationFillMode: 'both' }}>
                  {allLessons.filter(l => l.type === 'quiz').length === 0 ? (
                    <div className="py-12 text-center">
                      <FileText className="h-8 w-8 text-muted-foreground/20 mx-auto" />
                      <p className="mt-3 text-xs text-muted-foreground">
                        No quizzes available for this course.
                      </p>
                    </div>
                  ) : (
                    allLessons.filter(l => l.type === 'quiz').map((quiz) => (
                      <div
                        key={quiz.id}
                        className="group rounded-xl border border-border/60 bg-card hover:border-primary/40 transition-all duration-300 shadow-sm hover:shadow-lg hover:-translate-y-1 p-5 flex flex-col gap-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-4">
                            <div className={`mt-1 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl transition-transform duration-500 group-hover:scale-110 relative ${quiz.isCompleted ? 'bg-gradient-to-br from-yellow-500/20 to-amber-600/30 border border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-border/50'}`}>
                              <div className={`absolute inset-0 ${quiz.isCompleted ? 'bg-yellow-500/40 animate-pulse' : 'bg-blue-500/30'} blur-xl rounded-full`} />
                              <span className="relative text-3xl drop-shadow-[0_5px_15px_rgba(0,0,0,0.6)] group-hover:rotate-12 transition-transform duration-300" role="img" aria-label="3D Trophy">
                                🏆
                              </span>
                            </div>
                            <div>
                              <h4 className="font-bold text-base text-foreground leading-tight">{quiz.title}</h4>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5 font-medium">
                                {quiz.isMandatory ? <Lock className="h-3 w-3 text-red-500" /> : <Play className="h-3 w-3 text-primary/70" />}
                                {quiz.isMandatory ? 'Mandatory Quiz' : 'Optional Quiz'}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 pt-4 border-t border-border mt-auto">
                          {quiz.isCompleted && <span className="text-sm text-emerald-500 font-medium px-2 py-1 bg-emerald-500/10 rounded-md">Completed</span>}
                          <Button
                            size="sm"
                            onClick={() => {
                              setCurrentLessonId(quiz.id);
                              setActiveTab('content');
                              setIsSidebarOpen(false);
                            }}
                            className="w-full sm:w-auto"
                          >
                            Take Quiz
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Leaderboard tab */}
            <TabsContent
              value="leaderboard"
              className="mt-0 min-h-0 flex-1 overflow-hidden p-0"
              style={{ display: activeTab === 'leaderboard' ? 'flex' : 'none', flexDirection: 'column' }}
            >
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4 animate-sweep-up" style={{ animationFillMode: 'both' }}>
                  <div className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl border border-primary/20 mb-2">
                    <Trophy className="w-12 h-12 text-yellow-500 mb-2 drop-shadow-sm" />
                    <h3 className="text-lg font-bold text-foreground">Top Students</h3>
                    <p className="text-xs text-muted-foreground text-center max-w-[250px] mt-1">Based on points earned from completing modules and project submissions.</p>
                  </div>

                  {leaderboard.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-muted-foreground">No students on the leaderboard yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {leaderboard.map((student: any, idx: number) => {
                        const isTop3 = idx < 3;
                        return (
                          <div
                            key={student.id}
                            className={`flex items-center gap-3 p-3 rounded-xl border relative overflow-hidden transition-all duration-300 ${isTop3 ? 'bg-gradient-to-r from-card to-card/50 shadow-sm border-primary/30' : 'bg-card/50 border-border/50 hover:bg-card'}`}
                          >
                            {/* Rank Indicator */}
                            <div className="flex flex-col items-center justify-center w-6 z-10 font-bold shrink-0">
                              {idx === 0 ? <span className="text-xl drop-shadow-md">🥇</span> :
                                idx === 1 ? <span className="text-xl drop-shadow-md">🥈</span> :
                                  idx === 2 ? <span className="text-xl drop-shadow-md">🥉</span> :
                                    <span className="text-sm text-muted-foreground/80">#{idx + 1}</span>}
                            </div>

                            {/* Avatar */}
                            <Avatar className={`h-10 w-10 border-2 shrink-0 z-10 ${idx === 0 ? 'border-yellow-400/80 shadow-[0_0_10px_rgba(250,204,21,0.4)]' : idx === 1 ? 'border-gray-300/80' : idx === 2 ? 'border-amber-600/80' : 'border-transparent'}`}>
                              <AvatarImage src={student.avatarUrl} alt={student.firstName || 'Student'} className="object-cover" />
                              <AvatarFallback className="bg-primary/10 font-medium text-primary">
                                {(student.firstName?.[0] || 'S').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>

                            {/* Student Info */}
                            <div className="flex-1 min-w-0 z-10">
                              <p className={`text-sm truncate font-bold leading-tight ${isTop3 ? 'text-foreground' : 'text-foreground/80'}`}>
                                {student.firstName} {student.lastName}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                  <CheckCircle className="w-2.5 h-2.5 text-primary/70" />
                                  {student.completedModules}
                                </span>
                                <span className="text-[10px] text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                  <FileText className="w-2.5 h-2.5 text-primary/70" />
                                  {student.submissionsCount}
                                </span>
                              </div>
                            </div>

                            {/* Points */}
                            <div className="flex flex-col items-end z-10 shrink-0">
                              <span className={`font-black text-lg ${idx === 0 ? 'text-yellow-500 drop-shadow-sm' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-amber-600' : 'text-primary/70'}`}>
                                {student.points}
                              </span>
                              <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Pts</span>
                            </div>

                            {/* Glow effect for top 1 */}
                            {idx === 0 && <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-2xl -mr-10 -mt-10" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div >
  );
};

export default Player;
