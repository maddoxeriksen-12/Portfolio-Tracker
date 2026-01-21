const pool = require('../db/pool');

class ProjectionCalculatorService {
  // Calculate future portfolio value based on CAGR estimates
  // yearlyContributions: object mapping calendar year to monthly contribution amount
  // e.g., { 2026: 500, 2027: 750, 2028: 1000 }
  // includeRetirement: whether to include retirement accounts in projections
  async calculateProjections(userId, years = 10, yearlyContributionsMap = {}, includeRetirement = true) {
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

    // Get retirement accounts if included
    let retirementData = { accounts: [], totalValue: 0, totalMonthlyContrib: 0, avgCagr: 7 };
    if (includeRetirement) {
      retirementData = await this.getRetirementSummary(userId);
    }

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
      // Each month's contribution grows for the remaining months in the year
      // Month 1 contribution: grows for 11 months at monthlyRate
      // Month 2 contribution: grows for 10 months at monthlyRate
      // ...
      // Month 12 contribution: grows for 0 months (no growth)
      let compoundedContributions = 0;
      if (monthlyContribution > 0) {
        for (let month = 1; month <= 12; month++) {
          const monthsToGrow = 12 - month;
          const grownContribution = monthlyContribution * Math.pow(1 + monthlyRate, monthsToGrow);
          compoundedContributions += grownContribution;
        }
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
          rawContributions: 0,
          yearlyContributions: 0,
          contributionGrowth: 0,
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
          rawContributions: monthlyContribution * 12,  // Uncompounded total
          yearlyContributions: compoundedContributions, // Compounded value at year end
          contributionGrowth: compoundedContributions - (monthlyContribution * 12), // Growth from compounding
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

    // Calculate retirement projections if included
    let retirementProjections = [];
    if (includeRetirement && retirementData.accounts.length > 0) {
      retirementProjections = this.calculateRetirementYearlyProjections(
        retirementData.accounts,
        years,
        currentYear
      );
    }

    // Combine portfolio and retirement projections
    const combinedProjections = yearlyBreakdown.map((portfolioYear, index) => {
      const retirementYear = retirementProjections[index] || { totalValue: 0, yearlyContributions: 0 };
      return {
        ...portfolioYear,
        retirementValue: retirementYear.totalValue,
        retirementContributions: retirementYear.yearlyContributions,
        retirementGrowth: retirementYear.yearlyGrowth || 0,
        combinedValue: portfolioYear.endingBalance + retirementYear.totalValue
      };
    });

    return {
      projections: combinedProjections,
      summary: {
        currentValue: yearlyBreakdown[0]?.startingBalance || 0,
        projectedValue: yearlyBreakdown[years]?.endingBalance || 0,
        totalGrowth: (yearlyBreakdown[years]?.endingBalance || 0) - (yearlyBreakdown[0]?.startingBalance || 0),
        years,
        currentYear,
        monthlyNetIncome: currentMonthlyNet,
        monthlyExpenses: avgMonthlyExpenses,
        averageCAGR: avgCAGR,
        // Retirement summary
        retirementCurrentValue: retirementData.totalValue,
        retirementProjectedValue: retirementProjections[years]?.totalValue || retirementData.totalValue,
        retirementMonthlyContributions: retirementData.totalMonthlyContrib,
        // Combined totals
        combinedCurrentValue: (yearlyBreakdown[0]?.startingBalance || 0) + retirementData.totalValue,
        combinedProjectedValue: (yearlyBreakdown[years]?.endingBalance || 0) + (retirementProjections[years]?.totalValue || retirementData.totalValue)
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

  // Get retirement account summary for projections
  async getRetirementSummary(userId) {
    const accounts = await pool.query(
      `SELECT 
         ra.id,
         ra.account_name,
         ra.account_type,
         ra.current_value,
         ra.estimated_cagr
       FROM retirement_accounts ra
       WHERE ra.user_id = $1`,
      [userId]
    );

    if (accounts.rows.length === 0) {
      return { accounts: [], totalValue: 0, totalMonthlyContrib: 0, avgCagr: 7 };
    }

    // Get contributions
    const contributions = await pool.query(
      `SELECT 
         rc.account_id,
         rc.contribution_type,
         rc.amount,
         rc.frequency,
         rc.start_date,
         rc.end_date
       FROM retirement_contributions rc
       JOIN retirement_accounts ra ON rc.account_id = ra.id
       WHERE ra.user_id = $1`,
      [userId]
    );

    // Group contributions by account
    const contribsByAccount = {};
    contributions.rows.forEach(c => {
      if (!contribsByAccount[c.account_id]) {
        contribsByAccount[c.account_id] = [];
      }
      contribsByAccount[c.account_id].push(c);
    });

    // Calculate totals
    let totalValue = 0;
    let totalMonthlyContrib = 0;
    let totalCagr = 0;

    const accountsWithContribs = accounts.rows.map(account => {
      const accountContribs = contribsByAccount[account.id] || [];
      let monthlyContrib = 0;

      accountContribs.forEach(contrib => {
        if (contrib.end_date && new Date(contrib.end_date) < new Date()) return;
        const amount = parseFloat(contrib.amount);
        switch (contrib.frequency) {
          case 'WEEKLY': monthlyContrib += amount * 52 / 12; break;
          case 'BI_WEEKLY': monthlyContrib += amount * 26 / 12; break;
          case 'MONTHLY': monthlyContrib += amount; break;
          case 'QUARTERLY': monthlyContrib += amount / 3; break;
          case 'ANNUALLY': monthlyContrib += amount / 12; break;
        }
      });

      totalValue += parseFloat(account.current_value);
      totalMonthlyContrib += monthlyContrib;
      totalCagr += parseFloat(account.estimated_cagr);

      return {
        id: account.id,
        accountName: account.account_name,
        accountType: account.account_type,
        currentValue: parseFloat(account.current_value),
        estimatedCagr: parseFloat(account.estimated_cagr),
        contributions: accountContribs,
        monthlyContribution: monthlyContrib
      };
    });

    return {
      accounts: accountsWithContribs,
      totalValue,
      totalMonthlyContrib,
      avgCagr: accounts.rows.length > 0 ? totalCagr / accounts.rows.length : 7
    };
  }

  // Calculate retirement projections year by year
  calculateRetirementYearlyProjections(accounts, years, currentYear) {
    const projections = [];
    const accountValues = {};

    // Initialize account values
    accounts.forEach(a => {
      accountValues[a.id] = a.currentValue;
    });

    for (let yearOffset = 0; yearOffset <= years; yearOffset++) {
      const calendarYear = currentYear + yearOffset;
      let yearTotal = 0;
      let yearContributions = 0;
      let yearGrowth = 0;

      accounts.forEach(account => {
        const cagr = account.estimatedCagr / 100;
        const monthlyRate = Math.pow(1 + cagr, 1/12) - 1;

        if (yearOffset === 0) {
          yearTotal += account.currentValue;
        } else {
          const prevValue = accountValues[account.id];

          // Calculate yearly contributions
          let yearlyContrib = 0;
          account.contributions.forEach(contrib => {
            const startDate = new Date(contrib.start_date);
            const endDate = contrib.end_date ? new Date(contrib.end_date) : null;
            if (startDate.getFullYear() > calendarYear) return;
            if (endDate && endDate.getFullYear() < calendarYear) return;

            const amount = parseFloat(contrib.amount);
            switch (contrib.frequency) {
              case 'WEEKLY': yearlyContrib += amount * 52; break;
              case 'BI_WEEKLY': yearlyContrib += amount * 26; break;
              case 'MONTHLY': yearlyContrib += amount * 12; break;
              case 'QUARTERLY': yearlyContrib += amount * 4; break;
              case 'ANNUALLY': yearlyContrib += amount; break;
            }
          });

          // Portfolio growth
          const portfolioGrowth = prevValue * (Math.pow(1 + monthlyRate, 12) - 1);

          // Contributions compounded monthly
          const monthlyContrib = yearlyContrib / 12;
          let compoundedContribs = 0;
          for (let month = 1; month <= 12; month++) {
            compoundedContribs += monthlyContrib * Math.pow(1 + monthlyRate, 12 - month);
          }

          const newValue = prevValue + portfolioGrowth + compoundedContribs;
          accountValues[account.id] = newValue;
          yearTotal += newValue;
          yearContributions += yearlyContrib;
          yearGrowth += portfolioGrowth + (compoundedContribs - yearlyContrib);
        }
      });

      projections.push({
        yearOffset,
        calendarYear,
        totalValue: yearTotal,
        yearlyContributions,
        yearlyGrowth: yearGrowth
      });
    }

    return projections;
  }
}

module.exports = new ProjectionCalculatorService();
