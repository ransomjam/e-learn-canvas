const http = require('http');

const req = http.get('http://localhost:3001/health', (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.on('data', () => { });
    res.on('end', () => console.log('Response ended'));
});

req.on('error', (e) => {
    console.log(`ERROR: ${e.message}`);
});
