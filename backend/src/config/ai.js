/**
 * AI configuration — single source of truth for every AI-related setting.
 *
 * The application never talks to a model vendor directly; it talks to the
 * provider abstraction in services/ai/providers. This file only decides
 * WHICH provider/models are active and holds tuning knobs.
 *
 * Environment variables:
 *   AI_PROVIDER          gemini | deepseek     (default: gemini)
 *   GEMINI_API_KEY       Google AI Studio key  (required for gemini)
 *   GEMINI_MODEL         reasoning model       (default: gemini-2.5-flash)
 *   GEMINI_MODEL_LONG    long-context model for large documents/media
 *   DEEPSEEK_API_KEY     fallback text-only provider key
 *   AI_MAX_RETRIES       retry count for transient provider errors
 *   AI_JOB_CONCURRENCY   how many background AI jobs run in parallel
 */

// Provider resolution: explicit env wins, otherwise prefer Gemini when its
// key exists, otherwise fall back to DeepSeek (text-only).
const resolveProvider = () => {
    if (process.env.AI_PROVIDER) return process.env.AI_PROVIDER;
    if (process.env.GEMINI_API_KEY) return 'gemini';
    return 'deepseek';
};

module.exports = {
    provider: resolveProvider(),

    gemini: {
        apiKey: process.env.GEMINI_API_KEY || '',
        // Default reasoning model — fast, cheap, 1M-token context.
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        // Model used for very large documents / media understanding.
        longContextModel: process.env.GEMINI_MODEL_LONG || process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        uploadBaseUrl: 'https://generativelanguage.googleapis.com/upload/v1beta',
        // Files smaller than this are sent inline (base64); larger ones go
        // through the Gemini File API (resumable upload).
        inlineMediaLimitBytes: 18 * 1024 * 1024,
    },

    deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY || '',
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        baseUrl: 'https://api.deepseek.com',
    },

    // Transient-error retry policy (429/5xx/network)
    maxRetries: parseInt(process.env.AI_MAX_RETRIES) || 3,
    retryBaseDelayMs: 2000,

    requestTimeoutMs: parseInt(process.env.AI_REQUEST_TIMEOUT_MS) || 180000,

    // Background job worker
    jobConcurrency: parseInt(process.env.AI_JOB_CONCURRENCY) || 2,
    jobMaxAttempts: parseInt(process.env.AI_JOB_MAX_ATTEMPTS) || 2,

    // Token optimisation: extracted source text is truncated to this many
    // characters before being sent for reasoning (Gemini handles ~1M tokens,
    // this is a generous safety bound, ~250k tokens).
    maxSourceChars: parseInt(process.env.AI_MAX_SOURCE_CHARS) || 900000,

    isConfigured() {
        if (this.provider === 'gemini') return !!this.gemini.apiKey;
        if (this.provider === 'deepseek') return !!this.deepseek.apiKey;
        return false;
    },
};
