/**
 * Consolidated migration runner – executes ALL migration files in the correct order.
 * Usage:  cd backend && node src/database/migrate-all.js
 *
 * This is what Render's startCommand calls before starting the server so the
 * database schema is always up-to-date after every deploy.
 */

require('dotenv').config();
const { pool, query } = require('../config/database');

// ─── helpers ────────────────────────────────────────────────────────────────

async function ensureMigrationsTable() {
    await query(`
        CREATE TABLE IF NOT EXISTS migrations (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

async function getExecutedMigrations() {
    const { rows } = await query('SELECT name FROM migrations ORDER BY id');
    return new Set(rows.map(m => m.name));
}

async function runMigration(client, name, sql) {
    await client.query('BEGIN');
    try {
        await client.query(sql);
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [name]);
        await client.query('COMMIT');
        console.log(`  ✅ ${name}`);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
}

// ─── migration definitions (order matters) ──────────────────────────────────

const allMigrations = [
    // ── core schema (from migrate.js) ────────────────────────────────────
    { name: '001_enable_uuid', up: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` },
    {
        name: '002_create_users', up: `
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'learner' CHECK (role IN ('admin', 'instructor', 'learner')),
            avatar_url TEXT, bio TEXT, phone VARCHAR(20),
            is_active BOOLEAN DEFAULT true, is_verified BOOLEAN DEFAULT false,
            verification_token VARCHAR(255),
            reset_password_token VARCHAR(255), reset_password_expires TIMESTAMP,
            last_login TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    `},
    {
        name: '003_create_refresh_tokens', up: `
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token VARCHAR(500) NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
    `},
    {
        name: '004_create_categories', up: `
        CREATE TABLE IF NOT EXISTS categories (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(100) NOT NULL, slug VARCHAR(100) UNIQUE NOT NULL,
            description TEXT,
            parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
        CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
    `},
    {
        name: '005_create_courses', up: `
        CREATE TABLE IF NOT EXISTS courses (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
            title VARCHAR(255) NOT NULL, slug VARCHAR(255) UNIQUE NOT NULL,
            description TEXT, short_description VARCHAR(500),
            thumbnail_url TEXT, preview_video_url TEXT,
            price DECIMAL(10,2) DEFAULT 0.00, discount_price DECIMAL(10,2),
            currency VARCHAR(3) DEFAULT 'USD',
            level VARCHAR(20) DEFAULT 'beginner' CHECK (level IN ('beginner','intermediate','advanced')),
            language VARCHAR(50) DEFAULT 'English',
            duration_hours DECIMAL(5,2) DEFAULT 0,
            status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
            is_featured BOOLEAN DEFAULT false,
            requirements TEXT[], objectives TEXT[], tags TEXT[],
            rating_avg DECIMAL(3,2) DEFAULT 0, rating_count INTEGER DEFAULT 0,
            enrollment_count INTEGER DEFAULT 0,
            published_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_courses_instructor ON courses(instructor_id);
        CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category_id);
        CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug);
        CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
        CREATE INDEX IF NOT EXISTS idx_courses_level ON courses(level);
    `},
    {
        name: '006_create_sections', up: `
        CREATE TABLE IF NOT EXISTS sections (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL, description TEXT,
            order_index INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_sections_course ON sections(course_id);
    `},
    {
        name: '007_create_lessons', up: `
        CREATE TABLE IF NOT EXISTS lessons (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
            course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL, slug VARCHAR(255) NOT NULL,
            description TEXT, content TEXT,
            type VARCHAR(20) DEFAULT 'video' CHECK (type IN ('video','text','quiz','assignment')),
            video_url TEXT, video_duration INTEGER DEFAULT 0,
            order_index INTEGER NOT NULL DEFAULT 0,
            is_free BOOLEAN DEFAULT false, is_published BOOLEAN DEFAULT true,
            resources JSONB DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(course_id, slug)
        );
        CREATE INDEX IF NOT EXISTS idx_lessons_section ON lessons(section_id);
        CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
        CREATE INDEX IF NOT EXISTS idx_lessons_type ON lessons(type);
    `},
    {
        name: '008_create_enrollments', up: `
        CREATE TABLE IF NOT EXISTS enrollments (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('pending','active','completed','cancelled')),
            enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP, expires_at TIMESTAMP,
            progress_percentage DECIMAL(5,2) DEFAULT 0,
            last_accessed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, course_id)
        );
        CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);
        CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
        CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);
    `},
    {
        name: '009_create_progress', up: `
        CREATE TABLE IF NOT EXISTS progress (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
            enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
            is_completed BOOLEAN DEFAULT false, completed_at TIMESTAMP,
            watch_time INTEGER DEFAULT 0, last_position INTEGER DEFAULT 0,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, lesson_id)
        );
        CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
        CREATE INDEX IF NOT EXISTS idx_progress_lesson ON progress(lesson_id);
        CREATE INDEX IF NOT EXISTS idx_progress_enrollment ON progress(enrollment_id);
    `},
    {
        name: '010_create_payments', up: `
        CREATE TABLE IF NOT EXISTS payments (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,
            amount DECIMAL(10,2) NOT NULL,
            currency VARCHAR(3) DEFAULT 'USD',
            status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
            payment_method VARCHAR(50),
            payment_provider VARCHAR(50) DEFAULT 'stripe',
            transaction_id VARCHAR(255),
            provider_payment_id VARCHAR(255),
            provider_response JSONB,
            refund_amount DECIMAL(10,2), refund_reason TEXT, refunded_at TIMESTAMP,
            paid_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
        CREATE INDEX IF NOT EXISTS idx_payments_course ON payments(course_id);
        CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
        CREATE INDEX IF NOT EXISTS idx_payments_transaction ON payments(transaction_id);
    `},
    {
        name: '011_create_certificates', up: `
        CREATE TABLE IF NOT EXISTS certificates (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
            certificate_number VARCHAR(50) UNIQUE NOT NULL,
            title VARCHAR(255) NOT NULL, description TEXT,
            issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP,
            certificate_url TEXT, verification_url TEXT,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, course_id)
        );
        CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);
        CREATE INDEX IF NOT EXISTS idx_certificates_course ON certificates(course_id);
        CREATE INDEX IF NOT EXISTS idx_certificates_number ON certificates(certificate_number);
    `},
    {
        name: '012_create_reviews', up: `
        CREATE TABLE IF NOT EXISTS reviews (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
            title VARCHAR(255), comment TEXT,
            is_approved BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, course_id)
        );
        CREATE INDEX IF NOT EXISTS idx_reviews_course ON reviews(course_id);
        CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
        CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
    `},
    {
        name: '013_create_course_resources', up: `
        CREATE TABLE IF NOT EXISTS course_resources (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL, description TEXT,
            url TEXT NOT NULL, type VARCHAR(50) DEFAULT 'link',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_course_resources_course ON course_resources(course_id);
    `},
    {
        name: '014_create_chat_messages', up: `
        CREATE TABLE IF NOT EXISTS chat_messages (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_chat_messages_course ON chat_messages(course_id);
        CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
    `},

    // ── admin features (from migrate-admin.js) ───────────────────────────
    {
        name: '013_create_audit_logs', up: `
        CREATE TABLE IF NOT EXISTS audit_logs (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            action VARCHAR(100) NOT NULL, entity_type VARCHAR(50) NOT NULL,
            entity_id UUID, old_values JSONB, new_values JSONB,
            ip_address VARCHAR(45), user_agent TEXT,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
    `},
    {
        name: '014_add_course_moderation', up: `
        ALTER TABLE courses
        ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'approved',
        ADD COLUMN IF NOT EXISTS submitted_for_review_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
        CREATE INDEX IF NOT EXISTS idx_courses_moderation ON courses(moderation_status);
    `},
    {
        name: '015_add_user_moderation', up: `
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS ban_reason TEXT,
        ADD COLUMN IF NOT EXISTS ban_expires_at TIMESTAMP;
        CREATE INDEX IF NOT EXISTS idx_users_banned ON users(is_banned);
    `},
    {
        name: '016_create_system_settings', up: `
        CREATE TABLE IF NOT EXISTS system_settings (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            key VARCHAR(100) UNIQUE NOT NULL,
            value JSONB NOT NULL, description TEXT,
            updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO system_settings (key, value, description) VALUES
            ('platform_name', '"E-Learn Canvas"', 'Platform display name'),
            ('require_course_approval', 'true', 'Require admin approval for new courses'),
            ('commission_rate', '0.20', 'Platform commission rate (0-1)'),
            ('min_course_price', '0', 'Minimum course price'),
            ('max_course_price', '999.99', 'Maximum course price'),
            ('allow_instructor_registration', 'true', 'Allow users to register as instructors')
        ON CONFLICT (key) DO NOTHING;
    `},
    {
        name: '017_create_notifications', up: `
        CREATE TABLE IF NOT EXISTS notifications (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL, title VARCHAR(255) NOT NULL,
            message TEXT, data JSONB DEFAULT '{}',
            is_read BOOLEAN DEFAULT false, read_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
        CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
    `},

    // ── instructor features (extra columns) ──────────────────────────────
    {
        name: '018_instructor_extra_columns', up: `
        ALTER TABLE courses
        ADD COLUMN IF NOT EXISTS moderation_notes TEXT,
        ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
    `},

    // ── enrollment codes ─────────────────────────────────────────────────
    {
        name: '020_create_enrollment_codes', up: `
        CREATE TABLE IF NOT EXISTS enrollment_codes (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            code VARCHAR(20) UNIQUE NOT NULL,
            course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            used_by UUID REFERENCES users(id) ON DELETE SET NULL,
            is_used BOOLEAN DEFAULT false, used_at TIMESTAMP, expires_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_enrollment_codes_code ON enrollment_codes(code);
        CREATE INDEX IF NOT EXISTS idx_enrollment_codes_course ON enrollment_codes(course_id);
        CREATE INDEX IF NOT EXISTS idx_enrollment_codes_used_by ON enrollment_codes(used_by);
        CREATE INDEX IF NOT EXISTS idx_enrollment_codes_is_used ON enrollment_codes(is_used);
    `},

    // ── lesson type expansion ────────────────────────────────────────────
    {
        name: '021_expand_lesson_types', up: `
        ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_type_check;
        ALTER TABLE lessons ADD CONSTRAINT lessons_type_check
            CHECK (type IN ('video','text','quiz','assignment','document','pdf','ppt','doc'));
    `},

    // ── wishlist ─────────────────────────────────────────────────────────
    {
        name: '022_create_wishlist', up: `
        CREATE TABLE IF NOT EXISTS wishlist (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, course_id)
        );
        CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON wishlist(user_id);
    `},

    // ── likes & projects ─────────────────────────────────────────────────
    {
        name: '023_create_lesson_likes', up: `
        CREATE TABLE IF NOT EXISTS lesson_likes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, lesson_id)
        );
        CREATE INDEX IF NOT EXISTS idx_lesson_likes_user_id ON lesson_likes(user_id);
        CREATE INDEX IF NOT EXISTS idx_lesson_likes_lesson_id ON lesson_likes(lesson_id);
    `},
    {
        name: '024_create_projects', up: `
        CREATE TABLE IF NOT EXISTS projects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL, description TEXT, instructions TEXT,
            due_date TIMESTAMP,
            max_file_size INTEGER DEFAULT 10485760,
            allowed_file_types TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_projects_course_id ON projects(course_id);
    `},
    {
        name: '025_create_project_submissions', up: `
        CREATE TABLE IF NOT EXISTS project_submissions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            submission_url TEXT, submission_text TEXT,
            file_name VARCHAR(255), file_size INTEGER,
            status VARCHAR(50) DEFAULT 'submitted',
            grade DECIMAL(5,2), instructor_feedback TEXT,
            instructor_id UUID REFERENCES users(id),
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            graded_at TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(project_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS idx_project_submissions_project_id ON project_submissions(project_id);
        CREATE INDEX IF NOT EXISTS idx_project_submissions_user_id ON project_submissions(user_id);
    `},

    // ── practice files column ────────────────────────────────────────────
    {
        name: '026_add_practice_files', up: `
        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS practice_files JSONB DEFAULT '[]'::jsonb;
    `},

    // ── global course likes ──────────────────────────────────────────────
    {
        name: '027_create_course_likes', up: `
        CREATE TABLE IF NOT EXISTS course_likes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, course_id)
        );
        CREATE INDEX IF NOT EXISTS idx_course_likes_user_id ON course_likes(user_id);
        CREATE INDEX IF NOT EXISTS idx_course_likes_course_id ON course_likes(course_id);
        ALTER TABLE courses ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
    `},

    // ── project attachment columns ───────────────────────────────────────
    {
        name: '028_project_attachment_columns', up: `
        ALTER TABLE projects ADD COLUMN IF NOT EXISTS attachment_url TEXT;
        ALTER TABLE projects ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255);
    `},

    // ── seed popular categories ──────────────────────────────────────────
    {
        name: '029_seed_popular_categories', up: `
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
        ON CONFLICT (slug) DO NOTHING;
    `},

    // ── Google OAuth support ─────────────────────────────────────────────
    {
        name: '030_add_google_id_to_users', up: `
        ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
        CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
    `},
];

