require('dotenv').config({ path: '.env' });
const { query, pool } = require('./src/config/database');

async function test() {
    try {
        await query('SELECT xxx FROM payments');
        console.log('Should not reach here');
    } catch (e) {
        console.log('Code for xxx:', e.code); // Expect 42703
    }
    try {
        await query(
            `INSERT INTO payments (user_id, course_id, amount, currency, status, payment_method, payment_provider, transaction_id, provider_response, external_id)
            VALUES ($1, $2, $3, $4, 'pending', 'mobile_money', 'fapshi', $5, $6, $7)
            RETURNING *`,
            ['00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 100, 'XAF', 'trans123', '{}', 'ext123']
        );
        console.log('Success?');
    } catch (e) {
        console.log('Code for INSERT:', e.code);
        console.error('Message:', e.message);
    }
    pool.end();
}
test();
