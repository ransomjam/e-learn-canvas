/**
 * Gemini provider — the only place in the codebase that knows how to talk
 * to the Google Generative Language API.
 *
 * Implements the common provider contract (see providers/index.js):
 *   name                       provider id
 *   supportsMedia              true — Gemini understands PDF/audio/video natively
 *   generateText(opts)         → string
 *   generateJSON(opts)         → parsed object/array
 *   prepareMediaFromUrl(...)   → opaque media part usable in `media` option
 *
 * opts: { prompt, system, media, model, temperature, maxOutputTokens }
 */
const axios = require('axios');
const aiConfig = require('../../../config/ai');
const { AIProviderError, sleep, withRetry, parseModelJson } = require('./provider-utils');

function apiKeyOrThrow() {
    if (!aiConfig.gemini.apiKey) {
        throw new AIProviderError(
            'AI is not configured on this server (missing GEMINI_API_KEY)',
            { statusCode: 503 }
        );
    }
    return aiConfig.gemini.apiKey;
}

/** Core generateContent call. */
async function generate({ prompt, system, media = [], model, temperature = 0.4, maxOutputTokens = 65536, json = false }) {
    const key = apiKeyOrThrow();
    const useModel = model || aiConfig.gemini.model;

    const parts = [];
    for (const m of media) parts.push(m); // media parts first (Gemini best practice)
    parts.push({ text: prompt });

    const body = {
        contents: [{ role: 'user', parts }],
        generationConfig: {
            temperature,
            maxOutputTokens,
            ...(json ? { responseMimeType: 'application/json' } : {}),
        },
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };

    const call = async () => {
        const res = await axios.post(
            `${aiConfig.gemini.baseUrl}/models/${useModel}:generateContent`,
            body,
            {
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
                timeout: aiConfig.requestTimeoutMs,
            }
        );
        const candidate = res.data?.candidates?.[0];
        const text = candidate?.content?.parts?.map((p) => p.text || '').join('') || '';
        if (!text) {
            const reason = candidate?.finishReason || res.data?.promptFeedback?.blockReason || 'unknown';
            throw new AIProviderError(`Gemini returned no content (${reason})`, { retryable: reason === 'unknown' });
        }
        return text;
    };

    return withRetry(call, `gemini:${useModel}`);
}

/**
 * Upload a remote file to the Gemini File API (resumable upload) and wait
 * until it is ACTIVE. Returns a `file_data` part.
 */
async function uploadToFileApi(buffer, mimeType, displayName) {
    const key = apiKeyOrThrow();

    // 1. Start resumable upload session
    const startRes = await axios.post(
        `${aiConfig.gemini.uploadBaseUrl}/files`,
        { file: { display_name: displayName || 'cradema-source' } },
        {
            headers: {
                'x-goog-api-key': key,
                'X-Goog-Upload-Protocol': 'resumable',
                'X-Goog-Upload-Command': 'start',
                'X-Goog-Upload-Header-Content-Length': String(buffer.length),
                'X-Goog-Upload-Header-Content-Type': mimeType,
                'Content-Type': 'application/json',
            },
            timeout: 60000,
        }
    );
    const uploadUrl = startRes.headers['x-goog-upload-url'];
    if (!uploadUrl) throw new AIProviderError('Gemini File API did not return an upload URL');

    // 2. Upload bytes and finalize
    const uploadRes = await axios.post(uploadUrl, buffer, {
        headers: {
            'Content-Length': String(buffer.length),
            'X-Goog-Upload-Offset': '0',
            'X-Goog-Upload-Command': 'upload, finalize',
        },
        maxBodyLength: Infinity,
        timeout: 10 * 60 * 1000,
    });
    let file = uploadRes.data?.file;
    if (!file?.name) throw new AIProviderError('Gemini File API upload failed');

    // 3. Wait for processing (audio/video files are transcoded server-side)
    const deadline = Date.now() + 8 * 60 * 1000;
    while (file.state === 'PROCESSING' && Date.now() < deadline) {
        await sleep(4000);
        const poll = await axios.get(`${aiConfig.gemini.baseUrl}/${file.name}`, {
            headers: { 'x-goog-api-key': key },
            timeout: 30000,
        });
        file = poll.data;
    }
    if (file.state !== 'ACTIVE') {
        throw new AIProviderError(`Gemini could not process the uploaded file (state: ${file.state})`);
    }
    return { file_data: { mime_type: mimeType, file_uri: file.uri } };
}

