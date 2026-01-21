const pool = require('../db/pool');

// Account type labels for display
const ACCOUNT_TYPE_LABELS = {
  'ROTH_IRA': 'Roth IRA',
  '401K': '401(k)',
  'TRADITIONAL_IRA': 'Traditional IRA',
  '403B': '403(b)',
  '457B': '457(b)',
  'SEP_IRA': 'SEP IRA',
  'SIMPLE_IRA': 'SIMPLE IRA',
  'PENSION': 'Pension',
  'HSA': 'HSA',
  'OTHER': 'Other'
};

// Get all retirement accounts for a user
exports.getRetirementAccounts = async (req, res) => {
  try {
    const accounts = await pool.query(
      `SELECT 
         ra.id,
         ra.account_name,
         ra.account_type,
         ra.current_value,
         ra.estimated_cagr,
         ra.employer_name,
         ra.notes,
         ra.created_at,
         ra.updated_at
       FROM retirement_accounts ra
       WHERE ra.user_id = $1
       ORDER BY ra.current_value DESC`,
      [req.user.id]
    );

    // Get contributions for each account
    const accountsWithContributions = await Promise.all(
      accounts.rows.map(async (account) => {
        const contributions = await pool.query(
          `SELECT 
             id, contribution_type, amount, frequency, start_date, end_date, notes
           FROM retirement_contributions
           WHERE account_id = $1
           ORDER BY created_at DESC`,
          [account.id]
        );

        // Calculate monthly contribution total
        const monthlyContribution = contributions.rows.reduce((total, contrib) => {
          if (contrib.end_date && new Date(contrib.end_date) < new Date()) return total;
          
          const amount = parseFloat(contrib.amount);
          switch (contrib.frequency) {
            case 'WEEKLY': return total + (amount * 52 / 12);
            case 'BI_WEEKLY': return total + (amount * 26 / 12);
            case 'MONTHLY': return total + amount;
            case 'QUARTERLY': return total + (amount / 3);
            case 'ANNUALLY': return total + (amount / 12);
            default: return total;
          }
        }, 0);

        // Calculate yearly contribution total
        const yearlyContribution = monthlyContribution * 12;

        return {
          ...account,
          accountTypeLabel: ACCOUNT_TYPE_LABELS[account.account_type] || account.account_type,
          currentValue: parseFloat(account.current_value),
          estimatedCagr: parseFloat(account.estimated_cagr),
          contributions: contributions.rows.map(c => ({
            ...c,
            amount: parseFloat(c.amount)
          })),
          monthlyContribution,
          yearlyContribution
        };
      })
    );

    // Calculate totals
    const totalValue = accountsWithContributions.reduce((sum, a) => sum + a.currentValue, 0);
    const totalMonthlyContribution = accountsWithContributions.reduce((sum, a) => sum + a.monthlyContribution, 0);
    const averageCagr = accountsWithContributions.length > 0
      ? accountsWithContributions.reduce((sum, a) => sum + a.estimatedCagr, 0) / accountsWithContributions.length
      : 7;

    res.json({
      accounts: accountsWithContributions,
      summary: {
        totalValue,
        totalMonthlyContribution,
        totalYearlyContribution: totalMonthlyContribution * 12,
        averageCagr,
        accountCount: accountsWithContributions.length
      }
    });
  } catch (error) {
    console.error('Get retirement accounts error:', error);
    res.status(500).json({ error: 'Failed to get retirement accounts' });
  }
};

// Create a new retirement account
exports.createRetirementAccount = async (req, res) => {
  try {
    const { accountName, accountType, currentValue, estimatedCagr, employerName, notes } = req.body;

    if (!accountName || !accountType) {
      return res.status(400).json({ error: 'Account name and type are required' });
    }

    const result = await pool.query(
      `INSERT INTO retirement_accounts (user_id, account_name, account_type, current_value, estimated_cagr, employer_name, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user.id, accountName, accountType, currentValue || 0, estimatedCagr || 7, employerName, notes]
    );

    // Record initial value in history
    if (currentValue > 0) {
      await pool.query(
        `INSERT INTO retirement_value_history (account_id, value)
         VALUES ($1, $2)`,
        [result.rows[0].id, currentValue]
      );
    }

    const account = result.rows[0];
    res.status(201).json({
      account: {
        id: account.id,
        accountName: account.account_name,
        accountType: account.account_type,
        accountTypeLabel: ACCOUNT_TYPE_LABELS[account.account_type],
        currentValue: parseFloat(account.current_value),
        estimatedCagr: parseFloat(account.estimated_cagr),
        employerName: account.employer_name,
        notes: account.notes,
        contributions: [],
        monthlyContribution: 0,
        yearlyContribution: 0
      }
    });
  } catch (error) {
    console.error('Create retirement account error:', error);
    res.status(500).json({ error: 'Failed to create retirement account' });
  }
};

// Update a retirement account
exports.updateRetirementAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { accountName, accountType, currentValue, estimatedCagr, employerName, notes } = req.body;

    // Verify ownership
    const existing = await pool.query(
      'SELECT id, current_value FROM retirement_accounts WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const oldValue = parseFloat(existing.rows[0].current_value);

    const result = await pool.query(
      `UPDATE retirement_accounts
       SET account_name = COALESCE($1, account_name),
           account_type = COALESCE($2, account_type),
           current_value = COALESCE($3, current_value),
           estimated_cagr = COALESCE($4, estimated_cagr),
           employer_name = COALESCE($5, employer_name),
           notes = COALESCE($6, notes)
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [accountName, accountType, currentValue, estimatedCagr, employerName, notes, id, req.user.id]
    );

    // Record value change in history if value changed
    if (currentValue !== undefined && currentValue !== oldValue) {
      await pool.query(
        `INSERT INTO retirement_value_history (account_id, value)
         VALUES ($1, $2)`,
        [id, currentValue]
      );
    }

    const account = result.rows[0];
    res.json({
      account: {
        id: account.id,
        accountName: account.account_name,
        accountType: account.account_type,
        accountTypeLabel: ACCOUNT_TYPE_LABELS[account.account_type],
        currentValue: parseFloat(account.current_value),
        estimatedCagr: parseFloat(account.estimated_cagr),
        employerName: account.employer_name,
        notes: account.notes
      }
    });
  } catch (error) {
    console.error('Update retirement account error:', error);
    res.status(500).json({ error: 'Failed to update retirement account' });
  }
};

