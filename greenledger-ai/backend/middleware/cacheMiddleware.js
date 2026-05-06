/**
 * Redis cache middleware — uses the existing ioredis singleton (BullMQ connection).
 *
 * Cache key is scoped per company so one admin never sees another's data.
 * Falls back silently if Redis is offline — the request just hits MongoDB.
 *
 * In-memory hit/miss counters (reset on server restart) are exposed via
 * getCacheStats() for the System Health endpoint.
 */
const { getRedisConnection } = require('../queues/redisConnection');

// Volatile in-process counters — good enough for a demo dashboard
const _stats = { hits: 0, misses: 0 };

/**
 * cacheMiddleware(ttlSeconds)
 *
 * Usage:
 *   router.get('/kpis', authMiddleware, allowRoles('Admin'), cacheMiddleware(60), handler)
 *
 * Cache is busted by company + URL, so POST/mutations on the same route
 * should call invalidateCache(companyId, '/api/report/kpis') afterward.
 */
const cacheMiddleware = (ttlSeconds = 60) => async (req, res, next) => {
  const redis  = getRedisConnection();
  const cid    = req.user?.companyId || 'anon';
  const cacheKey = `gl:cache:${cid}:${req.originalUrl}`;

  try {
    const cached = await Promise.race([
      redis.get(cacheKey),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Redis timeout')), 200)),
    ]);

    if (cached) {
      _stats.hits++;
      res.set('X-Cache', 'HIT');
      res.set('X-Cache-TTL', ttlSeconds);
      return res.json(JSON.parse(cached));
    }
    _stats.misses++;
  } catch {
    // Redis offline or slow — fall through to handler
    _stats.misses++;
  }

  // Intercept res.json to write the response into cache before sending
  const originalJson = res.json.bind(res);
  res.json = async (body) => {
    try {
      await redis.setex(cacheKey, ttlSeconds, JSON.stringify(body));
    } catch { /* fail silently */ }
    res.set('X-Cache', 'MISS');
    return originalJson(body);
  };

  next();
};

/**
 * Bust the cache for a specific company + URL after a write operation.
 * Call this after POST /api/sync/kpi-result updates the KpiResult document.
 */
const invalidateCache = async (companyId, urlPath) => {
  try {
    const redis = getRedisConnection();
    await redis.del(`gl:cache:${companyId}:${urlPath}`);
  } catch { /* fail silently */ }
};

/** Returns the current hit/miss stats for the System Health endpoint. */
const getCacheStats = () => {
  const total = _stats.hits + _stats.misses;
  return {
    hits:    _stats.hits,
    misses:  _stats.misses,
    total,
    hitRate: total > 0 ? Math.round((_stats.hits / total) * 1000) / 10 : 0,
  };
};

module.exports = { cacheMiddleware, invalidateCache, getCacheStats };
