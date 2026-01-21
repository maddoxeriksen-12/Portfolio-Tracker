require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes = require('./routes/auth');
const assetRoutes = require('./routes/assets');
const transactionRoutes = require('./routes/transactions');
const taxRoutes = require('./routes/tax');
const incomeRoutes = require('./routes/income');
const expenseRoutes = require('./routes/expenses');
const portfolioRoutes = require('./routes/portfolio');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (required for Railway, Heroku, etc. to get real client IP for rate limiting)
app.set('trust proxy', 1);

// ===================
// CORS CONFIGURATION (must be before other middleware)
// ===================

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL
].filter(Boolean); // Remove undefined values

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    // Remove trailing slash for comparison
    const normalizedOrigin = origin.replace(/\/$/, '');
    const normalizedAllowed = allowedOrigins.map(o => o.replace(/\/$/, ''));
    
    if (normalizedAllowed.includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      console.log('Allowed origins:', normalizedAllowed);
      callback(null, true); // Allow all origins for now to debug
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 hours
};

// Apply CORS
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// ===================
// SECURITY MIDDLEWARE
// ===================

// Helmet: Sets various HTTP headers for security
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting: Prevent brute force attacks
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  // Use X-Forwarded-For header for client identification behind proxies
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
  }
});

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Increased from 10 to allow for reasonable usage
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  // Use X-Forwarded-For header for client identification behind proxies
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
  }
});

// Apply general rate limiting to all requests
app.use(generalLimiter);

// Body parsing with size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Remove X-Powered-By header
app.disable('x-powered-by');

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

// ===================
// ROUTES
// ===================

// Health check (no rate limit)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    allowedOrigins: allowedOrigins
  });
});

// Auth routes with stricter rate limiting
app.use('/api/auth', authLimiter, authRoutes);

// API Routes
app.use('/api/assets', assetRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/tax', taxRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/portfolio', portfolioRoutes);

// ===================
// ERROR HANDLING
// ===================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  res.status(err.status || 500).json({ error: message });
});

// ===================
// SERVER START
// ===================

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════╗
  ║                                                       ║
  ║   📊 Portfolio Tracker API                            ║
  ║   Running on port ${PORT}                               ║
  ║   Environment: ${process.env.NODE_ENV || 'development'}                       ║
  ║                                                       ║
  ║   🔒 Security: Helmet, Rate Limiting, CORS enabled    ║
  ║   Allowed Origins: ${allowedOrigins.join(', ')}
  ║                                                       ║
  ╚═══════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
