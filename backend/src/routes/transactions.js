const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const transactionController = require('../controllers/transactionController');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Create transaction
router.post('/', [
  body('symbol').trim().notEmpty(),
  body('assetType').isIn(['STOCK', 'CRYPTO']),
  body('transactionType').isIn(['BUY', 'SELL']),
  body('quantity').isFloat({ gt: 0 }),
  body('pricePerUnit').isFloat({ gt: 0 }),
  body('fees').optional().isFloat({ min: 0 }),
  body('transactionDate').isDate(),
  body('notes').optional().trim()
], transactionController.createTransaction);

// Get all transactions
router.get('/', transactionController.getTransactions);

// Get single transaction
router.get('/:id', transactionController.getTransaction);

// Delete transaction
router.delete('/:id', transactionController.deleteTransaction);

module.exports = router;
