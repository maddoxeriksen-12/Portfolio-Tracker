const pool = require('../db/pool');

class ProjectionCalculatorService {
  // Calculate future portfolio value based on CAGR estimates
  async calculateProjections(userId, years = 10, monthlyContribution = 0) {
    // Get current holdings with projections
    const holdings = await pool.query(
      `SELECT 
         tl.asset_id,
         a.symbol,
         a.asset_type,
         SUM(tl.remaining_quantity) as quantity,
         SUM(tl.remaining_quantity * tl.cost_basis_per_unit) as cost_basis,
         COALESCE(ap.estimated_cagr, 7) as estimated_cagr
       FROM tax_lots tl
       JOIN assets a ON tl.asset_id = a.id
       LEFT JOIN asset_projections ap ON ap.asset_id = tl.asset_id AND ap.user_id = tl.user_id
       WHERE tl.user_id = $1 AND tl.remaining_quantity > 0
       GROUP BY tl.asset_id, a.symbol, a.asset_type, ap.estimated_cagr`,
      [userId]
    );

    // Get income after expenses (monthly net)
    const incomeExpense = await this.getMonthlyNetIncome(userId);
    const monthlyNet = incomeExpense.monthlyNetIncome;

    // Calculate projections
    const projections = [];
    const yearlyBreakdown = [];

    for (let year = 0; year <= years; year++) {
      let totalValue = 0;
      const assetValues = [];

      for (const holding of holdings.rows) {
        const cagr = parseFloat(holding.estimated_cagr) / 100;
        const currentValue = parseFloat(holding.cost_basis); // Use cost basis as starting point
        
        // Compound growth: FV = PV * (1 + r)^n
        const futureValue = currentValue * Math.pow(1 + cagr, year);
        
        assetValues.push({
          symbol: holding.symbol,
          assetType: holding.asset_type,
          quantity: parseFloat(holding.quantity),
          estimatedCAGR: parseFloat(holding.estimated_cagr),
          currentValue: currentValue,
          futureValue: futureValue,
          growth: futureValue - currentValue
        });
        
        totalValue += futureValue;
      }

      // Add monthly contributions compounded
      // Future Value of Annuity: FV = PMT * [((1 + r)^n - 1) / r]
      // Using average portfolio CAGR for contributions
      const avgCAGR = holdings.rows.length > 0
        ? holdings.rows.reduce((sum, h) => sum + parseFloat(h.estimated_cagr), 0) / holdings.rows.length / 100
        : 0.07;
      
      const monthlyRate = avgCAGR / 12;
      const months = year * 12;
      const contributionValue = monthlyContribution > 0 && monthlyRate > 0
        ? monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
        : monthlyContribution * months;

      // Add monthly net income contributions
      const netIncomeContributions = monthlyNet > 0 && monthlyRate > 0
        ? monthlyNet * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
        : monthlyNet * months;

      yearlyBreakdown.push({
        year,
        portfolioValue: totalValue,
        contributionsValue: contributionValue,
        netIncomeValue: netIncomeContributions,
        totalValue: totalValue + contributionValue + netIncomeContributions,
        assetValues
      });
    }

    // Calculate average CAGR for summary
    const avgCAGR = holdings.rows.length > 0
      ? holdings.rows.reduce((sum, h) => sum + parseFloat(h.estimated_cagr), 0) / holdings.rows.length
      : 7;

    return {
      projections: yearlyBreakdown,
      summary: {
        currentValue: yearlyBreakdown[0]?.portfolioValue || 0,
        projectedValue: yearlyBreakdown[years]?.totalValue || 0,
        totalGrowth: (yearlyBreakdown[years]?.totalValue || 0) - (yearlyBreakdown[0]?.portfolioValue || 0),
        years,
        monthlyContribution,
        monthlyNetIncome: monthlyNet,
        averageCAGR: avgCAGR
      }
    };
  }

  // Calculate projections for specific assets
  async calculateAssetProjections(userId, assetIds, years = 10) {
    const holdings = await pool.query(
      `SELECT 
         tl.asset_id,
         a.symbol,
         a.asset_type,
         SUM(tl.remaining_quantity) as quantity,
         SUM(tl.remaining_quantity * tl.cost_basis_per_unit) as cost_basis,
         COALESCE(ap.estimated_cagr, 7) as estimated_cagr
       FROM tax_lots tl
       JOIN assets a ON tl.asset_id = a.id
       LEFT JOIN asset_projections ap ON ap.asset_id = tl.asset_id AND ap.user_id = tl.user_id
       WHERE tl.user_id = $1 
         AND tl.remaining_quantity > 0
         AND tl.asset_id = ANY($2)
       GROUP BY tl.asset_id, a.symbol, a.asset_type, ap.estimated_cagr`,
      [userId, assetIds]
    );

    const assetProjections = {};

    for (const holding of holdings.rows) {
      const cagr = parseFloat(holding.estimated_cagr) / 100;
      const currentValue = parseFloat(holding.cost_basis);
      const yearlyValues = [];

      for (let year = 0; year <= years; year++) {
        const futureValue = currentValue * Math.pow(1 + cagr, year);
        yearlyValues.push({
          year,
          value: futureValue,
          growth: futureValue - currentValue,
          growthPercent: ((futureValue - currentValue) / currentValue) * 100
        });
      }

      assetProjections[holding.symbol] = {
        symbol: holding.symbol,
        assetType: holding.asset_type,
        quantity: parseFloat(holding.quantity),
        estimatedCAGR: parseFloat(holding.estimated_cagr),
        currentValue,
        projectedValue: yearlyValues[years]?.value || currentValue,
        yearlyBreakdown: yearlyValues
      };
    }

    return assetProjections;
  }

