import { Link } from 'react-router-dom';
import { Star, Clock, Users, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Course } from '@/data/mockData';

interface CourseCardProps {
  course: Course;
}

const CourseCard = ({ course }: CourseCardProps) => {
  return (
    <Link to={`/course/${course.id}`} className="group">
      <div className="card-hover overflow-hidden rounded-xl border border-border bg-card">
        {/* Thumbnail */}
        <div className="relative aspect-video overflow-hidden">
          <img
            src={course.thumbnail}
            alt={course.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-glow">
              <Play className="h-6 w-6 text-primary-foreground" fill="currentColor" />
            </div>
          </div>
          {course.bestseller && (
            <Badge className="absolute left-3 top-3 bg-accent text-accent-foreground">
              Bestseller
            </Badge>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="line-clamp-2 font-display text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
            {course.title}
          </h3>

          <p className="mt-2 text-sm text-muted-foreground">{course.instructor}</p>

          {/* Rating */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-accent text-accent" />
              <span className="text-sm font-medium text-foreground">{course.rating}</span>
            </div>
            <span className="text-sm text-muted-foreground">
              ({course.reviewCount.toLocaleString()})
            </span>
          </div>

          {/* Meta */}
          <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{course.duration}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{(course.studentsCount / 1000).toFixed(1)}k</span>
            </div>
          </div>

          {/* Price */}
          <div className="mt-4 flex items-center gap-2">
            <span className="font-display text-xl font-bold text-foreground">
              ${course.price}
            </span>
            {course.originalPrice && (
              <span className="text-sm text-muted-foreground line-through">
                ${course.originalPrice}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default CourseCard;
