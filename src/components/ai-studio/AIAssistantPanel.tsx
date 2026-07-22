import { useState } from 'react';
import {
    Sparkles, Wand2, Minimize2, Maximize2, ListPlus, Baby,
    GraduationCap, SpellCheck, Languages, Loader2, MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { aiStudioService } from '@/services/aiStudio.service';
import type { AssistAction } from '@/types/aiStudio';

/**
 * AI Assistant — one-click rewrites of lesson content.
 * Drop it next to any content editor: it takes the current content,
 * runs the chosen action through the AI service and hands back the result.
 */

const ACTIONS: Array<{ action: AssistAction; label: string; icon: React.ElementType }> = [
    { action: 'improve', label: 'Improve', icon: Wand2 },
    { action: 'shorten', label: 'Shorten', icon: Minimize2 },
    { action: 'expand', label: 'Expand', icon: Maximize2 },
    { action: 'add_examples', label: 'Add examples', icon: ListPlus },
    { action: 'simplify', label: 'Simplify', icon: Sparkles },
    { action: 'for_beginners', label: 'For beginners', icon: Baby },
    { action: 'for_experts', label: 'For experts', icon: GraduationCap },
    { action: 'fix_grammar', label: 'Fix grammar', icon: SpellCheck },
];

const LANGUAGES = ['French', 'English', 'Spanish', 'German', 'Portuguese', 'Arabic', 'Swahili'];

interface AIAssistantPanelProps {
    content: string;
    lessonId?: string;
    onResult: (markdown: string, action: string) => void;
    className?: string;
}

const AIAssistantPanel = ({ content, lessonId, onResult, className }: AIAssistantPanelProps) => {
    const { toast } = useToast();
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const [customInstruction, setCustomInstruction] = useState('');
    const [showTranslate, setShowTranslate] = useState(false);

    const run = async (action: AssistAction, instructions?: string) => {
        if (!content.trim()) {
            toast({ title: 'Write or generate some content first', variant: 'destructive' });
            return;
        }
        setBusyAction(instructions ? 'custom' : action);
        try {
            const markdown = await aiStudioService.assist({ content, action, instructions, lessonId });
            onResult(markdown, action);
            toast({ title: 'Content updated by the AI assistant' });
        } catch (error: any) {
            toast({
                title: 'The assistant could not complete that',
                description: error.response?.data?.message || error.message,
                variant: 'destructive',
            });
        } finally {
            setBusyAction(null);
        }
    };

    const translate = async (language: string) => {
        if (!content.trim()) return;
        setBusyAction(`translate-${language}`);
        try {
            const markdown = await aiStudioService.translate(content, language);
            onResult(markdown, `translate to ${language}`);
            toast({ title: `Translated to ${language}` });
        } catch (error: any) {
            toast({
                title: 'Translation failed',
                description: error.response?.data?.message || error.message,
                variant: 'destructive',
            });
        } finally {
            setBusyAction(null);
        }
    };

    return (
        <div className={`rounded-xl border border-border bg-card p-4 space-y-3 ${className || ''}`}>
            <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">AI Assistant</h3>
            </div>

            <div className="flex flex-wrap gap-2">
                {ACTIONS.map(({ action, label, icon: Icon }) => (
                    <Button
                        key={action}
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={busyAction !== null}
                        onClick={() => run(action)}
                    >
                        {busyAction === action
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Icon className="h-3.5 w-3.5" />}
                        {label}
                    </Button>
                ))}
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={busyAction !== null}
                    onClick={() => setShowTranslate((v) => !v)}
                >
                    <Languages className="h-3.5 w-3.5" />
                    Translate
                </Button>
            </div>

            {showTranslate && (
                <div className="flex flex-wrap gap-1.5">
                    {LANGUAGES.map((lang) => (
                        <Button
                            key={lang}
                            variant="secondary"
                            size="sm"
                            disabled={busyAction !== null}
                            onClick={() => translate(lang)}
                        >
                            {busyAction === `translate-${lang}` && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                            {lang}
                        </Button>
                    ))}
                </div>
            )}

            <div className="flex gap-2">
                <Input
                    value={customInstruction}
                    onChange={(e) => setCustomInstruction(e.target.value)}
                    placeholder='Tell the assistant what to change, e.g. "add a section about pricing"'
                    className="text-sm"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && customInstruction.trim()) {
                            run('custom', customInstruction.trim());
                            setCustomInstruction('');
                        }
                    }}
                />
                <Button
                    size="sm"
                    disabled={busyAction !== null || !customInstruction.trim()}
                    onClick={() => {
                        run('custom', customInstruction.trim());
                        setCustomInstruction('');
                    }}
                    className="gap-1.5 shrink-0"
                >
                    {busyAction === 'custom'
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <MessageSquare className="h-3.5 w-3.5" />}
                    Apply
                </Button>
            </div>
        </div>
    );
};

export default AIAssistantPanel;
