const { query } = require('../config/database');

async function migrateLikesAndProjects() {
    try {
        console.log('Creating lesson_likes table...');
        await query(`
            CREATE TABLE IF NOT EXISTS lesson_likes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, lesson_id)
            )
        `);
        console.log('✓ lesson_likes table created');

        console.log('Creating indexes for lesson_likes...');
        await query(`
            CREATE INDEX IF NOT EXISTS idx_lesson_likes_user_id ON lesson_likes(user_id);
            CREATE INDEX IF NOT EXISTS idx_lesson_likes_lesson_id ON lesson_likes(lesson_id);
        `);
        console.log('✓ lesson_likes indexes created');

        console.log('Creating projects table...');
        await query(`
            CREATE TABLE IF NOT EXISTS projects (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                instructions TEXT,
                due_date TIMESTAMP,
                max_file_size INTEGER DEFAULT 10485760,
                allowed_file_types TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ projects table created');

        console.log('Creating project_submissions table...');
        await query(`
            CREATE TABLE IF NOT EXISTS project_submissions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                submission_url TEXT,
                submission_text TEXT,
                file_name VARCHAR(255),
                file_size INTEGER,
                status VARCHAR(50) DEFAULT 'submitted',
                grade DECIMAL(5, 2),
                instructor_feedback TEXT,
                instructor_id UUID REFERENCES users(id),
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                graded_at TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(project_id, user_id)
            )
        `);
        console.log('✓ project_submissions table created');

        console.log('Creating indexes for projects and submissions...');
        await query(`
            CREATE INDEX IF NOT EXISTS idx_projects_course_id ON projects(course_id);
            CREATE INDEX IF NOT EXISTS idx_project_submissions_project_id ON project_submissions(project_id);
            CREATE INDEX IF NOT EXISTS idx_project_submissions_user_id ON project_submissions(user_id);
        `);
        console.log('✓ Indexes created for projects and submissions');

        console.log('\n✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrateLikesAndProjects();
