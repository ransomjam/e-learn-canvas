/**
 * One-off migration: move every asset referenced in the database from
 * Cloudinary to the new storage providers, then rewrite the URLs in place.
 *
 *   videos            → Bunny Stream (re-transcoded to adaptive HLS)
 *   images/raw files  → Cloudflare R2
 *
 * The script scans ALL text/varchar/json/jsonb columns of every table in the
 * public schema, so it catches avatars, thumbnails, lesson videos, resources
 * arrays, project attachments, submissions — everything — without needing a
 * hardcoded column list.
 *
 * Cloudinary assets are NOT deleted; once you've verified the app works,
 * delete the Cloudinary account (or its media) manually.
 *
 * Usage (from backend/):
 *   node src/database/migrate-storage.js --dry-run     # report only
 *   node src/database/migrate-storage.js               # migrate + rewrite
 *
 * Requires: DATABASE_URL, R2_*, BUNNY_* and CLOUDINARY_* env vars all set
 * (Cloudinary creds are needed to sign download URLs for restricted assets).
 */
require('dotenv').config();

const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');

const { query, pool } = require('../config/database');
const r2 = require('../config/r2');
const bunny = require('../config/bunny');
const { signCloudinaryUrl } = require('../controllers/upload.controller');

const DRY_RUN = process.argv.includes('--dry-run');
const CLOUDINARY_URL_RE = /https?:\/\/res\.cloudinary\.com\/[^\s"'\\<>)}\]]+/g;

// old URL → new URL (cache so the same asset referenced twice maps once)
const urlMap = new Map();
const failures = [];

const classify = (url) => {
    if (url.includes('/video/upload/')) return 'video';
    if (url.includes('/image/upload/')) return 'image';
    return 'raw';
};

// Minimal magic-bytes sniffing for extensionless legacy raw uploads
const sniffExt = (buf) => {
    if (!buf || buf.length < 4) return '';
    if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return '.pdf';
    if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
        const s = buf.toString('ascii', 0, Math.min(buf.length, 4096));
        if (s.includes('xl/')) return '.xlsx';
        if (s.includes('ppt/')) return '.pptx';
        if (s.includes('word/')) return '.docx';
        return '.zip';
    }
    if (buf[0] === 0x89 && buf[1] === 0x50) return '.png';
    if (buf[0] === 0xff && buf[1] === 0xd8) return '.jpg';
    if (buf[0] === 0x47 && buf[1] === 0x49) return '.gif';
    return '';
};

const download = async (url) => {
    // Sign so restricted Cloudinary assets are downloadable
    const fetchUrl = signCloudinaryUrl(url);
    const res = await axios.get(fetchUrl, {
        responseType: 'arraybuffer',
        maxRedirects: 5,
        timeout: 10 * 60 * 1000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        validateStatus: (s) => s === 200,
    });
    return Buffer.from(res.data);
};

const migrateOne = async (url) => {
    if (urlMap.has(url)) return urlMap.get(url);

    const kind = classify(url);
    console.log(`\n→ [${kind}] ${url.slice(0, 110)}`);

    if (DRY_RUN) {
        urlMap.set(url, `<would migrate to ${kind === 'video' ? 'Bunny' : 'R2'}>`);
        return urlMap.get(url);
    }

    const buf = await download(url);
    console.log(`  downloaded ${(buf.length / 1024 / 1024).toFixed(2)} MB`);

    // Work out a filename with a real extension
    let name = decodeURIComponent(path.basename(new URL(url).pathname));
    if (!path.extname(name)) name += sniffExt(buf) || '';

    const tmp = path.join(os.tmpdir(), `mig-${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(name) || '.bin'}`);
    fs.writeFileSync(tmp, buf);

    try {
        let newUrl;
        if (kind === 'video') {
            const videoId = await bunny.createVideo(name || 'migrated-video');
            newUrl = await bunny.uploadLocalFile(videoId, tmp);
        } else {
            const folder = kind === 'image' ? 'images' : 'files';
            const key = r2.makeKey(folder, name || 'file');
            const mime = require('mime-types').lookup(name) || 'application/octet-stream';
            newUrl = await r2.uploadLocalFile(tmp, key, mime);
        }
        console.log(`  ✅ → ${newUrl}`);
        urlMap.set(url, newUrl);
        return newUrl;
    } finally {
        fs.unlinkSync(tmp);
    }
};

