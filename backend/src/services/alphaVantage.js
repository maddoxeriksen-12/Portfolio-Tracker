const axios = require('axios');
const pool = require('../db/pool');
const redisCache = require('./redisCache');

const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';

class AlphaVantageService {
  constructor() {
    this.apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    this.requestQueue = [];
    this.isProcessing = false;
    // Alpha Vantage free tier: 5 requests/minute, 500/day
    this.rateLimitDelay = 12000; // 12 seconds between requests
    this.pendingRequests = new Map(); // Dedup concurrent requests for same symbol
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

  // Get price with daily change data - OPTIMIZED with Redis caching
  async getPriceWithChange(assetId, symbol, assetType, forceRefresh = false) {
    const today = new Date().toISOString().split('T')[0];
    
    // Check Redis cache first (fastest)
    if (!forceRefresh) {
      const redisCached = await redisCache.getCachedPrice(assetId, today);
      if (redisCached) {
        return redisCached;
      }
    }
    
    // Check PostgreSQL cache (if Redis miss)
    if (!forceRefresh) {
      const cached = await pool.query(
        'SELECT price, daily_change, daily_change_percent, previous_close FROM price_cache WHERE asset_id = $1 AND price_date = $2',
        [assetId, today]
      );

      if (cached.rows.length > 0) {
        const priceData = {
          price: parseFloat(cached.rows[0].price),
          dailyChange: parseFloat(cached.rows[0].daily_change) || 0,
          dailyChangePercent: parseFloat(cached.rows[0].daily_change_percent) || 0,
          previousClose: parseFloat(cached.rows[0].previous_close) || 0
        };
        
        // Store in Redis for faster future access
        await redisCache.cachePrice(assetId, today, priceData);
        
        return priceData;
      }
    }

    // Dedup concurrent requests for the same asset
    const pendingKey = `${assetId}-${today}`;
    if (this.pendingRequests.has(pendingKey)) {
      return this.pendingRequests.get(pendingKey);
    }

    // Fetch fresh price from API
    const fetchPromise = this._fetchAndCachePrice(assetId, symbol, assetType, today);
    this.pendingRequests.set(pendingKey, fetchPromise);
    
    try {
      const result = await fetchPromise;
      return result;
    } finally {
      this.pendingRequests.delete(pendingKey);
    }
  }

  // Internal method to fetch and cache price
  async _fetchAndCachePrice(assetId, symbol, assetType, today) {
    let price, dailyChange = 0, dailyChangePercent = 0, previousClose = 0;
    
    try {
      if (assetType === 'STOCK') {
        const quote = await this.getStockQuote(symbol);
        price = quote.price;
        dailyChange = quote.change || 0;
        dailyChangePercent = quote.changePercent || 0;
        previousClose = price - dailyChange;
      } else {
        const quote = await this.getCryptoQuote(symbol);
        price = quote.price;
        
        // Get previous close from cache
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        // Check Redis first
        let prevPrice = await redisCache.getCachedPrice(assetId, yesterdayStr);
        
        if (!prevPrice) {
          // Fallback to PostgreSQL
          const prevCacheResult = await pool.query(
            'SELECT price FROM price_cache WHERE asset_id = $1 AND price_date < $2 ORDER BY price_date DESC LIMIT 1',
            [assetId, today]
          );
          
          if (prevCacheResult.rows.length > 0) {
            previousClose = parseFloat(prevCacheResult.rows[0].price);
          }
        } else {
          previousClose = prevPrice.price;
        }
        
        if (previousClose > 0) {
          dailyChange = price - previousClose;
          dailyChangePercent = ((price - previousClose) / previousClose) * 100;
        }
      }

      const priceData = { price, dailyChange, dailyChangePercent, previousClose };

      // Cache in Redis (fast access)
      await redisCache.cachePrice(assetId, today, priceData);

      // Cache in PostgreSQL (persistence)
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

      return priceData;
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

  // Get multiple prices at once - OPTIMIZED for parallel fetching with batched cache lookup
  async getPricesWithChangeBatch(assets, forceRefresh = false) {
    const today = new Date().toISOString().split('T')[0];
    const results = new Map();
    const assetsNeedingFetch = [];

    if (!forceRefresh) {
      // Batch lookup from Redis first
      const assetIds = assets.map(a => a.assetId);
      const redisCached = await redisCache.getCachedPrices(assetIds, today);
      
      for (const asset of assets) {
        const cacheKey = redisCache.priceKey(asset.assetId, today);
        if (redisCached[cacheKey]) {
          results.set(asset.assetId, redisCached[cacheKey]);
        } else {
          assetsNeedingFetch.push(asset);
        }
      }
      
      // If all cached in Redis, return immediately
      if (assetsNeedingFetch.length === 0) {
        return results;
      }

      // Batch lookup from PostgreSQL for remaining
      if (assetsNeedingFetch.length > 0) {
        const remainingIds = assetsNeedingFetch.map(a => a.assetId);
        const pgCached = await pool.query(
          `SELECT asset_id, price, daily_change, daily_change_percent, previous_close 
           FROM price_cache 
           WHERE asset_id = ANY($1) AND price_date = $2`,
          [remainingIds, today]
        );

        const pgResults = new Map(pgCached.rows.map(row => [
          row.asset_id,
          {
            price: parseFloat(row.price),
            dailyChange: parseFloat(row.daily_change) || 0,
            dailyChangePercent: parseFloat(row.daily_change_percent) || 0,
            previousClose: parseFloat(row.previous_close) || 0
          }
        ]));

        // Update Redis cache and results
        const toCache = {};
        for (const asset of [...assetsNeedingFetch]) {
          const pgData = pgResults.get(asset.assetId);
          if (pgData) {
            results.set(asset.assetId, pgData);
            toCache[redisCache.priceKey(asset.assetId, today)] = pgData;
            // Remove from assetsNeedingFetch
            const idx = assetsNeedingFetch.findIndex(a => a.assetId === asset.assetId);
            if (idx > -1) assetsNeedingFetch.splice(idx, 1);
          }
        }
        
        // Batch update Redis
        if (Object.keys(toCache).length > 0) {
          await redisCache.mset(toCache, redisCache.PRICE_TTL);
        }
      }
    } else {
      // Force refresh - add all assets to fetch list
      assetsNeedingFetch.push(...assets);
    }

    // Fetch remaining from API (sequentially due to rate limits)
    for (const asset of assetsNeedingFetch) {
      try {
        const priceData = await this.getPriceWithChange(
          asset.assetId,
          asset.symbol,
          asset.assetType,
          forceRefresh
        );
        results.set(asset.assetId, priceData);
      } catch (error) {
        console.error(`Failed to fetch price for ${asset.symbol}:`, error.message);
        results.set(asset.assetId, {
          price: 0,
          dailyChange: 0,
          dailyChangePercent: 0,
          previousClose: 0,
          error: error.message
        });
      }
    }

    return results;
  }

  // Get cached prices only (no API calls) - for quick reads
  async getCachedPricesOnly(assets) {
    const today = new Date().toISOString().split('T')[0];
    const results = new Map();

    // Batch lookup from Redis
    const assetIds = assets.map(a => a.assetId);
    const redisCached = await redisCache.getCachedPrices(assetIds, today);
    
    const assetsNotInRedis = [];
    for (const asset of assets) {
      const cacheKey = redisCache.priceKey(asset.assetId, today);
      if (redisCached[cacheKey]) {
        results.set(asset.assetId, redisCached[cacheKey]);
      } else {
        assetsNotInRedis.push(asset);
      }
    }

    // Fallback to PostgreSQL for remaining
    if (assetsNotInRedis.length > 0) {
      const remainingIds = assetsNotInRedis.map(a => a.assetId);
      const pgCached = await pool.query(
        `SELECT asset_id, price, daily_change, daily_change_percent, previous_close 
         FROM price_cache 
         WHERE asset_id = ANY($1) AND price_date = $2`,
        [remainingIds, today]
      );

      for (const row of pgCached.rows) {
        results.set(row.asset_id, {
          price: parseFloat(row.price),
          dailyChange: parseFloat(row.daily_change) || 0,
          dailyChangePercent: parseFloat(row.daily_change_percent) || 0,
          previousClose: parseFloat(row.previous_close) || 0
        });
      }

      // For assets with no cache, try to get most recent price
      const missingIds = remainingIds.filter(id => !results.has(id));
      if (missingIds.length > 0) {
        const fallbackQuery = await pool.query(
          `SELECT DISTINCT ON (asset_id) 
             asset_id, price, daily_change, daily_change_percent, previous_close, price_date
           FROM price_cache 
           WHERE asset_id = ANY($1)
           ORDER BY asset_id, price_date DESC`,
          [missingIds]
        );

        for (const row of fallbackQuery.rows) {
          results.set(row.asset_id, {
            price: parseFloat(row.price),
            dailyChange: parseFloat(row.daily_change) || 0,
            dailyChangePercent: parseFloat(row.daily_change_percent) || 0,
            previousClose: parseFloat(row.previous_close) || 0,
            stale: true,
            lastDate: row.price_date
          });
        }
      }
    }

    return results;
  }

  // Refresh prices for multiple assets - fetches fresh data from API
  async refreshPrices(assets) {
    const today = new Date().toISOString().split('T')[0];
    
    // Clear today's cache in both Redis and PostgreSQL
    await redisCache.clearTodayPrices();
    
    const assetIds = assets.map(a => a.assetId);
    if (assetIds.length > 0) {
      await pool.query(
        'DELETE FROM price_cache WHERE asset_id = ANY($1) AND price_date = $2',
        [assetIds, today]
      );
    }

    // Fetch fresh prices
    const results = [];
    for (const asset of assets) {
      try {
        const priceData = await this.getPriceWithChange(
          asset.assetId,
          asset.symbol,
          asset.assetType,
          true
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

  // Invalidate cache for specific assets
  async invalidateTodayCache(assetIds = null) {
    const today = new Date().toISOString().split('T')[0];
    
    if (assetIds && assetIds.length > 0) {
      // Delete specific assets from Redis
      for (const assetId of assetIds) {
        await redisCache.del(redisCache.priceKey(assetId, today));
      }
      // Delete from PostgreSQL
      await pool.query(
        'DELETE FROM price_cache WHERE asset_id = ANY($1) AND price_date = $2',
        [assetIds, today]
      );
    } else {
      // Clear all today's prices
      await redisCache.clearTodayPrices();
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
