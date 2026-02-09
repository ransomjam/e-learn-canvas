import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, Maximize,
  ChevronLeft, CheckCircle, Lock, Menu, X, FileText, HelpCircle, Clock, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { coursesService, Section, Lesson } from '@/services/courses.service';
import { enrollmentsService } from '@/services/enrollments.service';
import { resolveMediaUrl } from '@/lib/media';

const Player = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);

  // Fetch course details
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', id],
    queryFn: () => coursesService.getCourseById(id!),
    enabled: !!id,
  });

  // Fetch course sections and lessons
  const { data: sections = [], isLoading: lessonsLoading } = useQuery({
    queryKey: ['courseLessons', id],
    queryFn: () => coursesService.getCourseLessons(id!),
    enabled: !!id,
  });

  // Fetch progress
  const { data: progress } = useQuery({
    queryKey: ['courseProgress', id],
    queryFn: () => enrollmentsService.getCourseProgress(id!),
    enabled: !!id,
  });

  // Complete lesson mutation
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

  // Set initial lesson
  useEffect(() => {
    if (sections.length > 0 && !currentLessonId) {
      // Find first incomplete lesson or first lesson
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

  // Get current lesson
  const currentLesson = sections.flatMap(s => s.lessons).find(l => l.id === currentLessonId);

  // Calculate progress
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
      const nextLesson = allLessons[index + 1];
      if (!nextLesson.isFree && course?.isFree === false) {
        // Check if enrolled
      }
      setCurrentLessonId(nextLesson.id);
    }
  };

  const handlePrevLesson = () => {
    const index = allLessons.findIndex(l => l.id === currentLessonId);
    if (index > 0) {
      setCurrentLessonId(allLessons[index - 1].id);
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
      {/* Top Bar */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-3 sm:px-4">
        <div className="flex items-center gap-4">
          <Link to={`/course/${id}`}>
            <Button variant="ghost" size="sm">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Course
            </Button>
          </Link>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-foreground line-clamp-1">{course.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 md:flex">
            <span className="text-sm text-muted-foreground">
              {completedLessons}/{totalLessons} lessons
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
        {/* Main Content */}
        <div className="flex flex-1 flex-col">
          {/* Video Player */}
          <div className="relative aspect-video w-full bg-black">
            {currentLesson?.videoUrl ? (
              currentLesson.videoUrl.includes('drive.google.com') ? (
                <iframe
                  src={currentLesson.videoUrl.replace('/view', '/preview')}
                  className="h-full w-full"
                  allow="autoplay"
                  allowFullScreen
                />
              ) : (
                <video
                  src={currentLesson.videoUrl}
                  className="h-full w-full"
                  controls
                  poster={resolveMediaUrl(course.thumbnailUrl)}
                />
              )
            ) : (
              <>
                <img
                  src={resolveMediaUrl(course.thumbnailUrl) || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&h=675&fit=crop'}
                  alt="Video thumbnail"
                  className="h-full w-full object-cover opacity-50"
                />

                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-glow transition-transform hover:scale-110"
                  >
                    {isPlaying ? (
                      <Pause className="h-8 w-8" />
                    ) : (
                      <Play className="h-8 w-8 ml-1" fill="currentColor" />
                    )}
                  </button>
                </div>
              </>
            )}

            {/* Video Controls */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <Progress value={35} className="mb-4 h-1" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={handlePrevLesson}
                  >
                    <SkipBack className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={handleNextLesson}
                  >
                    <SkipForward className="h-5 w-5" />
                  </Button>
                  <span className="ml-2 text-sm text-white">
                    {currentLesson?.duration ? `${currentLesson.duration} min` : '--:--'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                    <Volume2 className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                    <Maximize className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Lesson Info */}
          <div className="flex-1 overflow-auto p-4 sm:p-6">
            <div className="max-w-3xl">
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

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
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

        {/* Sidebar - Course Content */}
        <div
          className={`w-full flex-shrink-0 border-l border-border bg-card transition-all sm:w-80 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
            } fixed bottom-0 right-0 top-14 z-20 lg:static lg:translate-x-0`}
        >
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Course Content</h2>
            <p className="text-sm text-muted-foreground">
              {progressPercent}% complete
            </p>
          </div>

          <ScrollArea className="h-[calc(100vh-8rem)]">
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
        </div>
      </div>
    </div>
  );
};

export default Player;
