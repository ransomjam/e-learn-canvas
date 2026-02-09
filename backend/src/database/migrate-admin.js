require('dotenv').config();
const { pool } = require('../config/database');

// Additional migrations for admin features
const adminMigrations = [
    // Audit logs table
    {
        name: '013_create_audit_logs',
        up: `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID,
        old_values JSONB,
        new_values JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
      CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
      CREATE INDEX idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
    `,
        down: `DROP TABLE IF EXISTS audit_logs CASCADE;`
    },

    // Course moderation columns
    {
        name: '014_add_course_moderation',
        up: `
      ALTER TABLE courses 
      ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'approved' 
        CHECK (moderation_status IN ('draft', 'pending_review', 'approved', 'rejected')),
      ADD COLUMN IF NOT EXISTS submitted_for_review_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
      
      CREATE INDEX IF NOT EXISTS idx_courses_moderation ON courses(moderation_status);
    `,
        down: `
      ALTER TABLE courses 
      DROP COLUMN IF EXISTS moderation_status,
      DROP COLUMN IF EXISTS submitted_for_review_at,
      DROP COLUMN IF EXISTS reviewed_at,
      DROP COLUMN IF EXISTS reviewed_by,
      DROP COLUMN IF EXISTS rejection_reason;
    `
    },

    // User ban/suspension fields
    {
        name: '015_add_user_moderation',
        up: `
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS ban_reason TEXT,
      ADD COLUMN IF NOT EXISTS ban_expires_at TIMESTAMP;
      
      CREATE INDEX IF NOT EXISTS idx_users_banned ON users(is_banned);
    `,
        down: `
      ALTER TABLE users 
      DROP COLUMN IF EXISTS is_banned,
      DROP COLUMN IF EXISTS banned_at,
      DROP COLUMN IF EXISTS banned_by,
      DROP COLUMN IF EXISTS ban_reason,
      DROP COLUMN IF EXISTS ban_expires_at;
    `
    },

    // System settings table
    {
        name: '016_create_system_settings',
        up: `
      CREATE TABLE IF NOT EXISTS system_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        key VARCHAR(100) UNIQUE NOT NULL,
        value JSONB NOT NULL,
        description TEXT,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Insert default settings
      INSERT INTO system_settings (key, value, description) VALUES
        ('platform_name', '"E-Learn Canvas"', 'Platform display name'),
        ('require_course_approval', 'true', 'Require admin approval for new courses'),
        ('commission_rate', '0.20', 'Platform commission rate (0-1)'),
        ('min_course_price', '0', 'Minimum course price'),
        ('max_course_price', '999.99', 'Maximum course price'),
        ('allow_instructor_registration', 'true', 'Allow users to register as instructors')
      ON CONFLICT (key) DO NOTHING;
    `,
        down: `DROP TABLE IF EXISTS system_settings CASCADE;`
    },

    // Notifications table
    {
        name: '017_create_notifications',
        up: `
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        data JSONB DEFAULT '{}',
        is_read BOOLEAN DEFAULT false,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
      CREATE INDEX idx_notifications_created ON notifications(created_at);
    `,
        down: `DROP TABLE IF EXISTS notifications CASCADE;`
    }
];

// Run migrations
const migrate = async () => {
    const client = await pool.connect();

    try {
        console.log('🔄 Running admin feature migrations...\n');

        // Ensure migrations table exists
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
        for (const migration of adminMigrations) {
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

        console.log('\n✅ Admin migrations completed successfully!');
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
};

migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
