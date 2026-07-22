/**
 * Shared provider plumbing: typed errors, retry with backoff, defensive
 * JSON parsing, and HTTP error normalization. Every provider module uses
 * these so behavior is consistent regardless of vendor.
 */
const aiConfig = require('../../../config/ai');

class AIProviderError extends Error {
    constructor(message, { statusCode = 502, retryable = false, cause } = {}) {
        super(message);
        this.name = 'AIProviderError';
        this.statusCode = statusCode;
        this.retryable = retryable;
        this.cause = cause;
    }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Map raw HTTP/axios errors to actionable AIProviderErrors. */
function normalizeProviderError(err, providerName) {
    if (err instanceof AIProviderError) return err;
    const status = err.response?.status;
    if (status === 401 || status === 403) {
        return new AIProviderError(
            `The ${providerName} API key was rejected — check the server's AI configuration`,
            { statusCode: status, retryable: false, cause: err }
        );
    }
    if (status === 429) {
        return new AIProviderError(
            `The ${providerName} API rate limit was reached — please try again shortly`,
            { statusCode: 429, retryable: true, cause: err }
        );
    }
    return err;
}

/** Retry transient failures with exponential backoff. */
async function withRetry(fn, label) {
    let lastErr;
    for (let attempt = 0; attempt <= aiConfig.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (rawErr) {
            const err = normalizeProviderError(rawErr, label.split(':')[0]);
            lastErr = err;
            const retryable = err.retryable
                || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED'
                || [429, 500, 502, 503, 504].includes(err.response?.status);
            if (!retryable || attempt === aiConfig.maxRetries) break;
            const delay = aiConfig.retryBaseDelayMs * Math.pow(2, attempt);
            console.warn(`[AI] ${label} failed (attempt ${attempt + 1}), retrying in ${delay}ms:`, err.message);
            await sleep(delay);
        }
    }
    throw lastErr;
}

/** Strip markdown fences and parse the model's JSON output defensively. */
function parseModelJson(text) {
    if (typeof text !== 'string') throw new AIProviderError('Empty model response');
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    try {
        return JSON.parse(cleaned);
    } catch {
        const start = cleaned.search(/[[{]/);
        if (start >= 0) {
            const open = cleaned[start];
            const close = open === '{' ? '}' : ']';
            const end = cleaned.lastIndexOf(close);
            if (end > start) {
                try {
                    return JSON.parse(cleaned.slice(start, end + 1));
                } catch { /* fall through */ }
            }
        }
        throw new AIProviderError('The AI returned malformed JSON output', { retryable: true });
    }
}

module.exports = { AIProviderError, sleep, withRetry, parseModelJson, normalizeProviderError };
