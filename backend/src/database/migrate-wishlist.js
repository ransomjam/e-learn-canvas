const { query } = require('../config/database');

async function migrateWishlist() {
    try {
        console.log('Creating wishlist table...');
        
        await query(`
            CREATE TABLE IF NOT EXISTS wishlist (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, course_id)
            )
        `);
        
        console.log('✓ Wishlist table created successfully');

        await query(`
            CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON wishlist(user_id)
        `);
        
        console.log('✓ Wishlist indexes created');
        
        process.exit(0);
    } catch (error) {
        console.error('✗ Wishlist migration failed:', error.message);
        process.exit(1);
    }
}

migrateWishlist();
