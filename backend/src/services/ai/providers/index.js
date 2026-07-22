/**
 * Provider registry — resolves the active AI provider from config.
 *
 * Controllers and services never import a vendor module directly; they call
 * getProvider() (or let CourseAIService do it). Swapping Gemini for another
 * vendor is a one-line env change (AI_PROVIDER) plus a provider module that
 * implements the same contract:
 *
 *   { name, supportsMedia, generateText, generateJSON,
 *     prepareMediaFromUrl, prepareMediaFromBuffer }
 */
const aiConfig = require('../../../config/ai');
const gemini = require('./gemini.provider');
const deepseek = require('./deepseek.provider');

const providers = {
    gemini,
    deepseek,
};

function getProvider(name) {
    const provider = providers[name || aiConfig.provider];
    if (!provider) {
        throw new Error(`Unknown AI provider: ${name || aiConfig.provider}`);
    }
    return provider;
}

/** Provider that can understand media (PDF/audio/video), if any is configured. */
function getMediaProvider() {
    const primary = getProvider();
    if (primary.supportsMedia) return primary;
    if (aiConfig.gemini.apiKey) return gemini;
    return primary; // will throw a clear error when media is attempted
}

module.exports = { getProvider, getMediaProvider, providers };
