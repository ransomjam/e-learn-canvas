import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('created_at');
  const [page, setPage] = useState(1);

  // Sync search query from URL params (e.g. when navigating from navbar search)
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    if (urlSearch && urlSearch !== searchQuery) {
      setSearchQuery(urlSearch);
      setPage(1);
    }
  }, [searchParams]);

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

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedLevel(null);
    setPage(1);
  };

  return (
    <Layout>
      <div className="py-8 sm:py-12">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl md:text-4xl">
              Explore Courses
            </h1>
            <p className="mt-1 text-sm text-muted-foreground sm:mt-2 sm:text-base">
              Discover {pagination?.total || 0}+ courses to boost your skills
            </p>
          </div>

          {/* Search & Filters */}
          <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Search */}
            <div className="relative w-full flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search courses or instructors..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-10 text-sm"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 sm:gap-3 flex-nowrap">
              {/* Category Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 justify-between sm:flex-none sm:w-auto">
                    <Filter className="mr-1 h-4 w-4 sm:mr-2 flex-shrink-0" />
                    <span className="truncate text-xs sm:text-sm">{selectedCategory || 'Category'}</span>
                    <ChevronDown className="ml-1 h-4 w-4 flex-shrink-0 sm:ml-2" />
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
                  <Button variant="outline" size="sm" className="flex-1 justify-between sm:flex-none sm:w-auto">
                    <span className="truncate text-xs sm:text-sm">Sort</span>
                    <ChevronDown className="ml-1 h-4 w-4 flex-shrink-0 sm:ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortBy('enrollment_count')}>Most Popular</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('rating_avg')}>Highest Rated</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('created_at')}>Newest</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('price')}>Price: Low to High</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setSortBy('price'); /* Add sortOrder state for desc */ }}>Price: High to Low</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Level Filters */}
          <div className="mb-6 flex flex-wrap gap-2 sm:mb-8">
            <Badge
              variant={selectedLevel === null ? 'default' : 'outline'}
              className="cursor-pointer px-3 py-1 text-xs sm:px-4 sm:py-2 sm:text-sm"
              onClick={() => { setSelectedLevel(null); setPage(1); }}
            >
              All Levels
            </Badge>
            {levels.map((level) => (
              <Badge
                key={level}
                variant={selectedLevel === level ? 'default' : 'outline'}
                className="cursor-pointer px-3 py-1 text-xs sm:px-4 sm:py-2 sm:text-sm"
                onClick={() => { setSelectedLevel(level); setPage(1); }}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </Badge>
            ))}
          </div>

          {/* Results Count */}
          <p className="mb-4 text-xs text-muted-foreground sm:mb-6 sm:text-sm">
            Showing {courses.length} of {pagination?.total || 0} courses
          </p>

          {/* Loading State */}
          {isLoading ? (
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
              <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {courses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:mt-8 sm:flex-row sm:gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground sm:text-sm">
                    Page {page} of {pagination.pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center sm:py-20">
              <p className="text-sm text-muted-foreground sm:text-lg">No courses found matching your criteria.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 sm:mt-4"
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
