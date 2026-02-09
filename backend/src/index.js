require('dotenv').config();
const app = require('./app');
const { testConnection } = require('./config/database');
const fs = require('fs');

process.on('uncaughtException', (err) => {
  fs.appendFileSync('crash.log', `Uncaught Exception: ${err.stack}\n`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  fs.appendFileSync('crash.log', `Unhandled Rejection: ${reason}\n`);
});

const PORT = process.env.PORT || 3001;

// Test database connection and start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();
    console.log('✅ Database connected successfully');

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api/v1`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
