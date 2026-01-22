const pool = require('../db/pool');
const alphaVantage = require('../services/alphaVantage');
const projectionCalculator = require('../services/projectionCalculator');
const redisCache = require('../services/redisCache');

// Helper to build portfolio response from holdings and prices
const buildPortfolioResponse = (holdings, pricesMap) => {
  let totalCostBasis = 0;
  let totalCurrentValue = 0;
  let totalDailyChange = 0;
  const assets = [];
  let hasStaleData = false;
  let hasMissingPrices = false;

  for (const holding of holdings) {
    const priceData = pricesMap.get(holding.asset_id) || {
      price: 0,
      dailyChange: 0,
      dailyChangePercent: 0,
      previousClose: 0,
      missing: true
    };

    if (priceData.missing) hasMissingPrices = true;
    if (priceData.stale) hasStaleData = true;

    const currentPrice = priceData.price || 0;
    const dailyChange = priceData.dailyChange || 0;
    const dailyChangePercent = priceData.dailyChangePercent || 0;

    const quantity = parseFloat(holding.quantity);
    const costBasis = parseFloat(holding.cost_basis);
    const currentValue = quantity * currentPrice;
    const gainLoss = currentValue - costBasis;
    const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
    const todayDollarChange = quantity * dailyChange;

    totalCostBasis += costBasis;
    totalCurrentValue += currentValue;
    totalDailyChange += todayDollarChange;

    assets.push({
      assetId: holding.asset_id,
      symbol: holding.symbol,
      name: holding.name,
      assetType: holding.asset_type,
      quantity,
      costBasis,
      currentPrice,
      currentValue,
      gainLoss,
      gainLossPercent,
      allocation: 0,
      firstPurchase: holding.first_purchase,
      dailyChange,
      dailyChangePercent,
      todayDollarChange,
      stale: priceData.stale || false,
      missing: priceData.missing || false
    });
  }

  // Calculate allocations
  assets.forEach(asset => {
    asset.allocation = totalCurrentValue > 0 ? (asset.currentValue / totalCurrentValue) * 100 : 0;
  });

  // Calculate totals by asset type
  const stocksValue = assets.filter(a => a.assetType === 'STOCK').reduce((sum, a) => sum + a.currentValue, 0);
  const cryptoValue = assets.filter(a => a.assetType === 'CRYPTO').reduce((sum, a) => sum + a.currentValue, 0);
  const stocksDailyChange = assets.filter(a => a.assetType === 'STOCK').reduce((sum, a) => sum + a.todayDollarChange, 0);
  const cryptoDailyChange = assets.filter(a => a.assetType === 'CRYPTO').reduce((sum, a) => sum + a.todayDollarChange, 0);

  const overview = {
    totalCostBasis,
    totalCurrentValue,
    totalGainLoss: totalCurrentValue - totalCostBasis,
    totalGainLossPercent: totalCostBasis > 0 ? ((totalCurrentValue - totalCostBasis) / totalCostBasis) * 100 : 0,
    stocksValue,
    cryptoValue,
    stocksAllocation: totalCurrentValue > 0 ? (stocksValue / totalCurrentValue) * 100 : 0,
    cryptoAllocation: totalCurrentValue > 0 ? (cryptoValue / totalCurrentValue) * 100 : 0,
    assetCount: assets.length,
    totalDailyChange,
    totalDailyChangePercent: (totalCurrentValue - totalDailyChange) > 0 
      ? (totalDailyChange / (totalCurrentValue - totalDailyChange)) * 100 
      : 0,
    stocksDailyChange,
    cryptoDailyChange
  };

  return { overview, assets, hasStaleData, hasMissingPrices };
};

// Get holdings from database
const getHoldings = async (userId) => {
  const result = await pool.query(
    `SELECT 
       a.id as asset_id,
       a.symbol,
       a.name,
       a.asset_type,
       SUM(tl.remaining_quantity) as quantity,
       SUM(tl.remaining_quantity * tl.cost_basis_per_unit) as cost_basis,
       MIN(tl.purchase_date) as first_purchase
     FROM tax_lots tl
     JOIN assets a ON tl.asset_id = a.id
     WHERE tl.user_id = $1 AND tl.remaining_quantity > 0
     GROUP BY a.id, a.symbol, a.name, a.asset_type
     ORDER BY SUM(tl.remaining_quantity * tl.cost_basis_per_unit) DESC`,
    [userId]
  );
  return result.rows;
};

