/**
 * Migration: Add google_id column to users table for Google OAuth support
 */
require('dotenv').config();
const { pool } = require('../config/database');

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('🔄 Adding google_id column to users table...');

        await client.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
        `);

        console.log('✅ Migration complete: google_id column added');
    } catch (error) {
        if (error.message.includes('already exists')) {
            console.log('⏭️  Column google_id already exists, skipping.');
        } else {
            throw error;
        }
    } finally {
        client.release();
        await pool.end();
    }
}

migrate().catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
