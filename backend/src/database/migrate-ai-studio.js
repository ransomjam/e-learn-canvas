/**
 * AI Course Studio migration — jobs, storyboards, scenes, decks, artifacts.
 * Usage:  cd backend && node src/database/migrate-ai-studio.js
 *
 * Every statement is idempotent (IF NOT EXISTS) so it is safe to re-run.
 */
require('dotenv').config();
const { pool } = require('../config/database');

const AI_STUDIO_SQL = `
  -- Background AI jobs (asynchronous generations with progress)
  CREATE TABLE IF NOT EXISTS ai_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued'
      CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
    progress INTEGER NOT NULL DEFAULT 0,
    step_label VARCHAR(255),
    input JSONB NOT NULL DEFAULT '{}',
    result JSONB,
    error TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_ai_jobs_user ON ai_jobs(user_id);
  CREATE INDEX IF NOT EXISTS idx_ai_jobs_course ON ai_jobs(course_id);
  CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_jobs(status);

  -- Whiteboard storyboards (one per generated whiteboard lesson)
  CREATE TABLE IF NOT EXISTS storyboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    structured_content JSONB NOT NULL DEFAULT '{}',
    total_duration_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_storyboards_course ON storyboards(course_id);
  CREATE INDEX IF NOT EXISTS idx_storyboards_lesson ON storyboards(lesson_id);

  -- Individual scenes: description (AI) + compiled scene graph (deterministic).
  -- Editing/regenerating one scene never touches the others.
  CREATE TABLE IF NOT EXISTS storyboard_scenes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    storyboard_id UUID NOT NULL REFERENCES storyboards(id) ON DELETE CASCADE,
    scene_index INTEGER NOT NULL,
    scene JSONB NOT NULL DEFAULT '{}',
    scene_graph JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (storyboard_id, scene_index)
  );
  CREATE INDEX IF NOT EXISTS idx_storyboard_scenes_storyboard ON storyboard_scenes(storyboard_id);

  -- Flashcard decks + cards
  CREATE TABLE IF NOT EXISTS flashcard_decks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_flashcard_decks_lesson ON flashcard_decks(lesson_id);
  CREATE INDEX IF NOT EXISTS idx_flashcard_decks_course ON flashcard_decks(course_id);

  CREATE TABLE IF NOT EXISTS flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deck_id UUID NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    difficulty VARCHAR(20) DEFAULT 'medium',
    tags JSONB DEFAULT '[]',
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_flashcards_deck ON flashcards(deck_id);

  -- Slide decks (slides stored as JSONB — atomic unit is the deck)
  CREATE TABLE IF NOT EXISTS slide_decks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    slides JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_slide_decks_lesson ON slide_decks(lesson_id);
  CREATE INDEX IF NOT EXISTS idx_slide_decks_course ON slide_decks(course_id);

  -- Every intermediate generated asset (structured content, drafts, quizzes,
  -- assignments, summaries, recording analyses...). Never store only the
  -- final output — these enable partial regeneration and auditing.
  CREATE TABLE IF NOT EXISTS ai_artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES ai_jobs(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
    kind VARCHAR(50) NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_ai_artifacts_job ON ai_artifacts(job_id);
  CREATE INDEX IF NOT EXISTS idx_ai_artifacts_lesson ON ai_artifacts(lesson_id);
  CREATE INDEX IF NOT EXISTS idx_ai_artifacts_kind ON ai_artifacts(kind);

  -- Generation history: audit + response cache (input_hash lookup)
  CREATE TABLE IF NOT EXISTS ai_generation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    provider VARCHAR(30),
    model VARCHAR(80),
    input_hash VARCHAR(64),
    output JSONB,
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_ai_history_hash ON ai_generation_history(input_hash);
  CREATE INDEX IF NOT EXISTS idx_ai_history_user ON ai_generation_history(user_id);
`;

const migrateAiStudio = async () => {
    const client = await pool.connect();
    try {
        console.log('🔄 Starting AI Course Studio migration...\n');
        await client.query('BEGIN');
        await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
        await client.query(AI_STUDIO_SQL);
        await client.query('COMMIT');
        console.log('✅ AI Course Studio migration completed successfully!');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ AI Course Studio migration failed:', error.message);
        throw error;
    } finally {
        client.release();
    }
};

if (require.main === module) {
    migrateAiStudio()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { migrateAiStudio, AI_STUDIO_SQL };
