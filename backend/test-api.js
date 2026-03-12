require('dotenv').config({ path: '.env' });
const axios = require('axios');
const jwt = require('jsonwebtoken');

async function test() {
    try {
        // Create a JWT for the first user
        const { jwt: jwtConfig } = require('./src/config/constants');
        const token = jwt.sign({ userId: '00000000-0000-0000-0000-000000000000', role: 'learner' }, jwtConfig.secret, { expiresIn: '1h' });

        // Let's get a real user ID and course ID from the DB
        const { query, pool } = require('./src/config/database');
        const userRes = await query('SELECT id FROM users LIMIT 1');
        const courseRes = await query('SELECT id FROM courses LIMIT 1');
        
        if (userRes.rows.length === 0 || courseRes.rows.length === 0) {
            console.log('No users or courses found');
            return;
        }

        const realToken = jwt.sign({ userId: userRes.rows[0].id, role: 'learner' }, jwtConfig.secret, { expiresIn: '1h' });

        try {
            const res = await axios.post('http://localhost:3001/api/v1/payments/fapshi', {
                courseId: courseRes.rows[0].id
            }, {
                headers: {
                    Authorization: `Bearer ${realToken}`
                }
            });
            console.log('Success:', res.data);
        } catch (e) {
            console.error('API Error:', e.response?.status);
            console.error('Data:', e.response?.data);
        }
        
        pool.end();
    } catch (e) {
        console.error('Test error:', e);
    }
}
test();
