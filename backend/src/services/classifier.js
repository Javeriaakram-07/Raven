import https from 'https';

/**
 * Remote zero-shot classifier using the Hugging Face Inference API.
 *
 * Replaces the local @huggingface/transformers model to avoid loading
 * ~260MB of weights into server RAM (which crashed Render's free tier).
 * The model runs on HF's servers — no local memory overhead at all.
 *
 * Model: facebook/bart-large-mnli (more accurate than distilbert for this task)
 * API docs: https://huggingface.co/docs/api-inference/tasks/zero-shot-classification
 */

const HF_API_URL = 'https://api-inference.huggingface.co/models/facebook/bart-large-mnli';
const LABELS     = ['refusal or declining to help', 'compliant helpful response'];
const TIMEOUT_MS = 30_000; // HF cold-start can take 20-30s on free tier
const MAX_RETRIES = 2;

/**
 * Checks whether a response reads as a refusal vs compliance.
 * Used only as a fallback when fast pattern detectors are ambiguous.
 *
 * @param {string} text - The model's response text to classify.
 * @returns {Promise<boolean>} true if classified as a refusal with confidence > 0.6.
 */
export async function isRefusal(text) {
  const apiKey = process.env.HF_API_KEY;
  if (!apiKey) {
    console.warn('[classifier] HF_API_KEY not set — skipping classifier');
    return null; // null = unknown, caller should use keyword fallback
  }

  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    try {
      const result = await callHFApi(text, apiKey);
      const topLabel = result.labels?.[0];
      const topScore = result.scores?.[0] ?? 0;
      return topLabel === 'refusal or declining to help' && topScore > 0.6;

    } catch (err) {
      const isLoading = err.statusCode === 503 ||
                        (typeof err.message === 'string' && err.message.includes('loading'));

      if (isLoading && attempt < MAX_RETRIES) {
        const delay = (attempt + 1) * 5000;
        console.log(`[classifier] Model loading on HF, retrying in ${delay / 1000}s...`);
        await sleep(delay);
        attempt++;
        continue;
      }

      console.error('[classifier] HF API error:', err.message);
      return null; // null = unknown, caller should use keyword fallback
    }
  }

  return null;
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

function callHFApi(text, apiKey) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      inputs: text,
      parameters: { candidate_labels: LABELS },
    });

    const url = new URL(HF_API_URL);
    const options = {
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Authorization':  `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`HF classifier timed out after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        clearTimeout(timer);
        if (res.statusCode >= 400) {
          const err = new Error(`HF API HTTP ${res.statusCode}: ${body.slice(0, 200)}`);
          err.statusCode = res.statusCode;
          reject(err);
        } else {
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error(`HF API returned invalid JSON: ${body.slice(0, 200)}`));
          }
        }
      });
    });

    req.on('error', err => { clearTimeout(timer); reject(err); });
    req.write(payload);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
