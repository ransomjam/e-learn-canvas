require('dotenv').config();
const { pool } = require('../config/database');

const migrate = async () => {
    const client = await pool.connect();

    try {
        console.log('🔄 Adding free course feature...\n');

        await client.query('BEGIN');

        // Add is_free column to courses table
        await client.query(`
            ALTER TABLE courses 
            ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false;
        `);

        console.log('✅ Added is_free column to courses table');

        // Create index for free courses
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_courses_is_free ON courses(is_free);
        `);

        console.log('✅ Created index for is_free column');

        await client.query('COMMIT');
        console.log('\n✅ Free course migration completed successfully!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
};

migrate().catch(console.error);
