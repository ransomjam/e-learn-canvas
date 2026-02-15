import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Star, Loader2 } from 'lucide-react';
import { coursesService } from '@/services/courses.service';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface ReviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    courseId: string;
    initialReview?: { rating: number; title: string; comment: string } | null;
}

export const ReviewDialog = ({ open, onOpenChange, courseId, initialReview }: ReviewDialogProps) => {
    const [rating, setRating] = useState(initialReview?.rating || 0);
    const [title, setTitle] = useState(initialReview?.title || '');
    const [comment, setComment] = useState(initialReview?.comment || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (open) {
            setRating(initialReview?.rating || 0);
            setTitle(initialReview?.title || '');
            setComment(initialReview?.comment || '');
        }
    }, [open, initialReview]);

    const handleSubmit = async () => {
        if (rating === 0) {
            toast({
                title: "Rating required",
                description: "Please select a star rating",
                variant: "destructive"
            });
            return;
        }

        setIsSubmitting(true);
        try {
            if (initialReview) {
                await coursesService.updateReview(courseId, { rating, title, comment });
                toast({ title: 'Review updated successfully' });
            } else {
                await coursesService.addReview(courseId, { rating, title, comment });
                toast({ title: 'Review submitted successfully' });
            }
            queryClient.invalidateQueries({ queryKey: ['course', courseId] });
            queryClient.invalidateQueries({ queryKey: ['userReview', courseId] });
            onOpenChange(false);
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.response?.data?.message || 'Failed to submit review',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{initialReview ? 'Edit Review' : 'Rate this Course'}</DialogTitle>
                    <DialogDescription>
                        Share your experience with other students.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    <div className="flex flex-col items-center gap-2">
                        <Label className="text-base text-center">Your Rating</Label>
                        <div className="flex justify-center space-x-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    className="focus:outline-none transition-transform hover:scale-110 p-1"
                                    onClick={() => setRating(star)}
                                >
                                    <Star
                                        className={`h-8 w-8 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
                                            }`}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="title">Title (Optional)</Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Great introduction to the topic!"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="comment">Review (Optional)</Label>
                        <Textarea
                            id="comment"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Tell us what you liked or didn't like..."
                            className="resize-none h-32"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || rating === 0}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {initialReview ? 'Update Review' : 'Submit Review'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
