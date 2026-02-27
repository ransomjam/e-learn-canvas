import { useMemo, useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, PlayCircle, Video as VideoIcon, X } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import CourseCard from '@/components/courses/CourseCard';
import { Button } from '@/components/ui/button';
import { coursesService } from '@/services/courses.service';
import { enrollmentsService } from '@/services/enrollments.service';
import { adminService } from '@/services/admin.service';
import { resolveMediaUrl } from '@/lib/media';
import { useAuth } from '@/contexts/AuthContext';
import TechBackground from '@/components/ui/TechBackground';

const Index = () => {
  const { isAuthenticated } = useAuth();
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const modalVideoRef = useRef<HTMLVideoElement>(null);

  // Close modal on Escape key
  useEffect(() => {
    if (!videoModalOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVideoModalOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [videoModalOpen]);

  // Pause modal video when closed
  useEffect(() => {
    if (!videoModalOpen && modalVideoRef.current) {
      modalVideoRef.current.pause();
    }
    if (videoModalOpen && modalVideoRef.current) {
      modalVideoRef.current.play().catch(() => {});
    }
  }, [videoModalOpen]);

  const { data: coursesData } = useQuery({
    queryKey: ['courses', { limit: 8 }],
    queryFn: () => coursesService.getCourses({ limit: 8, sortBy: 'enrollment_count' }),
  });

  // Fetch user enrollments to mark enrolled courses
  const { data: enrollments } = useQuery({
    queryKey: ['myEnrollments'],
    queryFn: () => enrollmentsService.getMyEnrollments(),
    enabled: isAuthenticated,
  });

  // Fetch platform video
  const { data: platformVideo, isLoading: videoLoading } = useQuery({
    queryKey: ['platformVideoView'],
    queryFn: async () => {
      try {
        return await adminService.getPlatformVideo();
      } catch {
        return null;
      }
    },
    retry: false,
  });

  const courses = coursesData?.data || [];

  // Create a Set of enrolled course IDs for O(1) lookup
  const enrolledCourseIds = useMemo(() => {
    if (!enrollments) return new Set<string>();
    return new Set(enrollments.map(e => e.courseId || e.course?.id).filter(Boolean));
  }, [enrollments]);

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 sm:py-20 lg:py-28">
        <TechBackground />

        <div className="container relative mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center animate-fade-in">
            <h1 className="font-display text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl">
              Unlock Your{' '}
              <span className="text-gradient">Potential</span> with Expert-Led Courses
            </h1>

            <p className="mt-5 text-base text-white/70 sm:mt-6 sm:text-lg md:text-lg">
              Master in-demand skills with courses taught by industry experts.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:mt-10 sm:gap-4 sm:flex-row">
              <Link to="/courses" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto font-semibold h-11">
                  Explore Courses
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/auth?mode=signup" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto font-semibold h-11">
                  Get Started Free
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works / Platform Video Section */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-24">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl md:text-5xl">
              {platformVideo?.title || 'How to Use Our Platform'}
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg max-w-2xl mx-auto">
              {platformVideo?.description || 'Watch this quick video to learn how to navigate the platform, discover courses, and start learning effectively.'}
            </p>
          </div>

          <div className="relative mx-auto aspect-video max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            {videoLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-secondary/30">
                <div className="animate-pulse flex flex-col items-center">
                  <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                    <PlayCircle className="h-8 w-8 text-primary/50" />
                  </div>
                  <div className="h-4 w-32 bg-secondary rounded" />
                </div>
              </div>
            ) : platformVideo?.videoUrl ? (
              <>
                {/* Thumbnail / poster placeholder with play button overlay */}
                <div
                  className="absolute inset-0 flex items-center justify-center cursor-pointer group"
                  onClick={() => setVideoModalOpen(true)}
                >
                  {platformVideo.thumbnailUrl ? (
                    <img
                      src={resolveMediaUrl(platformVideo.thumbnailUrl)}
                      alt="Video thumbnail"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-secondary/40" />
                  )}
                  {/* Play button overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                    <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-primary/90 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                      <PlayCircle className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                    </div>
                  </div>
                </div>

                {/* Fullscreen modal */}
                {videoModalOpen && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-0"
                    onClick={(e) => { if (e.target === e.currentTarget) setVideoModalOpen(false); }}
                  >
                    <div className="relative w-full h-full flex items-center justify-center">
                      <button
                        onClick={() => setVideoModalOpen(false)}
                        className="absolute top-3 right-3 z-10 h-9 w-9 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                        aria-label="Close video"
                      >
                        <X className="h-5 w-5" />
                      </button>
                      <video
                        ref={modalVideoRef}
                        src={resolveMediaUrl(platformVideo.videoUrl)}
                        poster={resolveMediaUrl(platformVideo.thumbnailUrl) || undefined}
                        controls
                        autoPlay
                        className="max-h-screen max-w-full w-full object-contain"
                        style={{ maxHeight: '100dvh' }}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/30 text-center p-6 border-2 border-dashed border-border/50">
                <VideoIcon className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold text-foreground">Coming Soon</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-md">
                  We are currently preparing an introductory video.
                  Admins can upload the video from the Admin Dashboard &gt; Platform Video section.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Courses Section */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-24 bg-gradient-to-b from-transparent via-primary/5 to-transparent">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex flex-col gap-3 sm:mb-10 sm:gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl md:text-4xl lg:text-5xl">
                Popular Courses
              </h2>
              <p className="mt-2 text-sm text-muted-foreground sm:mt-3 sm:text-base">
                Trending courses picked by our community
              </p>
            </div>
            <Link to="/courses" className="hidden sm:block">
              <Button variant="outline" size="lg" className="font-semibold h-11">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {courses.slice(0, 4).map((course) => (
              <CourseCard key={course.id} course={course} isEnrolled={enrolledCourseIds.has(course.id)} />
            ))}
          </div>

          <Link to="/courses" className="mt-8 block sm:hidden">
            <Button variant="outline" className="w-full text-base h-11 font-semibold">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden py-16 sm:py-20 md:py-24 lg:py-28">
        <div className="absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[120px]" />
        </div>

        <div className="container relative mx-auto px-4 text-center">
          <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl md:text-5xl max-w-2xl mx-auto">
            Ready to Start Learning?
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:mt-6 sm:text-lg">
            Join our community of learners and unlock access to thousands of courses, personalized recommendations, and exclusive content.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:mt-10 sm:gap-4 sm:flex-row">
            <Link to="/auth?mode=signup" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto font-semibold h-11">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/courses" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto font-semibold h-11">
                Browse Courses
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
