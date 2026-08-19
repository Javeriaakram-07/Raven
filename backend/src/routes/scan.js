import { Router } from 'express';
import { runScan }       from '../services/scanner.js';
import { logAndMap }     from '../utils/errorMapper.js';
import {
  visitorHourlyLimit,
  acquireScanLock,
  releaseScanLock,
} from '../middleware/scanLimiter.js';

export const scanRouter = Router();

const MAX_PROMPT_LENGTH = 8000;

/**
 * POST /api/scan
 *
 * Middleware stack (in order):
 *   1. visitorHourlyLimit  — 2 scans/hour per raven_uid cookie
 *   2. acquireScanLock     — only 1 scan server-wide at a time
 *   3. handler             — validates input, streams SSE, releases lock
 *
 * SSE event types:
 *   progress  — { completed, total, attackName, verdict }
 *   complete  — { ...fullScanResult }
 *   error     — { error: string }
 */
scanRouter.post('/scan', visitorHourlyLimit, acquireScanLock, async (req, res) => {
  const { systemPrompt } = req.body;

  // ── Input validation ───────────────────────────────────────────────────────
  if (!systemPrompt || typeof systemPrompt !== 'string') {
    releaseScanLock();
    return res.status(400).json({ error: 'systemPrompt is required and must be a string.' });
  }
  const trimmed = systemPrompt.trim();
  if (trimmed.length === 0) {
    releaseScanLock();
    return res.status(400).json({ error: 'systemPrompt must not be empty.' });
  }
  if (trimmed.length > MAX_PROMPT_LENGTH) {
    releaseScanLock();
    return res.status(400).json({
      error: `systemPrompt exceeds the maximum length of ${MAX_PROMPT_LENGTH} characters.`,
    });
  }

  // ── Set up SSE ─────────────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  function sendEvent(type, data) {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  const keepAlive = setInterval(() => res.write(': ping\n\n'), 15_000);

  console.log(`[scan] Starting — prompt length: ${trimmed.length} chars, visitor: ${req.visitorId?.slice(0, 8)}...`);
  const startTime = Date.now();

  try {
    const scanResult = await runScan(trimmed, ({ completed, total, attackName, verdict }) => {
      sendEvent('progress', { completed, total, attackName, verdict });
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[scan] Complete — risk: ${scanResult.riskScore}, ` +
      `failed: ${scanResult.summary.failed}/${scanResult.summary.total}, ` +
      `elapsed: ${elapsed}s`
    );

    sendEvent('complete', scanResult);

  } catch (err) {
    const safeMessage = logAndMap('[scan] top-level', err);
    sendEvent('error', { error: safeMessage });
  } finally {
    clearInterval(keepAlive);
    releaseScanLock();   // always release — even if scan errors out
    res.end();
  }
});
