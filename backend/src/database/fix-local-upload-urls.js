/**
 * fix-local-upload-urls.js
 *
 * One-time script to identify (and optionally clear) database records that still
 * reference local /uploads/ paths which no longer exist on Render's ephemeral
 * filesystem.
 *
 * Usage:
 *   node backend/src/database/fix-local-upload-urls.js         -- dry run (report only)
 *   node backend/src/database/fix-local-upload-urls.js --fix   -- clear broken URLs
 *
 * "Clear" means setting the column to NULL so the frontend shows a placeholder
 * instead of making a 404 request on every page load.
 */

require('dotenv').config();
const { pool } = require('../config/database');

const DRY_RUN = !process.argv.includes('--fix');

/** Returns true if the URL is a local /uploads/ path (not Cloudinary). */
function isLocalUpload(url) {
    if (!url) return false;
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return false;
    if (trimmed.startsWith('data:')) return false;
    // Relative paths or /uploads/... paths
    return true;
}

async function run() {
    const client = await pool.connect();
    const mode = DRY_RUN ? '🔍 DRY RUN (no changes made)' : '🔧 FIX MODE (clearing broken URLs)';
    console.log(`\n${mode}\n`);

    let totalFound = 0;

    try {
        // ── 1. courses.thumbnail_url ──────────────────────────────────────────────
        const { rows: courseThumbs } = await client.query(
            `SELECT id, title, thumbnail_url FROM courses WHERE thumbnail_url IS NOT NULL AND thumbnail_url NOT LIKE 'http%'`
        );
        console.log(`Courses with local thumbnail_url: ${courseThumbs.length}`);
        courseThumbs.forEach(r => console.log(`  [course] ${r.title} → ${r.thumbnail_url}`));
        totalFound += courseThumbs.length;
        if (!DRY_RUN && courseThumbs.length > 0) {
            await client.query(
                `UPDATE courses SET thumbnail_url = NULL WHERE thumbnail_url IS NOT NULL AND thumbnail_url NOT LIKE 'http%'`
            );
            console.log(`  ✅ Cleared ${courseThumbs.length} course thumbnail(s).`);
        }

        // ── 2. courses.preview_video_url ─────────────────────────────────────────
        const { rows: courseVideos } = await client.query(
            `SELECT id, title, preview_video_url FROM courses WHERE preview_video_url IS NOT NULL AND preview_video_url NOT LIKE 'http%'`
        );
        console.log(`Courses with local preview_video_url: ${courseVideos.length}`);
        courseVideos.forEach(r => console.log(`  [course] ${r.title} → ${r.preview_video_url}`));
        totalFound += courseVideos.length;
        if (!DRY_RUN && courseVideos.length > 0) {
            await client.query(
                `UPDATE courses SET preview_video_url = NULL WHERE preview_video_url IS NOT NULL AND preview_video_url NOT LIKE 'http%'`
            );
            console.log(`  ✅ Cleared ${courseVideos.length} course preview video(s).`);
        }

        // ── 3. lessons.video_url ─────────────────────────────────────────────────
        const { rows: lessonVideos } = await client.query(
            `SELECT id, title, video_url FROM lessons WHERE video_url IS NOT NULL AND video_url NOT LIKE 'http%'`
        );
        console.log(`Lessons with local video_url: ${lessonVideos.length}`);
        lessonVideos.forEach(r => console.log(`  [lesson] ${r.title} → ${r.video_url}`));
        totalFound += lessonVideos.length;
        if (!DRY_RUN && lessonVideos.length > 0) {
            await client.query(
                `UPDATE lessons SET video_url = NULL WHERE video_url IS NOT NULL AND video_url NOT LIKE 'http%'`
            );
            console.log(`  ✅ Cleared ${lessonVideos.length} lesson video_url(s).`);
        }

        // ── 4. users.avatar_url ──────────────────────────────────────────────────
        const { rows: userAvatars } = await client.query(
            `SELECT id, first_name, last_name, avatar_url FROM users WHERE avatar_url IS NOT NULL AND avatar_url NOT LIKE 'http%' AND avatar_url NOT LIKE 'data:%'`
        );
        console.log(`Users with local avatar_url: ${userAvatars.length}`);
        userAvatars.forEach(r => console.log(`  [user] ${r.first_name} ${r.last_name} → ${r.avatar_url}`));
        totalFound += userAvatars.length;
        if (!DRY_RUN && userAvatars.length > 0) {
            await client.query(
                `UPDATE users SET avatar_url = NULL WHERE avatar_url IS NOT NULL AND avatar_url NOT LIKE 'http%' AND avatar_url NOT LIKE 'data:%'`
            );
            console.log(`  ✅ Cleared ${userAvatars.length} user avatar(s).`);
        }

        // ── 5. course_resources.url ──────────────────────────────────────────────
        const { rows: resources } = await client.query(
            `SELECT id, title, url FROM course_resources WHERE url IS NOT NULL AND url NOT LIKE 'http%'`
        );
        console.log(`Course resources with local url: ${resources.length}`);
        resources.forEach(r => console.log(`  [resource] ${r.title} → ${r.url}`));
        totalFound += resources.length;
        if (!DRY_RUN && resources.length > 0) {
            // For resources, deleting the record is safer than leaving a null URL
            await client.query(
                `DELETE FROM course_resources WHERE url IS NOT NULL AND url NOT LIKE 'http%'`
            );
            console.log(`  ✅ Deleted ${resources.length} broken course resource(s).`);
        }

        console.log(`\n📊 Total broken local-upload records found: ${totalFound}`);
        if (DRY_RUN && totalFound > 0) {
            console.log('\n👉 Re-run with --fix to clear these broken URLs from the database.');
        } else if (!DRY_RUN) {
            console.log('\n✅ Database cleanup complete.');
        }
    } catch (err) {
        console.error('❌ Error:', err.message);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

run()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
