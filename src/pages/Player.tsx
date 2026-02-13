import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play, ChevronLeft, CheckCircle, Menu, X, FileText, HelpCircle, Clock, Loader2,
  MessageSquare, Paperclip, Send, Download, ChevronRight, Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { coursesService, Section, Lesson } from '@/services/courses.service';
import { enrollmentsService } from '@/services/enrollments.service';
import { resolveMediaUrl } from '@/lib/media';
import { useAuth } from '@/contexts/AuthContext';
import DocumentViewer from '@/components/ui/DocumentViewer';

const Player = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('content');
  const [chatMessage, setChatMessage] = useState('');

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

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatMessage.trim()) sendMessageMutation.mutate(chatMessage);
  };

  const goToLesson = (direction: 'prev' | 'next') => {
    const idx = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (idx >= 0 && idx < allLessons.length) setCurrentLessonId(allLessons[idx].id);
  };

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
          <div className="relative w-full bg-black flex-shrink-0" style={{ height: currentLesson?.type === 'video' ? 'auto' : '100%', minHeight: '50vh' }}>
            <div className={currentLesson?.type === 'video' ? "absolute inset-0" : "h-full w-full overflow-auto bg-background"}>
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

          {/* Lesson info + controls */}
          <div className="flex-1 overflow-auto">
            <div className="max-w-3xl mx-auto p-5 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-lg font-bold text-foreground leading-tight">
                    {currentLesson?.title || 'Select a lesson'}
                  </h1>
                  {currentLesson?.duration && (
                    <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {currentLesson.duration} min
                    </p>
                  )}
                </div>
                {currentLesson && !currentLesson.isCompleted && (
                  <Button
                    size="sm"
                    onClick={() => currentLessonId && completeLessonMutation.mutate(currentLessonId)}
                    disabled={completeLessonMutation.isPending}
                    className="flex-shrink-0"
                  >
                    {completeLessonMutation.isPending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Complete
                  </Button>
                )}
                {currentLesson?.isCompleted && (
                  <span className="flex items-center gap-1 text-xs text-accent font-medium flex-shrink-0">
                    <CheckCircle className="h-4 w-4" /> Done
                  </span>
                )}
              </div>

              {currentLesson?.content && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {currentLesson.content}
                </p>
              )}

              {/* Prev / Next */}
              <div className="flex gap-2 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToLesson('prev')}
                  disabled={currentIndex <= 0}
                  className="flex-1"
                >
                  <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToLesson('next')}
                  disabled={currentIndex >= allLessons.length - 1}
                  className="flex-1"
                >
                  Next
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div
          className={`fixed bottom-0 right-0 top-14 z-20 w-full transform transition-transform duration-300 ease-in-out lg:static lg:block lg:w-96 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
            } border-l bg-card flex flex-col`}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-semibold text-foreground">Course Content</h2>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Tabs defaultValue="content" className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-border px-3 py-1.5">
              <TabsList className="grid w-full grid-cols-3 h-8">
                <TabsTrigger value="content" className="text-xs">Lessons</TabsTrigger>
                <TabsTrigger value="resources" className="text-xs">Files</TabsTrigger>
                <TabsTrigger value="chat" className="text-xs">Chat</TabsTrigger>
              </TabsList>
            </div>

            {/* Lessons tab */}
            <TabsContent value="content" className="flex-1 overflow-hidden p-0 data-[state=active]:flex data-[state=active]:flex-col">
              <div className="flex-1 overflow-y-auto min-h-0 bg-card/50">
                {sections.length === 0 ? (
                  <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
                    <p>No lessons available</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-3">
                    {sections.map((section, si) => (
                      <div key={section.id}>
                        <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-foreground/70">
                          {section.title}
                        </p>
                        <div className="space-y-0.5">
                          {section.lessons.map((lesson) => {
                            const isActive = currentLessonId === lesson.id;
                            return (
                              <button
                                key={lesson.id}
                                onClick={() => setCurrentLessonId(lesson.id)}
                                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-3 text-left transition-colors text-sm ${isActive
                                  ? 'bg-primary/10 text-primary font-medium'
                                  : 'hover:bg-accent/50 text-foreground'
                                  }`}
                              >
                                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                                  {lesson.isCompleted ? (
                                    <CheckCircle className="h-4 w-4 text-primary" />
                                  ) : lesson.type === 'video' ? (
                                    <Play className="h-3.5 w-3.5" />
                                  ) : (
                                    <FileText className="h-3.5 w-3.5 opacity-70" />
                                  )}
                                </div>
                                <span className="flex-1 line-clamp-2">{lesson.title}</span>
                                {lesson.duration && (
                                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                    {lesson.duration}m
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Files tab */}
            <TabsContent value="resources" className="flex-1 overflow-hidden p-0 data-[state=active]:flex data-[state=active]:flex-col">
              <ScrollArea className="flex-1">
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

            {/* Chat tab */}
            <TabsContent value="chat" className="flex h-full flex-col p-0 data-[state=active]:flex">
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-3">
                  {messages.length === 0 && (
                    <div className="py-12 text-center">
                      <MessageSquare className="h-8 w-8 text-muted-foreground/20 mx-auto" />
                      <p className="mt-3 text-xs text-muted-foreground">No messages yet.</p>
                    </div>
                  )}
                  {messages.map((msg: any) => {
                    const isMe = msg.user.id === user?.id;
                    return (
                      <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <div
                          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${isMe ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                            }`}
                        >
                          {msg.user.firstName[0]}
                        </div>
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${isMe ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
                            }`}
                        >
                          {!isMe && (
                            <p className="mb-0.5 font-semibold opacity-80">{msg.user.firstName}</p>
                          )}
                          <p>{msg.message}</p>
                          <p className="mt-1 text-right text-[9px] opacity-60">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>
              <div className="border-t border-border p-3">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 h-8 text-xs"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="h-8 w-8"
                    disabled={!chatMessage.trim() || sendMessageMutation.isPending}
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </form>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div >
  );
};

export default Player;
