const pool = require('../db/pool');
const { validationResult } = require('express-validator');
const taxCalculator = require('../services/taxCalculator');
const { getOrCreateAsset } = require('./assetController');

// Create a transaction (buy or sell)
exports.createTransaction = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      symbol, 
      assetType, 
      transactionType, 
      quantity, 
      pricePerUnit, 
      fees = 0, 
      transactionDate, 
      notes 
    } = req.body;

    await client.query('BEGIN');

    // Get or create asset
    const asset = await getOrCreateAsset(symbol, assetType);

    // Calculate total amount
    const totalAmount = parseFloat(quantity) * parseFloat(pricePerUnit) + parseFloat(fees);

    // Create transaction record
    const txResult = await client.query(
      `INSERT INTO transactions 
       (user_id, asset_id, transaction_type, quantity, price_per_unit, total_amount, fees, transaction_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user.id, asset.id, transactionType, quantity, pricePerUnit, totalAmount, fees, transactionDate, notes]
    );

    const transaction = txResult.rows[0];

    let result = { transaction };

    if (transactionType === 'BUY') {
      // Create tax lot (pass client to use same transaction)
      const taxLot = await taxCalculator.createTaxLot(
        req.user.id,
        transaction.id,
        asset.id,
        quantity,
        pricePerUnit,
        fees,
        transactionDate,
        client  // Pass the database client for transaction consistency
      );
      result.taxLot = taxLot;
    } else if (transactionType === 'SELL') {
      // Process sale and calculate gains
      const realizedGains = await taxCalculator.processSale(
        req.user.id,
        transaction.id,
        asset.id,
        quantity,
        pricePerUnit,
        transactionDate
      );
      result.realizedGains = realizedGains;
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: `${transactionType} transaction recorded successfully`,
      ...result
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create transaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to create transaction' });
  } finally {
    client.release();
  }
};

// Get all transactions
exports.getTransactions = async (req, res) => {
  try {
    const { assetType, symbol, startDate, endDate, type, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT 
        t.*,
        a.symbol,
        a.name as asset_name,
        a.asset_type
      FROM transactions t
      JOIN assets a ON t.asset_id = a.id
      WHERE t.user_id = $1
    `;
    const params = [req.user.id];
    let paramIndex = 2;

    if (assetType) {
      query += ` AND a.asset_type = $${paramIndex}`;
      params.push(assetType);
      paramIndex++;
    }

    if (symbol) {
      query += ` AND a.symbol = $${paramIndex}`;
      params.push(symbol.toUpperCase());
      paramIndex++;
    }

    if (startDate) {
      query += ` AND t.transaction_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND t.transaction_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (type) {
      query += ` AND t.transaction_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    query += ` ORDER BY t.transaction_date DESC, t.created_at DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM transactions t
       JOIN assets a ON t.asset_id = a.id
       WHERE t.user_id = $1`,
      [req.user.id]
    );

    res.json({
      transactions: result.rows.map(t => ({
        id: t.id,
        symbol: t.symbol,
        assetName: t.asset_name,
        assetType: t.asset_type,
        transactionType: t.transaction_type,
        quantity: parseFloat(t.quantity),
        pricePerUnit: parseFloat(t.price_per_unit),
        totalAmount: parseFloat(t.total_amount),
        fees: parseFloat(t.fees),
        transactionDate: t.transaction_date,
        notes: t.notes,
        createdAt: t.created_at
      })),
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

// Get single transaction
exports.getTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        t.*,
        a.symbol,
        a.name as asset_name,
        a.asset_type
       FROM transactions t
       JOIN assets a ON t.asset_id = a.id
       WHERE t.id = $1 AND t.user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const t = result.rows[0];

    res.json({
      transaction: {
        id: t.id,
        symbol: t.symbol,
        assetName: t.asset_name,
        assetType: t.asset_type,
        transactionType: t.transaction_type,
        quantity: parseFloat(t.quantity),
        pricePerUnit: parseFloat(t.price_per_unit),
        totalAmount: parseFloat(t.total_amount),
        fees: parseFloat(t.fees),
        transactionDate: t.transaction_date,
        notes: t.notes,
        createdAt: t.created_at
      }
    });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
};

// Delete transaction (careful - affects tax lots)
exports.deleteTransaction = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Check if transaction exists and belongs to user
    const txResult = await client.query(
      'SELECT * FROM transactions WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (txResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const transaction = txResult.rows[0];

    // Check if there are dependent sells
    if (transaction.transaction_type === 'BUY') {
      const dependentSells = await client.query(
        `SELECT COUNT(*) FROM realized_gains rg
         JOIN tax_lots tl ON rg.tax_lot_id = tl.id
         WHERE tl.buy_transaction_id = $1`,
        [id]
      );

      if (parseInt(dependentSells.rows[0].count) > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete this buy transaction - it has associated sell transactions. Delete those first.' 
        });
      }

      // Delete tax lot
      await client.query('DELETE FROM tax_lots WHERE buy_transaction_id = $1', [id]);
    } else {
      // For sells, restore the tax lot quantities
      const gains = await client.query(
        'SELECT * FROM realized_gains WHERE sell_transaction_id = $1',
        [id]
      );

      for (const gain of gains.rows) {
        await client.query(
          'UPDATE tax_lots SET remaining_quantity = remaining_quantity + $1 WHERE id = $2',
          [gain.quantity_sold, gain.tax_lot_id]
        );
      }

      await client.query('DELETE FROM realized_gains WHERE sell_transaction_id = $1', [id]);
    }

    // Delete transaction
    await client.query('DELETE FROM transactions WHERE id = $1', [id]);

    await client.query('COMMIT');

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  } finally {
    client.release();
  }
};
