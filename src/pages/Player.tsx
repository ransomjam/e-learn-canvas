import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play, ChevronLeft, CheckCircle, Menu, X, FileText, Clock, Loader2,
  Send, Download, ChevronRight, Lock, ThumbsUp, Paperclip, Upload, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { coursesService, Section, Lesson } from '@/services/courses.service';
import { enrollmentsService } from '@/services/enrollments.service';
import { resolveMediaUrl } from '@/lib/media';
import { useAuth } from '@/contexts/AuthContext';
import DocumentViewer from '@/components/ui/DocumentViewer';
import { useIsMobile } from '@/hooks/use-mobile';
import { projectsService, Project } from '@/services/projects.service';

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
    queryKey: ['courseChat', id],
    queryFn: () => coursesService.getChatMessages(id!),
    enabled: !!id,
    refetchInterval: 5000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['courseProjects', id],
    queryFn: () => projectsService.getCourseProjects(id!),
    enabled: !!id,
  });

  const { data: likesData } = useQuery({
    queryKey: ['lessonLikes', currentLessonId],
    queryFn: () => coursesService.getLessonLikes(currentLessonId!),
    enabled: !!currentLessonId,
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
    mutationFn: (message: string) => coursesService.postChatMessage(id!, message),
    onSuccess: () => {
      setChatMessage('');
      queryClient.invalidateQueries({ queryKey: ['courseChat', id] });
    },
    onError: () => {
      toast({ title: 'Failed to send message', variant: 'destructive' });
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

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const currentLesson = sections.flatMap(s => s.lessons).find(l => l.id === currentLessonId);

  const allResources = useMemo(() => {
    if (!currentLesson) return resources || [];

    const items = [...(resources || [])];

    if (currentLesson.practiceFiles) {
      try {
        const parsed = typeof currentLesson.practiceFiles === 'string'
          ? JSON.parse(currentLesson.practiceFiles)
          : currentLesson.practiceFiles;
        if (Array.isArray(parsed)) {
          items.push(...parsed.map((p: any) => ({
            ...p,
            title: p.name,
            lessonTitle: currentLesson.title,
            id: `${currentLesson.id}-practice-${p.url}`
          })));
        }
      } catch { }
    }

    return items;
  }, [currentLesson, resources]);

  const allLessons = sections.flatMap(s => s.lessons);
  const currentIndex = allLessons.findIndex(l => l.id === currentLessonId);
  const totalLessons = allLessons.length;
  const completedLessons = progress?.completedLessons || 0;
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const isVideoLesson = currentLesson?.type === 'video';

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatMessage.trim()) sendMessageMutation.mutate(chatMessage);
  };

  const goToLesson = (direction: 'prev' | 'next') => {
    const idx = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (idx >= 0 && idx < allLessons.length) setCurrentLessonId(allLessons[idx].id);
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
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
            className="h-8 w-8 lg:hidden"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Content Area (Video/Document/Quiz) */}
          <div
            className="relative w-full bg-black flex-shrink-0"
            style={{
              height: isVideoLesson ? 'auto' : 'clamp(340px, 62vh, 820px)',
              minHeight: '50vh'
            }}
          >
            <div className={isVideoLesson ? "absolute inset-0" : "h-full w-full overflow-auto bg-background"}>
              {currentLesson ? (
                currentLesson.type === 'video' ? (
                  currentLesson.videoUrl ? (() => {
                    const resolvedVideoUrl = resolveMediaUrl(currentLesson.videoUrl);
                    return resolvedVideoUrl.includes('drive.google.com') ? (
                      <iframe
                        src={resolvedVideoUrl.replace('/view', '/preview')}
                        className="h-full w-full"
                        allow="autoplay"
                        allowFullScreen
                      />
                    ) : (
                      <video
                        key={resolvedVideoUrl}
                        src={resolvedVideoUrl}
                        className="h-full w-full"
                        controls
                        poster={resolveMediaUrl(course.thumbnailUrl)}
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
                  <div className="h-full w-full p-4 bg-slate-100 dark:bg-slate-900">
                    {currentLesson.videoUrl ? (
                      <DocumentViewer
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
                        className="h-full shadow-lg"
                      />
                    ) : currentLesson.content ? (
                      <div className="h-full w-full p-8 overflow-auto bg-card rounded-lg shadow-sm">
                        <div className="max-w-3xl mx-auto prose dark:prose-invert">
                          <h1 className="mb-4 text-2xl font-bold">{currentLesson.title}</h1>
                          <div dangerouslySetInnerHTML={{ __html: currentLesson.content }} />
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-muted-foreground gap-4">
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
                ) : (
                  <div className="h-full w-full p-8 overflow-auto">
                    <div className="max-w-3xl mx-auto prose dark:prose-invert">
                      <h1>{currentLesson.title}</h1>
                      <div dangerouslySetInnerHTML={{ __html: currentLesson.content || '' }} />
                    </div>
                  </div>
                )
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  Select a lesson to start
                </div>
              )}
            </div>
          </div>

          {/* Lesson info + controls + chats */}
          <div className="flex-1 overflow-auto">
            <div className="max-w-5xl mx-auto p-5 space-y-4">
              {/* Lesson title and metadata */}
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  {currentLesson?.title || 'Select a lesson'}
                </h1>
                {currentLesson?.duration && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {currentLesson.duration} minutes
                  </p>
                )}
              </div>

              {/* Action buttons row - YouTube style */}
              <div className="flex items-center justify-between py-3 border-y border-border">
                <div className="flex items-center gap-3">
                  {/* Like button */}
                  <Button
                    variant={likesData?.liked ? "default" : "outline"}
                    size="sm"
                    onClick={() => currentLessonId && toggleLikeMutation.mutate(currentLessonId)}
                    disabled={!currentLessonId || toggleLikeMutation.isPending}
                    className="gap-2"
                  >
                    <ThumbsUp className={`h-4 w-4 ${likesData?.liked ? 'fill-current' : ''}`} />
                    <span>{likesData?.likesCount || 0}</span>
                  </Button>

                  {/* Complete button */}
                  {currentLesson && !currentLesson.isCompleted && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => currentLessonId && completeLessonMutation.mutate(currentLessonId)}
                      disabled={completeLessonMutation.isPending}
                      className="gap-2"
                    >
                      {completeLessonMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                      Mark as Complete
                    </Button>
                  )}
                  {currentLesson?.isCompleted && (
                    <span className="flex items-center gap-2 text-sm text-accent font-medium px-3 py-1.5 bg-accent/10 rounded-full">
                      <CheckCircle className="h-4 w-4" /> Completed
                    </span>
                  )}
                </div>

                {/* Navigation buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToLesson('prev')}
                    disabled={currentIndex <= 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToLesson('next')}
                    disabled={currentIndex >= allLessons.length - 1}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
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

              {/* Chats section - YouTube style comments */}
              <div className="pt-4">
                <h3 className="text-lg font-semibold mb-4">
                  {messages.length} {messages.length === 1 ? 'Chat' : 'Chats'}
                </h3>

                {/* Chat input */}
                <form onSubmit={handleSendMessage} className="mb-6">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                        {user?.firstName?.[0]}
                      </div>
                    </div>
                    <div className="flex-1">
                      <Input
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        placeholder="Add a chat message..."
                        className="mb-2"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setChatMessage('')}
                          disabled={!chatMessage.trim()}
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
                            'Chat'
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </form>

                {/* Chat messages */}
                <div className="space-y-4">
                  {messages.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No chats yet. Be the first to start a conversation!
                    </p>
                  )}
                  {messages.map((msg: any) => {
                    const isMe = msg.user.id === user?.id;
                    return (
                      <div key={msg.id} className="flex gap-3">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                            {msg.user.firstName[0]}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="font-semibold text-sm">
                              {msg.user.firstName} {msg.user.lastName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(msg.createdAt).toLocaleDateString()} at {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-sm text-foreground break-words">
                            {msg.message}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
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
          className={`flex flex-col min-h-0 border-l border-border bg-card shadow-2xl overflow-hidden
            ${isMobile ? (
              isSidebarOpen 
                ? 'fixed left-0 right-0 top-14 bottom-0 z-20 w-full' 
                : 'hidden'
            ) : (
              'lg:shadow-none static w-96'
            )}`}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-semibold text-foreground">Course Content</h2>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col min-h-0 flex-1 overflow-hidden">
            <div className="border-b border-border px-2 py-1.5">
              <TabsList className="grid w-full grid-cols-3 h-9 gap-1">
                <TabsTrigger value="content" className="text-xs sm:text-sm px-2 sm:px-4">Lessons</TabsTrigger>
                <TabsTrigger value="resources" className="text-xs sm:text-sm px-2 sm:px-4">Files</TabsTrigger>
                <TabsTrigger value="projects" className="text-xs sm:text-sm px-2 sm:px-4">Projects</TabsTrigger>
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
                  <div className="flex h-96 items-center justify-center p-4 text-center text-sm text-muted-foreground">
                    <p>No lessons available</p>
                  </div>
                ) : (
                  <div className="p-3 space-y-3">
                    {sections.map((section, si) => (
                      <div key={section.id} className="space-y-1.5">
                        <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-foreground/60">
                          {section.title}
                        </p>
                        <div className="space-y-1">
                          {section.lessons && section.lessons.map((lesson) => {
                            const isActive = currentLessonId === lesson.id;
                            return (
                              <button
                                key={lesson.id}
                                onClick={() => {
                                  setCurrentLessonId(lesson.id);
                                  if (isMobile) {
                                    setIsSidebarOpen(false);
                                  }
                                }}
                                className={`w-full flex items-start gap-2 rounded-md px-2.5 py-2.5 text-left transition-all text-xs sm:text-sm ${isActive
                                  ? 'bg-primary/15 text-primary font-semibold'
                                  : 'text-foreground/85 hover:bg-accent/40'
                                  }`}
                              >
                                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
                                  {lesson.isCompleted ? (
                                    <CheckCircle className="h-4 w-4 text-primary" />
                                  ) : lesson.type === 'video' ? (
                                    <Play className="h-3.5 w-3.5" />
                                  ) : (
                                    <FileText className="h-3.5 w-3.5 opacity-70" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="break-words line-clamp-2 leading-snug">{lesson.title}</p>
                                  {lesson.duration && (
                                    <span className="text-[9px] text-muted-foreground/70 block mt-0.5">
                                      {lesson.duration}m
                                    </span>
                                  )}
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
                <div className="p-3 space-y-2">
                  {allResources.length === 0 ? (
                    <div className="py-12 text-center">
                      <FileText className="h-8 w-8 text-muted-foreground/20 mx-auto" />
                      <p className="mt-3 text-xs text-muted-foreground">No files for this course.</p>
                    </div>
                  ) : (
                    allResources.map((res: any, idx: number) => (
                      <a
                        key={res.id || idx}
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-secondary group"
                      >
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          {res.type === 'pdf' ? (
                            <FileText className="h-4 w-4 text-primary" />
                          ) : (
                            <Paperclip className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{res.title}</p>
                          {res.description && (
                            <p className="text-[10px] text-muted-foreground truncate">{res.description}</p>
                          )}
                          {res.lessonTitle && (
                            <p className="text-[10px] text-primary/70 truncate">Lesson: {res.lessonTitle}</p>
                          )}
                        </div>
                        <Download className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    ))
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
              <ScrollArea className="flex-1 min-h-0 p-3">
                <div className="space-y-3">
                  {projects.length === 0 ? (
                    <div className="py-12 text-center">
                      <FileText className="h-8 w-8 text-muted-foreground/20 mx-auto" />
                      <p className="mt-3 text-xs text-muted-foreground">
                        No projects assigned yet.
                      </p>
                    </div>
                  ) : (
                    projects.map((project: Project) => (
                      <div
                        key={project.id}
                        className="rounded-lg border border-border p-4 space-y-3 hover:bg-accent/5 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-sm text-foreground">{project.title}</h4>
                          {project.dueDate && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                              <Calendar className="h-3 w-3" />
                              {new Date(project.dueDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        
                        {project.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {project.description}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between pt-2 border-t border-border">
                          <span className="text-xs text-muted-foreground">
                            {project.submissionCount || 0} submission{project.submissionCount !== 1 ? 's' : ''}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // Navigate to project details
                              window.location.href = `/course/${id}/project/${project.id}`;
                            }}
                            className="h-7 text-xs"
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))
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
