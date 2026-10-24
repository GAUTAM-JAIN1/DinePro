/**
 * Sliding-window counter used for socket events (Bug #80).
 *
 * Returns `allow(key, now?)`: true while `key` has made fewer than `max` hits in
 * the last `windowMs`. In memory and per process, the same trade-off as the
 * HTTP limits in middleware/rateLimit.js — a restart resets the counters.
 */
function createWindowLimiter({ max, windowMs }) {
  const hits = new Map()
  let lastSweep = 0

  function sweep(now) {
    for (const [key, times] of hits) {
      const fresh = times.filter((t) => now - t < windowMs)
      if (fresh.length) hits.set(key, fresh)
      else hits.delete(key)
    }
    lastSweep = now
  }

  return function allow(key, now = Date.now()) {
    if (now - lastSweep > windowMs) sweep(now)
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs)
    if (recent.length >= max) {
      hits.set(key, recent)
      return false
    }
    recent.push(now)
    hits.set(key, recent)
    return true
  }
}

module.exports = { createWindowLimiter }
