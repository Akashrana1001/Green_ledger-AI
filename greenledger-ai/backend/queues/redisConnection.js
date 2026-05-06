const { Redis } = require('ioredis');

let connection = null;

/**
 * Single shared Redis connection used by both BullMQ queue + worker, and the
 * Redis cache middleware on read-heavy routes.
 *
 * Configuration is via a single REDIS_URL env var which covers all deployment
 * targets without code changes:
 *
 *   Local Docker:    redis://localhost:6379
 *   Redis Cloud:     rediss://default:<password>@redis-XXXX.cloud.redislabs.com:18745
 *   ElastiCache:     redis://greenledger.abc.0001.use1.cache.amazonaws.com:6379
 *
 * Falls back to localhost so existing dev workflow keeps working.
 *
 * `maxRetriesPerRequest: null` is required by BullMQ — without it BullMQ logs
 * a warning and bails on long-running blocking commands.
 */
const getRedisConnection = () => {
  if (!connection) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    connection = new Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });

    connection.on('error', (err) => {
      console.warn('[Redis] connection error (queue/cache unavailable):', err.message);
    });
  }
  return connection;
};

module.exports = { getRedisConnection };
