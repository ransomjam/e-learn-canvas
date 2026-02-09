require('dotenv').config();
const { pool } = require('../config/database');

const migrate = async () => {
    const client = await pool.connect();

    try {
        console.log('🔄 Adding instructor features...\n');

        await client.query('BEGIN');

        // Add moderation fields to courses
        await client.query(`
            ALTER TABLE courses 
            ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'pending_review' 
                CHECK (moderation_status IN ('pending_review', 'approved', 'rejected')),
            ADD COLUMN IF NOT EXISTS moderation_notes TEXT,
            ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES users(id),
            ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS submitted_for_review_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
            ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
            ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
        `);

        // Add ban fields to users
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS ban_reason TEXT,
            ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES users(id),
            ADD COLUMN IF NOT EXISTS ban_expires_at TIMESTAMP;
        `);

        // Create notifications table
        await client.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                data JSONB DEFAULT '{}',
                is_read BOOLEAN DEFAULT false,
                read_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
            CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
        `);

        // Create system_settings table
        await client.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                key VARCHAR(100) UNIQUE NOT NULL,
                value JSONB NOT NULL,
                description TEXT,
                updated_by UUID REFERENCES users(id),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
        `);

        // Create audit logs table
        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                action VARCHAR(100) NOT NULL,
                entity_type VARCHAR(50) NOT NULL,
                entity_id UUID,
                old_values JSONB,
                new_values JSONB,
                ip_address VARCHAR(45),
                user_agent TEXT,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
        `);

        // Add transaction_id to payments if not exists
        await client.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='payments' AND column_name='transaction_id'
                ) THEN
                    ALTER TABLE payments ADD COLUMN transaction_id VARCHAR(255) UNIQUE;
                END IF;
            END $$;
        `);

        await client.query('COMMIT');
        console.log('✅ Instructor features added successfully!');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
};

migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
