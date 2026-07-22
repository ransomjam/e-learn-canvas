/**
 * Content extraction — the entry gate of the AI pipeline.
 *
 * Every input type (idea, pasted text, PDF, DOCX, PPTX, audio, video,
 * existing lesson) is normalized here into the same structured educational
 * representation (see prompts.STRUCTURED_CONTENT_SCHEMA). That structured
 * JSON — not the original file — is the source of truth for all further
 * generation.
 */
const axios = require('axios');
const mime = require('mime-types');
const { query } = require('../../config/database');
const aiConfig = require('../../config/ai');
const { getProvider, getMediaProvider } = require('./providers');
const prompts = require('./prompts');

/** Best-effort MIME type from an explicit value or the URL's extension. */
function resolveMime(fileUrl, explicit, fallback) {
    if (explicit) return explicit;
    try {
        const pathname = new URL(fileUrl).pathname;
        const guessed = mime.lookup(pathname);
        if (guessed) return guessed;
    } catch { /* not a URL */ }
    return fallback;
}

async function downloadBuffer(fileUrl) {
    const res = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
        timeout: 10 * 60 * 1000,
        maxContentLength: 2 * 1024 * 1024 * 1024,
    });
    return Buffer.from(res.data);
}

/** DOCX → plain text (mammoth). */
async function extractDocxText(buffer) {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
}

/** PPTX → plain text (unzip + read the text runs of each slide). */
async function extractPptxText(buffer) {
    const JSZip = require('jszip');
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files)
        .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));

    const slides = [];
    for (const name of slideFiles) {
        const xml = await zip.files[name].async('string');
        // <a:t> holds every text run in a PPTX slide
        const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
        if (texts.length) slides.push(`--- Slide ${slides.length + 1} ---\n${texts.join('\n')}`);
    }
    return slides.join('\n\n');
}

/** Truncate huge sources to keep token usage sane. */
function boundText(text) {
    if (!text) return text;
    if (text.length <= aiConfig.maxSourceChars) return text;
    return text.slice(0, aiConfig.maxSourceChars) + '\n\n[...source truncated...]';
}

const extractionService = {
    /**
     * Normalize any content source into structured educational data.
     *
     * @param {object} source
     *   { sourceType: 'idea'|'text'|'pdf'|'doc'|'ppt'|'audio'|'video'|'lesson',
     *     text?, fileUrl?, mimeType?, lessonId? }
     * @param {object} options  { language?, level?, courseTitle? }
     * @param {function} onProgress  (label) => void
     * @returns {Promise<object>} structured lesson content
     */
    async extract(source, options = {}, onProgress = () => { }) {
        const { sourceType } = source;

        switch (sourceType) {
            case 'idea': {
                onProgress('Understanding your idea...');
                return getProvider().generateJSON({
                    system: prompts.EDUCATOR_SYSTEM,
                    prompt: prompts.expandIdea({
                        idea: source.text,
                        courseTitle: options.courseTitle,
                        level: options.level,
                    }),
                    temperature: 0.6,
                });
            }

            case 'text': {
                onProgress('Understanding content...');
                return this.structureText(boundText(source.text), 'pasted lesson text', options);
            }

            case 'doc': {
                onProgress('Reading document...');
                const buffer = await downloadBuffer(source.fileUrl);
                const text = await extractDocxText(buffer);
                if (!text.trim()) throw new Error('Could not extract any text from the Word document');
                onProgress('Understanding content...');
                return this.structureText(boundText(text), 'Word document', options);
            }

            case 'ppt': {
                onProgress('Reading presentation...');
                const buffer = await downloadBuffer(source.fileUrl);
                const text = await extractPptxText(buffer);
                if (!text.trim()) throw new Error('Could not extract any text from the presentation');
                onProgress('Understanding content...');
                return this.structureText(boundText(text), 'PowerPoint presentation', options);
            }

            case 'pdf': {
                onProgress('Reading PDF...');
                const provider = getMediaProvider();
                const mimeType = resolveMime(source.fileUrl, source.mimeType, 'application/pdf');
                const media = await provider.prepareMediaFromUrl(source.fileUrl, mimeType, 'lesson-source.pdf');
                onProgress('Understanding content...');
                return provider.generateJSON({
                    system: prompts.EDUCATOR_SYSTEM,
                    prompt: prompts.extractStructuredContent({ sourceDescription: 'attached PDF document', language: options.language }),
                    media: [media],
                    model: aiConfig.gemini.longContextModel,
                });
            }

            case 'audio':
            case 'video': {
                onProgress(sourceType === 'audio' ? 'Listening to your recording...' : 'Watching the video...');
                const provider = getMediaProvider();
                const fallbackMime = sourceType === 'audio' ? 'audio/webm' : 'video/mp4';
                const mimeType = resolveMime(source.fileUrl, source.mimeType, fallbackMime);
                const media = await provider.prepareMediaFromUrl(source.fileUrl, mimeType, `lesson-source-${sourceType}`);
                onProgress('Transcribing and understanding...');
                return provider.generateJSON({
                    system: prompts.EDUCATOR_SYSTEM,
                    prompt: prompts.extractStructuredContent({
                        sourceDescription: sourceType === 'audio'
                            ? 'attached voice recording of an instructor explaining a lesson'
                            : 'attached lecture video',
                        language: options.language,
                    }),
                    media: [media],
                    model: aiConfig.gemini.longContextModel,
                });
            }

            case 'lesson': {
                onProgress('Loading existing lesson...');
                const result = await query(
                    'SELECT title, description, content, quiz_data FROM lessons WHERE id = $1',
                    [source.lessonId]
                );
                if (result.rows.length === 0) throw new Error('Lesson not found');
                const lesson = result.rows[0];
                const text = `# ${lesson.title}\n\n${lesson.description || ''}\n\n${lesson.content || ''}`;
                if (text.trim().length < 30) throw new Error('This lesson has no text content to work from');
                onProgress('Understanding content...');
                return this.structureText(boundText(text), 'existing course lesson', options);
            }

            default:
                throw new Error(`Unsupported source type: ${sourceType}`);
        }
    },

    /** Plain text → structured content (shared by text/doc/ppt/lesson paths). */
    async structureText(text, sourceDescription, options = {}) {
        return getProvider().generateJSON({
            system: prompts.EDUCATOR_SYSTEM,
            prompt: prompts.extractStructuredContent({ sourceDescription, text, language: options.language }),
            model: text.length > 60000 ? aiConfig.gemini.longContextModel : undefined,
        });
    },

    /** Analyze a lecture recording: chapters, key moments, objectives. */
    async analyzeRecording(fileUrl, mimeType) {
        const provider = getMediaProvider();
        const resolved = resolveMime(fileUrl, mimeType, 'video/mp4');
        const media = await provider.prepareMediaFromUrl(fileUrl, resolved, 'lecture-recording');
        return provider.generateJSON({
            system: prompts.EDUCATOR_SYSTEM,
            prompt: prompts.videoOutline(),
            media: [media],
            model: aiConfig.gemini.longContextModel,
        });
    },
};

module.exports = extractionService;
