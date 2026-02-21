import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

interface QuizPlayerProps {
    lessonId: string;
    quizData: any[];
    onComplete: () => void;
}

const QuizPlayer = ({ lessonId, quizData, onComplete }: QuizPlayerProps) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const rootRef = useRef<HTMLDivElement>(null);

    const [answers, setAnswers] = useState<number[]>(new Array(quizData?.length || 0).fill(-1));
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [scoreInfo, setScoreInfo] = useState<any>(null);

    // Scroll to top when quiz data changes or on retry
    useEffect(() => {
        rootRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, [quizData, isSubmitted]);

    // Fetch previous results/leaderboard if available
    const { data: resultsInfo } = useQuery({
        queryKey: ['quizResults', lessonId],
        queryFn: async () => {
            const res = await api.get(`/quiz/${lessonId}/results`);
            return res.data.data;
        },
        enabled: !!lessonId,
    });

    const submitQuizMutation = useMutation({
        mutationFn: async (answersToSubmit: number[]) => {
            const res = await api.post(`/quiz/${lessonId}/submit`, { answers: answersToSubmit });
            return res.data.data;
        },
        onSuccess: (data) => {
            setIsSubmitted(true);
            setScoreInfo(data);
            queryClient.invalidateQueries({ queryKey: ['courseProgress'] });
            queryClient.invalidateQueries({ queryKey: ['courseLessons'] });
            queryClient.invalidateQueries({ queryKey: ['quizResults', lessonId] });
            if (data.passed) {
                toast({ title: 'Quiz Passed!', description: `You scored ${data.score}%` });
                onComplete();
            } else {
                toast({ title: 'Quiz Failed', description: `You scored ${data.score}%. Try again.`, variant: 'destructive' });
            }
        },
        onError: () => {
            toast({ title: 'Submission failed', variant: 'destructive' });
        }
    });

    const handleOptionSelect = (qIndex: number, optIndex: number) => {
        if (isSubmitted) return;
        const newAnswers = [...answers];
        newAnswers[qIndex] = optIndex;
        setAnswers(newAnswers);
    };

    const handleSubmit = () => {
        if (answers.includes(-1)) {
            toast({ title: 'Please answer all questions before submitting', variant: 'destructive' });
            return;
        }
        submitQuizMutation.mutate(answers);
    };

    const handleRetry = () => {
        setIsSubmitted(false);
        setAnswers(new Array(quizData.length).fill(-1));
        setScoreInfo(null);
    };

    if (!quizData || quizData.length === 0) {
        return <div className="p-8 text-center text-muted-foreground">This quiz has no questions.</div>;
    }

    return (
        <div ref={rootRef} className="max-w-3xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            {isSubmitted && scoreInfo ? (
                <div className="bg-card border border-border rounded-xl p-6 text-center shadow-lg">
                    <h2 className="text-2xl font-bold mb-2">Quiz Results</h2>
                    <div className={`mx-auto w-20 h-20 flex items-center justify-center rounded-full mb-4 ${scoreInfo.passed ? 'bg-emerald-100' : 'bg-red-100'}`}>
                        {scoreInfo.passed ? (
                            <CheckCircle className="h-12 w-12 text-emerald-500" />
                        ) : (
                            <XCircle className="h-12 w-12 text-red-500" />
                        )}
                    </div>
                    <div className={`text-5xl font-black mb-4 ${scoreInfo.passed ? 'text-emerald-500' : 'text-red-500'}`}>
                        {Math.round(scoreInfo.score)}%
                    </div>
                    <p className="text-muted-foreground mb-6">
                        You got {scoreInfo.correctAnswers} out of {scoreInfo.totalQuestions} questions right.
                        {scoreInfo.passed ? ' Great job!' : ' Keep practicing!'}
                    </p>

                    <div className="flex justify-center gap-4">
                        <Button onClick={handleRetry} variant="outline">Try Again</Button>
                        {scoreInfo.passed && (
                            <Button onClick={onComplete} className="gap-2">
                                Continue <ArrowRight className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    {/* Leaderboard */}
                    {resultsInfo?.leaderboard && resultsInfo.leaderboard.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-border text-left">
                            <h3 className="font-semibold text-lg mb-4 text-center">Top Performers</h3>
                            <div className="space-y-2 max-w-sm mx-auto">
                                {resultsInfo.leaderboard.map((user: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center bg-secondary/50 p-2 px-3 rounded text-sm">
                                        <span className="font-medium text-muted-foreground">
                                            <span className="opacity-50 inline-block w-4">{i + 1}.</span> {user.name}
                                        </span>
                                        <span className="font-bold text-primary">{Math.round(user.score)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-8">
                    {resultsInfo?.myBestScore !== null && resultsInfo?.myBestScore !== undefined && (
                        <div className="bg-primary/10 text-primary border border-primary/20 p-3 rounded-lg text-sm text-center font-medium">
                            Your previous best score: {Math.round(resultsInfo.myBestScore)}%
                        </div>
                    )}

                    {quizData.map((q, qIndex) => (
                        <div key={qIndex} className="bg-card border border-border rounded-xl p-6 shadow-sm">
                            <h3 className="text-lg font-medium mb-4">
                                <span className="text-muted-foreground mr-2">{qIndex + 1}.</span>
                                {q.question}
                            </h3>
                            <div className="space-y-2">
                                {q.options.map((opt: string, oIndex: number) => {
                                    const isSelected = answers[qIndex] === oIndex;
                                    let btnClass = isSelected
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-border bg-background hover:border-primary/50 hover:bg-secondary';

                                    return (
                                        <button
                                            key={oIndex}
                                            onClick={() => handleOptionSelect(qIndex, oIndex)}
                                            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${btnClass}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-primary' : 'border-muted-foreground/30'}`}>
                                                    {isSelected && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                                                </div>
                                                <span className="leading-tight">{opt}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    <div className="sticky bottom-4 z-10 flex justify-end bg-background/80 backdrop-blur pb-4 pt-2">
                        <Button
                            size="lg"
                            className="w-full sm:w-auto shadow-xl"
                            onClick={handleSubmit}
                            disabled={submitQuizMutation.isPending || answers.includes(-1)}
                        >
                            {submitQuizMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                            Submit Quiz
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuizPlayer;
