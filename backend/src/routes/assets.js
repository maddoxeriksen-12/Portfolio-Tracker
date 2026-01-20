const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Search assets
router.get('/search', assetController.searchAssets);

// Get stock quote
router.get('/stocks/:symbol/quote', assetController.getStockQuote);

// Get crypto quote
router.get('/crypto/:symbol/quote', assetController.getCryptoQuote);

// Get historical data
router.get('/:symbol/history', assetController.getHistoricalData);

// Get user's assets
router.get('/', assetController.getUserAssets);

module.exports = router;
