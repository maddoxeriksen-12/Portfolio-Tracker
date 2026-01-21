const Redis = require('ioredis');

class RedisCacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.localCache = new Map(); // Fallback in-memory cache
    this.CACHE_TTL = 60 * 60 * 12; // 12 hours default TTL
    this.PRICE_TTL = 60 * 60 * 4; // 4 hours for price data (refreshed more often)
    this.DAILY_RETURN_TTL = 60 * 5; // 5 minutes for today's return summaries
  }

  async connect() {
    if (this.client && this.isConnected) return this.client;

    const redisUrl = process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL;
    
    if (!redisUrl) {
      console.log('⚠️  No Redis URL configured, using in-memory cache fallback');
      return null;
    }

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        lazyConnect: true,
        connectTimeout: 5000,
        tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        console.error('Redis error:', err.message);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        console.log('Redis connection closed');
        this.isConnected = false;
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      console.error('Failed to connect to Redis:', error.message);
      this.client = null;
      this.isConnected = false;
      return null;
    }
  }

  // Generate cache key for price data
  priceKey(assetId, date) {
    return `price:${assetId}:${date}`;
  }

  // Generate cache key for daily portfolio summary
  dailySummaryKey(userId, date) {
    return `daily_summary:${userId}:${date}`;
  }

  // Generate cache key for overview
  overviewKey(userId) {
    return `overview:${userId}`;
  }

  // Get from cache (Redis first, then local fallback)
  async get(key) {
    try {
      if (this.client && this.isConnected) {
        const data = await this.client.get(key);
        if (data) {
          return JSON.parse(data);
        }
      }
    } catch (error) {
      console.error('Redis get error:', error.message);
    }

    // Fallback to local cache
    const localData = this.localCache.get(key);
    if (localData && localData.expiresAt > Date.now()) {
      return localData.value;
    }
    return null;
  }

  // Set to cache (Redis and local fallback)
  async set(key, value, ttl = this.CACHE_TTL) {
    try {
      if (this.client && this.isConnected) {
        await this.client.setex(key, ttl, JSON.stringify(value));
      }
    } catch (error) {
      console.error('Redis set error:', error.message);
    }

    // Always set local cache as backup
    this.localCache.set(key, {
      value,
      expiresAt: Date.now() + (ttl * 1000)
    });
  }

  // Delete from cache
  async del(key) {
    try {
      if (this.client && this.isConnected) {
        await this.client.del(key);
      }
    } catch (error) {
      console.error('Redis del error:', error.message);
    }
    this.localCache.delete(key);
  }

  // Delete by pattern (e.g., all prices for today)
  async delByPattern(pattern) {
    try {
      if (this.client && this.isConnected) {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      }
    } catch (error) {
      console.error('Redis delByPattern error:', error.message);
    }

    // Clean local cache
    for (const key of this.localCache.keys()) {
      if (this.matchPattern(key, pattern)) {
        this.localCache.delete(key);
      }
    }
  }

  // Simple pattern matching for local cache cleanup
  matchPattern(str, pattern) {
    const regexPattern = pattern.replace(/\*/g, '.*');
    return new RegExp(`^${regexPattern}$`).test(str);
  }

  // Get multiple keys at once
  async mget(keys) {
    const results = {};
    
    try {
      if (this.client && this.isConnected) {
        const values = await this.client.mget(keys);
        keys.forEach((key, index) => {
          if (values[index]) {
            results[key] = JSON.parse(values[index]);
          }
        });
        return results;
      }
    } catch (error) {
      console.error('Redis mget error:', error.message);
    }

    // Fallback to local cache
    for (const key of keys) {
      const localData = this.localCache.get(key);
      if (localData && localData.expiresAt > Date.now()) {
        results[key] = localData.value;
      }
    }
    return results;
  }

  // Set multiple keys at once
  async mset(keyValuePairs, ttl = this.CACHE_TTL) {
    try {
      if (this.client && this.isConnected) {
        const pipeline = this.client.pipeline();
        for (const [key, value] of Object.entries(keyValuePairs)) {
          pipeline.setex(key, ttl, JSON.stringify(value));
        }
        await pipeline.exec();
      }
    } catch (error) {
      console.error('Redis mset error:', error.message);
    }

    // Always set local cache
    for (const [key, value] of Object.entries(keyValuePairs)) {
      this.localCache.set(key, {
        value,
        expiresAt: Date.now() + (ttl * 1000)
      });
    }
  }

  // Cache price data with appropriate TTL
  async cachePrice(assetId, date, priceData) {
    const key = this.priceKey(assetId, date);
    await this.set(key, priceData, this.PRICE_TTL);
  }

  // Get cached price
  async getCachedPrice(assetId, date) {
    const key = this.priceKey(assetId, date);
    return await this.get(key);
  }

  // Get multiple prices at once
  async getCachedPrices(assetIds, date) {
    const keys = assetIds.map(id => this.priceKey(id, date));
    return await this.mget(keys);
  }

  // Cache daily summary for quick access
  async cacheDailySummary(userId, date, summary) {
    const key = this.dailySummaryKey(userId, date);
    await this.set(key, summary, this.DAILY_RETURN_TTL);
  }

  // Get cached daily summary
  async getCachedDailySummary(userId, date) {
    const key = this.dailySummaryKey(userId, date);
    return await this.get(key);
  }

  // Cache overview
  async cacheOverview(userId, overview) {
    const key = this.overviewKey(userId);
    await this.set(key, {
      ...overview,
      cachedAt: Date.now()
    }, this.DAILY_RETURN_TTL);
  }

  // Get cached overview
  async getCachedOverview(userId) {
    const key = this.overviewKey(userId);
    return await this.get(key);
  }

  // Invalidate user's cached data
  async invalidateUserCache(userId) {
    await this.del(this.overviewKey(userId));
    const today = new Date().toISOString().split('T')[0];
    await this.del(this.dailySummaryKey(userId, today));
  }

  // Clear all price cache for today (for force refresh)
  async clearTodayPrices() {
    const today = new Date().toISOString().split('T')[0];
    await this.delByPattern(`price:*:${today}`);
  }

  // Clean expired local cache entries periodically
  cleanLocalCache() {
    const now = Date.now();
    for (const [key, data] of this.localCache.entries()) {
      if (data.expiresAt <= now) {
        this.localCache.delete(key);
      }
    }
  }

  // Health check
  async isHealthy() {
    try {
      if (this.client && this.isConnected) {
        await this.client.ping();
        return true;
      }
    } catch (error) {
      return false;
    }
    return false;
  }

  // Close connection
  async close() {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }
}

// Create singleton instance
const redisCache = new RedisCacheService();

// Clean local cache every 5 minutes
setInterval(() => {
  redisCache.cleanLocalCache();
}, 5 * 60 * 1000);

module.exports = redisCache;
