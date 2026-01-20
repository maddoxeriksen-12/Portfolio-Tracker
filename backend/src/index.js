require('dotenv').config();
const express = require('express');
const cors = require('cors');

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

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Request logging (development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/tax', taxRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/portfolio', portfolioRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════╗
  ║                                                       ║
  ║   📊 Portfolio Tracker API                            ║
  ║   Running on port ${PORT}                               ║
  ║                                                       ║
  ║   Endpoints:                                          ║
  ║   • /api/auth      - Authentication                   ║
  ║   • /api/assets    - Asset management                 ║
  ║   • /api/transactions - Buy/Sell transactions         ║
  ║   • /api/tax       - Tax calculations                 ║
  ║   • /api/income    - Income tracking                  ║
  ║   • /api/expenses  - Expense tracking                 ║
  ║   • /api/portfolio - Portfolio analytics              ║
  ║                                                       ║
  ╚═══════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
