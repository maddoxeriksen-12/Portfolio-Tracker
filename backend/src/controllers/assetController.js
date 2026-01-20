const pool = require('../db/pool');
const alphaVantage = require('../services/alphaVantage');

// Get or create an asset
exports.getOrCreateAsset = async (symbol, assetType) => {
  let asset = await pool.query(
    'SELECT * FROM assets WHERE symbol = $1 AND asset_type = $2',
    [symbol.toUpperCase(), assetType]
  );

  if (asset.rows.length === 0) {
    // Fetch name from Alpha Vantage
    let name = symbol.toUpperCase();
    try {
      if (assetType === 'STOCK') {
        const searchResults = await alphaVantage.searchSymbol(symbol);
        if (searchResults.length > 0) {
          name = searchResults[0].name;
        }
      } else {
        const cryptoQuote = await alphaVantage.getCryptoQuote(symbol);
        name = cryptoQuote.name || symbol.toUpperCase();
      }
    } catch (error) {
      console.log(`Could not fetch name for ${symbol}, using symbol as name`);
    }

    asset = await pool.query(
      'INSERT INTO assets (symbol, name, asset_type) VALUES ($1, $2, $3) RETURNING *',
      [symbol.toUpperCase(), name, assetType]
    );
  }

  return asset.rows[0];
};

// Search assets
exports.searchAssets = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 1) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const results = await alphaVantage.searchSymbol(query);
    res.json({ results });
  } catch (error) {
    console.error('Asset search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
};

// Get stock quote
exports.getStockQuote = async (req, res) => {
  try {
    const { symbol } = req.params;
    const quote = await alphaVantage.getStockQuote(symbol);
    res.json(quote);
  } catch (error) {
    console.error('Stock quote error:', error);
    res.status(500).json({ error: 'Failed to fetch stock quote' });
  }
};

// Get crypto quote
exports.getCryptoQuote = async (req, res) => {
  try {
    const { symbol } = req.params;
    const quote = await alphaVantage.getCryptoQuote(symbol);
    res.json(quote);
  } catch (error) {
    console.error('Crypto quote error:', error);
    res.status(500).json({ error: 'Failed to fetch crypto quote' });
  }
};

// Get historical data
exports.getHistoricalData = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { type, outputSize } = req.query;

    let history;
    if (type === 'CRYPTO') {
      history = await alphaVantage.getCryptoHistory(symbol);
    } else {
      history = await alphaVantage.getStockHistory(symbol, outputSize || 'compact');
    }

    res.json({ history });
  } catch (error) {
    console.error('Historical data error:', error);
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
};

// Get all user's assets
exports.getUserAssets = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT 
         a.*,
         SUM(tl.remaining_quantity) as total_quantity,
         SUM(tl.remaining_quantity * tl.cost_basis_per_unit) as total_cost_basis
       FROM assets a
       JOIN tax_lots tl ON a.id = tl.asset_id
       WHERE tl.user_id = $1 AND tl.remaining_quantity > 0
       GROUP BY a.id
       ORDER BY a.asset_type, a.symbol`,
      [req.user.id]
    );

    // Fetch current prices
    const assets = [];
    for (const asset of result.rows) {
      let currentPrice = 0;
      try {
        currentPrice = await alphaVantage.getPrice(asset.id, asset.symbol, asset.asset_type);
      } catch (error) {
        console.error(`Could not fetch price for ${asset.symbol}`);
      }

      const quantity = parseFloat(asset.total_quantity);
      const costBasis = parseFloat(asset.total_cost_basis);
      const currentValue = quantity * currentPrice;
      const gainLoss = currentValue - costBasis;
      const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

      assets.push({
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        assetType: asset.asset_type,
        quantity,
        costBasis,
        currentPrice,
        currentValue,
        gainLoss,
        gainLossPercent
      });
    }

    res.json({ assets });
  } catch (error) {
    console.error('Get user assets error:', error);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
};
