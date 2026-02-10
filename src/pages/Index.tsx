import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import CourseCard from '@/components/courses/CourseCard';
import { Button } from '@/components/ui/button';
import { coursesService } from '@/services/courses.service';

const Index = () => {
  const { data: coursesData } = useQuery({
    queryKey: ['courses', { limit: 8 }],
    queryFn: () => coursesService.getCourses({ limit: 8, sortBy: 'enrollment_count' }),
  });

  const courses = coursesData?.data || [];
  const featuredCourses = courses.slice(0, 3);
  const popularCourses = courses.slice(0, 4);



  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/20 blur-[100px]" />
          <div className="absolute -right-40 top-20 h-80 w-80 rounded-full bg-accent/20 blur-[100px]" />
        </div>

        <div className="container relative mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center animate-fade-in">
            <h1 className="font-display text-4xl font-bold leading-tight text-foreground md:text-5xl lg:text-6xl">
              Unlock Your{' '}
              <span className="text-gradient">Potential</span> with Expert-Led Courses
            </h1>

            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              Master in-demand skills with courses taught by industry experts.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/courses">
                <Button size="xl">
                  Explore Courses
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/auth?mode=signup">
                <Button variant="outline" size="xl">
                  Get Started Free
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Courses */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-3xl font-bold text-foreground md:text-4xl">
                Featured Courses
              </h2>
              <p className="mt-2 text-muted-foreground">
                Hand-picked courses to get you started
              </p>
            </div>
            <Link to="/courses">
              <Button variant="outline">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuredCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </div>
      </section>

      {/* Popular Courses */}
      <section className="bg-card py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-bold text-foreground md:text-4xl">
              Popular This Week
            </h2>
            <p className="mt-2 text-muted-foreground">
              Join thousands of learners in these trending courses
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {popularCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[120px]" />
        </div>

        <div className="container relative mx-auto px-4 text-center">
          <h2 className="font-display text-3xl font-bold text-foreground md:text-4xl lg:text-5xl">
            Ready to Start Learning?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Join our community of learners and unlock access to thousands of courses, personalized recommendations, and exclusive content.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/auth?mode=signup">
              <Button size="xl">
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="outline" size="xl">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
