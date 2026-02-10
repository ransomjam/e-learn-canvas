import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen, Clock, Award, Flame, Play,
  TrendingUp, Calendar, ChevronRight, Settings, LogOut, Loader2
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { enrollmentsService, Enrollment } from '@/services/enrollments.service';
import { resolveMediaUrl } from '@/lib/media';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isLoading = enrollmentsLoading || statsLoading;

  const statCards = [
    { icon: BookOpen, value: stats?.totalEnrollments || 0, label: 'Enrolled Courses', color: 'text-primary' },
    { icon: Award, value: stats?.certificates || 0, label: 'Certificates', color: 'text-accent' },
    { icon: Clock, value: `${stats?.totalLessonsCompleted || 0}`, label: 'Lessons Completed', color: 'text-emerald-400' },
    { icon: Flame, value: stats?.currentStreak || 0, label: 'Day Streak', color: 'text-orange-400' },
  ];

  return (
    <Layout>
      <div className="py-12">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground">
                Welcome back, {user?.firstName}! 👋
              </h1>
              <p className="mt-1 text-muted-foreground">
                {(stats?.currentStreak || 0) > 0
                  ? `You're on a ${stats?.currentStreak} day learning streak. Keep it up!`
                  : 'Start learning today to build your streak!'}
              </p>
            </div>
            <div className="flex gap-3">
              <Link to="/profile">
                <Button variant="outline" size="sm">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                {statCards.map((stat, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/50 lg:p-5"
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-secondary lg:h-10 lg:w-10 ${stat.color}`}>
                      <stat.icon className="h-4 w-4 lg:h-5 lg:w-5" />
                    </div>
                    <p className="mt-2 font-display text-xl font-bold text-foreground lg:mt-3 lg:text-2xl">{stat.value}</p>
                    <p className="text-xs text-muted-foreground lg:text-sm">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-8 lg:grid-cols-3">
                {/* Continue Learning */}
                <div className="lg:col-span-2">
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="font-display text-2xl font-bold text-foreground">
                      Continue Learning
                    </h2>
                    <Link to="/courses" className="text-sm text-primary hover:underline">
                      View all courses
                    </Link>
                  </div>

                  {enrollments && enrollments.length > 0 ? (
                    <div className="space-y-4">
                      {enrollments.map((enrollment: Enrollment) => (
                        <Link
                          key={enrollment.id}
                          to={`/player/${enrollment.courseId}`}
                          className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 sm:flex-row"
                        >
                          <img
                            src={resolveMediaUrl(enrollment.course.thumbnailUrl) || ''}
                            alt={enrollment.course.title}
                            className="h-40 w-full flex-shrink-0 rounded-lg object-cover sm:h-24 sm:w-40"
                          />
                          <div className="flex flex-1 flex-col justify-between">
                            <div>
                              <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                                {enrollment.course.title}
                              </h3>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {enrollment.course.instructor.firstName} {enrollment.course.instructor.lastName}
                              </p>
                            </div>
                            <div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{enrollment.progressPercentage}% complete</span>
                                <span className="text-muted-foreground">
                                  {new Date(enrollment.enrolledAt).toLocaleDateString()}
                                </span>
                              </div>
                              <Progress value={enrollment.progressPercentage} className="mt-2 h-2" />
                            </div>
                          </div>
                          <div className="flex items-center">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary opacity-0 transition-opacity group-hover:opacity-100">
                              <Play className="h-5 w-5 text-primary-foreground" fill="currentColor" />
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
                      <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-4 font-semibold text-foreground">No courses yet</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Start your learning journey by enrolling in a course.
                      </p>
                      <Link to="/courses">
                        <Button className="mt-4">Browse Courses</Button>
                      </Link>
                    </div>
                  )}

                  <Link to="/courses">
                    <Button variant="outline" className="mt-6 w-full">
                      Browse More Courses
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                  {/* Weekly Goal */}
                  <div className="rounded-xl border border-border bg-card p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-foreground">Weekly Goal</h3>
                      <TrendingUp className="h-5 w-5 text-accent" />
                    </div>
                    <div className="mt-4">
                      <div className="flex items-end justify-between">
                        <span className="font-display text-3xl font-bold text-foreground">
                          {stats?.totalLessonsCompleted || 0}
                        </span>
                        <span className="text-sm text-muted-foreground">/ 10 lessons</span>
                      </div>
                      <Progress value={Math.min((stats?.totalLessonsCompleted || 0) * 10, 100)} className="mt-3 h-3" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        {(stats?.totalLessonsCompleted || 0) >= 10
                          ? "🎉 Goal achieved! Great work!"
                          : `${10 - (stats?.totalLessonsCompleted || 0)} more lessons to hit your goal.`}
                      </p>
                    </div>
                  </div>

                  {/* Upcoming */}
                  <div className="rounded-xl border border-border bg-card p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-foreground">Upcoming</h3>
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div className="mt-4 space-y-4">
                      <div className="flex gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Play className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Continue Learning</p>
                          <p className="text-sm text-muted-foreground">Pick up where you left off</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-accent/10">
                          <Award className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Complete a Course</p>
                          <p className="text-sm text-muted-foreground">Earn your certificate</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Achievements */}
                  <div className="rounded-xl border border-border bg-card p-6">
                    <h3 className="font-semibold text-foreground">Achievements</h3>
                    <div className="mt-4 flex gap-3">
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
