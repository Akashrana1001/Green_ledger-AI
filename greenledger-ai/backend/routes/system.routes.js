/**
 * GET /api/system/health — Admin-only system infrastructure health endpoint.
 *
 * Returns real stats from Redis (ping latency), BullMQ (queue counts),
 * and the in-process cache hit/miss counters.
 * Powers the SystemHealthPanel.jsx component in the War Room.
 */
const express        = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles     = require('../middleware/roleMiddleware');
const { getRedisConnection } = require('../queues/redisConnection');
const { getCacheStats }      = require('../middleware/cacheMiddleware');

const router = express.Router();

router.get('/health', authMiddleware, allowRoles('Admin'), async (req, res) => {
  const redis = getRedisConnection();

  /* ── Redis ping ───────────────────────────────────────────────────────── */
  let redisOnline = false;
  let redisPingMs = null;
  try {
    const t0 = Date.now();
    await Promise.race([
      redis.ping(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 1000)),
    ]);
    redisPingMs  = Date.now() - t0;
    redisOnline  = true;
  } catch { redisOnline = false; }

  /* ── BullMQ queue counts ──────────────────────────────────────────────── */
  let queue = { waiting: 0, active: 0, completed: 0, failed: 0 };
  try {
    const { getDocumentQueue } = require('../queues/documentQueue');
    const q = getDocumentQueue();
    const [waiting, active, completed, failed] = await Promise.all([
      q.getWaitingCount(),
      q.getActiveCount(),
      q.getCompletedCount(),
      q.getFailedCount(),
    ]);
    queue = { waiting, active, completed, failed };
  } catch { /* Redis offline — return zeros */ }

  const cache = getCacheStats();

  res.json({
    redis:     { online: redisOnline, pingMs: redisPingMs },
    queue,
    cache,
    workers:   { concurrency: 1, active: queue.active },
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
