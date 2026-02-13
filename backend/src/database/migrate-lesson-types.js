/**
 * Migration to add new lesson types (pdf, ppt, doc, document) to the lessons table CHECK constraint.
 * Run: cd backend && node src/database/migrate-lesson-types.js
 */
require('dotenv').config();
const { pool } = require('../config/database');

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Updating lessons type constraint...');
        await client.query(`
            ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_type_check;
        `);
        await client.query(`
            ALTER TABLE lessons ADD CONSTRAINT lessons_type_check 
            CHECK (type IN ('video', 'text', 'quiz', 'assignment', 'document', 'pdf', 'ppt', 'doc'));
        `);
        console.log('✅ Constraint updated successfully!');
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
