require('dotenv').config();
const { pool } = require('../config/database');

const migrateQuizzes = async () => {
    const client = await pool.connect();
    try {
        console.log('🔄 Starting quizzes migration...\n');
        await client.query('BEGIN');

        // 1. Add is_mandatory and quiz_data to lessons table
        console.log('  ⬆️  Updating lessons table...');
        await client.query(`
      ALTER TABLE lessons ADD COLUMN IF NOT EXISTS is_mandatory BOOLEAN DEFAULT false;
      ALTER TABLE lessons ADD COLUMN IF NOT EXISTS quiz_data JSONB DEFAULT '[]';
    `);

        // 2. Create quiz_attempts table
        console.log('  ⬆️  Creating quiz_attempts table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        score DECIMAL(5, 2) NOT NULL,
        total_questions INTEGER NOT NULL,
        answers JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id);
      CREATE INDEX IF NOT EXISTS idx_quiz_attempts_lesson ON quiz_attempts(lesson_id);
    `);

        await client.query('COMMIT');
        console.log('\n✅ Quizzes migration completed successfully!');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ Quizzes migration failed:', error.message);
        throw error;
    } finally {
        client.release();
    }
};

// If run directly
if (require.main === module) {
    migrateQuizzes()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { migrateQuizzes };
