const { query, pool } = require('../config/database');

async function migrateGlobalLikes() {
    try {
        console.log('Creating course_likes table for global likes...');
        await query(`
            CREATE TABLE IF NOT EXISTS course_likes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, course_id)
            )
        `);
        console.log('✓ course_likes table created');

        console.log('Creating indexes for course_likes...');
        await query(`
            CREATE INDEX IF NOT EXISTS idx_course_likes_user_id ON course_likes(user_id);
            CREATE INDEX IF NOT EXISTS idx_course_likes_course_id ON course_likes(course_id);
        `);
        console.log('✓ course_likes indexes created');

        // Add likes_count column to courses table for caching
        console.log('Adding likes_count to courses...');
        await query(`
            ALTER TABLE courses ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
        `);
        console.log('✓ likes_count column added');

        // Ensure projects table has attachment columns
        console.log('Ensuring projects table has attachment columns...');
        await query(`
            ALTER TABLE projects ADD COLUMN IF NOT EXISTS attachment_url TEXT;
            ALTER TABLE projects ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255);
        `);
        console.log('✓ projects attachment columns ensured');

        // Populate course_likes from existing lesson_likes data
        // Each user who liked any lesson in a course gets one course-level like
        console.log('Populating course_likes from existing lesson_likes...');
        await query(`
            INSERT INTO course_likes (user_id, course_id)
            SELECT DISTINCT ll.user_id, l.course_id
            FROM lesson_likes ll
            JOIN lessons l ON ll.lesson_id = l.id
            ON CONFLICT (user_id, course_id) DO NOTHING
        `);
        console.log('✓ course_likes populated from lesson_likes');

        // Update likes_count on courses
        console.log('Updating courses likes_count...');
        await query(`
            UPDATE courses SET likes_count = (
                SELECT COUNT(DISTINCT user_id) FROM course_likes WHERE course_id = courses.id
            )
        `);
        console.log('✓ courses likes_count updated');

        // Add seed categories if none exist
        console.log('Seeding popular categories...');
        const catResult = await query('SELECT COUNT(*) FROM categories');
        if (parseInt(catResult.rows[0].count) === 0) {
            await query(`
                INSERT INTO categories (name, slug, description) VALUES
                    ('Web Development', 'web-development', 'Build websites and web applications'),
                    ('Mobile Development', 'mobile-development', 'Create mobile apps for iOS and Android'),
                    ('Data Science', 'data-science', 'Analyze data and build machine learning models'),
                    ('Design', 'design', 'UI/UX design, graphic design, and more'),
                    ('Business', 'business', 'Entrepreneurship, marketing, and management'),
                    ('Programming', 'programming', 'Learn programming languages and concepts'),
                    ('Cloud Computing', 'cloud-computing', 'AWS, Azure, Google Cloud and DevOps'),
                    ('Cybersecurity', 'cybersecurity', 'Network security, ethical hacking, and more'),
                    ('AI & Machine Learning', 'ai-machine-learning', 'Artificial intelligence and deep learning'),
                    ('Digital Marketing', 'digital-marketing', 'SEO, social media, and online marketing')
                ON CONFLICT (slug) DO NOTHING
            `);
            console.log('✓ Popular categories seeded');
        } else {
            console.log('⏭️  Categories already exist, skipping seed');
        }

        console.log('\n✅ Global likes migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrateGlobalLikes();