  // Set CAGR estimate for an asset
  async setAssetCAGR(userId, assetId, estimatedCAGR, notes = null) {
    const result = await pool.query(
      `INSERT INTO asset_projections (user_id, asset_id, estimated_cagr, notes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, asset_id) 
       DO UPDATE SET estimated_cagr = $3, notes = $4
       RETURNING *`,
      [userId, assetId, estimatedCAGR, notes]
    );
    return result.rows[0];
  }

  // Get monthly net income (income - expenses)
  async getMonthlyNetIncome(userId) {
    // Get monthly income
    const incomeResult = await pool.query(
      `SELECT 
         SUM(
           CASE frequency
             WHEN 'ONE_TIME' THEN net_amount / 12
             WHEN 'WEEKLY' THEN net_amount * 52 / 12
             WHEN 'BI_WEEKLY' THEN net_amount * 26 / 12
             WHEN 'MONTHLY' THEN net_amount
             WHEN 'QUARTERLY' THEN net_amount / 3
             WHEN 'ANNUALLY' THEN net_amount / 12
           END
         ) as monthly_income
       FROM income_records
       WHERE user_id = $1 
         AND (end_date IS NULL OR end_date >= CURRENT_DATE)
         AND start_date <= CURRENT_DATE`,
      [userId]
    );

    // Get average monthly expenses (last 12 months)
    const expenseResult = await pool.query(
      `SELECT 
         AVG(monthly_total) as avg_monthly_expenses
       FROM (
         SELECT 
           DATE_TRUNC('month', expense_date) as month,
           SUM(amount) as monthly_total
         FROM expenses
         WHERE user_id = $1 
           AND expense_date >= CURRENT_DATE - INTERVAL '12 months'
         GROUP BY DATE_TRUNC('month', expense_date)
       ) monthly_expenses`,
      [userId]
    );

    const monthlyIncome = parseFloat(incomeResult.rows[0]?.monthly_income) || 0;
    const monthlyExpenses = parseFloat(expenseResult.rows[0]?.avg_monthly_expenses) || 0;

    return {
      monthlyIncome,
      monthlyExpenses,
      monthlyNetIncome: monthlyIncome - monthlyExpenses
    };
  }

  // Generate income vs expenses report
  async getIncomeExpenseReport(userId, months = 12) {
    const report = [];

    for (let i = 0; i < months; i++) {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - i);
      startDate.setDate(1);
      
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);

      const monthStr = startDate.toISOString().slice(0, 7);

      // Get income for the month
      const income = await pool.query(
        `SELECT 
           SUM(
             CASE frequency
               WHEN 'ONE_TIME' THEN 
                 CASE WHEN DATE_TRUNC('month', start_date) = DATE_TRUNC('month', $2::date) 
                      THEN net_amount ELSE 0 END
               WHEN 'WEEKLY' THEN net_amount * 4.33
               WHEN 'BI_WEEKLY' THEN net_amount * 2.17
               WHEN 'MONTHLY' THEN net_amount
               WHEN 'QUARTERLY' THEN 
                 CASE WHEN EXTRACT(MONTH FROM $2::date) IN 
                   (EXTRACT(MONTH FROM start_date), 
                    EXTRACT(MONTH FROM start_date) + 3,
                    EXTRACT(MONTH FROM start_date) + 6,
                    EXTRACT(MONTH FROM start_date) + 9) 
                 THEN net_amount ELSE 0 END
               WHEN 'ANNUALLY' THEN 
                 CASE WHEN EXTRACT(MONTH FROM $2::date) = EXTRACT(MONTH FROM start_date)
                 THEN net_amount ELSE 0 END
             END
           ) as income
         FROM income_records
         WHERE user_id = $1 
           AND start_date <= $3
           AND (end_date IS NULL OR end_date >= $2)`,
        [userId, startDate.toISOString(), endDate.toISOString()]
      );

      // Get expenses for the month
      const expenses = await pool.query(
        `SELECT 
           ec.name as category,
           ec.color,
           SUM(e.amount) as amount
         FROM expenses e
         LEFT JOIN expense_categories ec ON e.category_id = ec.id
         WHERE e.user_id = $1 
           AND e.expense_date >= $2 
           AND e.expense_date <= $3
         GROUP BY ec.name, ec.color
         ORDER BY SUM(e.amount) DESC`,
        [userId, startDate.toISOString(), endDate.toISOString()]
      );

      const totalExpenses = expenses.rows.reduce((sum, e) => sum + parseFloat(e.amount), 0);
      const totalIncome = parseFloat(income.rows[0]?.income) || 0;

      report.unshift({
        month: monthStr,
        income: totalIncome,
        expenses: totalExpenses,
        net: totalIncome - totalExpenses,
        expenseBreakdown: expenses.rows.map(e => ({
          category: e.category || 'Uncategorized',
          color: e.color || '#6366f1',
          amount: parseFloat(e.amount)
        }))
      });
    }

    return report;
  }
}

module.exports = new ProjectionCalculatorService();
