/**
 * errorMapper.js
 *
 * Centralised error-to-user-message mapping layer.
 *
 * RULE: nothing in this file ever passes raw error text, provider names,
 * account IDs, stack traces, or internal HTTP response bodies to the caller.
 * Callers receive only a safe, generic-but-informative string.
 *
 * Callers are responsible for logging the raw error BEFORE calling mapError().
 */

// ── Classification helpers ────────────────────────────────────────────────────

function httpStatus(err) {
  // Express/Node http errors, Axios, our own fetchWithTimeout rejections
  return (
    err.statusCode   ||   // set explicitly in openrouter.js fetchWithTimeout
    err.status       ||
    err.response?.status ||
    null
  );
}

function isTimeout(err) {
  return (
    err.name === 'AbortError' ||
    err.code === 'ECONNABORTED' ||
    err.code === 'ETIMEDOUT' ||
    (typeof err.message === 'string' && err.message.includes('timed out'))
  );
}

function isNetworkError(err) {
  return (
    err.code === 'ECONNREFUSED' ||
    err.code === 'ECONNRESET'   ||
    err.code === 'ENOTFOUND'    ||
    err.code === 'ENETUNREACH'  ||
    err.code === 'EAI_AGAIN'    ||
    err.name === 'FetchError'
  );
}

function isClassifierError(err) {
  // Errors thrown inside classifier.js or @huggingface/transformers
  return (
    (typeof err.message === 'string' && err.message.includes('[classifier]')) ||
    (typeof err.stack   === 'string' && err.stack.includes('classifier.js'))  ||
    (typeof err.stack   === 'string' && err.stack.includes('transformers'))
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

const MESSAGES = {
  rateLimited:   'Scan temporarily unavailable due to high demand. Please try again in a few minutes.',
  credits:       'Scan service is temporarily unavailable. Please try again later.',
  timeout:       'The scan took too long to complete. Please try again.',
  network:       'Unable to reach the scanning service. Please check your connection and try again.',
  classifier:    'Scan service is starting up. Please try again in a moment.',
  serverError:   'Something went wrong during the scan. Please try again.',
  inputInvalid:  'Invalid input. Please check your system prompt and try again.',
};

/**
 * Map any caught error to a safe, user-facing message string.
 *
 * @param {Error | unknown} err  - The raw error to classify.
 * @returns {string}             - A clean message safe to send to the client.
 */
export function mapError(err) {
  if (!err) return MESSAGES.serverError;

  const status = httpStatus(err);

  // HTTP status-code based (most specific — check first)
  if (status === 429) return MESSAGES.rateLimited;
  if (status === 402) return MESSAGES.credits;
  if (status === 401 || status === 403) return MESSAGES.serverError; // config issue, not user's fault
  if (status >= 500 && status < 600) return MESSAGES.serverError;
  if (status === 400) return MESSAGES.inputInvalid;

  // Error type / code based
  if (isTimeout(err))       return MESSAGES.timeout;
  if (isNetworkError(err))  return MESSAGES.network;
  if (isClassifierError(err)) return MESSAGES.classifier;

  // Named error types from Node / fetch
  if (err.name === 'SyntaxError') return MESSAGES.serverError; // bad JSON from provider
  if (err.name === 'TypeError')   return MESSAGES.network;      // usually a fetch config issue

  return MESSAGES.serverError;
}

/**
 * Log the full raw error to the console (server-side only) and return
 * the mapped safe message. Single-call convenience wrapper.
 *
 * @param {string}          context  - Where the error originated, e.g. '[scan]'
 * @param {Error | unknown} err      - The raw error.
 * @returns {string}                 - Safe user-facing message.
 */
export function logAndMap(context, err) {
  // Full details to server logs — never reaches the client
  console.error(
    `${context} raw error:`,
    err?.message ?? err,
    err?.statusCode ? `(HTTP ${err.statusCode})` : '',
    err?.stack ? `\n${err.stack}` : ''
  );
  return mapError(err);
}
