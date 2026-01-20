const pool = require('../db/pool');
const { validationResult } = require('express-validator');

// Create expense
exports.createExpense = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { categoryId, description, amount, expenseDate, isRecurring, recurringFrequency, notes } = req.body;

    const result = await pool.query(
      `INSERT INTO expenses 
       (user_id, category_id, description, amount, expense_date, is_recurring, recurring_frequency, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.user.id, categoryId, description, amount, expenseDate, isRecurring || false, recurringFrequency, notes]
    );

    // Get category info
    const expense = await getExpenseWithCategory(result.rows[0].id);

    res.status(201).json({
      message: 'Expense created',
      expense
    });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
};

// Get expenses with filtering
exports.getExpenses = async (req, res) => {
  try {
    const { startDate, endDate, categoryId, month, year, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT 
        e.*,
        ec.name as category_name,
        ec.color as category_color
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.user_id = $1
    `;
    const params = [req.user.id];
    let paramIndex = 2;

    if (startDate) {
      query += ` AND e.expense_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND e.expense_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (categoryId) {
      query += ` AND e.category_id = $${paramIndex}`;
      params.push(categoryId);
      paramIndex++;
    }

    if (month && year) {
      query += ` AND EXTRACT(MONTH FROM e.expense_date) = $${paramIndex}`;
      params.push(parseInt(month));
      paramIndex++;
      query += ` AND EXTRACT(YEAR FROM e.expense_date) = $${paramIndex}`;
      params.push(parseInt(year));
      paramIndex++;
    } else if (year) {
      query += ` AND EXTRACT(YEAR FROM e.expense_date) = $${paramIndex}`;
      params.push(parseInt(year));
      paramIndex++;
    }

    query += ` ORDER BY e.expense_date DESC, e.created_at DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    res.json({
      expenses: result.rows.map(formatExpense)
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
};

// Update expense
exports.updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryId, description, amount, expenseDate, isRecurring, recurringFrequency, notes } = req.body;

    const result = await pool.query(
      `UPDATE expenses SET
        category_id = COALESCE($1, category_id),
        description = COALESCE($2, description),
        amount = COALESCE($3, amount),
        expense_date = COALESCE($4, expense_date),
        is_recurring = COALESCE($5, is_recurring),
        recurring_frequency = $6,
        notes = $7
       WHERE id = $8 AND user_id = $9
       RETURNING *`,
      [categoryId, description, amount, expenseDate, isRecurring, recurringFrequency, notes, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const expense = await getExpenseWithCategory(id);

    res.json({
      message: 'Expense updated',
      expense
    });
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
};

// Delete expense
exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json({ message: 'Expense deleted' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
};

// Get expense categories
exports.getCategories = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM expense_categories WHERE user_id = $1 ORDER BY name',
      [req.user.id]
    );

    res.json({
      categories: result.rows.map(c => ({
        id: c.id,
        name: c.name,
        color: c.color
      }))
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

// Create expense category
exports.createCategory = async (req, res) => {
  try {
    const { name, color = '#6366f1' } = req.body;

    const result = await pool.query(
      'INSERT INTO expense_categories (user_id, name, color) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, name, color]
    );

    res.status(201).json({
      message: 'Category created',
      category: {
        id: result.rows[0].id,
        name: result.rows[0].name,
        color: result.rows[0].color
      }
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Category already exists' });
    }
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
};

// Update category
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;

    const result = await pool.query(
      `UPDATE expense_categories SET
        name = COALESCE($1, name),
        color = COALESCE($2, color)
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [name, color, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({
      message: 'Category updated',
      category: {
        id: result.rows[0].id,
        name: result.rows[0].name,
        color: result.rows[0].color
      }
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
};

// Delete category
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM expense_categories WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ message: 'Category deleted' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};

// Get monthly expense summary (P&L style) with recurring expense projections
exports.getMonthlyBreakdown = async (req, res) => {
  try {
    const { year } = req.query;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    const currentDate = new Date();
    const currentMonth = currentDate.getFullYear() === targetYear ? currentDate.getMonth() + 1 : 0;
    // If viewing a past year, currentMonth = 13 means all months are "past" (show actuals only)
    // If viewing a future year, currentMonth = 0 means all months are "future" (show projections)
    const effectiveCurrentMonth = currentDate.getFullYear() > targetYear ? 13 : 
                                   currentDate.getFullYear() < targetYear ? 0 : 
                                   currentDate.getMonth() + 1;

    // Get actual expenses for the year (all recorded expenses)
    const actualResult = await pool.query(
      `SELECT 
         EXTRACT(MONTH FROM e.expense_date) as month,
         ec.name as category,
         ec.color,
         SUM(e.amount) as total
       FROM expenses e
       LEFT JOIN expense_categories ec ON e.category_id = ec.id
       WHERE e.user_id = $1 
         AND EXTRACT(YEAR FROM e.expense_date) = $2
       GROUP BY EXTRACT(MONTH FROM e.expense_date), ec.name, ec.color
       ORDER BY EXTRACT(MONTH FROM e.expense_date), ec.name`,
      [req.user.id, targetYear]
    );

    // Get recurring expenses that started this year or before (for projecting future months)
    const recurringResult = await pool.query(
      `SELECT 
         e.id,
         e.amount,
         e.expense_date,
         e.recurring_frequency,
         ec.name as category,
         ec.color
       FROM expenses e
       LEFT JOIN expense_categories ec ON e.category_id = ec.id
       WHERE e.user_id = $1 
         AND e.is_recurring = true
         AND e.expense_date <= $2`,
      [req.user.id, `${targetYear}-12-31`]
    );

    // Organize by month
    const breakdown = {};
    for (let m = 1; m <= 12; m++) {
      breakdown[m] = {
        month: m,
        categories: {},
        actual: 0,
        projected: 0
      };
    }

    // Add actual expenses (these are real recorded expenses)
    for (const row of actualResult.rows) {
      const month = parseInt(row.month);
      const amount = parseFloat(row.total);
      const categoryName = row.category || 'Uncategorized';
      const categoryColor = row.color || '#64748b';
      
      if (!breakdown[month].categories[categoryName]) {
        breakdown[month].categories[categoryName] = {
          name: categoryName,
          color: categoryColor,
          actual: 0,
          projected: 0
        };
      }
      breakdown[month].categories[categoryName].actual += amount;
      breakdown[month].actual += amount;
    }

    // Project recurring expenses ONLY into future months (months after current month)
    for (const recurring of recurringResult.rows) {
      const expenseDate = new Date(recurring.expense_date);
      const expenseMonth = expenseDate.getMonth() + 1;
      const expenseYear = expenseDate.getFullYear();
      const amount = parseFloat(recurring.amount);
      const categoryName = recurring.category || 'Uncategorized';
      const categoryColor = recurring.color || '#64748b';

      // Calculate which future months should have this recurring expense
      const futureMonths = getRecurringMonths(
        expenseMonth, 
        expenseYear, 
        recurring.recurring_frequency, 
        targetYear, 
        effectiveCurrentMonth
      );

      for (const month of futureMonths) {
        if (!breakdown[month].categories[categoryName]) {
          breakdown[month].categories[categoryName] = {
            name: categoryName,
            color: categoryColor,
            actual: 0,
            projected: 0
          };
        }
        breakdown[month].categories[categoryName].projected += amount;
        breakdown[month].projected += amount;
      }
    }

    // Convert categories object to array for response
    const formattedBreakdown = Object.values(breakdown).map(m => ({
      month: m.month,
      categories: Object.values(m.categories).map(c => ({
        name: c.name,
        color: c.color,
        amount: c.actual + c.projected,
        actual: c.actual,
        projected: c.projected
      })),
      total: m.actual + m.projected,
      actual: m.actual,
      projected: m.projected
    }));

    // Calculate year totals
    const yearActual = formattedBreakdown.reduce((sum, m) => sum + m.actual, 0);
    const yearProjected = formattedBreakdown.reduce((sum, m) => sum + m.projected, 0);

    res.json({
      year: targetYear,
      breakdown: formattedBreakdown,
      yearTotal: yearActual + yearProjected,
      yearActual,
      yearProjected
    });
  } catch (error) {
    console.error('Monthly breakdown error:', error);
    res.status(500).json({ error: 'Failed to get monthly breakdown' });
  }
};

// Helper function to calculate which FUTURE months should have recurring expense projections
function getRecurringMonths(startMonth, startYear, frequency, targetYear, currentMonth) {
  const months = [];
  
  // Only project into months AFTER the current month (future months only)
  const firstFutureMonth = currentMonth + 1;
  
  // If all months are in the past (viewing past year), return empty
  if (firstFutureMonth > 12) return months;

  // For weekly/bi-weekly, we estimate monthly equivalent
  // Weekly = ~4.33 occurrences per month, bi-weekly = ~2.17 occurrences
  // For simplicity, we project 1x the amount per month

  if (frequency === 'WEEKLY' || frequency === 'BI_WEEKLY' || frequency === 'MONTHLY') {
    // Project to all future months in the target year
    for (let m = firstFutureMonth; m <= 12; m++) {
      // Skip if the expense hasn't started yet
      if (targetYear === startYear && m < startMonth) continue;
      if (targetYear < startYear) continue;
      months.push(m);
    }
  } else if (frequency === 'QUARTERLY') {
    // Calculate all quarterly months based on start month
    const quarterMonths = new Set();
    let m = startMonth;
    while (m <= 12) {
      quarterMonths.add(m);
      m += 3;
    }
    // For years after start year, also include wrapped months
    if (targetYear > startYear) {
      m = startMonth;
      while (m > 0) {
        m -= 3;
      }
      m += 3;
      while (m <= 12) {
        quarterMonths.add(m);
        m += 3;
      }
    }
    
    for (const qm of quarterMonths) {
      if (qm >= firstFutureMonth) {
        if (targetYear === startYear && qm < startMonth) continue;
        months.push(qm);
      }
    }
  } else if (frequency === 'ANNUALLY') {
    // Only the same month as the start month, if it's in the future
    if (startMonth >= firstFutureMonth) {
      if (targetYear >= startYear) {
        months.push(startMonth);
      }
    }
  }

  return months;
}

async function getExpenseWithCategory(expenseId) {
  const result = await pool.query(
    `SELECT 
      e.*,
      ec.name as category_name,
      ec.color as category_color
     FROM expenses e
     LEFT JOIN expense_categories ec ON e.category_id = ec.id
     WHERE e.id = $1`,
    [expenseId]
  );
  return formatExpense(result.rows[0]);
}

function formatExpense(expense) {
  return {
    id: expense.id,
    categoryId: expense.category_id,
    categoryName: expense.category_name || 'Uncategorized',
    categoryColor: expense.category_color || '#64748b',
    description: expense.description,
    amount: parseFloat(expense.amount),
    expenseDate: expense.expense_date,
    isRecurring: expense.is_recurring,
    recurringFrequency: expense.recurring_frequency,
    notes: expense.notes,
    createdAt: expense.created_at
  };
}