// Delete a retirement account
exports.deleteRetirementAccount = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM retirement_accounts WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete retirement account error:', error);
    res.status(500).json({ error: 'Failed to delete retirement account' });
  }
};

// Add a contribution to an account
exports.addContribution = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { contributionType, amount, frequency, startDate, endDate, notes } = req.body;

    // Verify account ownership
    const account = await pool.query(
      'SELECT id FROM retirement_accounts WHERE id = $1 AND user_id = $2',
      [accountId, req.user.id]
    );

    if (account.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (!contributionType || !amount || !frequency) {
      return res.status(400).json({ error: 'Contribution type, amount, and frequency are required' });
    }

    const result = await pool.query(
      `INSERT INTO retirement_contributions (account_id, contribution_type, amount, frequency, start_date, end_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [accountId, contributionType, amount, frequency, startDate || new Date(), endDate, notes]
    );

    const contribution = result.rows[0];
    res.status(201).json({
      contribution: {
        id: contribution.id,
        contributionType: contribution.contribution_type,
        amount: parseFloat(contribution.amount),
        frequency: contribution.frequency,
        startDate: contribution.start_date,
        endDate: contribution.end_date,
        notes: contribution.notes
      }
    });
  } catch (error) {
    console.error('Add contribution error:', error);
    res.status(500).json({ error: 'Failed to add contribution' });
  }
};

// Update a contribution
exports.updateContribution = async (req, res) => {
  try {
    const { contributionId } = req.params;
    const { contributionType, amount, frequency, startDate, endDate, notes } = req.body;

    // Verify ownership through account
    const existing = await pool.query(
      `SELECT rc.id FROM retirement_contributions rc
       JOIN retirement_accounts ra ON rc.account_id = ra.id
       WHERE rc.id = $1 AND ra.user_id = $2`,
      [contributionId, req.user.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Contribution not found' });
    }

    const result = await pool.query(
      `UPDATE retirement_contributions
       SET contribution_type = COALESCE($1, contribution_type),
           amount = COALESCE($2, amount),
           frequency = COALESCE($3, frequency),
           start_date = COALESCE($4, start_date),
           end_date = $5,
           notes = COALESCE($6, notes)
       WHERE id = $7
       RETURNING *`,
      [contributionType, amount, frequency, startDate, endDate, notes, contributionId]
    );

    const contribution = result.rows[0];
    res.json({
      contribution: {
        id: contribution.id,
        contributionType: contribution.contribution_type,
        amount: parseFloat(contribution.amount),
        frequency: contribution.frequency,
        startDate: contribution.start_date,
        endDate: contribution.end_date,
        notes: contribution.notes
      }
    });
  } catch (error) {
    console.error('Update contribution error:', error);
    res.status(500).json({ error: 'Failed to update contribution' });
  }
};

// Delete a contribution
exports.deleteContribution = async (req, res) => {
  try {
    const { contributionId } = req.params;

    // Verify ownership through account
    const result = await pool.query(
      `DELETE FROM retirement_contributions rc
       USING retirement_accounts ra
       WHERE rc.account_id = ra.id AND rc.id = $1 AND ra.user_id = $2
       RETURNING rc.id`,
      [contributionId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contribution not found' });
    }

    res.json({ message: 'Contribution deleted successfully' });
  } catch (error) {
    console.error('Delete contribution error:', error);
    res.status(500).json({ error: 'Failed to delete contribution' });
  }
};

// Get value history for an account
exports.getValueHistory = async (req, res) => {
  try {
    const { accountId } = req.params;

    // Verify ownership
    const account = await pool.query(
      'SELECT id FROM retirement_accounts WHERE id = $1 AND user_id = $2',
      [accountId, req.user.id]
    );

    if (account.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const history = await pool.query(
      `SELECT id, value, recorded_at
       FROM retirement_value_history
       WHERE account_id = $1
       ORDER BY recorded_at DESC
       LIMIT 365`,
      [accountId]
    );

    res.json({
      history: history.rows.map(h => ({
        id: h.id,
        value: parseFloat(h.value),
        recordedAt: h.recorded_at
      }))
    });
  } catch (error) {
    console.error('Get value history error:', error);
    res.status(500).json({ error: 'Failed to get value history' });
  }
};

// Get retirement projections
exports.getRetirementProjections = async (req, res) => {
  try {
    const { years = 30 } = req.query;
    const yearsNum = parseInt(years);
    const currentYear = new Date().getFullYear();

    // Get all retirement accounts with contributions
    const accounts = await pool.query(
      `SELECT 
         ra.id,
         ra.account_name,
         ra.account_type,
         ra.current_value,
         ra.estimated_cagr
       FROM retirement_accounts ra
       WHERE ra.user_id = $1`,
      [req.user.id]
    );

    if (accounts.rows.length === 0) {
      return res.json({
        projections: [],
        summary: {
          currentValue: 0,
          projectedValue: 0,
          totalContributions: 0,
          totalGrowth: 0
        }
      });
    }

    // Get contributions for all accounts
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
      [req.user.id]
    );

    // Group contributions by account
    const contribsByAccount = {};
    contributions.rows.forEach(c => {
      if (!contribsByAccount[c.account_id]) {
        contribsByAccount[c.account_id] = [];
      }
      contribsByAccount[c.account_id].push(c);
    });

    // Calculate projections year by year
    const yearlyProjections = [];
    const accountProjections = {};

    // Initialize account values
    accounts.rows.forEach(a => {
      accountProjections[a.id] = {
        accountName: a.account_name,
        accountType: a.account_type,
        cagr: parseFloat(a.estimated_cagr),
        values: [parseFloat(a.current_value)]
      };
    });

    let totalStartValue = accounts.rows.reduce((sum, a) => sum + parseFloat(a.current_value), 0);
    let previousYearTotal = totalStartValue;

    for (let yearOffset = 0; yearOffset <= yearsNum; yearOffset++) {
      const calendarYear = currentYear + yearOffset;
      let yearTotal = 0;
      let yearContributions = 0;

      // Calculate each account's value for this year
      accounts.rows.forEach(account => {
        const accountId = account.id;
        const cagr = parseFloat(account.estimated_cagr) / 100;
        const monthlyRate = Math.pow(1 + cagr, 1/12) - 1;
        
        let accountValue;
        if (yearOffset === 0) {
          accountValue = parseFloat(account.current_value);
        } else {
          // Get previous year's ending value
          const prevValue = accountProjections[accountId].values[yearOffset - 1];
          
          // Calculate yearly contributions for this account
          const accountContribs = contribsByAccount[accountId] || [];
          let yearlyContrib = 0;
          
          accountContribs.forEach(contrib => {
            const startDate = new Date(contrib.start_date);
            const endDate = contrib.end_date ? new Date(contrib.end_date) : null;
            
            // Check if contribution is active this year
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

          // Calculate compounded growth + contributions
          // Portfolio growth on starting balance
          const portfolioGrowth = prevValue * (Math.pow(1 + monthlyRate, 12) - 1);
          
          // Contributions compounded monthly (assuming monthly average)
          const monthlyContrib = yearlyContrib / 12;
          let compoundedContribs = 0;
          for (let month = 1; month <= 12; month++) {
            compoundedContribs += monthlyContrib * Math.pow(1 + monthlyRate, 12 - month);
          }
          
          accountValue = prevValue + portfolioGrowth + compoundedContribs;
          yearContributions += yearlyContrib;
        }

        accountProjections[accountId].values.push(accountValue);
        yearTotal += accountValue;
      });

      yearlyProjections.push({
        yearOffset,
        calendarYear,
        totalValue: yearTotal,
        yearlyContributions: yearContributions,
        yearlyGrowth: yearTotal - previousYearTotal - yearContributions,
        accountBreakdown: Object.entries(accountProjections).map(([id, proj]) => ({
          accountId: id,
          accountName: proj.accountName,
          accountType: proj.accountType,
          value: proj.values[yearOffset + 1] || proj.values[proj.values.length - 1]
        }))
      });

      previousYearTotal = yearTotal;
    }

    // Calculate totals
    const finalValue = yearlyProjections[yearsNum]?.totalValue || totalStartValue;
    const totalContributions = yearlyProjections.reduce((sum, y) => sum + y.yearlyContributions, 0);
    const totalGrowth = finalValue - totalStartValue - totalContributions;

    res.json({
      projections: yearlyProjections,
      summary: {
        currentValue: totalStartValue,
        projectedValue: finalValue,
        totalContributions,
        totalGrowth,
        years: yearsNum
      }
    });
  } catch (error) {
    console.error('Get retirement projections error:', error);
    res.status(500).json({ error: 'Failed to calculate retirement projections' });
  }
};
