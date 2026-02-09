import { useParams, Link } from 'react-router-dom';
import { 
  Star, Clock, Users, Play, Award, Globe, 
  CheckCircle, ChevronDown, Lock, FileText, HelpCircle
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { courses, courseSections } from '@/data/mockData';

const CourseDetail = () => {
  const { id } = useParams();
  const course = courses.find((c) => c.id === id) || courses[0];

  const totalLessons = courseSections.reduce((acc, section) => acc + section.lessons.length, 0);
  const completedLessons = courseSections.reduce(
    (acc, section) => acc + section.lessons.filter((l) => l.isCompleted).length,
    0
  );

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

  return (
    <Layout>
      {/* Hero Section */}
      <section className="bg-card py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Course Info */}
            <div className="lg:col-span-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="accent">{course.category}</Badge>
                <Badge variant="secondary">{course.level}</Badge>
                {course.bestseller && <Badge>Bestseller</Badge>}
              </div>

              <h1 className="mt-4 font-display text-3xl font-bold text-foreground md:text-4xl">
                {course.title}
              </h1>

              <p className="mt-4 text-lg text-muted-foreground">{course.description}</p>

              {/* Rating & Stats */}
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Star className="h-5 w-5 fill-accent text-accent" />
                    <span className="font-semibold text-foreground">{course.rating}</span>
                  </div>
                  <span className="text-muted-foreground">
                    ({course.reviewCount.toLocaleString()} ratings)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-5 w-5" />
                  <span>{course.studentsCount.toLocaleString()} students</span>
                </div>
              </div>

              {/* Instructor */}
              <div className="mt-6 flex items-center gap-3">
                <img
                  src={course.instructorAvatar}
                  alt={course.instructor}
                  className="h-12 w-12 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm text-muted-foreground">Created by</p>
                  <p className="font-medium text-foreground">{course.instructor}</p>
                </div>
              </div>

              {/* Meta */}
              <div className="mt-6 flex flex-wrap gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{course.duration} total</span>
                </div>
                <div className="flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  <span>{course.lessonsCount} lessons</span>
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
              <div className="sticky top-24 overflow-hidden rounded-xl border border-border bg-card">
                <img
                  src={course.thumbnail}
                  alt={course.title}
                  className="aspect-video w-full object-cover"
                />
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <span className="font-display text-3xl font-bold text-foreground">
                      ${course.price}
                    </span>
                    {course.originalPrice && (
                      <span className="text-lg text-muted-foreground line-through">
                        ${course.originalPrice}
                      </span>
                    )}
                    {course.originalPrice && (
                      <Badge variant="success">
                        {Math.round((1 - course.price / course.originalPrice) * 100)}% off
                      </Badge>
                    )}
                  </div>

                  <Link to={`/player/${course.id}`}>
                    <Button size="lg" className="mt-6 w-full">
                      Enroll Now
                    </Button>
                  </Link>
                  <Button variant="outline" size="lg" className="mt-3 w-full">
                    Add to Wishlist
                  </Button>

                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    30-Day Money-Back Guarantee
                  </p>

                  <div className="mt-6 space-y-3 border-t border-border pt-6">
                    <h4 className="font-semibold text-foreground">This course includes:</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <Play className="h-4 w-4 text-primary" />
                        {course.duration} on-demand video
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
            <div className="lg:col-span-2 space-y-12">
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
                    {courseSections.length} sections • {totalLessons} lessons
                  </span>
                </div>

                <Accordion type="multiple" className="space-y-4">
                  {courseSections.map((section) => (
                    <AccordionItem
                      key={section.id}
                      value={section.id}
                      className="rounded-lg border border-border bg-card px-4"
                    >
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3">
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
                              className="flex items-center justify-between rounded-lg p-3 hover:bg-secondary/50"
                            >
                              <div className="flex items-center gap-3">
                                {lesson.isLocked ? (
                                  <Lock className="h-4 w-4 text-muted-foreground" />
                                ) : lesson.type === 'video' ? (
                                  <Play className="h-4 w-4 text-primary" />
                                ) : lesson.type === 'quiz' ? (
                                  <HelpCircle className="h-4 w-4 text-accent" />
                                ) : (
                                  <FileText className="h-4 w-4 text-primary" />
                                )}
                                <span className={lesson.isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'}>
                                  {lesson.title}
                                </span>
                              </div>
                              <span className="text-sm text-muted-foreground">{lesson.duration}</span>
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
                <div className="mt-6 flex gap-6">
                  <img
                    src={course.instructorAvatar}
                    alt={course.instructor}
                    className="h-24 w-24 rounded-full object-cover"
                  />
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">{course.instructor}</h3>
                    <p className="mt-1 text-primary">Senior Software Engineer</p>
                    <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-accent" />
                        4.8 Instructor Rating
                      </span>
                      <span>45 Courses</span>
                      <span>280K Students</span>
                    </div>
                    <p className="mt-4 text-muted-foreground">
                      Passionate educator with 10+ years of industry experience at top tech companies. 
                      Committed to making complex topics accessible and engaging for all learners.
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
