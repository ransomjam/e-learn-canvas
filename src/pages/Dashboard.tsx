import { Link } from 'react-router-dom';
import { 
  BookOpen, Clock, Award, Flame, Play, 
  TrendingUp, Calendar, ChevronRight, Settings, LogOut
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { userProgress } from '@/data/mockData';

const Dashboard = () => {
  const stats = [
    { icon: BookOpen, value: userProgress.enrolledCourses.length, label: 'Enrolled Courses', color: 'text-primary' },
    { icon: Award, value: userProgress.certificates, label: 'Certificates', color: 'text-accent' },
    { icon: Clock, value: `${userProgress.hoursLearned}h`, label: 'Hours Learned', color: 'text-emerald-400' },
    { icon: Flame, value: userProgress.currentStreak, label: 'Day Streak', color: 'text-orange-400' },
  ];

  return (
    <Layout>
      <div className="py-12">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground">
                Welcome back, Alex! 👋
              </h1>
              <p className="mt-1 text-muted-foreground">
                You're on a {userProgress.currentStreak} day learning streak. Keep it up!
              </p>
            </div>
            <div className="flex gap-3">
              <Link to="/profile">
                <Button variant="outline" size="sm">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Button>
              </Link>
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, index) => (
              <div
                key={index}
                className="rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-secondary ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <p className="mt-4 font-display text-3xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
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

              <div className="space-y-4">
                {userProgress.enrolledCourses.map((course) => (
                  <Link
                    key={course.id}
                    to={`/player/${course.id}`}
                    className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 sm:flex-row"
                  >
                    <img
                      src={course.thumbnail}
                      alt={course.title}
                      className="h-40 w-full flex-shrink-0 rounded-lg object-cover sm:h-24 sm:w-40"
                    />
                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {course.title}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">{course.instructor}</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{course.progress}% complete</span>
                          <span className="text-muted-foreground">{course.lastAccessed}</span>
                        </div>
                        <Progress value={course.progress} className="mt-2 h-2" />
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
                    <span className="font-display text-3xl font-bold text-foreground">8.5</span>
                    <span className="text-sm text-muted-foreground">/ 10 hours</span>
                  </div>
                  <Progress value={85} className="mt-3 h-3" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Great progress! 1.5 more hours to hit your goal.
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
                      <p className="font-medium text-foreground">Live Q&A Session</p>
                      <p className="text-sm text-muted-foreground">Tomorrow, 3:00 PM</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-accent/10">
                      <Award className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Project Deadline</p>
                      <p className="text-sm text-muted-foreground">Friday, 11:59 PM</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Achievements */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-semibold text-foreground">Recent Achievements</h3>
                <div className="mt-4 flex gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500">
                    <Flame className="h-6 w-6 text-background" />
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent">
                    <Award className="h-6 w-6 text-background" />
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500">
                    <BookOpen className="h-6 w-6 text-background" />
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-border">
                    <span className="text-xl text-muted-foreground">+5</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
