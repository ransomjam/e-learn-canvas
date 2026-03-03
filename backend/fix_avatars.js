require("dotenv").config();
const { query } = require('./src/config/database');

async function fixAvatars() {
    try {
        const result = await query(
            `UPDATE users 
       SET avatar_url = NULL 
       WHERE avatar_url LIKE '%/uploads/%'
          OR (avatar_url NOT LIKE 'http%' AND avatar_url IS NOT NULL)`
        );
        console.log(`✅ Cleared ${result.rowCount} broken avatar links from users.`);
    } catch (err) {
        console.error("Error:", err.message);
    }
    process.exit(0);
}

fixAvatars();
