const pool = require('../db/pool');

class ProjectionCalculatorService {
  // Calculate future portfolio value based on CAGR estimates
  // yearlyContributions: object mapping calendar year to monthly contribution amount
  // e.g., { 2026: 500, 2027: 750, 2028: 1000 }
  async calculateProjections(userId, years = 10, yearlyContributionsMap = {}) {
    const currentYear = new Date().getFullYear();
    
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

    // Get all income records (including future ones for projections)
    const incomeRecords = await pool.query(
      `SELECT id, source, net_amount, frequency, start_date, end_date
       FROM income_records
       WHERE user_id = $1
       ORDER BY start_date`,
      [userId]
    );

    // Get average monthly expenses (for calculating remaining income)
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
    const avgMonthlyExpenses = parseFloat(expenseResult.rows[0]?.avg_monthly_expenses) || 0;

    // Calculate average CAGR
    const avgCAGR = holdings.rows.length > 0
      ? holdings.rows.reduce((sum, h) => sum + parseFloat(h.estimated_cagr), 0) / holdings.rows.length
      : 7;
    const avgCAGRDecimal = avgCAGR / 100;
    
    // Calculate monthly rate from annual CAGR for monthly compounding
    const monthlyRate = Math.pow(1 + avgCAGRDecimal, 1/12) - 1;

    // Calculate projections year by year
    const yearlyBreakdown = [];
    let previousEndingBalance = 0;

    // Calculate initial portfolio value
    const initialPortfolioValue = holdings.rows.reduce((sum, h) => sum + parseFloat(h.cost_basis), 0);

    for (let yearOffset = 0; yearOffset <= years; yearOffset++) {
      const calendarYear = currentYear + yearOffset;
      const assetValues = [];

      // Calculate asset values for this year
      for (const holding of holdings.rows) {
        const cagr = parseFloat(holding.estimated_cagr) / 100;
        const currentValue = parseFloat(holding.cost_basis);
        const futureValue = currentValue * Math.pow(1 + cagr, yearOffset);
        
        assetValues.push({
          symbol: holding.symbol,
          assetType: holding.asset_type,
          quantity: parseFloat(holding.quantity),
          estimatedCAGR: parseFloat(holding.estimated_cagr),
          currentValue: currentValue,
          futureValue: futureValue,
          growth: futureValue - currentValue
        });
      }

      // Calculate income for this specific calendar year
      const yearlyIncome = this.calculateYearlyIncome(incomeRecords.rows, calendarYear);
      
      // Get monthly contribution for this year (default to 0 if not specified)
      const monthlyContribution = yearlyContributionsMap[calendarYear] || 0;
      
      // Calculate the future value of monthly contributions with monthly compounding
      // Using the ordinary annuity formula: FV = PMT * [((1 + r)^n - 1) / r]
      // Each monthly contribution grows for the remaining months in the year
      let compoundedContributions = 0;
      if (monthlyContribution > 0 && monthlyRate > 0) {
        compoundedContributions = monthlyContribution * ((Math.pow(1 + monthlyRate, 12) - 1) / monthlyRate);
      } else if (monthlyContribution > 0) {
        // If rate is 0, no compounding
        compoundedContributions = monthlyContribution * 12;
      }
      
      // Calculate remaining income (yearly income - expenses - contributions)
      const yearlyExpenses = avgMonthlyExpenses * 12;
      const yearlyNetIncome = yearlyIncome - yearlyExpenses;
      const thisYearRemainingIncome = Math.max(0, yearlyNetIncome - (monthlyContribution * 12));

      if (yearOffset === 0) {
        // Current year: Show current state
        const startingBalance = initialPortfolioValue;
        previousEndingBalance = startingBalance;
        
        yearlyBreakdown.push({
          yearOffset,
          calendarYear,
          startingBalance: startingBalance,
          yearlyContributions: 0,
          yearlyIncome: yearlyIncome,
          yearlyExpenses: yearlyExpenses,
          yearlyRemainingIncome: 0,
          portfolioGrowth: 0,
          endingBalance: startingBalance,
          monthlyContribution: 0,
          assetValues
        });
      } else {
        // Future years: Calculate based on previous year's ending balance
        const startingBalance = previousEndingBalance;
        
        // Growth on starting balance (compounded monthly over 12 months)
        const portfolioGrowth = startingBalance * (Math.pow(1 + monthlyRate, 12) - 1);
        
        // Ending balance = starting balance grown monthly + compounded contributions + remaining income
        const endingBalance = startingBalance + portfolioGrowth + compoundedContributions + thisYearRemainingIncome;
        
        previousEndingBalance = endingBalance;
        
        yearlyBreakdown.push({
          yearOffset,
          calendarYear,
          startingBalance: startingBalance,
          yearlyContributions: compoundedContributions,
          yearlyIncome: yearlyIncome,
          yearlyExpenses: yearlyExpenses,
          yearlyRemainingIncome: thisYearRemainingIncome,
          portfolioGrowth: portfolioGrowth,
          endingBalance: endingBalance,
          monthlyContribution: monthlyContribution,
          assetValues
        });
      }
    }

    // Get current monthly net income for summary
    const currentMonthlyIncome = this.calculateYearlyIncome(incomeRecords.rows, currentYear) / 12;
    const currentMonthlyNet = currentMonthlyIncome - avgMonthlyExpenses;

    return {
      projections: yearlyBreakdown,
      summary: {
        currentValue: yearlyBreakdown[0]?.startingBalance || 0,
        projectedValue: yearlyBreakdown[years]?.endingBalance || 0,
        totalGrowth: (yearlyBreakdown[years]?.endingBalance || 0) - (yearlyBreakdown[0]?.startingBalance || 0),
        years,
        currentYear,
        monthlyNetIncome: currentMonthlyNet,
        monthlyExpenses: avgMonthlyExpenses,
        averageCAGR: avgCAGR
      }
    };
  }

