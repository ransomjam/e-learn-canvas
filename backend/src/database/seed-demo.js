/**
 * ============================================================
 * === DEMO DATA SEED SCRIPT ===
 * ============================================================
 * 
 * PURPOSE: Creates demo user accounts for testing.
 * USAGE:   cd backend && node src/database/seed-demo.js
 * 
 * REMOVAL: Delete this entire file before production deployment.
 *          Also search for "DEMO DATA" comments across the codebase
 *          to find and remove all related demo UI elements.
 * 
 * ACCOUNTS CREATED:
 *   Students (learner role):
 *     - student1@demo.com / demo123  (Alice Johnson)
 *     - student2@demo.com / demo123  (Bob Smith)
 *     - student3@demo.com / demo123  (Carol Williams)
 *   Instructors:
 *     - instructor1@demo.com / demo123  (David Brown)
 *     - instructor2@demo.com / demo123  (Emma Davis)
 *   Admin:
 *     - admin@demo.com / demo123  (Frank Admin)
 * ============================================================
 */

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

// Load env — same as the other migration scripts
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'elearn_canvas',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
});

const DEMO_ACCOUNTS = [
    { email: 'student1@demo.com', firstName: 'Alice', lastName: 'Johnson', role: 'learner' },
    { email: 'student2@demo.com', firstName: 'Bob', lastName: 'Smith', role: 'learner' },
    { email: 'student3@demo.com', firstName: 'Carol', lastName: 'Williams', role: 'learner' },
    { email: 'instructor1@demo.com', firstName: 'David', lastName: 'Brown', role: 'instructor' },
    { email: 'instructor2@demo.com', firstName: 'Emma', lastName: 'Davis', role: 'instructor' },
    { email: 'admin@demo.com', firstName: 'Frank', lastName: 'Admin', role: 'admin' },
];

const DEMO_PASSWORD = 'demo123';

async function seedDemoAccounts() {
    const client = await pool.connect();

    try {
        console.log('\n🌱 Seeding demo accounts...\n');

        const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

        for (const account of DEMO_ACCOUNTS) {
            try {
                const result = await client.query(
                    `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, is_verified)
                     VALUES ($1, $2, $3, $4, $5, true, true)
                     ON CONFLICT (email) DO NOTHING
                     RETURNING id, email, role`,
                    [account.email, passwordHash, account.firstName, account.lastName, account.role]
                );

                if (result.rows.length > 0) {
                    const user = result.rows[0];
                    console.log(`  ✅ Created: ${user.email} (${user.role})`);
                } else {
                    console.log(`  ⏭️  Skipped (already exists): ${account.email}`);
                }
            } catch (err) {
                console.error(`  ❌ Failed: ${account.email} - ${err.message}`);
            }
        }

        console.log('\n📋 Demo Credentials:');
        console.log('   Password for all accounts: demo123');
        console.log('   ─────────────────────────────────────');
        for (const a of DEMO_ACCOUNTS) {
            console.log(`   ${a.role.padEnd(12)} │ ${a.email}`);
        }
        console.log('\n✨ Done!\n');

    } finally {
        client.release();
        await pool.end();
    }
}

seedDemoAccounts().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
