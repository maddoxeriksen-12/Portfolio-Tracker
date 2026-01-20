const express = require('express');
const router = express.Router();
const taxController = require('../controllers/taxController');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Get tax summary for a year
router.get('/summary/:year?', taxController.getTaxSummary);

// Get cost basis report
router.get('/cost-basis', taxController.getCostBasisReport);

// Get unrealized gains
router.get('/unrealized', taxController.getUnrealizedGains);

// Get realized gains
router.get('/realized', taxController.getRealizedGains);

// Get tax lots
router.get('/lots', taxController.getTaxLots);

module.exports = router;
