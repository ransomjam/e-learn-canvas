/**
 * Prompt library for the AI Course Studio.
 *
 * Every prompt the platform sends to a model lives here, so educational
 * quality can be tuned in one place. All prompts demand strict JSON that
 * matches the internal structured representation — the model never decides
 * the shape of our data.
 */

/**
 * The internal structured representation of a lesson. This JSON — not the
 * original PDF/transcript — is the source of truth for every downstream
 * generation (lesson text, slides, quiz, flashcards, storyboard...).
 */
const STRUCTURED_CONTENT_SCHEMA = `{
  "title": "Concise lesson title",
  "subject": "Broad subject area, e.g. 'Biology'",
  "difficulty": "beginner" | "intermediate" | "advanced",
  "estimatedDurationMinutes": number,
  "prerequisites": ["..."],
  "learningObjectives": ["Actionable objective starting with a verb (Bloom's taxonomy)"],
  "keyConcepts": [{ "name": "...", "explanation": "1-3 sentence explanation" }],
  "definitions": [{ "term": "...", "definition": "..." }],
  "examples": [{ "title": "...", "content": "worked example, markdown allowed" }],
  "exercises": [{ "prompt": "...", "solution": "..." }],
  "sections": [{ "heading": "...", "content": "full teaching content in markdown" }],
  "summary": "3-6 sentence summary of the lesson",
  "references": ["source names, papers, URLs mentioned in the material"]
}`;

const EDUCATOR_SYSTEM = `You are a world-class instructional designer and university educator.
You produce rigorous, clear, learner-friendly educational material.
You always answer with ONLY valid JSON matching the requested schema — no markdown fences, no commentary.
Never invent facts that contradict the source material. When the source is thin, expand responsibly with widely accepted knowledge of the topic.`;

