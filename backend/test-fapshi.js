require('dotenv').config({ path: '.env' });
const fapshi = require('./src/config/fapshi');

async function test() {
    try {
        const payload = {
            amount: 1000,
            externalId: 'ext_test_123',
            redirectUrl: 'http://localhost:8080/payment/callback',
            message: 'Test payment',
            email: 'test@example.com',
            userId: '00000000-0000-0000-0000-000000000000'
        };

        const res = await fapshi.initiatePay(payload);
        console.log('Success:', res);
    } catch (e) {
        console.error('Failure:', e.response?.data || e.message);
    }
}
test();
