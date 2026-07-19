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
        requestHandler: {
            requestTimeout: 30000,
            connectionTimeout: 10000,
        },
    });
    console.log('📦 Cloudflare R2 configured:');
    console.log('   endpoint :', `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
    console.log('   bucket   :', process.env.R2_BUCKET);
    console.log('   public   :', process.env.R2_PUBLIC_BASE_URL);
    console.log('   key id   :', process.env.R2_ACCESS_KEY_ID?.slice(0, 8) + '...');
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
    const endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    console.log(`📤 R2 PUT → ${endpoint} | bucket=${BUCKET} | key=${key}`);
    try {
        await s3.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: fs.createReadStream(filePath),
            ContentLength: stat.size,
            ContentType: contentType || 'application/octet-stream',
        }));
    } catch (err) {
        // Surface the exact endpoint so misconfigured account IDs are obvious in logs
        const msg = err.message || String(err);
        throw new Error(`R2 upload failed (endpoint=${endpoint}, bucket=${BUCKET}): ${msg}`);
    }
    return publicUrl(key);
};

/**
 * Presigned PUT URL so the browser can upload straight to R2.
 *
 * The S3 SDK generates a URL pointing to the private S3 API endpoint
 * (<bucket>.<accountId>.r2.cloudflarestorage.com), which causes
 * ERR_SSL_VERSION_OR_CIPHER_MISMATCH in browsers. We rewrite the hostname
 * to the public base URL after signing — R2 accepts the same signed request
 * on either hostname, so the signature stays valid.
 */
const getPresignedPutUrl = async (key, contentType, expiresIn = 3600) => {
    const cmd = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: contentType || 'application/octet-stream',
    });
    const signed = await getSignedUrl(s3, cmd, { expiresIn });

    // Rewrite the S3 API hostname to the browser-accessible public base URL.
    // e.g. https://<bucket>.<accountId>.r2.cloudflarestorage.com/<key>?...
    //   -> https://files.cradema.com/<key>?...
    try {
        const u = new URL(signed);
        const pub = new URL(PUBLIC_BASE);
        u.hostname = pub.hostname;
        u.port = pub.port || '';
        u.protocol = pub.protocol;
        // Strip the bucket path prefix that path-style URLs add (not present in virtual-hosted style)
        // The signed URL path is /<bucket>/<key> in path-style or /<key> in virtual-hosted style.
        // R2 with a custom domain uses path-style: /<key> directly, so remove /<bucket> prefix if present.
        if (u.pathname.startsWith(`/${BUCKET}/`)) {
            u.pathname = u.pathname.slice(BUCKET.length + 1);
        }
        return u.toString();
    } catch {
        return signed; // fallback: return original if URL parsing fails
    }
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
