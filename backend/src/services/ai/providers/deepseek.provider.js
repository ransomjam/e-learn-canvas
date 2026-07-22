/**
 * DeepSeek provider — OpenAI-compatible chat completions. Text-only
 * (no media understanding); kept as a fallback / alternative provider to
 * prove the provider abstraction supports multiple vendors.
 */
const axios = require('axios');
const aiConfig = require('../../../config/ai');
const { AIProviderError, withRetry, parseModelJson } = require('./provider-utils');

async function chat({ prompt, system, model, temperature = 0.4, maxOutputTokens = 8192, json = false }) {
    if (!aiConfig.deepseek.apiKey) {
        throw new AIProviderError('AI is not configured on this server (missing DEEPSEEK_API_KEY)', { statusCode: 503 });
    }
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const res = await axios.post(
        `${aiConfig.deepseek.baseUrl}/chat/completions`,
        {
            model: model || aiConfig.deepseek.model,
            messages,
            temperature,
            max_tokens: maxOutputTokens,
            ...(json ? { response_format: { type: 'json_object' } } : {}),
        },
        {
            headers: {
                Authorization: `Bearer ${aiConfig.deepseek.apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: aiConfig.requestTimeoutMs,
        }
    );
    const content = res.data?.choices?.[0]?.message?.content;
    if (!content) throw new AIProviderError('DeepSeek returned no content', { retryable: true });
    return content;
}

module.exports = {
    name: 'deepseek',
    supportsMedia: false,

    async generateText(opts) {
        return withRetry(() => chat(opts), 'deepseek:text');
    },

    async generateJSON(opts) {
        return withRetry(async () => {
            const raw = await chat({ ...opts, json: false });
            return parseModelJson(raw);
        }, 'deepseek:json');
    },

    async prepareMediaFromUrl() {
        throw new AIProviderError('The configured AI provider does not support file/audio/video understanding', { statusCode: 400 });
    },

    async prepareMediaFromBuffer() {
        throw new AIProviderError('The configured AI provider does not support file/audio/video understanding', { statusCode: 400 });
    },
};
