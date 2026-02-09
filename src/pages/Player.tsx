import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, Maximize, 
  ChevronLeft, CheckCircle, Lock, Menu, X, FileText, HelpCircle, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { courses, courseSections } from '@/data/mockData';

const Player = () => {
  const { id } = useParams();
  const course = courses.find((c) => c.id === id) || courses[0];
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentLesson, setCurrentLesson] = useState(courseSections[0].lessons[2]);

  const totalLessons = courseSections.reduce((acc, s) => acc + s.lessons.length, 0);
  const completedLessons = courseSections.reduce(
    (acc, s) => acc + s.lessons.filter((l) => l.isCompleted).length,
    0
  );
  const progressPercent = Math.round((completedLessons / totalLessons) * 100);

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
            <img
              src={course.thumbnail}
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

            {/* Video Controls */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <Progress value={35} className="mb-4 h-1" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
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
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                    <SkipForward className="h-5 w-5" />
                  </Button>
                  <span className="ml-2 text-sm text-white">12:45 / 35:20</span>
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
                {currentLesson.title}
              </h1>
              <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {currentLesson.duration}
                </span>
              </div>

              <div className="mt-6">
                <h2 className="font-semibold text-foreground">About this lesson</h2>
                <p className="mt-2 text-muted-foreground">
                  In this lesson, we'll cover the fundamentals and set up our development environment. 
                  You'll learn the core concepts that will be essential throughout the rest of the course.
                  Make sure to follow along with the code examples provided.
                </p>
              </div>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Button>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark as Complete
                </Button>
                <Button variant="outline">
                  Download Resources
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Course Content */}
        <div
          className={`w-full flex-shrink-0 border-l border-border bg-card transition-all sm:w-80 ${
            isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
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
              {courseSections.map((section, sectionIndex) => (
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
                        onClick={() => !lesson.isLocked && setCurrentLesson(lesson)}
                        disabled={lesson.isLocked}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                          currentLesson.id === lesson.id
                            ? 'bg-primary/10 text-primary'
                            : lesson.isLocked
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-secondary text-foreground'
                        }`}
                      >
                        <div className="flex-shrink-0">
                          {lesson.isLocked ? (
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          ) : lesson.isCompleted ? (
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
                          <p className="text-xs text-muted-foreground">{lesson.duration}</p>
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
