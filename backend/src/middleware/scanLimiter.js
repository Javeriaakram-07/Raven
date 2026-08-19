import { randomUUID } from 'crypto';

// ── Constants ─────────────────────────────────────────────────────────────────

const COOKIE_NAME    = 'raven_uid';
const COOKIE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 h in ms
const HOURLY_LIMIT   = 2;
const HOUR_MS        = 60 * 60 * 1000;

// ── In-memory state ───────────────────────────────────────────────────────────

// Map<visitorId, number[]>  — stores timestamps of completed scan requests
const scanTimestamps = new Map();

// Global lock — only one scan runs at a time server-wide
let isScanning = false;

// ── Dev bypass helper ─────────────────────────────────────────────────────────

function isDevRequest(req) {
  if (process.env.NODE_ENV === 'production') return false;
  const ip = req.ip || req.socket?.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip.includes('127.0.0.1');
}

// ── Middleware: assign cookie ──────────────────────────────────────────────────

/**
 * Assigns a unique `raven_uid` cookie to any visitor who doesn't have one.
 * Mount this on every route (app-level) so the cookie is set on the first
 * request, not just when they hit /api/scan.
 */
export function assignVisitorCookie(req, res, next) {
  if (!req.cookies?.[COOKIE_NAME]) {
    const uid = randomUUID();
    res.cookie(COOKIE_NAME, uid, {
      maxAge:   COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: 'lax',
      secure:   process.env.NODE_ENV === 'production',
    });
    req.visitorId = uid;
  } else {
    req.visitorId = req.cookies[COOKIE_NAME];
  }
  next();
}

// ── Middleware: per-visitor hourly limit ──────────────────────────────────────

/**
 * Limits each visitor cookie to HOURLY_LIMIT scans per rolling hour.
 * Bypassed entirely in dev/localhost.
 */
export function visitorHourlyLimit(req, res, next) {
  if (isDevRequest(req)) return next();

  const uid  = req.visitorId;
  const now  = Date.now();
  const cutoff = now - HOUR_MS;

  // Prune old timestamps and check count
  const prev = (scanTimestamps.get(uid) || []).filter(t => t > cutoff);

  if (prev.length >= HOURLY_LIMIT) {
    const oldestInWindow = prev[0];
    const retryAfterSec  = Math.ceil((oldestInWindow + HOUR_MS - now) / 1000);
    res.setHeader('Retry-After', retryAfterSec);
    return res.status(429).json({
      error: `You've reached the limit of ${HOURLY_LIMIT} scans per hour. Please try again later.`,
    });
  }

  // Record this scan attempt now; release happens in releaseScanLock
  prev.push(now);
  scanTimestamps.set(uid, prev);

  next();
}

// ── Middleware: global concurrent scan lock ───────────────────────────────────

/**
 * Ensures only one scan runs at a time server-wide.
 * Bypassed entirely in dev/localhost.
 *
 * Call releaseScanLock() in the route's finally block.
 */
export function acquireScanLock(req, res, next) {
  if (isDevRequest(req)) return next();

  if (isScanning) {
    return res.status(429).json({
      error: 'A scan is already in progress. Please try again in about a minute.',
    });
  }

  isScanning = true;
  next();
}

/**
 * Release the global scan lock.
 * Must be called in a finally block in the route handler.
 */
export function releaseScanLock() {
  isScanning = false;
}

// ── Periodic cleanup ──────────────────────────────────────────────────────────
// Prune entries for visitors whose entire history is older than 1 hour,
// so the Map doesn't grow unboundedly on a long-running server.

setInterval(() => {
  const cutoff = Date.now() - HOUR_MS;
  for (const [uid, timestamps] of scanTimestamps.entries()) {
    if (timestamps.every(t => t <= cutoff)) {
      scanTimestamps.delete(uid);
    }
  }
}, 10 * 60 * 1000); // run every 10 minutes
