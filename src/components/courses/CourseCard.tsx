import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Users, BookOpen, ThumbsUp } from 'lucide-react';
import { Course } from '@/services/courses.service';
import { resolveMediaUrl } from '@/lib/media';

interface CourseCardProps {
  course: Course;
}

const CourseCard = ({ course }: CourseCardProps) => {
  const [imageError, setImageError] = useState(false);
  const thumbnail = resolveMediaUrl(course.thumbnailUrl);
  const displayPrice = course.discountPrice || course.price;
  const hasDiscount = course.discountPrice && course.discountPrice < course.price;

  return (
    <Link to={`/course/${course.id}`} className="group block">
      <div className="overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
        {/* Thumbnail */}
        <div className="relative aspect-video overflow-hidden bg-secondary">
          {thumbnail && !imageError ? (
            <img
              src={thumbnail}
              alt={course.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
              <BookOpen className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}
          {/* Likes badge */}
          {(course.likesCount ?? 0) > 0 && (
            <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-black/50 backdrop-blur-sm px-2 py-0.5">
              <ThumbsUp className="h-3 w-3 fill-blue-400 text-blue-400" />
              <span className="text-[10px] font-medium text-white">{course.likesCount}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <h3 className="line-clamp-2 text-sm font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
            {course.title}
          </h3>

          <p className="text-xs text-muted-foreground">
            {course.instructor.firstName} {course.instructor.lastName}
          </p>

          {/* Rating + students + likes row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-accent text-accent" />
              <span className="font-medium text-foreground">{course.ratingAvg?.toFixed(1) || '0.0'}</span>
              <span>({course.ratingCount?.toLocaleString() || '0'})</span>
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {(course.enrollmentCount || 0).toLocaleString()}
            </span>
            {(course.likesCount ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <ThumbsUp className="h-3.5 w-3.5 fill-blue-400 text-blue-400" />
                {course.likesCount}
              </span>
            )}
          </div>

          {/* Price */}
          <div className="flex items-center gap-2 pt-1 border-t border-border">
            {course.isFree || course.price === 0 ? (
              <span className="text-sm font-bold text-accent">Free</span>
            ) : (
              <>
                <span className="text-sm font-bold text-foreground">CFA {displayPrice}</span>
                {hasDiscount && (
                  <span className="text-xs text-muted-foreground line-through">CFA {course.price}</span>
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
