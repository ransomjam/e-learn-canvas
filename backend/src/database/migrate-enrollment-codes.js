require('dotenv').config();
const { pool } = require('../config/database');

const enrollmentCodeMigrations = [
    {
        name: '020_create_enrollment_codes',
        up: `
            CREATE TABLE IF NOT EXISTS enrollment_codes (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                code VARCHAR(20) UNIQUE NOT NULL,
                course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                used_by UUID REFERENCES users(id) ON DELETE SET NULL,
                is_used BOOLEAN DEFAULT false,
                used_at TIMESTAMP,
                expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX idx_enrollment_codes_code ON enrollment_codes(code);
            CREATE INDEX idx_enrollment_codes_course ON enrollment_codes(course_id);
            CREATE INDEX idx_enrollment_codes_used_by ON enrollment_codes(used_by);
            CREATE INDEX idx_enrollment_codes_is_used ON enrollment_codes(is_used);
        `,
        down: `DROP TABLE IF EXISTS enrollment_codes CASCADE;`
    }
];

const migrate = async () => {
    const client = await pool.connect();
    try {
        console.log('🔄 Running enrollment codes migration...\n');

        await client.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        const { rows: executedMigrations } = await client.query(
            'SELECT name FROM migrations ORDER BY id'
        );
        const executedNames = executedMigrations.map(m => m.name);

        for (const migration of enrollmentCodeMigrations) {
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

        console.log('\n✅ Enrollment codes migration completed!');
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
    }
};

migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
