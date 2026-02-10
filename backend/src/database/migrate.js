require('dotenv').config();
const { pool } = require('../config/database');

const migrations = [
  // Enable UUID extension
  {
    name: '001_enable_uuid',
    up: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`,
    down: `DROP EXTENSION IF EXISTS "uuid-ossp";`
  },

  // Users table
  {
    name: '002_create_users',
    up: `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'learner' CHECK (role IN ('admin', 'instructor', 'learner')),
        avatar_url TEXT,
        bio TEXT,
        phone VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        is_verified BOOLEAN DEFAULT false,
        verification_token VARCHAR(255),
        reset_password_token VARCHAR(255),
        reset_password_expires TIMESTAMP,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_users_role ON users(role);
    `,
    down: `DROP TABLE IF EXISTS users CASCADE;`
  },

  // Refresh tokens table
  {
    name: '003_create_refresh_tokens',
    up: `
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(500) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
      CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
    `,
    down: `DROP TABLE IF EXISTS refresh_tokens CASCADE;`
  },

  // Categories table
  {
    name: '004_create_categories',
    up: `
      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_categories_slug ON categories(slug);
      CREATE INDEX idx_categories_parent ON categories(parent_id);
    `,
    down: `DROP TABLE IF EXISTS categories CASCADE;`
  },

  // Courses table
  {
    name: '005_create_courses',
    up: `
      CREATE TABLE IF NOT EXISTS courses (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        short_description VARCHAR(500),
        thumbnail_url TEXT,
        preview_video_url TEXT,
        price DECIMAL(10, 2) DEFAULT 0.00,
        discount_price DECIMAL(10, 2),
        currency VARCHAR(3) DEFAULT 'USD',
        level VARCHAR(20) DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'advanced')),
        language VARCHAR(50) DEFAULT 'English',
        duration_hours DECIMAL(5, 2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
        is_featured BOOLEAN DEFAULT false,
        requirements TEXT[],
        objectives TEXT[],
        tags TEXT[],
        rating_avg DECIMAL(3, 2) DEFAULT 0,
        rating_count INTEGER DEFAULT 0,
        enrollment_count INTEGER DEFAULT 0,
        published_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_courses_instructor ON courses(instructor_id);
      CREATE INDEX idx_courses_category ON courses(category_id);
      CREATE INDEX idx_courses_slug ON courses(slug);
      CREATE INDEX idx_courses_status ON courses(status);
      CREATE INDEX idx_courses_level ON courses(level);
    `,
    down: `DROP TABLE IF EXISTS courses CASCADE;`
  },

  // Sections table (course chapters)
  {
    name: '006_create_sections',
    up: `
      CREATE TABLE IF NOT EXISTS sections (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        order_index INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_sections_course ON sections(course_id);
    `,
    down: `DROP TABLE IF EXISTS sections CASCADE;`
  },

  // Lessons table
  {
    name: '007_create_lessons',
    up: `
      CREATE TABLE IF NOT EXISTS lessons (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
        course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        description TEXT,
        content TEXT,
        type VARCHAR(20) DEFAULT 'video' CHECK (type IN ('video', 'text', 'quiz', 'assignment')),
        video_url TEXT,
        video_duration INTEGER DEFAULT 0,
        order_index INTEGER NOT NULL DEFAULT 0,
        is_free BOOLEAN DEFAULT false,
        is_published BOOLEAN DEFAULT true,
        resources JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(course_id, slug)
      );
      
      CREATE INDEX idx_lessons_section ON lessons(section_id);
      CREATE INDEX idx_lessons_course ON lessons(course_id);
      CREATE INDEX idx_lessons_type ON lessons(type);
    `,
    down: `DROP TABLE IF EXISTS lessons CASCADE;`
  },

  // Enrollments table
  {
    name: '008_create_enrollments',
    up: `
      CREATE TABLE IF NOT EXISTS enrollments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
        enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        expires_at TIMESTAMP,
        progress_percentage DECIMAL(5, 2) DEFAULT 0,
        last_accessed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, course_id)
      );
      
      CREATE INDEX idx_enrollments_user ON enrollments(user_id);
      CREATE INDEX idx_enrollments_course ON enrollments(course_id);
      CREATE INDEX idx_enrollments_status ON enrollments(status);
    `,
    down: `DROP TABLE IF EXISTS enrollments CASCADE;`
  },

  // Progress tracking table
  {
    name: '009_create_progress',
    up: `
      CREATE TABLE IF NOT EXISTS progress (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
        is_completed BOOLEAN DEFAULT false,
        completed_at TIMESTAMP,
        watch_time INTEGER DEFAULT 0,
        last_position INTEGER DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, lesson_id)
      );
      
      CREATE INDEX idx_progress_user ON progress(user_id);
      CREATE INDEX idx_progress_lesson ON progress(lesson_id);
      CREATE INDEX idx_progress_enrollment ON progress(enrollment_id);
    `,
    down: `DROP TABLE IF EXISTS progress CASCADE;`
  },

  // Payments table
  {
    name: '010_create_payments',
    up: `
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
        payment_method VARCHAR(50),
        payment_provider VARCHAR(50) DEFAULT 'stripe',
        transaction_id VARCHAR(255),
        provider_payment_id VARCHAR(255),
        provider_response JSONB,
        refund_amount DECIMAL(10, 2),
        refund_reason TEXT,
        refunded_at TIMESTAMP,
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_payments_user ON payments(user_id);
      CREATE INDEX idx_payments_course ON payments(course_id);
      CREATE INDEX idx_payments_status ON payments(status);
      CREATE INDEX idx_payments_transaction ON payments(transaction_id);
    `,
    down: `DROP TABLE IF EXISTS payments CASCADE;`
  },

  // Certificates table
  {
    name: '011_create_certificates',
    up: `
      CREATE TABLE IF NOT EXISTS certificates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
        certificate_number VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        certificate_url TEXT,
        verification_url TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, course_id)
      );
      
      CREATE INDEX idx_certificates_user ON certificates(user_id);
      CREATE INDEX idx_certificates_course ON certificates(course_id);
      CREATE INDEX idx_certificates_number ON certificates(certificate_number);
    `,
    down: `DROP TABLE IF EXISTS certificates CASCADE;`
  },

  // Reviews table
  {
    name: '012_create_reviews',
    up: `
      CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        title VARCHAR(255),
        comment TEXT,
        is_approved BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, course_id)
      );
      
      CREATE INDEX idx_reviews_course ON reviews(course_id);
      CREATE INDEX idx_reviews_user ON reviews(user_id);
      CREATE INDEX idx_reviews_rating ON reviews(rating);
    `,
    down: `DROP TABLE IF EXISTS reviews CASCADE;`
  },

  // Course Resources table
  {
    name: '013_create_course_resources',
    up: `
      CREATE TABLE IF NOT EXISTS course_resources (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        url TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'link',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_course_resources_course ON course_resources(course_id);
    `,
    down: `DROP TABLE IF EXISTS course_resources CASCADE;`
  },

  // Chat Messages table
  {
    name: '014_create_chat_messages',
    up: `
      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_chat_messages_course ON chat_messages(course_id);
      CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
    `,
    down: `DROP TABLE IF EXISTS chat_messages CASCADE;`
  },

  // Migrations tracking table
  {
    name: '000_create_migrations',
    up: `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `,
    down: `DROP TABLE IF EXISTS migrations CASCADE;`
  }
];

// Run migrations
const migrate = async () => {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting database migration...\n');

    // Create migrations table first
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get executed migrations
    const { rows: executedMigrations } = await client.query(
      'SELECT name FROM migrations ORDER BY id'
    );
    const executedNames = executedMigrations.map(m => m.name);

    // Run pending migrations
    for (const migration of migrations) {
      if (migration.name === '000_create_migrations') continue;

      if (!executedNames.includes(migration.name)) {
        console.log(`  ⬆️  Running migration: ${migration.name}`);
        await client.query('BEGIN');
        try {
          await client.query(migration.up);
          await client.query(
            'INSERT INTO migrations (name) VALUES ($1)',
            [migration.name]
          );
          await client.query('COMMIT');
          console.log(`  ✅ Migration completed: ${migration.name}`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      } else {
        console.log(`  ⏭️  Skipping (already executed): ${migration.name}`);
      }
    }

    console.log('\n✅ All migrations completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

// Rollback migrations
const rollback = async (steps = 1) => {
  const client = await pool.connect();

  try {
    console.log(`🔄 Rolling back ${steps} migration(s)...\n`);

    const { rows: executedMigrations } = await client.query(
      'SELECT name FROM migrations ORDER BY id DESC LIMIT $1',
      [steps]
    );

    for (const { name } of executedMigrations) {
      const migration = migrations.find(m => m.name === name);
      if (migration) {
        console.log(`  ⬇️  Rolling back: ${name}`);
        await client.query('BEGIN');
        try {
          await client.query(migration.down);
          await client.query('DELETE FROM migrations WHERE name = $1', [name]);
          await client.query('COMMIT');
          console.log(`  ✅ Rollback completed: ${name}`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }
    }

    console.log('\n✅ Rollback completed successfully!');
  } catch (error) {
    console.error('\n❌ Rollback failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

// CLI handling
const args = process.argv.slice(2);
if (args[0] === 'rollback') {
  const steps = parseInt(args[1]) || 1;
  rollback(steps)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} else {
  migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { migrate, rollback, migrations };
