require('dotenv').config({ path: '.env' });
const axios = require('axios');
const jwt = require('jsonwebtoken');

async function test() {
    try {
        const { jwt: jwtConfig } = require('./src/config/constants');
        const { query, pool } = require('./src/config/database');
        
        const userRes = await query('SELECT id FROM users LIMIT 1');
        const realToken = jwt.sign({ userId: userRes.rows[0].id, role: 'learner' }, jwtConfig.secret, { expiresIn: '1h' });

        try {
            const res = await axios.post('http://localhost:3001/api/v1/payments/fapshi', {
                courseId: '853d0f21-14e5-46e2-92c7-07ce696c1d80'
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
        
        await pool.end();
    } catch (e) {
        console.error('Test error:', e);
    }
}
test();
