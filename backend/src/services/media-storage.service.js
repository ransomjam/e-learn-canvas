/**
 * Media storage for server-rendered videos (whiteboard explainers).
 *
 * Same storage ladder as instructor uploads: Bunny Stream first (HLS
 * streaming, like every other course video), then Cloudflare R2 (direct
 * MP4), then the local uploads directory in development. The returned URL
 * is stored on the lesson exactly like a normal uploaded video, so the
 * player treats whiteboard videos identically to instructor uploads.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bunny = require('../config/bunny');
const r2 = require('../config/r2');

const LOCAL_UPLOADS_DIR = path.join(__dirname, '../../uploads');

async function storeRenderedVideo(filePath, title) {
    // 1. Bunny Stream — transcoded to HLS and served from the CDN
    if (bunny.isConfigured) {
        const videoId = await bunny.createVideo(title || 'Whiteboard lesson');
        const url = await bunny.uploadLocalFile(videoId, filePath);
        return { url, provider: 'bunny' };
    }

    // 2. Cloudflare R2 — direct MP4 (progressive playback)
    if (r2.isConfigured) {
        const key = r2.makeKey('videos', `${(title || 'whiteboard').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 60)}.mp4`);
        const url = await r2.uploadLocalFile(filePath, key, 'video/mp4');
        return { url, provider: 'r2' };
    }

    // 3. Local disk (development) — served from /uploads with Range support
    fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
    const filename = `whiteboard-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.mp4`;
    fs.copyFileSync(filePath, path.join(LOCAL_UPLOADS_DIR, filename));
    return { url: `/uploads/${filename}`, provider: 'local' };
}

module.exports = { storeRenderedVideo };
