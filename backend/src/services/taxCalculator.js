const pool = require('../db/pool');

// Days threshold for long-term capital gains (1 year + 1 day)
const LONG_TERM_THRESHOLD_DAYS = 366;

class TaxCalculatorService {
  // Process a sell transaction using FIFO method
  async processSale(userId, sellTransactionId, assetId, quantitySold, pricePerUnit, saleDate) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get available tax lots in FIFO order (oldest first)
      const lotsResult = await client.query(
        `SELECT * FROM tax_lots 
         WHERE user_id = $1 AND asset_id = $2 AND remaining_quantity > 0 
         ORDER BY purchase_date ASC`,
        [userId, assetId]
      );
      
      const availableLots = lotsResult.rows;
      let remainingToSell = parseFloat(quantitySold);
      const proceeds = parseFloat(quantitySold) * parseFloat(pricePerUnit);
      const realizedGains = [];
      
      for (const lot of availableLots) {
        if (remainingToSell <= 0) break;
        
        const lotQuantity = parseFloat(lot.remaining_quantity);
        const quantityFromLot = Math.min(lotQuantity, remainingToSell);
        const costBasisForSale = quantityFromLot * parseFloat(lot.cost_basis_per_unit);
        const proceedsForSale = quantityFromLot * parseFloat(pricePerUnit);
        const gainLoss = proceedsForSale - costBasisForSale;
        
        // Calculate holding period
        const purchaseDate = new Date(lot.purchase_date);
        const saleDateObj = new Date(saleDate);
        const holdingPeriodDays = Math.floor((saleDateObj - purchaseDate) / (1000 * 60 * 60 * 24));
        const isLongTerm = holdingPeriodDays >= LONG_TERM_THRESHOLD_DAYS;
        
        // Record realized gain
        const gainResult = await client.query(
          `INSERT INTO realized_gains 
           (user_id, sell_transaction_id, tax_lot_id, asset_id, quantity_sold, 
            cost_basis, proceeds, gain_loss, holding_period_days, is_long_term, sale_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [userId, sellTransactionId, lot.id, assetId, quantityFromLot, 
           costBasisForSale, proceedsForSale, gainLoss, holdingPeriodDays, isLongTerm, saleDate]
        );
        
        realizedGains.push(gainResult.rows[0]);
        
        // Update tax lot remaining quantity
        const newRemaining = lotQuantity - quantityFromLot;
        await client.query(
          'UPDATE tax_lots SET remaining_quantity = $1 WHERE id = $2',
          [newRemaining, lot.id]
        );
        
        remainingToSell -= quantityFromLot;
      }
      
      if (remainingToSell > 0.00000001) { // Allow for floating point errors
        throw new Error(`Insufficient holdings: trying to sell ${quantitySold} but only ${parseFloat(quantitySold) - remainingToSell} available`);
      }
      
      await client.query('COMMIT');
      return realizedGains;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Create a new tax lot from a buy transaction
  // Pass dbClient to use existing transaction, otherwise uses pool
  async createTaxLot(userId, buyTransactionId, assetId, quantity, pricePerUnit, fees, purchaseDate, dbClient = null) {
    // Cost basis includes fees
    const totalCost = parseFloat(quantity) * parseFloat(pricePerUnit) + parseFloat(fees || 0);
    const costBasisPerUnit = totalCost / parseFloat(quantity);
    
    // Use provided client (for transaction) or pool
    const queryRunner = dbClient || pool;
    
    const result = await queryRunner.query(
      `INSERT INTO tax_lots 
       (user_id, buy_transaction_id, asset_id, original_quantity, remaining_quantity, 
        cost_basis_per_unit, purchase_date)
       VALUES ($1, $2, $3, $4, $4, $5, $6)
       RETURNING *`,
      [userId, buyTransactionId, assetId, quantity, costBasisPerUnit, purchaseDate]
    );
    
    return result.rows[0];
  }

  // Get tax summary for a user
  async getTaxSummary(userId, year) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    const result = await pool.query(
      `SELECT 
         a.symbol,
         a.asset_type,
         rg.is_long_term,
         SUM(rg.quantity_sold) as total_quantity,
         SUM(rg.cost_basis) as total_cost_basis,
         SUM(rg.proceeds) as total_proceeds,
         SUM(rg.gain_loss) as total_gain_loss
       FROM realized_gains rg
       JOIN assets a ON rg.asset_id = a.id
       WHERE rg.user_id = $1 
         AND rg.sale_date >= $2 
         AND rg.sale_date <= $3
       GROUP BY a.symbol, a.asset_type, rg.is_long_term
       ORDER BY a.asset_type, a.symbol, rg.is_long_term`,
      [userId, startDate, endDate]
    );
    
    // Aggregate totals
    const summary = {
      year,
      shortTermGains: 0,
      shortTermLosses: 0,
      longTermGains: 0,
      longTermLosses: 0,
      netShortTerm: 0,
      netLongTerm: 0,
      totalNetGain: 0,
      byAsset: [],
      byType: {
        STOCK: { shortTerm: 0, longTerm: 0 },
        CRYPTO: { shortTerm: 0, longTerm: 0 }
      }
    };
    
    for (const row of result.rows) {
      const gainLoss = parseFloat(row.total_gain_loss);
      
      if (row.is_long_term) {
        if (gainLoss >= 0) {
          summary.longTermGains += gainLoss;
        } else {
          summary.longTermLosses += Math.abs(gainLoss);
        }
        summary.byType[row.asset_type].longTerm += gainLoss;
      } else {
        if (gainLoss >= 0) {
          summary.shortTermGains += gainLoss;
        } else {
          summary.shortTermLosses += Math.abs(gainLoss);
        }
        summary.byType[row.asset_type].shortTerm += gainLoss;
      }
      
      summary.byAsset.push({
        symbol: row.symbol,
        assetType: row.asset_type,
        isLongTerm: row.is_long_term,
        totalQuantity: parseFloat(row.total_quantity),
        costBasis: parseFloat(row.total_cost_basis),
        proceeds: parseFloat(row.total_proceeds),
        gainLoss: gainLoss
      });
    }
    
    summary.netShortTerm = summary.shortTermGains - summary.shortTermLosses;
    summary.netLongTerm = summary.longTermGains - summary.longTermLosses;
    summary.totalNetGain = summary.netShortTerm + summary.netLongTerm;
    
    return summary;
  }

  // Get cost basis report (all tax lots)
  async getCostBasisReport(userId) {
    const result = await pool.query(
      `SELECT 
         tl.*,
         a.symbol,
         a.asset_type,
         a.name as asset_name
       FROM tax_lots tl
       JOIN assets a ON tl.asset_id = a.id
       WHERE tl.user_id = $1 AND tl.remaining_quantity > 0
       ORDER BY a.asset_type, a.symbol, tl.purchase_date`,
      [userId]
    );
    
    const report = {
      byStock: [],
      byCrypto: [],
      totalStockCostBasis: 0,
      totalCryptoCostBasis: 0
    };
    
    for (const lot of result.rows) {
      const costBasis = parseFloat(lot.remaining_quantity) * parseFloat(lot.cost_basis_per_unit);
      const lotData = {
        id: lot.id,
        symbol: lot.symbol,
        name: lot.asset_name,
        purchaseDate: lot.purchase_date,
        originalQuantity: parseFloat(lot.original_quantity),
        remainingQuantity: parseFloat(lot.remaining_quantity),
        costBasisPerUnit: parseFloat(lot.cost_basis_per_unit),
        totalCostBasis: costBasis
      };
      
      if (lot.asset_type === 'STOCK') {
        report.byStock.push(lotData);
        report.totalStockCostBasis += costBasis;
      } else {
        report.byCrypto.push(lotData);
        report.totalCryptoCostBasis += costBasis;
      }
    }
    
    return report;
  }

  // Get unrealized gains (paper gains)
  async getUnrealizedGains(userId, currentPrices) {
    const lots = await pool.query(
      `SELECT 
         tl.*,
         a.symbol,
         a.asset_type
       FROM tax_lots tl
       JOIN assets a ON tl.asset_id = a.id
       WHERE tl.user_id = $1 AND tl.remaining_quantity > 0`,
      [userId]
    );
    
    const unrealizedGains = [];
    let totalUnrealizedGain = 0;
    
    for (const lot of lots.rows) {
      const currentPrice = currentPrices[lot.symbol] || 0;
      const quantity = parseFloat(lot.remaining_quantity);
      const costBasis = quantity * parseFloat(lot.cost_basis_per_unit);
      const currentValue = quantity * currentPrice;
      const unrealizedGain = currentValue - costBasis;
      
      // Calculate if would be long-term
      const purchaseDate = new Date(lot.purchase_date);
      const today = new Date();
      const holdingDays = Math.floor((today - purchaseDate) / (1000 * 60 * 60 * 24));
      const wouldBeLongTerm = holdingDays >= LONG_TERM_THRESHOLD_DAYS;
      
      unrealizedGains.push({
        symbol: lot.symbol,
        assetType: lot.asset_type,
        quantity,
        costBasis,
        currentPrice,
        currentValue,
        unrealizedGain,
        unrealizedGainPercent: costBasis > 0 ? (unrealizedGain / costBasis) * 100 : 0,
        holdingDays,
        wouldBeLongTerm,
        purchaseDate: lot.purchase_date
      });
      
      totalUnrealizedGain += unrealizedGain;
    }
    
    return {
      lots: unrealizedGains,
      totalUnrealizedGain
    };
  }
}

module.exports = new TaxCalculatorService();
