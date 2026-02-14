import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen, Clock, Award, Flame, Play,
  TrendingUp, Calendar, Loader2
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { enrollmentsService, Enrollment } from '@/services/enrollments.service';
import { resolveMediaUrl } from '@/lib/media';

const Dashboard = () => {
  const { user } = useAuth();

  // Fetch enrollments
  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ['enrollments'],
    queryFn: () => enrollmentsService.getMyEnrollments('active'),
  });

  // Fetch learning stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['learningStats'],
    queryFn: () => enrollmentsService.getLearningStats(),
  });

  const isLoading = enrollmentsLoading || statsLoading;

  const statCards = [
    { icon: BookOpen, value: stats?.totalEnrollments || 0, label: 'Enrolled Courses', color: 'text-primary' },
    { icon: Clock, value: `${stats?.totalLessonsCompleted || 0}`, label: 'Lessons Completed', color: 'text-emerald-400' },
  ];

  return (
    <Layout>
      <div className="py-8 sm:py-12">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-4 sm:mb-6">
            <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
              Welcome back, {user?.firstName}!
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              {(stats?.currentStreak || 0) > 0
                ? `You're on a ${stats?.currentStreak} day learning streak. Keep it up!`
                : 'Start learning today to build your streak!'}
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="mb-6 grid grid-cols-2 gap-2 sm:mb-8 sm:gap-2.5 lg:grid-cols-2 lg:gap-3">
                {statCards.map((stat, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-border bg-card p-2 transition-all hover:border-primary/50 sm:rounded-lg sm:p-2.5 lg:p-3"
                  >
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-secondary sm:h-7 sm:w-7 lg:h-8 lg:w-8 ${stat.color}`}>
                      <stat.icon className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                    </div>
                    <p className="mt-1 font-display text-sm font-bold text-foreground sm:text-base lg:mt-1.5 lg:text-lg">{stat.value}</p>
                    <p className="hidden text-xs text-muted-foreground sm:block">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 sm:gap-5">
                {/* Continue Learning */}
                <div>
                  <div className="mb-3 flex flex-col gap-1 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="font-display text-xl font-bold text-foreground sm:text-2xl">
                      Continue Learning
                    </h2>
                    <Link to="/courses" className="text-xs text-primary hover:underline sm:text-sm">
                      View all courses
                    </Link>
                  </div>

                  {enrollments && enrollments.length > 0 ? (
                    <div className="space-y-3 sm:space-y-4">
                      {enrollments.map((enrollment: Enrollment) => (
                        <Link
                          key={enrollment.id}
                          to={`/player/${enrollment.courseId}`}
                          className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/50 sm:rounded-lg sm:gap-4 sm:p-4 md:flex-row"
                        >
                          <img
                            src={resolveMediaUrl(enrollment.course.thumbnailUrl) || ''}
                            alt={enrollment.course.title}
                            className="h-32 w-full flex-shrink-0 rounded-lg object-cover sm:h-28 sm:w-48"
                          />
                          <div className="flex flex-1 flex-col justify-between">
                            <div>
                              <h3 className="text-base font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors sm:text-lg">
                                {enrollment.course.title}
                              </h3>
                              <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
                                {enrollment.course.instructor.firstName} {enrollment.course.instructor.lastName}
                              </p>
                            </div>
                            <div>
                              <div className="flex items-center justify-between text-sm sm:text-base">
                                <span className="text-muted-foreground">{enrollment.progressPercentage}% complete</span>
                                <span className="text-muted-foreground">
                                  {new Date(enrollment.enrolledAt).toLocaleDateString()}
                                </span>
                              </div>
                              <Progress value={enrollment.progressPercentage} className="mt-2 h-2.5" />
                            </div>
                          </div>
                          <div className="flex items-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary opacity-0 transition-opacity group-hover:opacity-100">
                              <Play className="h-6 w-6 text-primary-foreground" fill="currentColor" />
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border bg-card/50 p-4 text-center sm:rounded-lg sm:p-6">
                      <BookOpen className="mx-auto h-9 w-9 text-muted-foreground sm:h-10 sm:w-10" />
                      <h3 className="mt-2 font-semibold text-foreground sm:mt-3">No courses yet</h3>
                      <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                        Start your learning journey by enrolling in a course.
                      </p>
                      <Link to="/courses" className="block">
                        <Button size="sm" className="mt-2 w-full sm:w-auto sm:mt-3">Browse Courses</Button>
                      </Link>
                    </div>
                  )}
                </div>

                {/* Sidebar */}
                <div className="grid gap-4 sm:gap-5 grid-cols-2 lg:grid-cols-1 lg:space-y-4">
                  {/* Weekly Goal */}
                  <div className="rounded-lg border border-border bg-card p-3 sm:rounded-lg sm:p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-foreground sm:text-sm">Weekly Goal</h3>
                      <TrendingUp className="h-4 w-4 text-accent sm:h-4 sm:w-4" />
                    </div>
                    <div className="mt-2 sm:mt-3">
                      <div className="flex items-end justify-between">
                        <span className="font-display text-xl font-bold text-foreground sm:text-2xl">
                          {stats?.totalLessonsCompleted || 0}
                        </span>
                        <span className="text-xs text-muted-foreground sm:text-xs">/ 10 lessons</span>
                      </div>
                      <Progress value={Math.min((stats?.totalLessonsCompleted || 0) * 10, 100)} className="mt-1.5 h-2 sm:mt-2" />
                      <p className="mt-1.5 text-xs text-muted-foreground sm:text-xs">
                        {(stats?.totalLessonsCompleted || 0) >= 10
                          ? "Goal achieved! Great work!"
                          : `${10 - (stats?.totalLessonsCompleted || 0)} more lessons to hit your goal.`}
                      </p>
                    </div>
                  </div>

                  {/* Upcoming */}
                  <div className="rounded-lg border border-border bg-card p-3 sm:rounded-lg sm:p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-foreground sm:text-sm">Upcoming</h3>
                      <Calendar className="h-4 w-4 text-primary sm:h-4 sm:w-4" />
                    </div>
                    <div className="mt-2 space-y-2 sm:mt-3 sm:space-y-2.5">
                      <div className="flex gap-2">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:h-8 sm:w-8">
                          <Play className="h-4 w-4 text-primary sm:h-4 sm:w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-foreground sm:text-xs">Continue Learning</p>
                          <p className="text-xs text-muted-foreground sm:text-xs">Pick up where you left off</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent/10 sm:h-8 sm:w-8">
                          <Award className="h-4 w-4 text-accent sm:h-4 sm:w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-foreground sm:text-xs">Complete a Course</p>
                          <p className="text-xs text-muted-foreground sm:text-xs">Earn your certificate</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Achievements */}
                  <div className="rounded-lg border border-border bg-card p-3 sm:rounded-lg sm:p-4">
                    <h3 className="text-xs font-semibold text-foreground sm:text-sm">Achievements</h3>
                    <div className="mt-2 flex gap-2 sm:mt-3">
                      {(stats?.currentStreak || 0) >= 7 && (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500">
                          <Flame className="h-6 w-6 text-background" />
                        </div>
                      )}
                      {(stats?.certificates || 0) > 0 && (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent">
                          <Award className="h-6 w-6 text-background" />
                        </div>
                      )}
                      {(stats?.completedCourses || 0) > 0 && (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500">
                          <BookOpen className="h-6 w-6 text-background" />
                        </div>
                      )}
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-border">
                        <span className="text-xl text-muted-foreground">+</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
