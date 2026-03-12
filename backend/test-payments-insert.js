require('dotenv').config({ path: '.env' });
const { query } = require('./src/config/database');

async function test() {
    try {
        const courseId = '226bd364-77e4-4a52-b430-cbb612140bb0'; // valid uuid format, but may not exist
        const userId = '00000000-0000-0000-0000-000000000000'; // valid format
        const amount = 100;
        const currency = 'XAF';
        const transactionId = 'trans123';
        const fapshiResponse = { link: 'http://link' };
        const externalId = 'ext123';

        // We'll just do an explain analyze to see if the query structure is valid without actual foreign keys
        // If it throws foreign key violation, the statement is valid
        await query(
            `INSERT INTO payments (user_id, course_id, amount, currency, status, payment_method, payment_provider, transaction_id, provider_response, external_id)
            VALUES ($1, $2, $3, $4, 'pending', 'mobile_money', 'fapshi', $5, $6, $7)
            RETURNING *`,
            [userId, courseId, amount, currency, transactionId, JSON.stringify(fapshiResponse), externalId]
        );
        console.log('Success inserted');
    } catch (e) {
        if (e.message.includes('foreign key constraint')) {
            console.log('Query structure is valid, blocked by foreign key.');
        } else {
            console.error('Error:', e.message);
        }
    }
    process.exit(0);
}

test();
