const pool = require('../db/pool');
const { validationResult } = require('express-validator');

// Create income record
exports.createIncome = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { source, grossAmount, taxRate = 0, frequency, startDate, endDate, notes } = req.body;

    // Calculate net amount
    const netAmount = parseFloat(grossAmount) * (1 - parseFloat(taxRate) / 100);

    const result = await pool.query(
      `INSERT INTO income_records 
       (user_id, source, gross_amount, tax_rate, net_amount, frequency, start_date, end_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user.id, source, grossAmount, taxRate, netAmount, frequency, startDate, endDate, notes]
    );

    res.status(201).json({
      message: 'Income record created',
      income: formatIncomeRecord(result.rows[0])
    });
  } catch (error) {
    console.error('Create income error:', error);
    res.status(500).json({ error: 'Failed to create income record' });
  }
};

// Get all income records
exports.getIncomeRecords = async (req, res) => {
  try {
    const { active } = req.query;

    let query = `
      SELECT * FROM income_records
      WHERE user_id = $1
    `;

    if (active === 'true') {
      query += ` AND (end_date IS NULL OR end_date >= CURRENT_DATE)`;
    }

    query += ` ORDER BY start_date DESC`;

    const result = await pool.query(query, [req.user.id]);

    res.json({
      incomeRecords: result.rows.map(formatIncomeRecord)
    });
  } catch (error) {
    console.error('Get income records error:', error);
    res.status(500).json({ error: 'Failed to fetch income records' });
  }
};

// Update income record
exports.updateIncome = async (req, res) => {
  try {
    const { id } = req.params;
    const { source, grossAmount, taxRate, frequency, startDate, endDate, notes } = req.body;

    // Calculate new net amount if gross or tax rate changed
    let netAmount;
    if (grossAmount !== undefined || taxRate !== undefined) {
      const currentRecord = await pool.query(
        'SELECT * FROM income_records WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
      );

      if (currentRecord.rows.length === 0) {
        return res.status(404).json({ error: 'Income record not found' });
      }

      const gross = grossAmount !== undefined ? grossAmount : currentRecord.rows[0].gross_amount;
      const tax = taxRate !== undefined ? taxRate : currentRecord.rows[0].tax_rate;
      netAmount = parseFloat(gross) * (1 - parseFloat(tax) / 100);
    }

    const result = await pool.query(
      `UPDATE income_records SET
        source = COALESCE($1, source),
        gross_amount = COALESCE($2, gross_amount),
        tax_rate = COALESCE($3, tax_rate),
        net_amount = COALESCE($4, net_amount),
        frequency = COALESCE($5, frequency),
        start_date = COALESCE($6, start_date),
        end_date = $7,
        notes = $8
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [source, grossAmount, taxRate, netAmount, frequency, startDate, endDate, notes, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Income record not found' });
    }

    res.json({
      message: 'Income record updated',
      income: formatIncomeRecord(result.rows[0])
    });
  } catch (error) {
    console.error('Update income error:', error);
    res.status(500).json({ error: 'Failed to update income record' });
  }
};

// Delete income record
exports.deleteIncome = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM income_records WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Income record not found' });
    }

    res.json({ message: 'Income record deleted' });
  } catch (error) {
    console.error('Delete income error:', error);
    res.status(500).json({ error: 'Failed to delete income record' });
  }
};

// Get income summary
exports.getIncomeSummary = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         SUM(gross_amount * 
           CASE frequency
             WHEN 'ONE_TIME' THEN 1
             WHEN 'WEEKLY' THEN 52
             WHEN 'BI_WEEKLY' THEN 26
             WHEN 'MONTHLY' THEN 12
             WHEN 'QUARTERLY' THEN 4
             WHEN 'ANNUALLY' THEN 1
           END
         ) as annual_gross,
         SUM(net_amount * 
           CASE frequency
             WHEN 'ONE_TIME' THEN 1
             WHEN 'WEEKLY' THEN 52
             WHEN 'BI_WEEKLY' THEN 26
             WHEN 'MONTHLY' THEN 12
             WHEN 'QUARTERLY' THEN 4
             WHEN 'ANNUALLY' THEN 1
           END
         ) as annual_net
       FROM income_records
       WHERE user_id = $1 
         AND (end_date IS NULL OR end_date >= CURRENT_DATE)
         AND start_date <= CURRENT_DATE`,
      [req.user.id]
    );

    const annualGross = parseFloat(result.rows[0]?.annual_gross) || 0;
    const annualNet = parseFloat(result.rows[0]?.annual_net) || 0;

    res.json({
      summary: {
        annualGrossIncome: annualGross,
        annualNetIncome: annualNet,
        monthlyGrossIncome: annualGross / 12,
        monthlyNetIncome: annualNet / 12,
        effectiveTaxRate: annualGross > 0 ? ((annualGross - annualNet) / annualGross) * 100 : 0
      }
    });
  } catch (error) {
    console.error('Income summary error:', error);
    res.status(500).json({ error: 'Failed to get income summary' });
  }
};

function formatIncomeRecord(record) {
  return {
    id: record.id,
    source: record.source,
    grossAmount: parseFloat(record.gross_amount),
    taxRate: parseFloat(record.tax_rate),
    netAmount: parseFloat(record.net_amount),
    frequency: record.frequency,
    startDate: record.start_date,
    endDate: record.end_date,
    notes: record.notes,
    createdAt: record.created_at
  };
}
