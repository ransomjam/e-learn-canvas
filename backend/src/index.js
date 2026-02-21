require('dotenv').config();
const app = require('./app');
const { testConnection, query } = require('./config/database');
const fs = require('fs');

process.on('uncaughtException', (err) => {
  fs.appendFileSync('crash.log', `Uncaught Exception: ${err.stack}\n`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  fs.appendFileSync('crash.log', `Unhandled Rejection: ${reason}\n`);
});

const PORT = process.env.PORT || 3001;

/**
 * In production, deactivate demo accounts so they cannot be used.
 * This prevents test accounts from appearing or being logged into on Render.
 */
const cleanupDemoAccounts = async () => {
  if (process.env.NODE_ENV !== 'production') return;

  try {
    const result = await query(
      `UPDATE users SET is_active = false WHERE email LIKE '%@demo.com' AND is_active = true RETURNING email`
    );
    if (result.rows.length > 0) {
      console.log(`🧹 Deactivated ${result.rows.length} demo account(s) in production:`,
        result.rows.map(r => r.email).join(', '));
    }
    // Also delete any active refresh tokens for demo accounts
    await query(
      `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@demo.com')`
    );
  } catch (error) {
    console.warn('⚠️  Could not clean up demo accounts:', error.message);
  }
};

// Test database connection and start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();
    console.log('✅ Database connected successfully');

    // Clean up demo/test accounts in production
    await cleanupDemoAccounts();

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api/v1`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Keep-alive tuning — prevents Safari "server stopped responding" errors.
    // The keepAliveTimeout MUST exceed the reverse-proxy / load-balancer timeout
    // (Render uses ~60 s) so Node never closes a connection the proxy thinks is
    // still alive.  headersTimeout must be slightly larger than keepAliveTimeout.
    server.keepAliveTimeout = 65000;   // 65 seconds
    server.headersTimeout  = 66000;    // 66 seconds
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