// ─── runner ─────────────────────────────────────────────────────────────────

async function migrateAll() {
    const client = await pool.connect();
    try {
        console.log('🔄 Running all migrations…\n');

        await ensureMigrationsTable();
        const executed = await getExecutedMigrations();

        let ran = 0;
        for (const m of allMigrations) {
            if (executed.has(m.name)) {
                console.log(`  ⏭️  ${m.name}`);
                continue;
            }
            await runMigration(client, m.name, m.up);
            ran++;
        }

        console.log(`\n✅ Migrations complete (${ran} new, ${allMigrations.length - ran} skipped).`);

        // ── seed default admin account ───────────────────────────────────
        await seedDefaultAdmin(client);
    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// ─── default admin seed ─────────────────────────────────────────────────────

async function seedDefaultAdmin(client) {
    const bcrypt = require('bcryptjs');

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@cradema.com';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@2026';

    // Check if admin already exists
    const { rows } = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [ADMIN_EMAIL.toLowerCase()]
    );

    if (rows.length > 0) {
        console.log(`\n👤 Admin account already exists (${ADMIN_EMAIL})`);
        return;
    }

    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, is_verified)
         VALUES ($1, $2, 'Admin', 'User', 'admin', true, true)`,
        [ADMIN_EMAIL.toLowerCase(), hash]
    );
    console.log(`\n👤 Default admin created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    console.log('   ⚠️  Change the password after first login!');
}

migrateAll();