const prompts = {
    EDUCATOR_SYSTEM,
    STRUCTURED_CONTENT_SCHEMA,

    /** Any source (text or attached media) → structured lesson content. */
    extractStructuredContent({ sourceDescription, text, language }) {
        return `Analyze the ${sourceDescription} and convert it into structured educational data.

Rules:
- Preserve the author's teaching intent, terminology and examples.
- Write teaching content (sections[].content) as complete, polished lesson prose in markdown — not bullet fragments.
- Cover ALL substantive material; do not drop topics.
- learningObjectives: 3-6, measurable, Bloom-aligned.
- If the source is an audio/video recording, first understand the full transcript, clean up grammar and filler words, but preserve the speaker's teaching style.
${language ? `- Output language: ${language}.` : '- Keep the source language.'}

Output ONLY JSON matching this schema:
${STRUCTURED_CONTENT_SCHEMA}
${text ? `\nSOURCE MATERIAL:\n"""\n${text}\n"""` : '\nThe source material is attached as a file.'}`;
    },

    /** A short idea → full structured lesson. */
    expandIdea({ idea, courseTitle, level }) {
        return `An instructor teaching ${courseTitle ? `the course "${courseTitle}"` : 'an online course'} has only this lesson idea:

"""${idea}"""

Design a complete, professional lesson from it${level ? ` at ${level} level` : ''}. Create thorough teaching sections with explanations, analogies, worked examples and exercises, as a great instructor would.

Output ONLY JSON matching this schema:
${STRUCTURED_CONTENT_SCHEMA}`;
    },

    /** Structured content → polished lesson article (markdown). */
    lessonArticle({ structured }) {
        return `Turn this structured lesson data into a single polished lesson article for students.

Requirements:
- Markdown with a clear hierarchy (##, ###), short paragraphs, bold key terms.
- Include: brief intro, all teaching sections, worked examples, exercises (without solutions inline — put solutions in a collapsed "Solutions" section at the end), key takeaways.
- Educational pacing: explain before formalizing; use analogies where helpful.
- No meta commentary ("in this lesson we will..") beyond one short intro sentence.

Output ONLY JSON: { "title": "...", "markdown": "...", "estimatedReadMinutes": number }

STRUCTURED LESSON DATA:
${JSON.stringify(structured)}`;
    },

    /** Structured content → whiteboard storyboard (scene descriptions only). */
    storyboard({ structured, maxScenes = 10 }) {
        return `Design a whiteboard-lesson storyboard for this structured lesson.
A professional narrator writes/draws on a whiteboard while explaining. You only describe scenes — a deterministic renderer draws them.

Rules:
- ${Math.min(maxScenes, 12)} scenes max. Typical flow: title → introduction → definitions → core explanations → example → diagram/illustration → summary → key takeaways.
- narration: natural spoken teaching language, 2-5 sentences per scene (what the narrator SAYS).
- elements: what appears on the whiteboard, in the order it is written/drawn. Whiteboards hold few words — max ~7 elements per scene, short text.
- Element kinds: "heading" (large title), "text" (short phrase), "bullet" (list item), "definition" ({term, text}), "formula" (plain-text math), "arrow" ({text} label, drawn between previous and next element), "box" (emphasized boxed text), "chart" ({chartType: "bar"|"line"|"pie", labels: [...], values: [...], text: caption}), "diagram" ({nodes: ["A","B","C"], text: caption} simple left-to-right flowchart), "underline" (underline previous element), "highlight" (highlight previous element).
- durationSeconds: 8-40 per scene, matched to narration length (~150 words/min) plus drawing time.
- No decoration, no random animations — minimal, professional, readable.

Output ONLY JSON:
{
  "title": "...",
  "scenes": [
    {
      "type": "title"|"intro"|"definition"|"explanation"|"example"|"illustration"|"summary"|"takeaways",
      "title": "short scene title",
      "narration": "...",
      "durationSeconds": number,
      "elements": [ { "kind": "...", "text": "...", ...kind-specific fields } ]
    }
  ]
}

STRUCTURED LESSON DATA:
${JSON.stringify(structured)}`;
    },

    /** Regenerate a single scene with optional instructions. */
    regenerateScene({ structured, scene, instructions }) {
        return `Here is one scene of a whiteboard-lesson storyboard, plus the lesson's structured data for context.
Rewrite ONLY this scene${instructions ? ` following these instructions: "${instructions}"` : ' with improved clarity and pacing'}.
Keep the same JSON shape and the same "type". Follow the same element-kind rules as before ("heading","text","bullet","definition","formula","arrow","box","chart","diagram","underline","highlight").

Output ONLY the scene JSON object.

CURRENT SCENE:
${JSON.stringify(scene)}

LESSON DATA (context):
${JSON.stringify({ title: structured.title, learningObjectives: structured.learningObjectives, keyConcepts: structured.keyConcepts, summary: structured.summary })}`;
    },

    /** Structured content → quiz. */
    quiz({ structured, text, questionCount, difficulty = 'medium' }) {
        const source = structured ? `STRUCTURED LESSON DATA:\n${JSON.stringify(structured)}` : `SOURCE TEXT:\n"""${text}"""`;
        return `Create a quiz from the lesson material below.

Rules:
- ${questionCount ? `Exactly ${questionCount} questions.` : 'Cover every important concept — as many questions as the material supports.'}
- Mix of types: "multiple_choice" (4 options), "true_false", "fill_blank" (blank marked as ____), "short_answer", "scenario" (a realistic situation, 4 options).
- Overall difficulty ${difficulty}; tag each question "easy"|"medium"|"hard" and its Bloom's level ("remember"|"understand"|"apply"|"analyze"|"evaluate"|"create").
- For choice questions, correctAnswer is the 0-based option index. For fill_blank / short_answer, correctAnswer is the expected answer string and options is [].
- Every question gets a 1-2 sentence explanation.

Output ONLY a JSON array:
[{ "type": "...", "question": "...", "options": ["..."], "correctAnswer": 0 | "...", "explanation": "...", "difficulty": "...", "bloomLevel": "..." }]

${source}`;
    },

    /** Structured content → flashcards. */
    flashcards({ structured }) {
        return `Create concise study flashcards from this lesson.

Rules:
- One atomic fact/concept per card; question on the front, short precise answer on the back.
- Cover all definitions, key concepts and important facts.
- 8-30 cards depending on material density.

Output ONLY a JSON array:
[{ "question": "...", "answer": "...", "category": "...", "difficulty": "easy"|"medium"|"hard", "tags": ["..."] }]

STRUCTURED LESSON DATA:
${JSON.stringify(structured)}`;
    },

    /** Structured content → slide deck. */
    slides({ structured, maxSlides = 14 }) {
        return `Design a professional, minimal slide deck for this lesson.

Rules:
- ${maxSlides} slides max. Structure: title slide → objectives → one idea per slide → example(s) → summary.
- Minimal text: large heading + at most 4 short bullets (max ~9 words each) per slide.
- layout: "title" (heading + subtitle), "bullets" (heading + bullets), "statement" (single big statement), "definition" (term + definition), "chart" (heading + chart data), "quote".
- Each slide has speakerNotes: what the presenter says (2-5 sentences).
- Optional "chart": { "chartType": "bar"|"line"|"pie", "labels": [...], "values": [...] } for data slides only.

Output ONLY JSON:
{ "title": "...", "slides": [{ "layout": "...", "heading": "...", "subtitle": "...", "bullets": ["..."], "term": "...", "definition": "...", "statement": "...", "chart": {...} | null, "speakerNotes": "..." }] }

STRUCTURED LESSON DATA:
${JSON.stringify(structured)}`;
    },

    /** Structured content → practical assignment. */
    assignment({ structured }) {
        return `Design ONE practical, real-world assignment for this lesson.

Output ONLY JSON:
{
  "title": "...",
  "objective": "what the student will demonstrate",
  "instructions": "step-by-step instructions in markdown",
  "submissionRequirements": ["what must be submitted"],
  "rubric": [{ "criterion": "...", "excellent": "...", "good": "...", "needsImprovement": "...", "points": number }],
  "estimatedTimeMinutes": number
}

STRUCTURED LESSON DATA:
${JSON.stringify(structured)}`;
    },

    /** Summarize lesson/structured content. */
    summary({ text }) {
        return `Summarize the following lesson material for students. Output ONLY JSON:
{ "summary": "one-paragraph summary", "keyTakeaways": ["..."], "studyNotes": "concise study notes in markdown" }

MATERIAL:
"""${text}"""`;
    },

    /** Translate lesson content preserving markdown & pedagogy. */
    translate({ text, targetLanguage }) {
        return `Translate this lesson content into ${targetLanguage}.
Preserve markdown structure, technical terms (put the original in parentheses on first use), and teaching tone.
Output ONLY JSON: { "markdown": "translated content" }

CONTENT:
"""${text}"""`;
    },

    /** Video/audio import: chapters, timestamps, subtitilizable segments. */
    videoOutline() {
        return `The attached file is a lecture recording. Analyze it fully.

Output ONLY JSON:
{
  "title": "lecture title",
  "chapters": [{ "title": "...", "startSeconds": number, "endSeconds": number, "summary": "..." }],
  "learningObjectives": ["..."],
  "transcriptSummary": "detailed summary of everything taught",
  "keyMoments": [{ "timeSeconds": number, "label": "..." }]
}`;
    },

    /** Course-level generation: outline a whole course from a topic/description. */
    courseOutline({ topic, level, lessonCount }) {
        return `Design a complete online course outline about: "${topic}"${level ? ` for ${level} learners` : ''}.

Output ONLY JSON:
{
  "title": "...",
  "description": "...",
  "level": "beginner"|"intermediate"|"advanced",
  "sections": [{ "title": "...", "lessons": [{ "title": "...", "objective": "...", "estimatedMinutes": number }] }]
}
${lessonCount ? `Target roughly ${lessonCount} lessons total.` : 'Target 8-20 lessons total.'}`;
    },

    /**
     * AI Assistant actions on existing lesson content.
     * action ∈ improve|shorten|expand|add_examples|simplify|for_beginners|for_experts|fix_grammar|custom
     */
    assist({ action, content, instructions }) {
        const actions = {
            improve: 'Improve clarity, structure, flow and pedagogy. Keep length similar.',
            shorten: 'Shorten by 40-60% while keeping every essential concept.',
            expand: 'Expand with deeper explanations, analogies and one extra worked example.',
            add_examples: 'Add 2-3 concrete worked examples in the most useful places.',
            simplify: 'Simplify the language for easier reading; keep technical accuracy.',
            for_beginners: 'Rewrite so a complete beginner can follow: define jargon, add analogies, slow the pacing.',
            for_experts: 'Rewrite for an expert audience: denser, precise, skip basics, add advanced notes.',
            fix_grammar: 'Fix grammar, spelling and punctuation only. Do not change meaning or structure.',
            custom: instructions || 'Improve the content.',
        };
        return `You are editing an online course lesson. ${actions[action] || actions.custom}
${instructions && action !== 'custom' ? `Additional instructions: ${instructions}` : ''}
Preserve markdown formatting. Output ONLY JSON: { "markdown": "revised content" }

LESSON CONTENT:
"""${content}"""`;
    },
};

module.exports = prompts;
