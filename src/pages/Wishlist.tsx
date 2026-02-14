import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Heart, Trash2, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { wishlistService } from '@/services/wishlist.service';

const Wishlist = () => {
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchWishlist();
  }, []);

  const fetchWishlist = async () => {
    try {
      const data = await wishlistService.getWishlist();
      setWishlist(data);
    } catch (error) {
      console.error('Failed to fetch wishlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (courseId: string) => {
    try {
      await wishlistService.removeFromWishlist(courseId);
      setWishlist(prev => prev.filter(w => w.courseId !== courseId));
      toast({
        title: 'Removed',
        description: 'Course removed from your wishlist',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove from wishlist',
        variant: 'destructive',
      });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price) + ' CFA';
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Heart className="w-8 h-8 text-red-500" />
        <h1 className="text-3xl font-bold">My Wishlist</h1>
      </div>

      {wishlist.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <Heart className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Your wishlist is empty</h2>
          <p className="text-muted-foreground mb-6">
            Browse courses and add them to your wishlist
          </p>
          <Button onClick={() => navigate('/courses')}>
            Browse Courses
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {wishlist.map(item => (
            <div
              key={item.id}
              className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-colors"
            >
              <div className="aspect-video bg-muted flex items-center justify-center">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <BookOpen className="w-10 h-10 text-muted-foreground" />
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-1 line-clamp-2">
                  {item.title}
                </h3>
                {item.category && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                    {item.category}
                  </span>
                )}
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xl font-bold text-primary">
                    {item.price ? formatPrice(item.price) : 'Free'}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={() => handleRemove(item.courseId)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => navigate(`/course/${item.slug || item.courseId}`)}
                    >
                      View
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Wishlist;