// Get portfolio overview - ALWAYS returns immediately with cached data
// Never blocks waiting for API calls
exports.getPortfolioOverview = async (req, res) => {
  try {
    // Get holdings from database (fast)
    const holdings = await getHoldings(req.user.id);

    if (holdings.length === 0) {
      return res.json({
        overview: {
          totalCostBasis: 0,
          totalCurrentValue: 0,
          totalGainLoss: 0,
          totalGainLossPercent: 0,
          stocksValue: 0,
          cryptoValue: 0,
          stocksAllocation: 0,
          cryptoAllocation: 0,
          assetCount: 0,
          totalDailyChange: 0,
          totalDailyChangePercent: 0,
          stocksDailyChange: 0,
          cryptoDailyChange: 0
        },
        assets: [],
        needsRefresh: false
      });
    }

    // Get cached prices ONLY (no API calls) - this is always fast
    const assetsForPriceLookup = holdings.map(h => ({
      assetId: h.asset_id,
      symbol: h.symbol,
      assetType: h.asset_type
    }));

    const pricesMap = await alphaVantage.getCachedPricesOnly(assetsForPriceLookup);
    const response = buildPortfolioResponse(holdings, pricesMap);

    // Cache the response
    await redisCache.cacheOverview(req.user.id, response);

    res.json({
      ...response,
      needsRefresh: response.hasMissingPrices || response.hasStaleData
    });
  } catch (error) {
    console.error('Portfolio overview error:', error);
    res.status(500).json({ error: 'Failed to get portfolio overview' });
  }
};

// Quick endpoint to get today's return using only cached data (no API calls)
exports.getQuickDailyReturn = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Check for cached daily summary first
    const cachedSummary = await redisCache.getCachedDailySummary(req.user.id, today);
    if (cachedSummary) {
      return res.json({
        ...cachedSummary,
        fromCache: true
      });
    }

    // Get holdings
    const holdings = await pool.query(
      `SELECT 
         a.id as asset_id,
         a.symbol,
         a.asset_type,
         SUM(tl.remaining_quantity) as quantity
       FROM tax_lots tl
       JOIN assets a ON tl.asset_id = a.id
       WHERE tl.user_id = $1 AND tl.remaining_quantity > 0
       GROUP BY a.id, a.symbol, a.asset_type`,
      [req.user.id]
    );

    if (holdings.rows.length === 0) {
      return res.json({
        totalDailyChange: 0,
        totalDailyChangePercent: 0,
        stocksDailyChange: 0,
        cryptoDailyChange: 0,
        assetBreakdown: [],
        hasData: false
      });
    }

    // Get cached prices only (no API calls)
    const assetsForPriceLookup = holdings.rows.map(h => ({
      assetId: h.asset_id,
      symbol: h.symbol,
      assetType: h.asset_type
    }));
    
    const pricesMap = await alphaVantage.getCachedPricesOnly(assetsForPriceLookup);

    let totalValue = 0;
    let totalDailyChange = 0;
    let stocksValue = 0;
    let stocksDailyChange = 0;
    let cryptoValue = 0;
    let cryptoDailyChange = 0;
    const assetBreakdown = [];
    let hasStaleData = false;

    for (const holding of holdings.rows) {
      const priceData = pricesMap.get(holding.asset_id);
      if (!priceData) continue;

      const quantity = parseFloat(holding.quantity);
      const currentValue = quantity * priceData.price;
      const todayDollarChange = quantity * priceData.dailyChange;

      totalValue += currentValue;
      totalDailyChange += todayDollarChange;

      if (holding.asset_type === 'STOCK') {
        stocksValue += currentValue;
        stocksDailyChange += todayDollarChange;
      } else {
        cryptoValue += currentValue;
        cryptoDailyChange += todayDollarChange;
      }

      if (priceData.stale) hasStaleData = true;

      assetBreakdown.push({
        symbol: holding.symbol,
        assetType: holding.asset_type,
        dailyChange: todayDollarChange,
        dailyChangePercent: priceData.dailyChangePercent,
        currentValue
      });
    }

    const previousTotalValue = totalValue - totalDailyChange;
    const summary = {
      totalDailyChange,
      totalDailyChangePercent: previousTotalValue > 0 ? (totalDailyChange / previousTotalValue) * 100 : 0,
      totalValue,
      stocksValue,
      stocksDailyChange,
      stocksDailyChangePercent: (stocksValue - stocksDailyChange) > 0 
        ? (stocksDailyChange / (stocksValue - stocksDailyChange)) * 100 
        : 0,
      cryptoValue,
      cryptoDailyChange,
      cryptoDailyChangePercent: (cryptoValue - cryptoDailyChange) > 0 
        ? (cryptoDailyChange / (cryptoValue - cryptoDailyChange)) * 100 
        : 0,
      assetBreakdown,
      hasData: true,
      hasStaleData
    };

    // Cache for quick access
    await redisCache.cacheDailySummary(req.user.id, today, summary);

    res.json(summary);
  } catch (error) {
    console.error('Quick daily return error:', error);
    res.status(500).json({ error: 'Failed to get daily return' });
  }
};

