import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play, ChevronLeft, CheckCircle, Menu, X, FileText, HelpCircle, Clock, Loader2,
  MessageSquare, Paperclip, Send, Download
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

const Player = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('content');
  const [chatMessage, setChatMessage] = useState('');

  // Fetch Resources
  const { data: resources = [] } = useQuery({
    queryKey: ['courseResources', id],
    queryFn: () => coursesService.getResources(id!),
    enabled: !!id,
  });

  // Fetch Chat
  const { data: messages = [] } = useQuery({
    queryKey: ['courseChat', id],
    queryFn: () => coursesService.getChatMessages(id!),
    enabled: !!id,
    refetchInterval: 5000,
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

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatMessage.trim()) {
      sendMessageMutation.mutate(chatMessage);
    }
  };

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

  const completeLessonMutation = useMutation({
    mutationFn: (lessonId: string) => enrollmentsService.completeLesson(lessonId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseProgress', id] });
      queryClient.invalidateQueries({ queryKey: ['courseLessons', id] });
      toast({
        title: "Lesson completed!",
        description: "Great progress! Keep learning.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to save progress",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

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

  const currentLesson = sections.flatMap(s => s.lessons).find(l => l.id === currentLessonId);
  const allLessons = sections.flatMap(s => s.lessons);
  const totalLessons = allLessons.length;
  const completedLessons = progress?.completedLessons || 0;
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const handleMarkComplete = () => {
    if (currentLessonId) {
      completeLessonMutation.mutate(currentLessonId);
    }
  };

  const handleNextLesson = () => {
    const index = allLessons.findIndex(l => l.id === currentLessonId);
    if (index < allLessons.length - 1) {
      setCurrentLessonId(allLessons[index + 1].id);
    }
  };

  const isLoading = courseLoading || lessonsLoading;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background">
        <p className="text-muted-foreground">Course not found</p>
        <Link to="/courses">
          <Button className="mt-4">Browse Courses</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-4">
          <Link to={`/course/${id}`}>
            <Button variant="ghost" size="sm">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-foreground line-clamp-1">{course.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-sm text-muted-foreground">
              {completedLessons}/{totalLessons}
            </span>
            <Progress value={progressPercent} className="h-2 w-24" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="relative w-full bg-black" style={{ paddingTop: '56.25%' }}>
            <div className="absolute inset-0">
              {currentLesson?.videoUrl ? (() => {
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
                  <p className="text-muted-foreground">No video available</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-4xl mx-auto">
              <h1 className="font-display text-2xl font-bold text-foreground">
                {currentLesson?.title || 'Select a lesson'}
              </h1>
              <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                {currentLesson?.duration && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {currentLesson.duration} min
                  </span>
                )}
              </div>

              {currentLesson?.content && (
                <div className="mt-6">
                  <h2 className="font-semibold text-foreground">About this lesson</h2>
                  <p className="mt-2 text-muted-foreground">
                    {currentLesson.content}
                  </p>
                </div>
              )}

              <div className="mt-8 flex flex-wrap gap-4">
                <Button
                  onClick={handleMarkComplete}
                  disabled={completeLessonMutation.isPending || currentLesson?.isCompleted}
                >
                  {completeLessonMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  {currentLesson?.isCompleted ? 'Completed' : 'Mark as Complete'}
                </Button>
                <Button variant="outline" onClick={handleNextLesson}>
                  Next Lesson
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`w-full sm:w-96 flex-shrink-0 border-l border-border bg-card transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
            } fixed bottom-0 right-0 top-16 z-20 lg:static lg:translate-x-0`}
        >
          <Tabs defaultValue="content" className="flex h-full flex-col">
            <div className="border-b border-border px-4 py-2">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
                <TabsTrigger value="chat">Chat</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="content" className="flex-1 overflow-hidden p-0 data-[state=active]:flex data-[state=active]:flex-col">
              <div className="p-4 border-b border-border">
                <p className="text-sm text-muted-foreground">
                  {progressPercent}% complete
                </p>
                <Progress value={progressPercent} className="mt-2 h-2" />
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2">
                  {sections.map((section, sectionIndex) => (
                    <div key={section.id} className="mb-4">
                      <div className="px-3 py-2">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Section {sectionIndex + 1}
                        </p>
                        <p className="font-medium text-foreground">{section.title}</p>
                      </div>

                      <div className="space-y-1">
                        {section.lessons.map((lesson) => (
                          <button
                            key={lesson.id}
                            onClick={() => setCurrentLessonId(lesson.id)}
                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${currentLessonId === lesson.id
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-secondary text-foreground'
                              }`}
                          >
                            <div className="flex-shrink-0">
                              {lesson.isCompleted ? (
                                <CheckCircle className="h-4 w-4 text-accent" />
                              ) : lesson.type === 'video' ? (
                                <Play className="h-4 w-4" />
                              ) : lesson.type === 'quiz' ? (
                                <HelpCircle className="h-4 w-4" />
                              ) : (
                                <FileText className="h-4 w-4" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{lesson.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {lesson.duration ? `${lesson.duration} min` : lesson.type}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="resources" className="flex-1 overflow-hidden p-0 data-[state=active]:flex data-[state=active]:flex-col">
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {resources.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <FileText className="h-12 w-12 text-muted-foreground/20" />
                      <p className="mt-4 text-muted-foreground">No resources available for this course.</p>
                    </div>
                  ) : (
                    resources.map((res: any) => (
                      <div key={res.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/5">
                        <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                          {res.type === 'pdf' ? (
                            <FileText className="h-4 w-4 text-primary" />
                          ) : (
                            <Paperclip className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-foreground truncate">{res.title}</h4>
                          {res.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {res.description}
                            </p>
                          )}
                          <a
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center text-xs font-medium text-primary hover:underline"
                          >
                            <Download className="mr-1 h-3 w-3" />
                            Open Resource
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="chat" className="flex h-full flex-col p-0 data-[state=active]:flex">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <MessageSquare className="h-12 w-12 text-muted-foreground/20" />
                      <p className="mt-4 text-muted-foreground">No messages yet.</p>
                      <p className="text-sm text-muted-foreground">Start the conversation!</p>
                    </div>
                  )}
                  {messages.map((msg: any) => {
                    const isMe = msg.user.id === user?.id;
                    return (
                      <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <div
                          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${isMe ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                            }`}
                        >
                          {msg.user.firstName[0]}
                        </div>
                        <div
                          className={`max-w-[80%] rounded-lg p-3 text-sm ${isMe ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
                            }`}
                        >
                          <div className="mb-1 flex items-center justify-between gap-4">
                            <span className="font-medium opacity-90">{msg.user.firstName}</span>
                            {msg.user.role === 'instructor' && <span className="text-[10px] uppercase font-bold bg-background/20 px-1 rounded">Instr</span>}
                          </div>
                          <p>{msg.message}</p>
                          <p className="mt-1 text-right text-[10px] opacity-70">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <div className="border-t border-border bg-card p-4">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!chatMessage.trim() || sendMessageMutation.isPending}
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Player;
