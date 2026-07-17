/**
 * Bunny Stream video hosting.
 *
 * Videos are uploaded to Bunny Stream, which transcodes them to adaptive
 * HLS (multiple qualities) and serves them from a global CDN. This replaces
 * Cloudinary video hosting at a fraction of the cost.
 *
 * Required env vars:
 *   BUNNY_LIBRARY_ID  — Stream video library ID (numeric)
 *   BUNNY_API_KEY     — Stream library API key (Library → API)
 *   BUNNY_CDN_HOST    — the library's CDN hostname, no protocol
 *                       (e.g. "vz-abc12345-678.b-cdn.net")
 *
 * Optional:
 *   BUNNY_TOKEN_AUTH_KEY — if "Token Authentication" is enabled on the
 *                          library, set its key here so playback URLs are signed.
 */
const crypto = require('crypto');
const fs = require('fs');
const axios = require('axios');

const isConfigured = !!(
    process.env.BUNNY_LIBRARY_ID &&
    process.env.BUNNY_API_KEY &&
    process.env.BUNNY_CDN_HOST
);

if (isConfigured) {
    console.log('🎬 Bunny Stream configured (library:', process.env.BUNNY_LIBRARY_ID + ')');
} else {
    console.log('ℹ️  Bunny Stream not configured — set BUNNY_* env vars to enable video hosting');
}

const LIBRARY_ID = process.env.BUNNY_LIBRARY_ID;
const API_KEY = process.env.BUNNY_API_KEY;
const CDN_HOST = (process.env.BUNNY_CDN_HOST || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
const API_BASE = 'https://video.bunnycdn.com';
const TUS_ENDPOINT = 'https://video.bunnycdn.com/tusupload';

/** Create a video object in the library. Returns its guid. */
const createVideo = async (title) => {
    const res = await axios.post(
        `${API_BASE}/library/${LIBRARY_ID}/videos`,
        { title: (title || 'untitled').slice(0, 250) },
        { headers: { AccessKey: API_KEY, 'Content-Type': 'application/json' } }
    );
    return res.data.guid;
};

/**
 * Presigned signature for direct browser→Bunny TUS (resumable) uploads.
 * Per Bunny docs: sha256(library_id + api_key + expiration_time + video_id)
 */
const getTusSignature = (videoId, expiresInSeconds = 6 * 3600) => {
    const expiration = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const signature = crypto
        .createHash('sha256')
        .update(LIBRARY_ID + API_KEY + expiration + videoId)
        .digest('hex');
    return { signature, expiration, tusEndpoint: TUS_ENDPOINT };
};

/** HLS playback URL — this is what gets stored in the database. */
const hlsUrl = (videoId) => `https://${CDN_HOST}/${videoId}/playlist.m3u8`;

/** Auto-generated thumbnail. */
const thumbnailUrl = (videoId) => `https://${CDN_HOST}/${videoId}/thumbnail.jpg`;

/** Extract the video guid from any Bunny CDN URL for this library. */
const videoIdFromUrl = (url) => {
    if (!url || !CDN_HOST || !url.includes(CDN_HOST)) return null;
    const m = url.match(/b-cdn\.net\/([0-9a-f-]{36})\//i);
    return m ? m[1] : null;
};

/** Server-side upload of a local file (multer temp path) — backend proxy fallback. */
const uploadLocalFile = async (videoId, filePath) => {
    const stat = fs.statSync(filePath);
    await axios.put(
        `${API_BASE}/library/${LIBRARY_ID}/videos/${videoId}`,
        fs.createReadStream(filePath),
        {
            headers: {
                AccessKey: API_KEY,
                'Content-Type': 'application/octet-stream',
                'Content-Length': stat.size,
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 30 * 60 * 1000, // 30 min for large videos
        }
    );
    return hlsUrl(videoId);
};

/** Delete a video from the library. Accepts a guid or a Bunny CDN URL. */
const deleteVideo = async (videoIdOrUrl) => {
    const id = /^[0-9a-f-]{36}$/i.test(videoIdOrUrl)
        ? videoIdOrUrl
        : videoIdFromUrl(videoIdOrUrl);
    if (!id) return false;
    await axios.delete(`${API_BASE}/library/${LIBRARY_ID}/videos/${id}`, {
        headers: { AccessKey: API_KEY },
    });
    return true;
};

/** Fetch encoding status: 0-1 queued/processing, 2 encoding, 3 finished, 4 ready, 5 failed. */
const getVideoStatus = async (videoId) => {
    const res = await axios.get(`${API_BASE}/library/${LIBRARY_ID}/videos/${videoId}`, {
        headers: { AccessKey: API_KEY },
    });
    return res.data; // { status, encodeProgress, length, ... }
};

module.exports = {
    isConfigured,
    LIBRARY_ID,
    CDN_HOST,
    createVideo,
    getTusSignature,
    hlsUrl,
    thumbnailUrl,
    videoIdFromUrl,
    uploadLocalFile,
    deleteVideo,
    getVideoStatus,
};
