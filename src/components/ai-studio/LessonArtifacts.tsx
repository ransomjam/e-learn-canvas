import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Presentation, Layers, ChevronLeft, ChevronRight, Loader2, RotateCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { aiStudioService } from '@/services/aiStudio.service';
import type { Flashcard, Slide } from '@/types/aiStudio';

/**
 * LessonArtifacts — the student-facing home for the supplementary study
 * material the AI Studio generated alongside a lesson: the slide deck and
 * flashcards. (The whiteboard explainer is not shown here — it is rendered
 * as the lesson's own video.) Renders nothing when a lesson has no such
 * material, so it's safe to drop under every lesson.
 */

type ArtifactTab = 'slides' | 'flashcards';

interface LessonArtifactsProps {
    lessonId: string;
}

const LessonArtifacts = ({ lessonId }: LessonArtifactsProps) => {
    const { data, isLoading } = useQuery({
        queryKey: ['lessonArtifacts', lessonId],
        queryFn: () => aiStudioService.getLessonArtifacts(lessonId),
        enabled: !!lessonId,
        staleTime: 5 * 60 * 1000,
    });

    const hasSlides = !!data?.slideDecks?.length;
    const hasFlashcards = !!data?.flashcardDecks?.length;
    const hasAny = hasSlides || hasFlashcards;

    const firstTab: ArtifactTab = hasSlides ? 'slides' : 'flashcards';
    const [tab, setTab] = useState<ArtifactTab | null>(null);
    const activeTab = tab ?? firstTab;

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading learning materials...
            </div>
        );
    }
    if (!hasAny) return null;

    const tabs: Array<{ key: ArtifactTab; label: string; icon: React.ElementType; show: boolean }> = [
        { key: 'slides', label: 'Slides', icon: Presentation, show: hasSlides },
        { key: 'flashcards', label: 'Flashcards', icon: Layers, show: hasFlashcards },
    ];

    return (
        <div className="pt-4 space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Learning Materials</h3>

            <div className="flex flex-wrap gap-2">
                {tabs.filter((t) => t.show).map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${activeTab === key
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-secondary/40 text-muted-foreground hover:bg-secondary'
                            }`}
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                    </button>
                ))}
            </div>

            {activeTab === 'slides' && hasSlides && (
                <SlidesArtifact slides={(data!.slideDecks[0].slides as Slide[]) || []} />
            )}
            {activeTab === 'flashcards' && hasFlashcards && (
                <FlashcardsArtifact cards={data!.flashcardDecks[0].cards || []} />
            )}
        </div>
    );
};

/** Simple slide viewer with prev/next + speaker notes. */
const SlidesArtifact = ({ slides }: { slides: Slide[] }) => {
    const [index, setIndex] = useState(0);
    if (!slides.length) return null;
    const slide = slides[Math.min(index, slides.length - 1)];

    return (
        <div className="space-y-3">
            <div className="rounded-xl border border-border overflow-hidden shadow-sm">
                <div className="aspect-video bg-gradient-to-br from-secondary/40 to-secondary/10 p-8 flex flex-col justify-center">
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3">
                        Slide {index + 1} of {slides.length}
                    </p>
                    <h3 className={`font-display font-bold text-foreground ${slide.layout === 'title' || slide.layout === 'statement' ? 'text-3xl' : 'text-2xl'}`}>
                        {slide.heading || slide.statement || slide.term}
                    </h3>
                    {slide.subtitle && <p className="text-base text-muted-foreground mt-2">{slide.subtitle}</p>}
                    {slide.definition && <p className="text-base mt-3 text-foreground/90">{slide.definition}</p>}
                    {slide.bullets?.length ? (
                        <ul className="mt-4 space-y-2">
                            {slide.bullets.map((b, i) => (
                                <li key={i} className="text-base text-foreground/90 flex gap-2">
                                    <span className="text-primary">•</span>{b}
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
                {slide.speakerNotes && (
                    <div className="border-t border-border bg-secondary/40 px-5 py-3">
                        <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Notes:</span> {slide.speakerNotes}</p>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} className="gap-1">
                    <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <div className="flex gap-1">
                    {slides.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setIndex(i)}
                            className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-primary' : 'w-1.5 bg-border'}`}
                            aria-label={`Go to slide ${i + 1}`}
                        />
                    ))}
                </div>
                <Button variant="outline" size="sm" onClick={() => setIndex((i) => Math.min(slides.length - 1, i + 1))} disabled={index === slides.length - 1} className="gap-1">
                    Next <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};

/** Flashcard grid — click a card to flip it. */
const FlashcardsArtifact = ({ cards }: { cards: Flashcard[] }) => {
    const categories = useMemo(() => {
        const set = new Set(cards.map((c) => c.category || 'General'));
        return Array.from(set);
    }, [cards]);
    const [filter, setFilter] = useState<string>('all');
    const shown = filter === 'all' ? cards : cards.filter((c) => (c.category || 'General') === filter);

    return (
        <div className="space-y-3">
            {categories.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                    <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>All ({cards.length})</FilterChip>
                    {categories.map((cat) => (
                        <FilterChip key={cat} active={filter === cat} onClick={() => setFilter(cat)}>{cat}</FilterChip>
                    ))}
                </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {shown.map((card, i) => (
                    <FlipCard key={i} card={card} />
                ))}
            </div>
        </div>
    );
};

const FilterChip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
        onClick={onClick}
        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary/40 text-muted-foreground hover:bg-secondary'}`}
    >
        {children}
    </button>
);

const FlipCard = ({ card }: { card: Flashcard }) => {
    const [flipped, setFlipped] = useState(false);
    return (
        <button
            onClick={() => setFlipped((f) => !f)}
            className="group relative rounded-xl border border-border bg-card p-4 text-left min-h-[130px] hover:border-primary/50 hover:shadow-md transition-all"
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {card.category || 'General'} · {flipped ? 'Answer' : 'Question'}
                </span>
                <RotateCw className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
            </div>
            <p className={`text-sm leading-relaxed ${flipped ? 'text-primary' : 'text-foreground font-medium'}`}>
                {flipped ? card.answer : card.question}
            </p>
        </button>
    );
};

export default LessonArtifacts;
