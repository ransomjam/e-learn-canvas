const http = require('http');

const data = JSON.stringify({
    email: 'admin@elearn.com',
    password: 'admin123'
});

const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Origin': 'http://192.168.1.175:8081' // mimicking network access
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    const headers = JSON.stringify(res.headers);
    console.log(`HEADERS: ${headers}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
});

req.on('error', (e) => {
    console.log('Problem with request:');
    console.log(e);
});

req.write(data);
req.end();
