require('dotenv').config({ path: '../../.env' });
const { pool } = require('../config/database');

const migrate = async () => {
  try {
    const client = await pool.connect();
    console.log('Adding external_id to payments table...');
    await client.query('ALTER TABLE payments ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);');
    console.log('Successfully added external_id');
    client.release();
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}

migrate();
