import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Star, Clock, Users, Play, Award, Globe,
  CheckCircle, Lock, FileText, HelpCircle, Loader2, ShoppingCart
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { coursesService, Course, Section } from '@/services/courses.service';
import { enrollmentsService } from '@/services/enrollments.service';
import { paymentsService } from '@/services/payments.service';

const CourseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [isEnrolling, setIsEnrolling] = useState(false);

  // Fetch course
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', id],
    queryFn: () => coursesService.getCourseById(id!),
    enabled: !!id,
  });

  // Fetch sections
  const { data: sections = [] } = useQuery({
    queryKey: ['courseLessons', id],
    queryFn: () => coursesService.getCourseLessons(id!),
    enabled: !!id,
  });

  // Check enrollment
  const { data: enrollment } = useQuery({
    queryKey: ['enrollment', id],
    queryFn: () => enrollmentsService.checkEnrollment(id!),
    enabled: !!id && isAuthenticated,
  });

  const totalLessons = sections.reduce((acc, section) => acc + section.lessons.length, 0);
  const isEnrolled = !!enrollment;

  const handleEnroll = async () => {
    if (!isAuthenticated) {
      navigate('/auth', { state: { from: { pathname: `/course/${id}` } } });
      return;
    }

    setIsEnrolling(true);
    try {
      if (course?.isFree || course?.price === 0) {
        // Free course - enroll directly
        await enrollmentsService.enrollInCourse(id!);
        toast({
          title: "Enrolled successfully!",
          description: "You can now access the course.",
        });
        queryClient.invalidateQueries({ queryKey: ['enrollment', id] });
        navigate(`/player/${id}`);
      } else {
        // Paid course - create payment
        const paymentIntent = await paymentsService.createPayment(id!);
        // In production, integrate with Stripe here
        // For demo, simulate payment confirmation
        await paymentsService.confirmPayment(paymentIntent.paymentId, 'demo_transaction');
        toast({
          title: "Payment successful!",
          description: "You now have access to the course.",
        });
        queryClient.invalidateQueries({ queryKey: ['enrollment', id] });
        navigate(`/player/${id}`);
      }
    } catch (error: any) {
      toast({
        title: "Enrollment failed",
        description: error.response?.data?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsEnrolling(false);
    }
  };

  const whatYouLearn = [
    'Build powerful, fast, user-friendly and reactive web apps',
    'Apply for high-paid jobs or work as a freelancer',
    'Understand the core concepts behind modern frameworks',
    'Build modern, complex, responsive and scalable web applications',
  ];

  const requirements = [
    'Basic understanding of JavaScript fundamentals',
    'Familiarity with HTML and CSS',
    'A computer with internet connection',
    'No prior framework experience required',
  ];

  if (courseLoading) {
    return (
      <Layout>
        <div className="py-12">
          <div className="container mx-auto px-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="mt-4 h-6 w-1/2" />
            <Skeleton className="mt-8 h-64 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!course) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground">Course not found</p>
          <Link to="/courses">
            <Button className="mt-4">Browse Courses</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const displayPrice = course.discountPrice || course.price;
  const hasDiscount = course.discountPrice && course.discountPrice < course.price;

  return (
    <Layout>
      {/* Hero Section */}
      <section className="bg-card py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Course Info */}
            <div className="lg:col-span-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="accent">{course.category?.name || 'General'}</Badge>
                <Badge variant="secondary">{course.level.charAt(0).toUpperCase() + course.level.slice(1)}</Badge>
                {course.enrollmentCount > 1000 && <Badge>Bestseller</Badge>}
              </div>

              <h1 className="mt-4 font-display text-3xl font-bold text-foreground md:text-4xl">
                {course.title}
              </h1>

              <p className="mt-4 text-lg text-muted-foreground">
                {course.shortDescription || course.description}
              </p>

              {/* Rating & Stats */}
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Star className="h-5 w-5 fill-accent text-accent" />
                    <span className="font-semibold text-foreground">{course.ratingAvg.toFixed(1)}</span>
                  </div>
                  <span className="text-muted-foreground">
                    ({course.ratingCount.toLocaleString()} ratings)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-5 w-5" />
                  <span>{course.enrollmentCount.toLocaleString()} students</span>
                </div>
              </div>

              {/* Instructor */}
              <div className="mt-6 flex items-center gap-3">
                <img
                  src={course.instructor.avatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop'}
                  alt={`${course.instructor.firstName} ${course.instructor.lastName}`}
                  className="h-12 w-12 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm text-muted-foreground">Created by</p>
                  <p className="font-medium text-foreground">
                    {course.instructor.firstName} {course.instructor.lastName}
                  </p>
                </div>
              </div>

              {/* Meta */}
              <div className="mt-6 flex flex-wrap gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{course.duration ? `${Math.floor(course.duration / 60)} hours` : 'Self-paced'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  <span>{course.lessonCount} lessons</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span>English</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  <span>Certificate</span>
                </div>
              </div>
            </div>

            {/* Price Card */}
            <div className="lg:row-start-1 lg:col-start-3">
              <div className="overflow-hidden rounded-xl border border-border bg-card lg:sticky lg:top-24">
                <img
                  src={course.thumbnailUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=450&fit=crop'}
                  alt={course.title}
                  className="aspect-video w-full object-cover"
                />
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    {course.isFree || displayPrice === 0 ? (
                      <span className="font-display text-3xl font-bold text-accent">Free</span>
                    ) : (
                      <>
                        <span className="font-display text-3xl font-bold text-foreground">
                          ${displayPrice.toFixed(2)}
                        </span>
                        {hasDiscount && (
                          <span className="text-lg text-muted-foreground line-through">
                            ${course.price.toFixed(2)}
                          </span>
                        )}
                        {hasDiscount && (
                          <Badge variant="success">
                            {Math.round((1 - displayPrice / course.price) * 100)}% off
                          </Badge>
                        )}
                      </>
                    )}
                  </div>

                  {isEnrolled ? (
                    <Link to={`/player/${course.id}`}>
                      <Button size="lg" className="mt-6 w-full">
                        <Play className="mr-2 h-5 w-5" />
                        Continue Learning
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      size="lg"
                      className="mt-6 w-full"
                      onClick={handleEnroll}
                      disabled={isEnrolling}
                    >
                      {isEnrolling ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Processing...
                        </>
                      ) : course.isFree || displayPrice === 0 ? (
                        <>
                          <Play className="mr-2 h-5 w-5" />
                          Enroll Now - Free
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="mr-2 h-5 w-5" />
                          Buy Now
                        </>
                      )}
                    </Button>
                  )}

                  {!isEnrolled && (
                    <Button variant="outline" size="lg" className="mt-3 w-full">
                      Add to Wishlist
                    </Button>
                  )}

                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    30-Day Money-Back Guarantee
                  </p>

                  <div className="mt-6 space-y-3 border-t border-border pt-6">
                    <h4 className="font-semibold text-foreground">This course includes:</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <Play className="h-4 w-4 text-primary" />
                        {course.duration ? `${Math.floor(course.duration / 60)} hours` : 'Self-paced'} on-demand video
                      </li>
                      <li className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Downloadable resources
                      </li>
                      <li className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-primary" />
                        Full lifetime access
                      </li>
                      <li className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-primary" />
                        Certificate of completion
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Course Content */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-12 lg:grid-cols-3">
            <div className="space-y-12 lg:col-span-2">
              {/* What you'll learn */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="font-display text-2xl font-bold text-foreground">
                  What you'll learn
                </h2>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {whatYouLearn.map((item, index) => (
                    <div key={index} className="flex gap-3">
                      <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" />
                      <span className="text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Requirements */}
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground">
                  Requirements
                </h2>
                <ul className="mt-4 space-y-2">
                  {requirements.map((req, index) => (
                    <li key={index} className="flex items-start gap-2 text-muted-foreground">
                      <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Course Content */}
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    Course Content
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {sections.length} sections • {totalLessons} lessons
                  </span>
                </div>

                <Accordion type="multiple" className="space-y-4">
                  {sections.map((section, sectionIndex) => (
                    <AccordionItem
                      key={section.id}
                      value={section.id}
                      className="rounded-lg border border-border bg-card px-4"
                    >
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-semibold text-foreground">{section.title}</span>
                          <span className="text-sm text-muted-foreground">
                            {section.lessons.length} lessons
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2 pb-2">
                          {section.lessons.map((lesson) => (
                            <div
                              key={lesson.id}
                              className="flex flex-col gap-2 rounded-lg p-3 hover:bg-secondary/50 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                {!isEnrolled && !lesson.isFree ? (
                                  <Lock className="h-4 w-4 text-muted-foreground" />
                                ) : lesson.type === 'video' ? (
                                  <Play className="h-4 w-4 text-primary" />
                                ) : lesson.type === 'quiz' ? (
                                  <HelpCircle className="h-4 w-4 text-accent" />
                                ) : (
                                  <FileText className="h-4 w-4 text-primary" />
                                )}
                                <span className="text-foreground">
                                  {lesson.title}
                                </span>
                                {lesson.isFree && !isEnrolled && (
                                  <Badge variant="outline" className="text-xs">Preview</Badge>
                                )}
                              </div>
                              <span className="text-sm text-muted-foreground">
                                {lesson.duration ? `${lesson.duration} min` : lesson.type}
                              </span>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>

              {/* Instructor */}
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground">
                  Your Instructor
                </h2>
                <div className="mt-6 flex flex-col gap-6 sm:flex-row">
                  <img
                    src={course.instructor.avatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop'}
                    alt={`${course.instructor.firstName} ${course.instructor.lastName}`}
                    className="h-24 w-24 rounded-full object-cover"
                  />
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">
                      {course.instructor.firstName} {course.instructor.lastName}
                    </h3>
                    <p className="mt-1 text-primary">Course Instructor</p>
                    <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-accent" />
                        4.8 Rating
                      </span>
                      <span>{course.enrollmentCount.toLocaleString()} Students</span>
                    </div>
                    <p className="mt-4 text-muted-foreground">
                      Passionate educator committed to making complex topics accessible and engaging for all learners.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default CourseDetail;