// Refresh all asset prices - triggers API calls to get latest prices
// This is the ONLY endpoint that makes external API calls
exports.refreshPrices = async (req, res) => {
  try {
    // Invalidate user's cached overview
    await redisCache.invalidateUserCache(req.user.id);

    // Get all holdings for this user
    const holdings = await pool.query(
      `SELECT 
         a.id as asset_id,
         a.symbol,
         a.asset_type
       FROM tax_lots tl
       JOIN assets a ON tl.asset_id = a.id
       WHERE tl.user_id = $1 AND tl.remaining_quantity > 0
       GROUP BY a.id, a.symbol, a.asset_type`,
      [req.user.id]
    );

    if (holdings.rows.length === 0) {
      return res.json({ 
        message: 'No assets to refresh',
        refreshedCount: 0,
        assets: []
      });
    }

    // Map holdings to the format expected by refreshPrices
    const assetsToRefresh = holdings.rows.map(h => ({
      assetId: h.asset_id,
      symbol: h.symbol,
      assetType: h.asset_type
    }));

    // Refresh prices for all assets (this will make API calls)
    const refreshedPrices = await alphaVantage.refreshPrices(assetsToRefresh);

    // Build response with success/failure status
    const successful = refreshedPrices.filter(p => p.success);
    const failed = refreshedPrices.filter(p => !p.success);

    res.json({
      message: `Refreshed ${successful.length} of ${refreshedPrices.length} assets`,
      refreshedCount: successful.length,
      failedCount: failed.length,
      timestamp: new Date().toISOString(),
      assets: refreshedPrices.map(p => ({
        symbol: p.symbol,
        assetType: p.assetType,
        price: p.price,
        dailyChange: p.dailyChange,
        dailyChangePercent: p.dailyChangePercent,
        previousClose: p.previousClose,
        success: p.success,
        error: p.error
      }))
    });
  } catch (error) {
    console.error('Refresh prices error:', error);
    res.status(500).json({ error: 'Failed to refresh prices' });
  }
};

