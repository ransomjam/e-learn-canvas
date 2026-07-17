/**
 * Cloudflare R2 storage (S3-compatible).
 *
 * Used for images, PDFs, documents and any non-video files.
 * R2 has zero egress fees, which is why it replaces Cloudinary here.
 *
 * Required env vars:
 *   R2_ACCOUNT_ID        — Cloudflare account ID
 *   R2_ACCESS_KEY_ID     — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret
 *   R2_BUCKET            — bucket name (e.g. "cradema")
 *   R2_PUBLIC_BASE_URL   — public base URL of the bucket, no trailing slash
 *                          (e.g. "https://pub-xxxx.r2.dev" or "https://files.cradema.com")
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const isConfigured = !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET &&
    process.env.R2_PUBLIC_BASE_URL
);

let s3 = null;
let PutObjectCommand, DeleteObjectCommand, getSignedUrl;

if (isConfigured) {
    const { S3Client, PutObjectCommand: Put, DeleteObjectCommand: Del } = require('@aws-sdk/client-s3');
    ({ getSignedUrl } = require('@aws-sdk/s3-request-presigner'));
    PutObjectCommand = Put;
    DeleteObjectCommand = Del;

    s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
    });
    console.log('📦 Cloudflare R2 configured (bucket:', process.env.R2_BUCKET + ')');
} else {
    console.log('ℹ️  Cloudflare R2 not configured — set R2_* env vars to enable it');
}

const BUCKET = process.env.R2_BUCKET;
const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '');

/**
 * Build a unique object key: cradema/<folder>/<timestamp>-<random>-<sanitized-name>
 * The original filename is kept (sanitized) so downloads get a meaningful name
 * and the extension survives for Content-Type detection.
 */
const makeKey = (folder, originalname) => {
    const ext = path.extname(originalname || '').toLowerCase();
    const base = path
        .basename(originalname || 'file', ext)
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .slice(0, 80);
    const rand = crypto.randomBytes(4).toString('hex');
    return `cradema/${folder}/${Date.now()}-${rand}-${base}${ext}`;
};

const publicUrl = (key) => `${PUBLIC_BASE}/${key.split('/').map(encodeURIComponent).join('/')}`;

/** Upload a local file (multer temp path) to R2. Returns the public URL. */
const uploadLocalFile = async (filePath, key, contentType) => {
    const stat = fs.statSync(filePath);
    await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: fs.createReadStream(filePath),
        ContentLength: stat.size,
        ContentType: contentType || 'application/octet-stream',
    }));
    return publicUrl(key);
};

/**
 * Presigned PUT URL so the browser can upload straight to R2
 * (bypasses Render's 30 s request timeout and server memory).
 */
const getPresignedPutUrl = async (key, contentType, expiresIn = 3600) => {
    const cmd = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: contentType || 'application/octet-stream',
    });
    return getSignedUrl(s3, cmd, { expiresIn });
};

/** Delete an object by its public URL (no-op for URLs outside our bucket). */
const deleteByUrl = async (url) => {
    if (!isConfigured || !url || !url.startsWith(PUBLIC_BASE + '/')) return false;
    const key = decodeURIComponent(url.slice(PUBLIC_BASE.length + 1).split('?')[0]);
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
};

module.exports = {
    isConfigured,
    makeKey,
    publicUrl,
    uploadLocalFile,
    getPresignedPutUrl,
    deleteByUrl,
    PUBLIC_BASE,
};
