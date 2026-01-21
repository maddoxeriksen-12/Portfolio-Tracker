const express = require('express');
const router = express.Router();
const portfolioController = require('../controllers/portfolioController');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Portfolio overview
router.get('/overview', portfolioController.getPortfolioOverview);

// Refresh all asset prices (triggers API calls)
router.post('/refresh', portfolioController.refreshPrices);

// Returns by timeframe
router.get('/returns', portfolioController.getReturns);

// Returns by asset
router.get('/returns/by-asset', portfolioController.getReturnsByAsset);

// Future projections
router.get('/projections', portfolioController.getProjections);

// Asset-specific projections
router.get('/projections/assets', portfolioController.getAssetProjections);

// Set CAGR estimate for an asset
router.post('/projections/cagr/:assetId', portfolioController.setAssetCAGR);

// Income vs expense report
router.get('/income-expense', portfolioController.getIncomeExpenseReport);

module.exports = router;
