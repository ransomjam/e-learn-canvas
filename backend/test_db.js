require('dotenv').config();
const { pool } = require('./src/config/database');

async function test() {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('DB SUCCESS:', res.rows[0]);
        process.exit(0);
    } catch (err) {
        console.error('DB ERROR:', err);
        process.exit(1);
    }
}

test();
