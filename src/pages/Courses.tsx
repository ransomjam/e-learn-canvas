import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, ChevronDown, Loader2 } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import CourseCard from '@/components/courses/CourseCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { coursesService, Course } from '@/services/courses.service';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Courses = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('popular');
  const [page, setPage] = useState(1);

  const levels = ['beginner', 'intermediate', 'advanced'];

  // Fetch courses
  const { data: coursesData, isLoading } = useQuery({
    queryKey: ['courses', { page, search: searchQuery, category: selectedCategory, level: selectedLevel, sortBy }],
    queryFn: () => coursesService.getCourses({
      page,
      limit: 12,
      search: searchQuery || undefined,
      category: selectedCategory || undefined,
      level: selectedLevel || undefined,
      sortBy,
    }),
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => coursesService.getCategories(),
  });

  const courses = coursesData?.data || [];
  const pagination = coursesData?.pagination;

  // Map API course to CourseCard format
  const mapCourse = (course: Course) => ({
    id: course.id,
    title: course.title,
    instructor: `${course.instructor.firstName} ${course.instructor.lastName}`,
    instructorAvatar: course.instructor.avatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
    thumbnail: course.thumbnailUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=450&fit=crop',
    rating: course.ratingAvg,
    reviewCount: course.ratingCount,
    price: course.discountPrice || course.price,
    originalPrice: course.discountPrice ? course.price : undefined,
    category: course.category?.name || 'General',
    level: (course.level.charAt(0).toUpperCase() + course.level.slice(1)) as 'Beginner' | 'Intermediate' | 'Advanced',
    duration: course.duration ? `${Math.floor(course.duration / 60)} hours` : 'Self-paced',
    lessonsCount: course.lessonCount,
    studentsCount: course.enrollmentCount,
    description: course.shortDescription || '',
    bestseller: course.enrollmentCount > 1000,
    featured: course.ratingAvg >= 4.5,
  });

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedLevel(null);
    setPage(1);
  };

  return (
    <Layout>
      <div className="py-12">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">
              Explore Courses
            </h1>
            <p className="mt-2 text-muted-foreground">
              Discover {pagination?.total || 0}+ courses to boost your skills
            </p>
          </div>

          {/* Search & Filters */}
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Search */}
            <div className="relative w-full max-w-none flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search courses or instructors..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Category Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full min-w-[140px] justify-between sm:w-auto">
                    <Filter className="mr-2 h-4 w-4" />
                    {selectedCategory || 'Category'}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => { setSelectedCategory(''); setPage(1); }}
                    className={!selectedCategory ? 'bg-secondary' : ''}
                  >
                    All Categories
                  </DropdownMenuItem>
                  {categories?.map((category) => (
                    <DropdownMenuItem
                      key={category.id}
                      onClick={() => { setSelectedCategory(category.name); setPage(1); }}
                      className={selectedCategory === category.name ? 'bg-secondary' : ''}
                    >
                      {category.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Sort */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between sm:w-auto">
                    Sort by
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortBy('popular')}>Most Popular</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('rating')}>Highest Rated</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('newest')}>Newest</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('price-low')}>Price: Low to High</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('price-high')}>Price: High to Low</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Level Filters */}
          <div className="mb-8 flex flex-wrap gap-2">
            <Badge
              variant={selectedLevel === null ? 'default' : 'outline'}
              className="cursor-pointer px-4 py-2"
              onClick={() => { setSelectedLevel(null); setPage(1); }}
            >
              All Levels
            </Badge>
            {levels.map((level) => (
              <Badge
                key={level}
                variant={selectedLevel === level ? 'default' : 'outline'}
                className="cursor-pointer px-4 py-2"
                onClick={() => { setSelectedLevel(level); setPage(1); }}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </Badge>
            ))}
          </div>

          {/* Results Count */}
          <p className="mb-6 text-sm text-muted-foreground">
            Showing {courses.length} of {pagination?.total || 0} courses
          </p>

          {/* Loading State */}
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4">
                  <Skeleton className="h-40 w-full rounded-lg" />
                  <Skeleton className="mt-4 h-4 w-3/4" />
                  <Skeleton className="mt-2 h-4 w-1/2" />
                  <Skeleton className="mt-4 h-8 w-full" />
                </div>
              ))}
            </div>
          ) : courses.length > 0 ? (
            <>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {courses.map((course) => (
                  <CourseCard key={course.id} course={mapCourse(course)} />
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="mt-8 flex justify-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-4 text-sm text-muted-foreground">
                    Page {page} of {pagination.pages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="py-20 text-center">
              <p className="text-lg text-muted-foreground">No courses found matching your criteria.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Courses;
