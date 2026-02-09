const http = require('http');

const data = JSON.stringify({
    email: 'admin@elearn.com',
    password: 'admin123'
});

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Origin': 'http://localhost:3001' // THIS IS THE SAME ORIGIN
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.on('data', chunk => process.stdout.write(chunk));
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
