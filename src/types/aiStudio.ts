/**
 * AI Course Studio — shared types mirroring the backend contracts.
 */

export type SourceType =
    | 'idea'
    | 'text'
    | 'pdf'
    | 'doc'
    | 'ppt'
    | 'audio'
    | 'video'
    | 'lesson';

export interface GenerationSource {
    sourceType: SourceType;
    text?: string;
    fileUrl?: string;
    mimeType?: string;
    lessonId?: string;
}

export interface GenerationInclude {
    quiz?: boolean;
    flashcards?: boolean;
    slides?: boolean;
    assignment?: boolean;
    whiteboard?: boolean;
    summary?: boolean;
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AIJob {
    id: string;
    userId: string;
    courseId?: string;
    lessonId?: string;
    type: string;
    status: JobStatus;
    progress: number;
    stepLabel?: string;
    result?: LessonPack | Record<string, unknown>;
    error?: string;
    createdAt: string;
    finishedAt?: string;
}

// ── Structured educational content (the pipeline's source of truth) ────────

export interface StructuredContent {
    title: string;
    subject?: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    estimatedDurationMinutes?: number;
    prerequisites?: string[];
    learningObjectives?: string[];
    keyConcepts?: Array<{ name: string; explanation: string }>;
    definitions?: Array<{ term: string; definition: string }>;
    examples?: Array<{ title: string; content: string }>;
    exercises?: Array<{ prompt: string; solution: string }>;
    sections?: Array<{ heading: string; content: string }>;
    summary?: string;
    references?: string[];
}

export interface LessonDraft {
    title: string;
    markdown: string;
    estimatedReadMinutes?: number;
}

export interface QuizQuestion {
    type: 'multiple_choice' | 'true_false' | 'fill_blank' | 'short_answer' | 'scenario';
    question: string;
    options: string[];
    correctAnswer: number | string;
    explanation: string;
    difficulty: 'easy' | 'medium' | 'hard';
    bloomLevel: string;
}

export interface Flashcard {
    id?: string;
    question: string;
    answer: string;
    category: string;
    difficulty: string;
    tags: string[];
}

export interface Slide {
    layout: 'title' | 'bullets' | 'statement' | 'definition' | 'chart' | 'quote';
    heading: string;
    subtitle?: string;
    bullets: string[];
    term?: string;
    definition?: string;
    statement?: string;
    chart?: { chartType: 'bar' | 'line' | 'pie'; labels: string[]; values: number[] } | null;
    speakerNotes: string;
}

export interface SlideDeck {
    title: string;
    slides: Slide[];
}

export interface Assignment {
    title: string;
    objective: string;
    instructions: string;
    submissionRequirements: string[];
    rubric: Array<{ criterion: string; excellent: string; good: string; needsImprovement: string; points: number }>;
    estimatedTimeMinutes: number;
}

export interface LessonSummary {
    summary: string;
    keyTakeaways: string[];
    studyNotes: string;
}

// ── Whiteboard scene graph (deterministic render plan) ─────────────────────

export interface SceneItem {
    id: string;
    kind: 'text' | 'path' | 'rect';
    animation: 'write' | 'draw' | 'fade';
    x: number;
    y: number;
    startTime: number;
    duration: number;
    color: string;
    // text items
    text?: string;
    fontSize?: number;
    weight?: 'bold';
    family?: 'mono';
    // path items
    d?: string;
    strokeWidth?: number;
    fill?: string;
    // rect items
    width?: number;
    height?: number;
    behind?: boolean;
}

export interface GraphScene {
    index: number;
    type: string;
    title: string;
    narration: string;
    durationSeconds: number;
    items: SceneItem[];
}

export interface SceneGraph {
    version: number;
    title: string;
    canvas: { width: number; height: number };
    theme: Record<string, unknown> & { background: string };
    totalDurationSeconds: number;
    scenes: GraphScene[];
}

export interface StoryboardScene {
    type: string;
    title: string;
    narration: string;
    durationSeconds: number;
    elements: Array<Record<string, unknown>>;
}

export interface Storyboard {
    title: string;
    scenes: StoryboardScene[];
}

// ── The full generated pack (lesson_pack job result) ───────────────────────

export interface LessonPack {
    structured: StructuredContent;
    lesson: LessonDraft;
    quiz: QuizQuestion[] | null;
    flashcards: Flashcard[] | null;
    slides: SlideDeck | null;
    assignment: Assignment | null;
    summary: LessonSummary | null;
    storyboard: Storyboard | null;
    sceneGraph: SceneGraph | null;
    warnings: string[];
    source: { sourceType: SourceType; fileUrl: string | null };
}

export type AssistAction =
    | 'improve'
    | 'shorten'
    | 'expand'
    | 'add_examples'
    | 'simplify'
    | 'for_beginners'
    | 'for_experts'
    | 'fix_grammar'
    | 'custom';

export interface AIStatus {
    enabled: boolean;
    provider: string;
    mediaUnderstanding: boolean;
}

export interface ApplyResult {
    lessonId: string;
    quizLessonId?: string;
    flashcardDeckId?: string;
    slideDeckId?: string;
    storyboardId?: string;
}