  // Calculate yearly income based on income records active during that year
  calculateYearlyIncome(incomeRecords, calendarYear) {
    const yearStart = new Date(calendarYear, 0, 1);
    const yearEnd = new Date(calendarYear, 11, 31);
    
    let totalYearlyIncome = 0;

    for (const record of incomeRecords) {
      const startDate = new Date(record.start_date);
      const endDate = record.end_date ? new Date(record.end_date) : null;
      
      // Check if this income record is active during this calendar year
      if (startDate > yearEnd) continue; // Hasn't started yet
      if (endDate && endDate < yearStart) continue; // Already ended
      
      // Calculate monthly equivalent
      let monthlyAmount = 0;
      const netAmount = parseFloat(record.net_amount);
      
      switch (record.frequency) {
        case 'ONE_TIME':
          // One-time income only counts if it's in this year
          if (startDate >= yearStart && startDate <= yearEnd) {
            totalYearlyIncome += netAmount;
          }
          continue;
        case 'WEEKLY':
          monthlyAmount = netAmount * 52 / 12;
          break;
        case 'BI_WEEKLY':
          monthlyAmount = netAmount * 26 / 12;
          break;
        case 'MONTHLY':
          monthlyAmount = netAmount;
          break;
        case 'QUARTERLY':
          monthlyAmount = netAmount / 3;
          break;
        case 'ANNUALLY':
          monthlyAmount = netAmount / 12;
          break;
        default:
          monthlyAmount = netAmount;
      }
      
      // Calculate how many months this income is active in this year
      const activeStartMonth = startDate > yearStart ? startDate.getMonth() : 0;
      const activeEndMonth = (endDate && endDate < yearEnd) ? endDate.getMonth() : 11;
      const activeMonths = activeEndMonth - activeStartMonth + 1;
      
      totalYearlyIncome += monthlyAmount * activeMonths;
    }
    
    return totalYearlyIncome;
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
