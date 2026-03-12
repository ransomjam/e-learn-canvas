import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Star, Users, Play, Award, Globe,
  CheckCircle, Lock, FileText, HelpCircle, Loader2, ShoppingCart, BookOpen,
  Ticket, CreditCard, Heart, Phone, Smartphone, ArrowRight, CheckCircle2, XCircle, AlertCircle
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { coursesService, Course, Section } from '@/services/courses.service';
import { enrollmentsService } from '@/services/enrollments.service';
import { paymentsService } from '@/services/payments.service';
import { wishlistService } from '@/services/wishlist.service';
import { resolveMediaUrl } from '@/lib/media';
import { ReviewDialog } from '@/components/courses/ReviewDialog';

const CourseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [enrollMode, setEnrollMode] = useState<'choose' | 'code' | 'payment'>('choose');
  const [enrollmentCode, setEnrollmentCode] = useState('');
  const [isRedeemingCode, setIsRedeemingCode] = useState(false);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);

  // In-situ payment state
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentMedium, setPaymentMedium] = useState<'mobile money' | 'orange money'>('mobile money');
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'sent' | 'polling' | 'success' | 'failed'>('idle');
  const [paymentError, setPaymentError] = useState('');
  const [paymentTransactionId, setPaymentTransactionId] = useState('');
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef(0);

  // Fetch course
  const { data: course, isLoading: courseLoading, isError: courseError } = useQuery({
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

  // Check wishlist status
  useEffect(() => {
    const checkWishlist = async () => {
      if (!isAuthenticated) return;
      try {
        const wishlist = await wishlistService.getWishlist();
        const inWishlist = wishlist.some((w: any) => w.courseId === id);
        setIsInWishlist(inWishlist);
      } catch (error) {
        // Ignore errors
      }
    };
    checkWishlist();
  }, [id, isAuthenticated]);

  const totalLessons = sections.reduce((acc, section) => acc + section.lessons.length, 0);
  const isEnrolled = !!enrollment || !!course?.isEnrolled;

  const { data: userReview } = useQuery({
    queryKey: ['userReview', id],
    queryFn: () => coursesService.getUserReview(id!),
    enabled: !!id && isAuthenticated && isEnrolled,
  });

  const handleEnroll = async () => {
    if (!isAuthenticated) {
      navigate('/auth', { state: { from: { pathname: `/course/${id}` } } });
      return;
    }

    if (isEnrolled) {
      navigate(`/player/${id}`);
      return;
    }

    if (course?.isFree || course?.price === 0) {
      // Free course - enroll directly
      setIsEnrolling(true);
      try {
        await enrollmentsService.enrollInCourse(id!);
        toast({
          title: "Enrolled successfully!",
          description: "You can now access the course.",
        });
        queryClient.invalidateQueries({ queryKey: ['enrollment', id] });
        navigate(`/player/${id}`);
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || "Please try again.";
        if (errorMsg.toLowerCase().includes('already enrolled')) {
          queryClient.invalidateQueries({ queryKey: ['enrollment', id] });
          navigate(`/player/${id}`);
        } else {
          toast({
            title: "Enrollment failed",
            description: errorMsg,
            variant: "destructive",
          });
        }
      } finally {
        setIsEnrolling(false);
      }
    } else {
      // Paid course - show enrollment dialog with options
      setEnrollMode('choose');
      setEnrollmentCode('');
      setShowEnrollDialog(true);
    }
  };

  const handleRedeemCode = async () => {
    if (!enrollmentCode.trim()) {
      toast({
        title: "Enter a code",
        description: "Please enter your enrollment code.",
        variant: "destructive",
      });
      return;
    }

    setIsRedeemingCode(true);
    try {
      const result = await enrollmentsService.redeemEnrollmentCode(enrollmentCode.trim());
      toast({
        title: "Enrolled successfully!",
        description: `You now have access to ${result.courseTitle}.`,
      });
      setShowEnrollDialog(false);
      queryClient.invalidateQueries({ queryKey: ['enrollment', id] });
      navigate(`/player/${id}`);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || "Invalid or expired enrollment code.";
      toast({
        title: "Code redemption failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsRedeemingCode(false);
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const resetPaymentState = useCallback(() => {
    setPaymentPhone('');
    setPaymentMedium('mobile money');
    setIsPaymentProcessing(false);
    setPaymentStatus('idle');
    setPaymentError('');
    setPaymentTransactionId('');
    pollCountRef.current = 0;
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const pollPaymentStatus = useCallback((transactionId: string) => {
    setPaymentStatus('polling');
    pollCountRef.current = 0;

    pollIntervalRef.current = setInterval(async () => {
      pollCountRef.current += 1;

      // Stop after ~3 minutes (36 polls × 5 seconds)
      if (pollCountRef.current > 36) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setPaymentStatus('failed');
        setPaymentError('Payment verification timed out. If you have been charged, please contact support.');
        return;
      }

      try {
        const result = await paymentsService.checkFapshiPaymentStatus(transactionId);
        if (result.status === 'completed' || result.fapshiStatus === 'SUCCESSFUL') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setPaymentStatus('success');
          toast({
            title: "Payment successful! 🎉",
            description: "You are now enrolled in the course.",
          });
          queryClient.invalidateQueries({ queryKey: ['enrollment', id] });
          // Auto-navigate after a short delay so the user sees the success state
          setTimeout(() => {
            setShowEnrollDialog(false);
            navigate(`/player/${id}`);
          }, 2000);
        } else if (result.status === 'failed') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setPaymentStatus('failed');
          setPaymentError('Payment was declined or failed. Please try again.');
        }
      } catch (err) {
        // Don't stop polling on network errors, just continue
        console.warn('Payment status check failed, retrying...', err);
      }
    }, 5000);
  }, [id, queryClient, toast, navigate]);

  const handleDirectPayment = async () => {
    if (!paymentPhone.trim()) {
      setPaymentError('Please enter your phone number.');
      return;
    }

    // Basic validation for Cameroon phone numbers
    const cleanPhone = paymentPhone.replace(/\s+/g, '').replace(/^\+?237/, '');
    if (!/^6\d{8}$/.test(cleanPhone)) {
      setPaymentError('Invalid phone number. Use format: 6XXXXXXXX (9 digits)');
      return;
    }

    setPaymentError('');
    setIsPaymentProcessing(true);
    setPaymentStatus('sent');

    try {
      const result = await paymentsService.createFapshiDirectPayment(id!, cleanPhone, paymentMedium);
      setPaymentTransactionId(result.transactionId);
      // Start polling for payment confirmation
      pollPaymentStatus(result.transactionId);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Payment initiation failed. Please try again.';
      setPaymentError(errorMsg);
      setPaymentStatus('failed');
      setIsPaymentProcessing(false);
    }
  };

  const handleWishlist = async () => {
    if (!isAuthenticated) {
      navigate('/auth', { state: { from: { pathname: `/course/${id}` } } });
      return;
    }

    setWishlistLoading(true);
    try {
      if (isInWishlist) {
        await wishlistService.removeFromWishlist(id!);
        setIsInWishlist(false);
        toast({
          title: "Removed",
          description: "Course removed from your wishlist",
        });
      } else {
        await wishlistService.addToWishlist(id!);
        setIsInWishlist(true);
        toast({
          title: "Added",
          description: "Course added to your wishlist",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to update wishlist",
        variant: "destructive",
      });
    } finally {
      setWishlistLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this course? This action cannot be undone.')) {
      try {
        await coursesService.deleteCourse(id!);
        toast({
          title: "Course deleted",
          description: "The course has been successfully removed.",
        });
        navigate('/courses');
      } catch (error) {
        toast({
          title: "Error deleting course",
          description: "Failed to delete the course. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleEdit = () => {
    // Navigate to edit page (to be implemented)
    navigate(`/instructor/courses/${id}/edit`);
  };



  if (courseLoading) {
    return (
      <Layout>
        <div className="px-4 py-8 sm:py-12">
          <div className="container mx-auto">
            <Skeleton className="h-8 w-3/4 sm:h-10" />
            <Skeleton className="mt-3 h-5 w-1/2 sm:mt-4" />
            <Skeleton className="mt-6 h-48 w-full sm:mt-8 sm:h-64" />
          </div>
        </div>
      </Layout>
    );
  }

  if (courseError) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-12 sm:py-20 gap-4">
          <p className="text-muted-foreground">Failed to load course. Please check your connection.</p>
          <div className="flex gap-3">
            <Button onClick={() => window.location.reload()}>Reload</Button>
            <Link to="/courses"><Button variant="outline">Browse Courses</Button></Link>
          </div>
        </div>
      </Layout>
    );
  }

  if (!course) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-12 sm:py-20">
          <BookOpen className="h-12 w-12 text-muted-foreground sm:h-16 sm:w-16" />
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">Course not found</p>
          <Link to="/courses" className="w-full sm:w-auto mt-6">
            <Button className="w-full sm:w-auto h-11 font-semibold">Browse Courses</Button>
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
      <section className="bg-card py-10">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Course Info */}
            <div className="space-y-6 lg:col-span-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="accent">{course.category?.name || 'General'}</Badge>
                <Badge variant="secondary">{course.level.charAt(0).toUpperCase() + course.level.slice(1)}</Badge>
                {course.enrollmentCount > 1000 && <Badge>Bestseller</Badge>}
              </div>

              <h1 className="max-w-3xl text-balance font-display text-2xl font-semibold leading-tight text-foreground md:text-3xl">
                {course.title}
              </h1>

              <p className="max-w-3xl text-sm leading-7 text-justify text-muted-foreground md:text-base">
                {course.shortDescription || course.description}
              </p>

              {/* Rating & Stats */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-accent text-accent" />
                    <span className="font-semibold text-foreground">{course.ratingAvg.toFixed(1)}</span>
                  </div>
                  <span className="text-muted-foreground">
                    ({course.ratingCount.toLocaleString()} ratings)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{course.enrollmentCount.toLocaleString()} students</span>
                </div>
              </div>

              {/* Instructor */}
              <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/40 p-3">
                {course.instructor.avatarUrl ? (
                  <img
                    src={resolveMediaUrl(course.instructor.avatarUrl)}
                    alt={`${course.instructor.firstName} ${course.instructor.lastName}`}
                    className="h-12 w-12 rounded-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                  />
                ) : null}
                <div className={`h-12 w-12 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center flex-shrink-0 ${course.instructor.avatarUrl ? 'hidden' : ''}`}>
                  <span className="text-lg font-bold text-primary">
                    {course.instructor.firstName?.charAt(0)}{course.instructor.lastName?.charAt(0)}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm text-muted-foreground">Created by</p>
                  <p className="text-sm font-medium text-foreground md:text-base">
                    {course.instructor.firstName} {course.instructor.lastName}
                  </p>
                </div>
              </div>

              {isAuthenticated && (user?.role === 'admin' || user?.id === course?.instructor?.id) && (
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={handleEdit}>
                    Edit Course
                  </Button>
                  <Button variant="destructive" onClick={handleDelete}>
                    Delete Course
                  </Button>
                </div>
              )}
            </div>

            {/* Price Card */}
            <div className="lg:row-start-1 lg:col-start-3">
              <div className="overflow-hidden rounded-xl border border-border bg-card lg:sticky lg:top-24">
                {resolveMediaUrl(course.thumbnailUrl) ? (
                  <img
                    src={resolveMediaUrl(course.thumbnailUrl)}
                    alt={course.title}
                    className="aspect-video w-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                  />
                ) : null}
                <div className={`aspect-video w-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10 ${resolveMediaUrl(course.thumbnailUrl) ? 'hidden' : ''}`}>
                  <BookOpen className="h-12 w-12 text-muted-foreground/30" />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    {course.isFree || displayPrice === 0 ? (
                      <span className="font-display text-3xl font-bold text-accent">Free</span>
                    ) : (
                      <>
                        <span className="font-display text-2xl font-bold text-foreground md:text-3xl">
                          {displayPrice.toLocaleString()} CFA
                        </span>
                        {hasDiscount && (
                          <span className="text-lg text-muted-foreground line-through">
                            {course.price.toLocaleString()} CFA
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
                    <>
                      <Link to={`/player/${course.id}`}>
                        <Button size="lg" className="mt-6 w-full">
                          <Play className="mr-2 h-5 w-5" />
                          Continue Learning
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        className="mt-3 w-full"
                        onClick={() => setShowReviewDialog(true)}
                      >
                        <Star className={`mr-2 h-4 w-4 ${userReview?.rating ? 'fill-amber-400 text-amber-400' : ''}`} />
                        {userReview ? 'Edit Your Review' : 'Rate this Course'}
                      </Button>
                    </>
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
                          <BookOpen className="mr-2 h-5 w-5" />
                          Enroll Now
                        </>
                      )}
                    </Button>
                  )}

                  {!isEnrolled && (
                    <Button
                      variant="outline"
                      size="lg"
                      className="mt-3 w-full"
                      onClick={handleWishlist}
                      disabled={wishlistLoading}
                    >
                      <Heart className={`mr-2 h-5 w-5 ${isInWishlist ? 'fill-red-500 text-red-500' : ''}`} />
                      {isInWishlist ? 'Remove from Wishlist' : 'Add to Wishlist'}
                    </Button>
                  )}

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
      <section className="py-10">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-10 lg:col-span-2">
              {/* What you'll learn */}
              {course.objectives && course.objectives.length > 0 && (
                <div className="rounded-xl border border-border bg-card/80 p-5 md:p-6">
                  <h2 className="font-display text-xl font-semibold text-foreground md:text-2xl">
                    What you'll learn
                  </h2>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {course.objectives.map((item, index) => (
                      <div key={index} className="flex gap-3">
                        <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" />
                        <span className="text-sm leading-6 text-justify text-muted-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Requirements */}
              {course.requirements && course.requirements.length > 0 && (
                <div>
                  <h2 className="font-display text-xl font-semibold text-foreground md:text-2xl">
                    Requirements
                  </h2>
                  <ul className="mt-4 space-y-2.5">
                    {course.requirements.map((req, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm leading-6 text-justify text-muted-foreground">
                        <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Course Content */}
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="font-display text-xl font-semibold text-foreground md:text-2xl">
                    Course Content
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {sections.length} sections • {totalLessons} lessons
                  </span>
                </div>

                <Accordion type="multiple" className="space-y-3">
                  {sections.map((section, sectionIndex) => (
                    <AccordionItem
                      key={section.id}
                      value={section.id}
                      className="rounded-lg border border-border bg-card/80 px-4"
                    >
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm font-semibold text-foreground md:text-base">{section.title}</span>
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
                              <div className="flex min-w-0 items-center gap-4">
                                <div className="flex-shrink-0 w-20 h-12 bg-muted rounded-md overflow-hidden relative flex items-center justify-center border border-border/50">
                                  <img
                                    src={
                                      lesson.type === 'video' && lesson.videoUrl && lesson.videoUrl.includes('res.cloudinary.com')
                                        ? resolveMediaUrl(lesson.videoUrl).replace(/\.[^/.]+$/, ".jpg")
                                        : resolveMediaUrl(course.thumbnailUrl)
                                    }
                                    alt=""
                                    className="absolute inset-0 w-full h-full object-cover opacity-80"
                                  />
                                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                    {!isEnrolled && !lesson.isFree ? (
                                      <div className="bg-background/80 backdrop-blur-sm rounded-full p-1.5 shadow-sm">
                                        <Lock className="h-3 w-3 text-muted-foreground" />
                                      </div>
                                    ) : lesson.type === 'video' ? (
                                      <div className="bg-background/80 backdrop-blur-sm rounded-full p-1.5 shadow-sm">
                                        <Play className="h-3 w-3 text-primary ml-0.5" />
                                      </div>
                                    ) : lesson.type === 'quiz' ? (
                                      <div className="bg-background/80 backdrop-blur-sm rounded-full p-1.5 shadow-sm">
                                        <HelpCircle className="h-3 w-3 text-accent" />
                                      </div>
                                    ) : (
                                      <div className="bg-background/80 backdrop-blur-sm rounded-full p-1.5 shadow-sm">
                                        <FileText className="h-3 w-3 text-primary" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-foreground md:text-base line-clamp-2">
                                      {lesson.title}
                                    </span>
                                    {lesson.isFree && !isEnrolled && (
                                      <Badge variant="outline" className="text-[10px] h-5 px-1.5">Preview</Badge>
                                    )}
                                  </div>
                                </div>
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
                <h2 className="font-display text-xl font-semibold text-foreground md:text-2xl">
                  Your Instructor
                </h2>
                <div className="mt-6 flex flex-col gap-6 sm:flex-row">
                  {course.instructor.avatarUrl ? (
                    <img
                      src={resolveMediaUrl(course.instructor.avatarUrl)}
                      alt={`${course.instructor.firstName} ${course.instructor.lastName}`}
                      className="h-24 w-24 rounded-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                    />
                  ) : null}
                  <div className={`h-24 w-24 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center flex-shrink-0 ${course.instructor.avatarUrl ? 'hidden' : ''}`}>
                    <span className="text-3xl font-bold text-primary">
                      {course.instructor.firstName?.charAt(0)}{course.instructor.lastName?.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground md:text-xl">
                      {course.instructor.firstName} {course.instructor.lastName}
                    </h3>
                    <p className="mt-1 text-sm text-primary">Course Instructor</p>
                    <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-accent" />
                        4.8 Rating
                      </span>
                      <span>{course.enrollmentCount.toLocaleString()} Students</span>
                    </div>
                    {course.instructor.bio && (
                      <p className="mt-4 text-sm leading-7 text-justify text-muted-foreground">
                        {course.instructor.bio}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Enrollment Dialog */}
      <Dialog open={showEnrollDialog} onOpenChange={(open) => {
        if (!open) {
          resetPaymentState();
        }
        setShowEnrollDialog(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {enrollMode === 'choose' ? 'Enroll in Course' : enrollMode === 'code' ? 'Enter Enrollment Code' : 'Mobile Money Payment'}
            </DialogTitle>
            <DialogDescription>
              {enrollMode === 'choose'
                ? 'Choose how you would like to enroll in this course.'
                : enrollMode === 'code'
                  ? 'Enter the enrollment code provided by your administrator.'
                  : `Pay ${course ? `${(course.discountPrice || course.price).toLocaleString()} CFA` : ''} via mobile money.`}
            </DialogDescription>
          </DialogHeader>

          {enrollMode === 'choose' && (
            <div className="space-y-3 pt-2">
              <Button
                variant="outline"
                size="lg"
                className="w-full justify-start gap-3 h-16"
                onClick={() => setEnrollMode('code')}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Ticket className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-semibold">Enrollment Code</p>
                  <p className="text-xs text-muted-foreground">I have a code from my organization</p>
                </div>
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="w-full justify-start gap-3 h-16"
                onClick={() => {
                  resetPaymentState();
                  setEnrollMode('payment');
                }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                  <CreditCard className="h-5 w-5 text-accent" />
                </div>
                <div className="text-left">
                  <p className="font-semibold">Pay Now</p>
                  <p className="text-xs text-muted-foreground">
                    {`Pay ${course ? (course.discountPrice || course.price).toLocaleString() + ' CFA' : ''} with mobile money (MTN/Orange)`}
                  </p>
                </div>
              </Button>
            </div>
          )}

          {enrollMode === 'code' && (
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Enrollment Code</label>
                <Input
                  placeholder="e.g. ENR-ABCD-1234"
                  value={enrollmentCode}
                  onChange={(e) => setEnrollmentCode(e.target.value.toUpperCase())}
                  className="font-mono text-center text-lg tracking-wider"
                  onKeyDown={(e) => e.key === 'Enter' && handleRedeemCode()}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEnrollMode('choose')}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleRedeemCode}
                  disabled={isRedeemingCode || !enrollmentCode.trim()}
                >
                  {isRedeemingCode ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Redeem Code'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* In-situ mobile money payment */}
          {enrollMode === 'payment' && (
            <div className="space-y-5 pt-2">
              {/* Payment amount summary */}
              <div className="rounded-lg bg-accent/5 border border-accent/20 p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Amount to pay</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {course ? (course.discountPrice || course.price).toLocaleString() : '—'}
                  <span className="text-sm font-normal text-muted-foreground ml-1">CFA</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">{course?.title}</p>
              </div>

              {/* Idle / input state */}
              {(paymentStatus === 'idle' || paymentStatus === 'failed') && (
                <>
                  {/* Payment medium selector */}
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">Payment Method</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left transition-all ${
                          paymentMedium === 'mobile money'
                            ? 'border-[#FFCC00] bg-[#FFCC00]/10 shadow-sm'
                            : 'border-border hover:border-border/80 hover:bg-secondary/30'
                        }`}
                        onClick={() => setPaymentMedium('mobile money')}
                      >
                        <div className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold ${
                          paymentMedium === 'mobile money' ? 'bg-[#FFCC00] text-black' : 'bg-muted text-muted-foreground'
                        }`}>MTN</div>
                        <div>
                          <p className="text-sm font-medium">MTN MoMo</p>
                          <p className="text-[10px] text-muted-foreground">Mobile Money</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left transition-all ${
                          paymentMedium === 'orange money'
                            ? 'border-[#FF6600] bg-[#FF6600]/10 shadow-sm'
                            : 'border-border hover:border-border/80 hover:bg-secondary/30'
                        }`}
                        onClick={() => setPaymentMedium('orange money')}
                      >
                        <div className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold ${
                          paymentMedium === 'orange money' ? 'bg-[#FF6600] text-white' : 'bg-muted text-muted-foreground'
                        }`}>OM</div>
                        <div>
                          <p className="text-sm font-medium">Orange</p>
                          <p className="text-[10px] text-muted-foreground">Orange Money</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Phone number input */}
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">
                      <Phone className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                      Phone Number
                    </label>
                    <Input
                      type="tel"
                      placeholder="e.g. 6XXXXXXXX"
                      value={paymentPhone}
                      onChange={(e) => {
                        setPaymentPhone(e.target.value);
                        setPaymentError('');
                      }}
                      className="text-center text-lg tracking-wider font-mono"
                      onKeyDown={(e) => e.key === 'Enter' && handleDirectPayment()}
                      maxLength={13}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1.5">Enter your {paymentMedium === 'mobile money' ? 'MTN' : 'Orange'} mobile money number</p>
                  </div>

                  {/* Error message */}
                  {paymentError && (
                    <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-destructive">{paymentError}</p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        resetPaymentState();
                        setEnrollMode('choose');
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleDirectPayment}
                      disabled={isPaymentProcessing || !paymentPhone.trim()}
                    >
                      {isPaymentProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Smartphone className="mr-2 h-4 w-4" />
                          Pay Now
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}

              {/* Polling / waiting state */}
              {(paymentStatus === 'sent' || paymentStatus === 'polling') && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="relative">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Smartphone className="h-8 w-8 text-primary" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-accent flex items-center justify-center">
                      <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="font-semibold text-foreground">Check your phone</p>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      A payment prompt has been sent to your {paymentMedium === 'mobile money' ? 'MTN' : 'Orange'} number.
                      Please confirm the payment on your device.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Waiting for confirmation...</span>
                  </div>
                </div>
              )}

              {/* Success state */}
              {paymentStatus === 'success' && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="font-semibold text-foreground">Payment Successful! 🎉</p>
                    <p className="text-sm text-muted-foreground">
                      You are now enrolled. Redirecting to your course...
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ReviewDialog
        open={showReviewDialog}
        onOpenChange={setShowReviewDialog}
        courseId={id!}
        initialReview={userReview}
      />
    </Layout >
  );
};

export default CourseDetail;