const main = async () => {
    console.log(DRY_RUN ? '🔎 DRY RUN — nothing will be changed\n' : '🚚 Migrating Cloudinary assets → R2 / Bunny Stream\n');

    if (!DRY_RUN) {
        if (!r2.isConfigured) throw new Error('R2 is not configured (set R2_* env vars)');
        // Bunny is only required if videos are found — checked lazily below.
    }

    // Every text-ish column in the public schema
    const colsRes = await query(`
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type IN ('text', 'character varying', 'json', 'jsonb')
        ORDER BY table_name, column_name
    `);

    let totalRefs = 0;

    for (const { table_name, column_name, data_type } of colsRes.rows) {
        const isJson = data_type === 'json' || data_type === 'jsonb';
        const colExpr = isJson ? `"${column_name}"::text` : `"${column_name}"`;

        let rows;
        try {
            rows = (await query(
                `SELECT ${colExpr} AS val FROM "${table_name}" WHERE ${colExpr} LIKE '%res.cloudinary.com%'`
            )).rows;
        } catch (e) {
            continue; // views / permission quirks — skip
        }
        if (rows.length === 0) continue;

        const urls = new Set();
        for (const row of rows) {
            for (const m of (row.val || '').matchAll(CLOUDINARY_URL_RE)) urls.add(m[0]);
        }
        if (urls.size === 0) continue;

        console.log(`\n📋 ${table_name}.${column_name}: ${rows.length} row(s), ${urls.size} unique URL(s)`);
        totalRefs += urls.size;

        // Check Bunny availability before touching videos
        const hasVideo = [...urls].some((u) => classify(u) === 'video');
        if (hasVideo && !DRY_RUN && !bunny.isConfigured) {
            throw new Error('Videos found but Bunny Stream is not configured (set BUNNY_* env vars)');
        }

        for (const url of urls) {
            try {
                const newUrl = await migrateOne(url);
                if (DRY_RUN) continue;

                // Rewrite every occurrence in this column
                const updateSql = isJson
                    ? `UPDATE "${table_name}" SET "${column_name}" = REPLACE("${column_name}"::text, $1, $2)::${data_type} WHERE "${column_name}"::text LIKE '%' || $1 || '%'`
                    : `UPDATE "${table_name}" SET "${column_name}" = REPLACE("${column_name}", $1, $2) WHERE "${column_name}" LIKE '%' || $1 || '%'`;
                const upd = await query(updateSql, [url, newUrl]);
                console.log(`  ✏️  rewrote ${upd.rowCount} row(s) in ${table_name}.${column_name}`);
            } catch (err) {
                console.error(`  ❌ FAILED: ${url.slice(0, 100)} — ${err.message}`);
                failures.push({ url, table: table_name, column: column_name, error: err.message });
            }
        }
    }

    console.log('\n──────────────────────────────────────────');
    console.log(`Unique assets found:    ${urlMap.size}`);
    console.log(`Failed:                 ${failures.length}`);
    if (failures.length) {
        console.log('\nFailures (rows left untouched, still pointing at Cloudinary):');
        failures.forEach((f) => console.log(`  - ${f.table}.${f.column}: ${f.url.slice(0, 90)} → ${f.error}`));
    }
    if (!DRY_RUN && urlMap.size > 0) {
        console.log('\n✅ Done. Verify the app, then Cloudinary can be emptied/closed.');
        console.log('   Note: Bunny videos need a few minutes to finish transcoding before playback works.');
    }
    if (totalRefs === 0) console.log('No Cloudinary URLs found — nothing to migrate. 🎉');

    await pool.end();
};

main().catch((err) => {
    console.error('\n💥 Migration aborted:', err.message);
    process.exit(1);
});
