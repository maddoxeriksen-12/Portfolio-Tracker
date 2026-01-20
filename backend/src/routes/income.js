const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const incomeController = require('../controllers/incomeController');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Create income record
router.post('/', [
  body('source').trim().notEmpty(),
  body('grossAmount').isFloat({ gt: 0 }),
  body('taxRate').optional().isFloat({ min: 0, max: 100 }),
  body('frequency').isIn(['ONE_TIME', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY']),
  body('startDate').isDate(),
  body('endDate').optional({ nullable: true }).isDate(),
  body('notes').optional().trim()
], incomeController.createIncome);

// Get all income records
router.get('/', incomeController.getIncomeRecords);

// Get income summary
router.get('/summary', incomeController.getIncomeSummary);

// Update income record
router.put('/:id', incomeController.updateIncome);

// Delete income record
router.delete('/:id', incomeController.deleteIncome);

module.exports = router;
