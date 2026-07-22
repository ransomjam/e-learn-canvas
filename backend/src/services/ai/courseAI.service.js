/**
 * CourseAIService — the single AI facade for the whole platform.
 *
 * Controllers and background jobs call these methods; nothing else in the
 * app talks to a model provider. The service performs REASONING only
 * (understanding, generating, rewriting structured content). Rendering
 * (whiteboard video) is a deterministic pipeline in whiteboard.service.js.
 */
const { getProvider } = require('./providers');
const prompts = require('./prompts');
const extractionService = require('./extraction.service');
const whiteboardService = require('./whiteboard.service');

const courseAIService = {
    /**
     * Any content source → structured educational data (the source of truth).
     * @see extraction.service.js
     */
    async extractContent(source, options = {}, onProgress) {
        return extractionService.extract(source, options, onProgress);
    },

    /** Outline a whole course from a topic. */
    async generateCourse({ topic, level, lessonCount }) {
        return getProvider().generateJSON({
            system: prompts.EDUCATOR_SYSTEM,
            prompt: prompts.courseOutline({ topic, level, lessonCount }),
            temperature: 0.6,
        });
    },

    /** Structured content → polished lesson article. */
    async generateLesson(structured) {
        return getProvider().generateJSON({
            system: prompts.EDUCATOR_SYSTEM,
            prompt: prompts.lessonArticle({ structured }),
            temperature: 0.5,
        });
    },

    /** Structured content → storyboard (scene descriptions, normalized). */
    async generateStoryboard(structured, { maxScenes } = {}) {
        const raw = await getProvider().generateJSON({
            system: prompts.EDUCATOR_SYSTEM,
            prompt: prompts.storyboard({ structured, maxScenes }),
            temperature: 0.5,
        });
        return whiteboardService.normalizeStoryboard(raw);
    },

    /** Regenerate a single storyboard scene. */
    async regenerateScene(structured, scene, instructions) {
        const raw = await getProvider().generateJSON({
            system: prompts.EDUCATOR_SYSTEM,
            prompt: prompts.regenerateScene({ structured, scene, instructions }),
            temperature: 0.6,
        });
        // Normalize through the storyboard validator (single-scene wrapper)
        return whiteboardService.normalizeStoryboard({ title: 'scene', scenes: [raw] }).scenes[0];
    },

    /**
     * Storyboard → deterministic whiteboard scene graph (the "video").
     * No AI involved — same storyboard always produces the same output.
     */
    generateWhiteboardVideo(storyboard) {
        return whiteboardService.compileStoryboard(storyboard);
    },

    /** Quiz from structured content or raw text. */
    async generateQuiz({ structured, text, questionCount, difficulty }) {
        const result = await getProvider().generateJSON({
            system: prompts.EDUCATOR_SYSTEM,
            prompt: prompts.quiz({ structured, text, questionCount, difficulty }),
            temperature: 0.5,
        });
        const questions = Array.isArray(result) ? result : (result.questions || []);
        // Defensive normalization so the player never crashes on bad data
        return questions
            .filter((q) => q && q.question)
            .map((q) => ({
                type: q.type || 'multiple_choice',
                question: String(q.question),
                options: Array.isArray(q.options) ? q.options.map(String) : [],
                correctAnswer: q.correctAnswer ?? 0,
                explanation: q.explanation || '',
                difficulty: q.difficulty || 'medium',
                bloomLevel: q.bloomLevel || 'understand',
            }));
    },

    /** Flashcards from structured content. */
    async generateFlashcards(structured) {
        const result = await getProvider().generateJSON({
            system: prompts.EDUCATOR_SYSTEM,
            prompt: prompts.flashcards({ structured }),
            temperature: 0.4,
        });
        const cards = Array.isArray(result) ? result : (result.cards || []);
        return cards
            .filter((c) => c && c.question && c.answer)
            .map((c) => ({
                question: String(c.question),
                answer: String(c.answer),
                category: c.category || 'General',
                difficulty: c.difficulty || 'medium',
                tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
            }));
    },

    /** Slide deck from structured content. */
    async generateSlides(structured, { maxSlides } = {}) {
        const deck = await getProvider().generateJSON({
            system: prompts.EDUCATOR_SYSTEM,
            prompt: prompts.slides({ structured, maxSlides }),
            temperature: 0.5,
        });
        return {
            title: deck.title || structured.title || 'Slides',
            slides: (Array.isArray(deck.slides) ? deck.slides : []).map((s) => ({
                layout: s.layout || 'bullets',
                heading: s.heading || '',
                subtitle: s.subtitle || '',
                bullets: Array.isArray(s.bullets) ? s.bullets.map(String) : [],
                term: s.term || '',
                definition: s.definition || '',
                statement: s.statement || '',
                chart: s.chart || null,
                speakerNotes: s.speakerNotes || '',
            })),
        };
    },

    /** One practical assignment from structured content. */
    async generateAssignments(structured) {
        return getProvider().generateJSON({
            system: prompts.EDUCATOR_SYSTEM,
            prompt: prompts.assignment({ structured }),
            temperature: 0.5,
        });
    },

    /** Summary + key takeaways + study notes from any text. */
    async generateSummary(text) {
        return getProvider().generateJSON({
            system: prompts.EDUCATOR_SYSTEM,
            prompt: prompts.summary({ text }),
            temperature: 0.3,
        });
    },

    /**
     * Narration script per scene (the voice track of the whiteboard video).
     * TTS synthesis is a future provider capability; the script is the
     * deterministic input it will consume.
     */
    generateVoiceNarration(storyboard) {
        return (storyboard.scenes || []).map((scene, i) => ({
            sceneIndex: i,
            text: scene.narration || '',
            estimatedSeconds: scene.durationSeconds || 12,
        }));
    },

    /** Translate lesson content (markdown-preserving). */
    async translateCourse(text, targetLanguage) {
        const result = await getProvider().generateJSON({
            system: prompts.EDUCATOR_SYSTEM,
            prompt: prompts.translate({ text, targetLanguage }),
            temperature: 0.3,
        });
        return result.markdown || '';
    },

    /** AI Assistant: rewrite existing lesson content. */
    async assistLesson({ action, content, instructions }) {
        const result = await getProvider().generateJSON({
            system: prompts.EDUCATOR_SYSTEM,
            prompt: prompts.assist({ action, content, instructions }),
            temperature: 0.5,
        });
        if (!result.markdown) throw new Error('The AI did not return revised content');
        return result.markdown;
    },

    /** Lecture recording → chapters / key moments / objectives. */
    async analyzeRecording(fileUrl, mimeType) {
        return extractionService.analyzeRecording(fileUrl, mimeType);
    },
};

module.exports = courseAIService;
