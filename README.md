# Folio - Portfolio Tracker

A comprehensive portfolio tracking application for managing crypto and equity investments, calculating taxes, and projecting future growth.

![Folio Portfolio Tracker](https://via.placeholder.com/800x400/0a1929/2a97ff?text=Folio+Portfolio+Tracker)

## Features

### 📊 Portfolio Management
- Track stocks and cryptocurrency holdings
- Record buy and sell transactions
- Real-time price data from Alpha Vantage API
- Portfolio allocation visualization
- Performance tracking by asset and timeframe

### 💰 Tax Reporting
- **FIFO cost basis tracking** - Automatically tracks cost basis using First-In-First-Out method
- **Short-term vs Long-term gains** - Separates gains by holding period (< 1 year vs ≥ 1 year)
- **Tax lot management** - View individual purchase lots and their cost basis
- **Realized gains report** - Track taxable events by year

### 💵 Income Tracking
- Multiple income sources with different frequencies
- Before and after-tax calculations
- Annual and monthly income summaries
- Effective tax rate calculations

### 📝 Expense Tracking
- Line-by-line expense entry
- Categorized expenses with custom colors
- Monthly P&L style breakdown
- Visual charts for spending patterns

### 📈 Future Projections
- User-defined CAGR estimates per asset
- Adjustable time horizons (1-30 years)
- Include monthly contributions
- Factor in net income after expenses
- Yearly growth breakdown

## Tech Stack

### Backend
- **Node.js** with Express.js
- **PostgreSQL** database
- **Redis** for high-performance caching
- **Alpha Vantage API** for market data
- JWT authentication
- Deployed on **Railway**

### Frontend
- **React 18** with Vite
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Recharts** for data visualization
- **Zustand** for state management
- Deployed on **Vercel**

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Alpha Vantage API key (free tier available)

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on the example:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/portfolio_tracker
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key
ALPHA_VANTAGE_API_KEY=your-alpha-vantage-api-key
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

> **Note:** Redis is optional for local development. If `REDIS_URL` is not set, the app will use an in-memory cache fallback.

4. Run database migrations:
```bash
npm run migrate
```

5. Start the development server:
```bash
npm run dev
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```env
VITE_API_URL=http://localhost:3001/api
```

4. Start the development server:
```bash
npm run dev
```

5. Open http://localhost:5173 in your browser

## Deployment

### Backend (Railway)

1. Create a new project on [Railway](https://railway.app)
2. Add a PostgreSQL database
3. **Add a Redis database** for caching (click "New" → "Database" → "Redis")
4. Connect your GitHub repository
5. Set environment variables:
   - `DATABASE_URL` (from Railway PostgreSQL)
   - `REDIS_URL` (from Railway Redis - automatically available as `REDIS_URL`)
   - `JWT_SECRET`
   - `ALPHA_VANTAGE_API_KEY`
   - `FRONTEND_URL` (your Vercel URL)
   - `NODE_ENV=production`
6. Railway will automatically deploy on push

> **Note:** Redis is optional but highly recommended for performance. Without Redis, the app will use an in-memory cache fallback which works but doesn't persist across restarts.

### Frontend (Vercel)

1. Create a new project on [Vercel](https://vercel.com)
2. Connect your GitHub repository
3. Set the root directory to `frontend`
4. Set environment variables:
   - `VITE_API_URL` (your Railway backend URL + `/api`)
5. Vercel will automatically deploy on push

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login
- `GET /api/auth/profile` - Get user profile

### Assets
- `GET /api/assets` - Get user's assets
- `GET /api/assets/search` - Search for assets
- `GET /api/assets/stocks/:symbol/quote` - Get stock quote
- `GET /api/assets/crypto/:symbol/quote` - Get crypto quote

### Transactions
- `POST /api/transactions` - Create transaction
- `GET /api/transactions` - List transactions
- `DELETE /api/transactions/:id` - Delete transaction

### Tax
- `GET /api/tax/summary/:year` - Get tax summary
- `GET /api/tax/cost-basis` - Get cost basis report
- `GET /api/tax/unrealized` - Get unrealized gains
- `GET /api/tax/realized` - Get realized gains
- `GET /api/tax/lots` - Get tax lots

### Income
- `POST /api/income` - Add income source
- `GET /api/income` - List income records
- `GET /api/income/summary` - Get income summary

### Expenses
- `POST /api/expenses` - Add expense
- `GET /api/expenses` - List expenses
- `GET /api/expenses/monthly` - Get monthly breakdown
- `GET /api/expenses/categories` - Get categories

### Portfolio
- `GET /api/portfolio/overview` - Portfolio overview (cached)
- `GET /api/portfolio/overview?quick=true` - Quick overview using cache only (fastest)
- `GET /api/portfolio/overview?refresh=true` - Force refresh from API
- `GET /api/portfolio/daily-return` - Today's return (cached, very fast)
- `POST /api/portfolio/refresh` - Refresh all prices from API
- `GET /api/portfolio/cache-status` - Check cache health
- `GET /api/portfolio/returns` - Returns by timeframe
- `GET /api/portfolio/projections` - Future projections
- `POST /api/portfolio/projections/cagr/:assetId` - Set CAGR

## Database Schema

The application uses the following main tables:
- `users` - User accounts
- `assets` - Stocks and crypto assets
- `transactions` - Buy/sell records
- `tax_lots` - FIFO cost basis tracking
- `realized_gains` - Taxable events
- `income_records` - Income sources
- `expenses` - Expense entries
- `expense_categories` - Expense categories
- `asset_projections` - CAGR estimates
- `price_cache` - Cached market prices

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Disclaimer

This application is for informational purposes only and should not be considered financial or tax advice. Always consult with a qualified professional for financial decisions and tax matters.
