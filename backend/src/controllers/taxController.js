const taxCalculator = require('../services/taxCalculator');
const alphaVantage = require('../services/alphaVantage');
const pool = require('../db/pool');

// Get tax summary for a year
exports.getTaxSummary = async (req, res) => {
  try {
    const { year } = req.params;
    const currentYear = new Date().getFullYear();
    const targetYear = year ? parseInt(year) : currentYear;

    const summary = await taxCalculator.getTaxSummary(req.user.id, targetYear);
    res.json(summary);
  } catch (error) {
    console.error('Tax summary error:', error);
    res.status(500).json({ error: 'Failed to get tax summary' });
  }
};

// Get cost basis report
exports.getCostBasisReport = async (req, res) => {
  try {
    const report = await taxCalculator.getCostBasisReport(req.user.id);
    res.json(report);
  } catch (error) {
    console.error('Cost basis report error:', error);
    res.status(500).json({ error: 'Failed to get cost basis report' });
  }
};

// Get unrealized gains
exports.getUnrealizedGains = async (req, res) => {
  try {
    // Get all unique assets for the user
    const assets = await pool.query(
      `SELECT DISTINCT a.id, a.symbol, a.asset_type
       FROM tax_lots tl
       JOIN assets a ON tl.asset_id = a.id
       WHERE tl.user_id = $1 AND tl.remaining_quantity > 0`,
      [req.user.id]
    );

    // Fetch current prices
    const currentPrices = {};
    for (const asset of assets.rows) {
      try {
        currentPrices[asset.symbol] = await alphaVantage.getPrice(
          asset.id, 
          asset.symbol, 
          asset.asset_type
        );
      } catch (error) {
        console.error(`Could not fetch price for ${asset.symbol}`);
        currentPrices[asset.symbol] = 0;
      }
    }

    const gains = await taxCalculator.getUnrealizedGains(req.user.id, currentPrices);
    res.json(gains);
  } catch (error) {
    console.error('Unrealized gains error:', error);
    res.status(500).json({ error: 'Failed to get unrealized gains' });
  }
};

// Get realized gains for a date range
exports.getRealizedGains = async (req, res) => {
  try {
    const { startDate, endDate, assetType } = req.query;

    let query = `
      SELECT 
        rg.*,
        a.symbol,
        a.asset_type
      FROM realized_gains rg
      JOIN assets a ON rg.asset_id = a.id
      WHERE rg.user_id = $1
    `;
    const params = [req.user.id];
    let paramIndex = 2;

    if (startDate) {
      query += ` AND rg.sale_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND rg.sale_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (assetType) {
      query += ` AND a.asset_type = $${paramIndex}`;
      params.push(assetType);
      paramIndex++;
    }

    query += ` ORDER BY rg.sale_date DESC`;

    const result = await pool.query(query, params);

    const gains = result.rows.map(g => ({
      id: g.id,
      symbol: g.symbol,
      assetType: g.asset_type,
      quantitySold: parseFloat(g.quantity_sold),
      costBasis: parseFloat(g.cost_basis),
      proceeds: parseFloat(g.proceeds),
      gainLoss: parseFloat(g.gain_loss),
      holdingPeriodDays: g.holding_period_days,
      isLongTerm: g.is_long_term,
      saleDate: g.sale_date
    }));

    // Calculate totals
    const shortTerm = gains.filter(g => !g.isLongTerm);
    const longTerm = gains.filter(g => g.isLongTerm);

    res.json({
      gains,
      summary: {
        totalGains: gains.reduce((sum, g) => sum + g.gainLoss, 0),
        shortTermGains: shortTerm.reduce((sum, g) => sum + g.gainLoss, 0),
        longTermGains: longTerm.reduce((sum, g) => sum + g.gainLoss, 0),
        totalTransactions: gains.length
      }
    });
  } catch (error) {
    console.error('Realized gains error:', error);
    res.status(500).json({ error: 'Failed to get realized gains' });
  }
};

// Get tax lots
exports.getTaxLots = async (req, res) => {
  try {
    const { includeExhausted } = req.query;

    let query = `
      SELECT 
        tl.*,
        a.symbol,
        a.name as asset_name,
        a.asset_type
      FROM tax_lots tl
      JOIN assets a ON tl.asset_id = a.id
      WHERE tl.user_id = $1
    `;

    if (!includeExhausted) {
      query += ` AND tl.remaining_quantity > 0`;
    }

    query += ` ORDER BY a.symbol, tl.purchase_date`;

    const result = await pool.query(query, [req.user.id]);

    res.json({
      taxLots: result.rows.map(lot => ({
        id: lot.id,
        symbol: lot.symbol,
        assetName: lot.asset_name,
        assetType: lot.asset_type,
        originalQuantity: parseFloat(lot.original_quantity),
        remainingQuantity: parseFloat(lot.remaining_quantity),
        costBasisPerUnit: parseFloat(lot.cost_basis_per_unit),
        totalCostBasis: parseFloat(lot.remaining_quantity) * parseFloat(lot.cost_basis_per_unit),
        purchaseDate: lot.purchase_date
      }))
    });
  } catch (error) {
    console.error('Tax lots error:', error);
    res.status(500).json({ error: 'Failed to get tax lots' });
  }
};
