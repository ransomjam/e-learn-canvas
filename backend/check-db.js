require('dotenv').config({ path: '.env' });
const { query, pool } = require('./src/config/database');

async function check() {
    try {
        const res1 = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'courses'");
        console.log('courses:', res1.rows.map(r => r.column_name));

        const res2 = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'payments'");
        console.log('payments:', res2.rows.map(r => r.column_name));
        
        const res3 = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'enrollments'");
        console.log('enrollments:', res3.rows.map(r => r.column_name));
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
        process.exit(0);
    }
}
check();
