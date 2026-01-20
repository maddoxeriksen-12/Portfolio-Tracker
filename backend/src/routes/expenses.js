const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const expenseController = require('../controllers/expenseController');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Categories
router.get('/categories', expenseController.getCategories);
router.post('/categories', [
  body('name').trim().notEmpty(),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/)
], expenseController.createCategory);
router.put('/categories/:id', expenseController.updateCategory);
router.delete('/categories/:id', expenseController.deleteCategory);

// Monthly breakdown
router.get('/monthly', expenseController.getMonthlyBreakdown);

// Expenses CRUD
router.post('/', [
  body('categoryId').optional({ nullable: true }).isUUID(),
  body('description').trim().notEmpty(),
  body('amount').isFloat({ gt: 0 }),
  body('expenseDate').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be in YYYY-MM-DD format'),
  body('isRecurring').optional().isBoolean(),
  body('recurringFrequency').optional({ nullable: true }).isIn(['WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY']),
  body('notes').optional({ nullable: true }).trim()
], expenseController.createExpense);

router.get('/', expenseController.getExpenses);
router.put('/:id', expenseController.updateExpense);
router.delete('/:id', expenseController.deleteExpense);

module.exports = router;
