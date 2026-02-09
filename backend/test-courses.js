// Quick test - paste this in browser console on frontend
fetch('http://localhost:3001/api/v1/courses')
  .then(r => r.json())
  .then(d => console.log('Courses:', d))
  .catch(e => console.error('Error:', e));

// Or check specific course in database
// Run in backend: node -e "const {query} = require('./src/config/database'); query('SELECT id, title, status, moderation_status FROM courses').then(r => console.log(r.rows)).then(() => process.exit())"
