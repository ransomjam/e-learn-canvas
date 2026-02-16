const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const courseRoutes = require('./routes/course.routes');
const lessonRoutes = require('./routes/lesson.routes');
const enrollmentRoutes = require('./routes/enrollment.routes');
const progressRoutes = require('./routes/progress.routes');
const paymentRoutes = require('./routes/payment.routes');
const certificateRoutes = require('./routes/certificate.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const adminRoutes = require('./routes/admin.routes');
const instructorRoutes = require('./routes/instructor.routes');
const uploadRoutes = require('./routes/upload.routes');
const wishlistRoutes = require('./routes/wishlist.routes');

// Import middleware
const { errorHandler, notFound } = require('./middleware/error.middleware');

const app = express();

// Trust proxy in production (Render, Heroku, etc.) - required for express-rate-limit
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security middleware - configure CSP for dashboard
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://accounts.google.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://accounts.google.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "http://localhost:*"],
            connectSrc: ["'self'", "http://localhost:*", "https://cdn.jsdelivr.net", "https://accounts.google.com", "https://oauth2.googleapis.com", "https://www.googleapis.com"],
            frameSrc: ["'self'", "https://accounts.google.com", "https://drive.google.com", "https://*.google.com"],
        },
    },
}));
app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',').map(o => o.trim());

        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);

        // Development: automatically allow local network IPs and localhost:3001
        if (process.env.NODE_ENV === 'development') {
            if (origin.startsWith('http://192.168.') || origin === 'http://localhost:3001' || origin === 'http://127.0.0.1:3001') {
                return callback(null, true);
            }
        }

        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.error(`Blocked CORS origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// Rate limiting - more lenient for development
const isDev = process.env.NODE_ENV !== 'production';
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || (isDev ? 1 * 60 * 1000 : 15 * 60 * 1000), // 1 min dev, 15 min prod
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (isDev ? 1000 : 100), // 1000 dev, 100 prod
    message: {
        success: false,
        message: 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isDev && req.path === '/api/v1/auth/me', // Skip rate limit for auth/me in dev
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files with CORS
const path = require('path');
app.use('/uploads', cors(), (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../public')));

// Dashboard redirect — unified dashboard lives in the React frontend
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';
app.get('/dashboard', (req, res) => {
    res.redirect(FRONTEND_URL + '/instructor');
});

// Legacy backend dashboard (for development/debugging only)
app.get('/dashboard-legacy', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// Logging
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Environment info endpoint (tells frontend if demo mode is available)
app.get('/api/v1/config', (req, res) => {
    res.json({
        success: true,
        data: {
            demoMode: process.env.NODE_ENV !== 'production',
            googleAuthEnabled: !!(process.env.GOOGLE_CLIENT_ID),
        }
    });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/courses', courseRoutes);
app.use('/api/v1/lessons', lessonRoutes);
app.use('/api/v1/enrollments', enrollmentRoutes);
app.use('/api/v1/progress', progressRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/certificates', certificateRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/instructor', instructorRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/wishlist', wishlistRoutes);

// API documentation endpoint
app.get('/api/v1', (req, res) => {
    res.json({
        message: 'Cradema API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/v1/auth',
            users: '/api/v1/users',
            courses: '/api/v1/courses',
            lessons: '/api/v1/lessons',
            enrollments: '/api/v1/enrollments',
            progress: '/api/v1/progress',
            payments: '/api/v1/payments',
            certificates: '/api/v1/certificates'
        }
    });
});

// In production, serve the React frontend from dist/
const fs = require('fs');
const mime = require('mime-types');
const frontendPath = path.join(__dirname, '../../dist');
const frontendIndex = path.join(frontendPath, 'index.html');

if (fs.existsSync(frontendIndex)) {
    console.log('📦 Serving frontend from', frontendPath);
    app.use(express.static(frontendPath, {
        // Explicitly set correct MIME types for static assets
        setHeaders: (res, filePath) => {
            const mimeType = mime.lookup(filePath);
            if (mimeType) {
                res.setHeader('Content-Type', mimeType);
            }
        },
        // Allow long-term caching for hashed assets
        maxAge: '1y',
        immutable: true,
        index: false, // Don't auto-serve index.html from static middleware
    }));

    // SPA catch-all: only serve index.html for navigation routes, NOT for asset files
    app.get('*', (req, res, next) => {
        // Let API/upload/health requests fall through to 404 handler
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path === '/health') {
            return next();
        }
        // Don't serve index.html for static asset requests (js, css, images, fonts, etc.)
        if (req.path.match(/\.(js|css|map|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json|webp|avif|mp4|webm)$/)) {
            return next(); // Let it 404 properly instead of returning HTML
        }
        res.setHeader('Content-Type', 'text/html');
        res.sendFile(frontendIndex);
    });
} else {
    console.log('⚠️  No frontend dist/ found at', frontendPath, '— SPA serving disabled');
}

// Error handling (API 404s and server errors)
app.use(notFound);
app.use(errorHandler);

module.exports = app;