// Get portfolio returns by timeframe - uses cached prices only for fast response
exports.getReturns = async (req, res) => {
  try {
    const { timeframe = '1Y' } = req.query;

    // Calculate date range based on timeframe
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeframe) {
      case '1W':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '1M':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case '3M':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case '6M':
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case 'YTD':
        startDate.setMonth(0);
        startDate.setDate(1);
        break;
      case '1Y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case '3Y':
        startDate.setFullYear(startDate.getFullYear() - 3);
        break;
      case '5Y':
        startDate.setFullYear(startDate.getFullYear() - 5);
        break;
      case 'ALL':
        startDate.setFullYear(2000);
        break;
    }

    // Get transactions in the period
    const transactions = await pool.query(
      `SELECT 
         t.transaction_type,
         t.total_amount,
         t.transaction_date,
         a.symbol,
         a.asset_type
       FROM transactions t
       JOIN assets a ON t.asset_id = a.id
       WHERE t.user_id = $1 AND t.transaction_date >= $2
       ORDER BY t.transaction_date`,
      [req.user.id, startDate.toISOString().split('T')[0]]
    );

    // Get realized gains in period
    const realizedGains = await pool.query(
      `SELECT SUM(gain_loss) as total_gains
       FROM realized_gains
       WHERE user_id = $1 AND sale_date >= $2`,
      [req.user.id, startDate.toISOString().split('T')[0]]
    );

    // Get current holdings
    const holdings = await pool.query(
      `SELECT 
         a.id as asset_id,
         a.symbol,
         a.asset_type,
         SUM(tl.remaining_quantity) as quantity,
         SUM(tl.remaining_quantity * tl.cost_basis_per_unit) as cost_basis
       FROM tax_lots tl
       JOIN assets a ON tl.asset_id = a.id
       WHERE tl.user_id = $1 AND tl.remaining_quantity > 0
       GROUP BY a.id, a.symbol, a.asset_type`,
      [req.user.id]
    );

    let currentValue = 0;
    let costBasis = 0;

    if (holdings.rows.length > 0) {
      // Get cached prices ONLY (no API calls) - fast response
      const assetsForPriceLookup = holdings.rows.map(h => ({
        assetId: h.asset_id,
        symbol: h.symbol,
        assetType: h.asset_type
      }));

      const pricesMap = await alphaVantage.getCachedPricesOnly(assetsForPriceLookup);

      for (const holding of holdings.rows) {
        const priceData = pricesMap.get(holding.asset_id);
        if (priceData) {
          currentValue += parseFloat(holding.quantity) * priceData.price;
        }
        costBasis += parseFloat(holding.cost_basis);
      }
    }

    // Calculate totals
    const totalBuys = transactions.rows
      .filter(t => t.transaction_type === 'BUY')
      .reduce((sum, t) => sum + parseFloat(t.total_amount), 0);
    
    const totalSells = transactions.rows
      .filter(t => t.transaction_type === 'SELL')
      .reduce((sum, t) => sum + parseFloat(t.total_amount), 0);

    const realizedGain = parseFloat(realizedGains.rows[0]?.total_gains) || 0;
    const unrealizedGain = currentValue - costBasis;
    const totalReturn = realizedGain + unrealizedGain;
    const netInvested = totalBuys - totalSells;
    const returnPercent = netInvested > 0 ? (totalReturn / netInvested) * 100 : 0;

    res.json({
      timeframe,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      returns: {
        totalBuys,
        totalSells,
        netInvested,
        currentValue,
        costBasis,
        realizedGain,
        unrealizedGain,
        totalReturn,
        returnPercent
      }
    });
  } catch (error) {
    console.error('Portfolio returns error:', error);
    res.status(500).json({ error: 'Failed to calculate returns' });
  }
};

// Get returns by asset - uses cached prices only
exports.getReturnsByAsset = async (req, res) => {
  try {
    const { assetIds } = req.query;

    let whereClause = 'tl.user_id = $1 AND tl.remaining_quantity > 0';
    const params = [req.user.id];

    if (assetIds) {
      const ids = assetIds.split(',');
      whereClause += ` AND a.id = ANY($2)`;
      params.push(ids);
    }

    const holdings = await pool.query(
      `SELECT 
         a.id as asset_id,
         a.symbol,
         a.name,
         a.asset_type,
         SUM(tl.remaining_quantity) as quantity,
         SUM(tl.remaining_quantity * tl.cost_basis_per_unit) as cost_basis
       FROM tax_lots tl
       JOIN assets a ON tl.asset_id = a.id
       WHERE ${whereClause}
       GROUP BY a.id, a.symbol, a.name, a.asset_type`,
      params
    );

    if (holdings.rows.length === 0) {
      return res.json({ assetReturns: [] });
    }

    // Get cached prices ONLY (no API calls)
    const assetsForPriceLookup = holdings.rows.map(h => ({
      assetId: h.asset_id,
      symbol: h.symbol,
      assetType: h.asset_type
    }));

    const pricesMap = await alphaVantage.getCachedPricesOnly(assetsForPriceLookup);

    // Get realized gains for all assets in one query
    const assetIdList = holdings.rows.map(h => h.asset_id);
    const realizedGainsQuery = await pool.query(
      `SELECT asset_id, SUM(gain_loss) as total_gains
       FROM realized_gains
       WHERE user_id = $1 AND asset_id = ANY($2)
       GROUP BY asset_id`,
      [req.user.id, assetIdList]
    );

    const realizedGainsMap = new Map(
      realizedGainsQuery.rows.map(r => [r.asset_id, parseFloat(r.total_gains) || 0])
    );

    const assetReturns = [];

    for (const holding of holdings.rows) {
      const priceData = pricesMap.get(holding.asset_id) || { price: 0 };
      const currentPrice = priceData.price;

      const quantity = parseFloat(holding.quantity);
      const costBasis = parseFloat(holding.cost_basis);
      const currentValue = quantity * currentPrice;
      const unrealizedGain = currentValue - costBasis;
      const realizedGain = realizedGainsMap.get(holding.asset_id) || 0;
      const totalReturn = unrealizedGain + realizedGain;

      assetReturns.push({
        assetId: holding.asset_id,
        symbol: holding.symbol,
        name: holding.name,
        assetType: holding.asset_type,
        quantity,
        costBasis,
        currentPrice,
        currentValue,
        unrealizedGain,
        unrealizedGainPercent: costBasis > 0 ? (unrealizedGain / costBasis) * 100 : 0,
        realizedGain,
        totalReturn,
        totalReturnPercent: costBasis > 0 ? (totalReturn / costBasis) * 100 : 0
      });
    }

    res.json({ assetReturns });
  } catch (error) {
    console.error('Returns by asset error:', error);
    res.status(500).json({ error: 'Failed to calculate returns by asset' });
  }
};

