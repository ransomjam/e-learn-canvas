import { Link } from 'react-router-dom';
import { Star, Clock, Users, Play, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Course } from '@/services/courses.service';
import { resolveMediaUrl } from '@/lib/media';

interface CourseCardProps {
  course: Course;
}

const CourseCard = ({ course }: CourseCardProps) => {
  const thumbnail = resolveMediaUrl(course.thumbnailUrl);
  return (
    <Link to={`/course/${course.id}`} className="group">
      <div className="card-hover overflow-hidden rounded-xl border border-border bg-card">
        <div className="relative aspect-video overflow-hidden">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={course.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
              <BookOpen className="h-12 w-12 text-muted-foreground/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-glow">
              <Play className="h-6 w-6 text-primary-foreground" fill="currentColor" />
            </div>
          </div>
        </div>

        <div className="p-4">
          <h3 className="line-clamp-2 font-display text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
            {course.title}
          </h3>

          <p className="mt-2 text-sm text-muted-foreground">
            {course.instructor.firstName} {course.instructor.lastName}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-accent text-accent" />
              <span className="text-sm font-medium text-foreground">{course.ratingAvg?.toFixed(1) || '0.0'}</span>
            </div>
            <span className="text-sm text-muted-foreground">
              ({course.ratingCount?.toLocaleString() || '0'})
            </span>
          </div>

          <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{course.duration ? `${Math.floor(course.duration / 60)}h` : 'Self-paced'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{((course.enrollmentCount || 0) / 1000).toFixed(1)}k</span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            {course.isFree || course.price === 0 ? (
              <span className="font-display text-xl font-bold text-accent">Free</span>
            ) : (
              <>
                <span className="font-display text-xl font-bold text-foreground">
                  ${course.discountPrice || course.price}
                </span>
                {course.discountPrice && course.discountPrice < course.price && (
                  <span className="text-sm text-muted-foreground line-through">
                    ${course.price}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default CourseCard;