module.exports = {
    name: 'gemini',
    supportsMedia: true,
    AIProviderError,

    async generateText(opts) {
        return generate({ ...opts, json: false });
    },

    async generateJSON(opts) {
        const text = await withRetry(
            async () => {
                const out = await generate({ ...opts, json: true });
                parseModelJson(out); // validate inside retry so malformed JSON is retried
                return out;
            },
            'gemini:json'
        );
        return parseModelJson(text);
    },

    /**
     * Text → speech. Returns raw PCM audio (s16le, 24 kHz, mono) suitable
     * for the whiteboard renderer's audio track.
     */
    async generateSpeech(text, { voice } = {}) {
        const key = apiKeyOrThrow();
        const model = aiConfig.gemini.ttsModel;
        const call = async () => {
            let res;
            try {
                res = await axios.post(
                    `${aiConfig.gemini.baseUrl}/models/${model}:generateContent`,
                    {
                        contents: [{ role: 'user', parts: [{ text }] }],
                        generationConfig: {
                            responseModalities: ['AUDIO'],
                            speechConfig: {
                                voiceConfig: {
                                    prebuiltVoiceConfig: { voiceName: voice || aiConfig.gemini.ttsVoice },
                                },
                            },
                        },
                    },
                    {
                        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
                        timeout: aiConfig.requestTimeoutMs,
                    }
                );
            } catch (err) {
                // Surface the API's real reason (model access, quota, bad request)
                // so the "no narration" warning is actionable in the logs.
                const apiMsg = err.response?.data?.error?.message;
                const status = err.response?.status;
                if (apiMsg) {
                    throw new AIProviderError(`Gemini TTS (${model}): ${apiMsg}`, {
                        statusCode: status || 502,
                        retryable: [429, 500, 502, 503, 504].includes(status),
                    });
                }
                throw err;
            }
            // v1beta returns camelCase inlineData, but tolerate snake_case too.
            const parts = res.data?.candidates?.[0]?.content?.parts || [];
            const part = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
            const b64 = part?.inlineData?.data || part?.inline_data?.data;
            if (!b64) {
                const reason = res.data?.candidates?.[0]?.finishReason
                    || res.data?.promptFeedback?.blockReason || 'no audio in response';
                throw new AIProviderError(`Gemini TTS returned no audio (${reason})`, { retryable: true });
            }
            return Buffer.from(b64, 'base64');
        };
        return withRetry(call, 'gemini:tts');
    },

    /**
     * Fetch a remote file (R2/Cloudinary/local URL) and turn it into a media
     * part. Small files are inlined as base64; large files go through the
     * File API so Gemini can process long audio/video.
     */
    async prepareMediaFromUrl(url, mimeType, displayName) {
        const download = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 10 * 60 * 1000,
            maxContentLength: 2 * 1024 * 1024 * 1024,
        });
        const buffer = Buffer.from(download.data);
        return this.prepareMediaFromBuffer(buffer, mimeType, displayName);
    },

    async prepareMediaFromBuffer(buffer, mimeType, displayName) {
        if (buffer.length <= aiConfig.gemini.inlineMediaLimitBytes) {
            return { inline_data: { mime_type: mimeType, data: buffer.toString('base64') } };
        }
        return withRetry(() => uploadToFileApi(buffer, mimeType, displayName), 'gemini:file-upload');
    },
};
