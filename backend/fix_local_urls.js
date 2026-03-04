/**
 * Comprehensive database cleanup: remove ALL broken local /uploads/ URLs.
 * 
 * These are files that were uploaded during development to the local filesystem.
 * Render's ephemeral filesystem deletes them on every deploy, causing 404 errors.
 * 
 * Tables and columns cleaned:
 * - users.avatar_url
 * - courses.thumbnail_url
 * - courses.preview_video_url
 * - lessons.video_url
 * - lessons.resources (JSONB — removes entries with local URLs)
 * - lessons.practice_files (JSONB — removes entries with local URLs)
 * - course_resources.url
 * - projects.attachment_url
 * - project_submissions.submission_url
 * - practice_submissions.file_url
 * - certificates.certificate_url
 * 
 * Usage: cd backend && node fix_local_urls.js
 */

require("dotenv").config();
const { query, pool } = require("./src/config/database");

async function fixAll() {
    console.log("🔧 Cleaning broken local /uploads/ URLs from database...\n");

    let totalFixed = 0;

    // ── 1. Simple TEXT columns: NULL out any value starting with /uploads/ or uploads/ ──
    const textColumns = [
        { table: "users", col: "avatar_url" },
        { table: "courses", col: "thumbnail_url" },
        { table: "courses", col: "preview_video_url" },
        { table: "lessons", col: "video_url" },
        { table: "course_resources", col: "url" },
        { table: "projects", col: "attachment_url" },
        { table: "project_submissions", col: "submission_url" },
        { table: "practice_submissions", col: "file_url" },
        { table: "certificates", col: "certificate_url" },
    ];

    for (const { table, col } of textColumns) {
        try {
            const result = await query(
                `UPDATE ${table} 
         SET ${col} = NULL 
         WHERE ${col} IS NOT NULL 
           AND (${col} LIKE '/uploads/%' 
             OR ${col} LIKE 'uploads/%'
             OR (${col} NOT LIKE 'http%' AND ${col} NOT LIKE '%cloudinary%' AND ${col} IS NOT NULL AND ${col} != ''))
        `
            );
            if (result.rowCount > 0) {
                console.log(`  ✅ ${table}.${col}: cleared ${result.rowCount} broken URL(s)`);
                totalFixed += result.rowCount;
            } else {
                console.log(`  ⏭️  ${table}.${col}: no broken URLs found`);
            }
        } catch (err) {
            // Table or column might not exist yet
            console.log(`  ⚠️  ${table}.${col}: skipped (${err.message.substring(0, 60)})`);
        }
    }

    // ── 2. JSONB columns: filter out resource entries with local URLs ────────────
    const jsonbColumns = [
        { table: "lessons", col: "resources" },
        { table: "lessons", col: "practice_files" },
    ];

    for (const { table, col } of jsonbColumns) {
        try {
            // Find lessons where any resource has a local URL
            const findResult = await query(
                `SELECT id, ${col} FROM ${table} 
         WHERE ${col} IS NOT NULL 
           AND ${col}::text LIKE '%/uploads/%'`
            );

            let jsonFixed = 0;
            for (const row of findResult.rows) {
                let resources = row[col];
                if (typeof resources === "string") {
                    try { resources = JSON.parse(resources); } catch { continue; }
                }
                if (!Array.isArray(resources)) continue;

                // Filter out entries with local URLs
                const cleaned = resources.filter((r) => {
                    if (!r.url) return true;
                    return !r.url.startsWith("/uploads/") && !r.url.startsWith("uploads/");
                });

                if (cleaned.length !== resources.length) {
                    await query(
                        `UPDATE ${table} SET ${col} = $1 WHERE id = $2`,
                        [JSON.stringify(cleaned), row.id]
                    );
                    jsonFixed += resources.length - cleaned.length;
                }
            }

            if (jsonFixed > 0) {
                console.log(`  ✅ ${table}.${col}: removed ${jsonFixed} broken resource entry/entries`);
                totalFixed += jsonFixed;
            } else {
                console.log(`  ⏭️  ${table}.${col}: no broken resource URLs found`);
            }
        } catch (err) {
            console.log(`  ⚠️  ${table}.${col}: skipped (${err.message.substring(0, 60)})`);
        }
    }

    console.log(`\n✅ Done! Fixed ${totalFixed} broken local URL(s) total.`);
    await pool.end();
    process.exit(0);
}

fixAll().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
