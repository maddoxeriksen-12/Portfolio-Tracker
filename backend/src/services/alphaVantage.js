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
    const today = new Date().toISOString().split('T')[0];
    
    // Check cache first
    const cached = await pool.query(
      'SELECT price FROM price_cache WHERE asset_id = $1 AND price_date = $2',
      [assetId, today]
    );

    if (cached.rows.length > 0) {
      return parseFloat(cached.rows[0].price);
    }

    // Fetch fresh price
    let price;
    try {
      if (assetType === 'STOCK') {
        const quote = await this.getStockQuote(symbol);
        price = quote.price;
      } else {
        const quote = await this.getCryptoQuote(symbol);
        price = quote.price;
      }

      // Cache the price
      await pool.query(
        `INSERT INTO price_cache (asset_id, price, price_date) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (asset_id, price_date) DO UPDATE SET price = $2, fetched_at = CURRENT_TIMESTAMP`,
        [assetId, price, today]
      );

      return price;
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error.message);
      
      // Return most recent cached price if available
      const lastCached = await pool.query(
        'SELECT price FROM price_cache WHERE asset_id = $1 ORDER BY price_date DESC LIMIT 1',
        [assetId]
      );
      
      if (lastCached.rows.length > 0) {
        return parseFloat(lastCached.rows[0].price);
      }
      
      throw error;
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