// Get future projections
exports.getProjections = async (req, res) => {
  try {
    const { years = 10, yearlyContributions } = req.query;

    let contributionsMap = {};
    if (yearlyContributions) {
      try {
        contributionsMap = JSON.parse(yearlyContributions);
        const parsed = {};
        for (const [year, amount] of Object.entries(contributionsMap)) {
          parsed[parseInt(year)] = parseFloat(amount) || 0;
        }
        contributionsMap = parsed;
      } catch (e) {
        contributionsMap = {};
      }
    }

    const projections = await projectionCalculator.calculateProjections(
      req.user.id,
      parseInt(years),
      contributionsMap
    );

    res.json(projections);
  } catch (error) {
    console.error('Projections error:', error);
    res.status(500).json({ error: 'Failed to calculate projections' });
  }
};

// Get projections for specific assets
exports.getAssetProjections = async (req, res) => {
  try {
    const { assetIds, years = 10 } = req.query;

    if (!assetIds) {
      return res.status(400).json({ error: 'Asset IDs required' });
    }

    const ids = assetIds.split(',');
    const projections = await projectionCalculator.calculateAssetProjections(
      req.user.id,
      ids,
      parseInt(years)
    );

    res.json({ projections });
  } catch (error) {
    console.error('Asset projections error:', error);
    res.status(500).json({ error: 'Failed to calculate asset projections' });
  }
};

// Set CAGR estimate for an asset
exports.setAssetCAGR = async (req, res) => {
  try {
    const { assetId } = req.params;
    const { estimatedCAGR, notes } = req.body;

    if (estimatedCAGR === undefined) {
      return res.status(400).json({ error: 'Estimated CAGR required' });
    }

    const result = await projectionCalculator.setAssetCAGR(
      req.user.id,
      assetId,
      estimatedCAGR,
      notes
    );

    res.json({
      message: 'CAGR estimate saved',
      projection: result
    });
  } catch (error) {
    console.error('Set CAGR error:', error);
    res.status(500).json({ error: 'Failed to set CAGR estimate' });
  }
};

// Get income vs expense report
exports.getIncomeExpenseReport = async (req, res) => {
  try {
    const { months = 12 } = req.query;

    const report = await projectionCalculator.getIncomeExpenseReport(
      req.user.id,
      parseInt(months)
    );

    res.json({ report });
  } catch (error) {
    console.error('Income expense report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
};

// Cache health check
exports.getCacheStatus = async (req, res) => {
  try {
    const redisHealthy = await redisCache.isHealthy();
    
    res.json({
      redis: {
        connected: redisHealthy,
        url: process.env.REDIS_URL ? 'configured' : 'not configured'
      },
      localCache: {
        size: redisCache.localCache.size
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get cache status' });
  }
};
