const { query } = require('../config/database');
require('dotenv').config();

async function addPracticeFilesColumn() {
    try {
        await query(`
            ALTER TABLE lessons 
            ADD COLUMN IF NOT EXISTS practice_files JSONB DEFAULT '[]'::jsonb;
        `);
        console.log('✓ Added practice_files column to lessons table');
    } catch (error) {
        console.error('Error adding practice_files column:', error);
    }
    process.exit();
}

addPracticeFilesColumn();
