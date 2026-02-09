import { Link } from 'react-router-dom';
import { ArrowRight, Play, Users, BookOpen, Award, TrendingUp, CheckCircle } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import CourseCard from '@/components/courses/CourseCard';
import { Button } from '@/components/ui/button';
import { courses } from '@/data/mockData';

const Index = () => {
  const featuredCourses = courses.filter((c) => c.featured).slice(0, 3);
  const popularCourses = courses.filter((c) => c.bestseller);

  const stats = [
    { icon: Users, value: '500K+', label: 'Active Learners' },
    { icon: BookOpen, value: '10K+', label: 'Expert-Led Courses' },
    { icon: Award, value: '95%', label: 'Success Rate' },
    { icon: TrendingUp, value: '150+', label: 'Countries' },
  ];

  const features = [
    'Learn at your own pace with lifetime access',
    'Expert instructors from top companies',
    'Hands-on projects and real-world skills',
    'Industry-recognized certificates',
  ];

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
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Content */}
            <div className="animate-fade-in">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                <span className="text-sm text-primary">New: AI-Powered Learning Paths</span>
              </div>

              <h1 className="font-display text-4xl font-bold leading-tight text-foreground md:text-5xl lg:text-6xl">
                Unlock Your{' '}
                <span className="text-gradient">Potential</span> with Expert-Led Courses
              </h1>

              <p className="mt-6 text-lg text-muted-foreground md:text-xl">
                Join over 500,000 learners worldwide. Master in-demand skills with courses taught by industry experts.
              </p>

              <ul className="mt-8 space-y-3">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3 text-foreground">
                    <CheckCircle className="h-5 w-5 text-accent" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link to="/courses">
                  <Button size="xl">
                    Explore Courses
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Button variant="outline" size="xl">
                  <Play className="mr-2 h-5 w-5" />
                  Watch Demo
                </Button>
              </div>
            </div>

            {/* Hero Image */}
            <div className="relative animate-fade-in [animation-delay:200ms]">
              <div className="relative rounded-2xl border border-border bg-card p-2 shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=600&fit=crop"
                  alt="Students learning"
                  className="rounded-xl"
                />
                {/* Floating Card */}
                <div className="absolute -left-8 bottom-8 rounded-xl border border-border bg-card p-4 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20">
                      <TrendingUp className="h-6 w-6 text-accent" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">12.5K</p>
                      <p className="text-sm text-muted-foreground">New enrollments</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-border bg-card py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                  <stat.icon className="h-7 w-7 text-primary" />
                </div>
                <p className="font-display text-3xl font-bold text-foreground">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Courses */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 flex items-end justify-between">
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
