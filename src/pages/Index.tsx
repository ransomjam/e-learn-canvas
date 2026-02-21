import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import CourseCard from '@/components/courses/CourseCard';
import { Button } from '@/components/ui/button';
import { coursesService } from '@/services/courses.service';
import { enrollmentsService } from '@/services/enrollments.service';
import { useAuth } from '@/contexts/AuthContext';
import heroBg from '@/assets/hero-bg.jpg';

const Index = () => {
  const { isAuthenticated } = useAuth();

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
        {/* Background Image */}
        <div className="absolute inset-0">
          <img src={heroBg} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-background/70 dark:bg-background/60" />
        </div>

        <div className="container relative mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center animate-fade-in">
            <h1 className="font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl md:text-6xl">
              Unlock Your{' '}
              <span className="text-gradient">Potential</span> with Expert-Led Courses
            </h1>

            <p className="mt-5 text-base text-muted-foreground sm:mt-6 sm:text-lg md:text-lg">
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
