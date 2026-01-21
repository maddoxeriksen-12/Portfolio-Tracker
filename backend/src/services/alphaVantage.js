const axios = require('axios');
const pool = require('../db/pool');

const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';

class AlphaVantageService {
  constructor() {
    this.apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    this.requestQueue = [];
    this.isProcessing = false;
    // Alpha Vantage free tier: 5 requests/minute, 500/day
    this.rateLimitDelay = 12000; // 12 seconds between requests
  }

  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.requestQueue.length > 0) {
      const { resolve, reject, requestFn } = this.requestQueue.shift();
      
      try {
        const result = await requestFn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
      
      if (this.requestQueue.length > 0) {
        await new Promise(r => setTimeout(r, this.rateLimitDelay));
      }
    }
    
    this.isProcessing = false;
  }

  queueRequest(requestFn) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ resolve, reject, requestFn });
      this.processQueue();
    });
  }

  // Get stock quote
  async getStockQuote(symbol) {
    return this.queueRequest(async () => {
      const response = await axios.get(ALPHA_VANTAGE_BASE_URL, {
        params: {
          function: 'GLOBAL_QUOTE',
          symbol: symbol,
          apikey: this.apiKey
        }
      });

      const data = response.data['Global Quote'];
      if (!data || Object.keys(data).length === 0) {
        throw new Error(`No data found for stock symbol: ${symbol}`);
      }

      return {
        symbol: data['01. symbol'],
        price: parseFloat(data['05. price']),
        change: parseFloat(data['09. change']),
        changePercent: parseFloat(data['10. change percent']?.replace('%', '')),
        volume: parseInt(data['06. volume']),
        latestTradingDay: data['07. latest trading day']
      };
    });
  }

  // Get crypto quote
  async getCryptoQuote(symbol, market = 'USD') {
    return this.queueRequest(async () => {
      const response = await axios.get(ALPHA_VANTAGE_BASE_URL, {
        params: {
          function: 'CURRENCY_EXCHANGE_RATE',
          from_currency: symbol,
          to_currency: market,
          apikey: this.apiKey
        }
      });

      const data = response.data['Realtime Currency Exchange Rate'];
      if (!data) {
        throw new Error(`No data found for crypto symbol: ${symbol}`);
      }

      return {
        symbol: data['1. From_Currency Code'],
        name: data['2. From_Currency Name'],
        price: parseFloat(data['5. Exchange Rate']),
        lastRefreshed: data['6. Last Refreshed'],
        timezone: data['7. Time Zone']
      };
    });
  }

  // Get historical stock data
  async getStockHistory(symbol, outputSize = 'compact') {
    return this.queueRequest(async () => {
      const response = await axios.get(ALPHA_VANTAGE_BASE_URL, {
        params: {
          function: 'TIME_SERIES_DAILY',
          symbol: symbol,
          outputsize: outputSize,
          apikey: this.apiKey
        }
      });

      const timeSeries = response.data['Time Series (Daily)'];
      if (!timeSeries) {
        throw new Error(`No historical data found for: ${symbol}`);
      }

      return Object.entries(timeSeries).map(([date, values]) => ({
        date,
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: parseInt(values['5. volume'])
      }));
    });
  }

  // Get historical crypto data
  async getCryptoHistory(symbol, market = 'USD') {
    return this.queueRequest(async () => {
      const response = await axios.get(ALPHA_VANTAGE_BASE_URL, {
        params: {
          function: 'DIGITAL_CURRENCY_DAILY',
          symbol: symbol,
          market: market,
          apikey: this.apiKey
        }
      });

      const timeSeries = response.data['Time Series (Digital Currency Daily)'];
      if (!timeSeries) {
        throw new Error(`No historical data found for crypto: ${symbol}`);
      }

      return Object.entries(timeSeries).map(([date, values]) => ({
        date,
        open: parseFloat(values[`1a. open (${market})`]),
        high: parseFloat(values[`2a. high (${market})`]),
        low: parseFloat(values[`3a. low (${market})`]),
        close: parseFloat(values[`4a. close (${market})`]),
        volume: parseFloat(values['5. volume'])
      }));
    });
  }

  // Get price with caching
  async getPrice(assetId, symbol, assetType) {
    const priceData = await this.getPriceWithChange(assetId, symbol, assetType);
    return priceData.price;
  }

  // Get price with daily change data and caching
  async getPriceWithChange(assetId, symbol, assetType, forceRefresh = false) {
    const today = new Date().toISOString().split('T')[0];
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await pool.query(
        'SELECT price, daily_change, daily_change_percent, previous_close FROM price_cache WHERE asset_id = $1 AND price_date = $2',
        [assetId, today]
      );

      if (cached.rows.length > 0) {
        return {
          price: parseFloat(cached.rows[0].price),
          dailyChange: parseFloat(cached.rows[0].daily_change) || 0,
          dailyChangePercent: parseFloat(cached.rows[0].daily_change_percent) || 0,
          previousClose: parseFloat(cached.rows[0].previous_close) || 0
        };
      }
    }

    // Fetch fresh price from API
    let price, dailyChange = 0, dailyChangePercent = 0, previousClose = 0;
    try {
      if (assetType === 'STOCK') {
        // Stock: GLOBAL_QUOTE gives us change from previous close directly
        const quote = await this.getStockQuote(symbol);
        price = quote.price;
        dailyChange = quote.change || 0;
        dailyChangePercent = quote.changePercent || 0;
        previousClose = price - dailyChange; // Calculate previous close from current price and change
      } else {
        // Crypto: Get current price and calculate change from previous close
        const quote = await this.getCryptoQuote(symbol);
        price = quote.price;
        
        // Get previous close from yesterday's cache or most recent cache
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        // First try yesterday's close
        let prevCacheResult = await pool.query(
          'SELECT price FROM price_cache WHERE asset_id = $1 AND price_date = $2',
          [assetId, yesterdayStr]
        );
        
        // If no yesterday cache, get most recent before today
        if (prevCacheResult.rows.length === 0) {
          prevCacheResult = await pool.query(
            'SELECT price FROM price_cache WHERE asset_id = $1 AND price_date < $2 ORDER BY price_date DESC LIMIT 1',
            [assetId, today]
          );
        }
        
        if (prevCacheResult.rows.length > 0) {
          previousClose = parseFloat(prevCacheResult.rows[0].price);
          dailyChange = price - previousClose;
          dailyChangePercent = previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : 0;
        }
      }

      // Cache the price with change data
      await pool.query(
        `INSERT INTO price_cache (asset_id, price, daily_change, daily_change_percent, previous_close, price_date) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         ON CONFLICT (asset_id, price_date) DO UPDATE SET 
           price = $2, 
           daily_change = $3, 
           daily_change_percent = $4, 
           previous_close = $5,
           fetched_at = CURRENT_TIMESTAMP`,
        [assetId, price, dailyChange, dailyChangePercent, previousClose, today]
      );

      return { price, dailyChange, dailyChangePercent, previousClose };
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error.message);
      
      // Return most recent cached price if available
      const lastCached = await pool.query(
        'SELECT price, daily_change, daily_change_percent, previous_close FROM price_cache WHERE asset_id = $1 ORDER BY price_date DESC LIMIT 1',
        [assetId]
      );
      
      if (lastCached.rows.length > 0) {
        return {
          price: parseFloat(lastCached.rows[0].price),
          dailyChange: parseFloat(lastCached.rows[0].daily_change) || 0,
          dailyChangePercent: parseFloat(lastCached.rows[0].daily_change_percent) || 0,
          previousClose: parseFloat(lastCached.rows[0].previous_close) || 0
        };
      }
      
      throw error;
    }
  }

  // Refresh prices for multiple assets - fetches fresh data from API
  async refreshPrices(assets) {
    const today = new Date().toISOString().split('T')[0];
    
    // First, delete today's cache for all these assets to force fresh fetch
    const assetIds = assets.map(a => a.assetId);
    if (assetIds.length > 0) {
      await pool.query(
        'DELETE FROM price_cache WHERE asset_id = ANY($1) AND price_date = $2',
        [assetIds, today]
      );
    }

    // Now fetch fresh prices for each asset
    const results = [];
    for (const asset of assets) {
      try {
        const priceData = await this.getPriceWithChange(
          asset.assetId,
          asset.symbol,
          asset.assetType,
          true // force refresh
        );
        results.push({
          ...asset,
          ...priceData,
          success: true
        });
      } catch (error) {
        console.error(`Failed to refresh price for ${asset.symbol}:`, error.message);
        results.push({
          ...asset,
          price: 0,
          dailyChange: 0,
          dailyChangePercent: 0,
          previousClose: 0,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  // Invalidate cache for specific assets (used when refresh button is clicked)
  async invalidateTodayCache(assetIds = null) {
    const today = new Date().toISOString().split('T')[0];
    if (assetIds && assetIds.length > 0) {
      await pool.query(
        'DELETE FROM price_cache WHERE asset_id = ANY($1) AND price_date = $2',
        [assetIds, today]
      );
    } else {
      await pool.query('DELETE FROM price_cache WHERE price_date = $1', [today]);
    }
  }

  // Search for symbols
  async searchSymbol(keywords) {
    return this.queueRequest(async () => {
      const response = await axios.get(ALPHA_VANTAGE_BASE_URL, {
        params: {
          function: 'SYMBOL_SEARCH',
          keywords: keywords,
          apikey: this.apiKey
        }
      });

      const matches = response.data.bestMatches || [];
      return matches.map(match => ({
        symbol: match['1. symbol'],
        name: match['2. name'],
        type: match['3. type'],
        region: match['4. region'],
        currency: match['8. currency']
      }));
    });
  }
}

module.exports = new AlphaVantageService();
