import https from 'https';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Model used to run the attack — reads from env, set to llama-3.3-70b-versatile
const ATTACK_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

const TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;

/**
 * Invoke the attack model with a system prompt and an attack payload.
 *
 * @param {string} systemPrompt  - The user-supplied system prompt under test.
 * @param {string} userMessage   - The attack payload acting as the user turn.
 * @returns {Promise<string>}    - Raw text response from the model.
 */
export async function invokeModel(systemPrompt, userMessage) {
  // Prepend a meta-instruction to the system prompt so the model always
  // produces a text response rather than returning null/empty content.
  // This does NOT weaken the tested system prompt — it only ensures we get
  // a response to evaluate. The system prompt's own rules still govern behaviour.
  const wrappedSystem = `${systemPrompt}

[IMPORTANT: You must always respond with text, even if you are declining or refusing a request. Never return an empty response. If you cannot fulfil a request, explain why in a complete sentence.]`;

  return callGroq(ATTACK_MODEL, [
    { role: 'system', content: wrappedSystem },
    { role: 'user',   content: userMessage  },
  ]);
}

// ── Shared caller ─────────────────────────────────────────────────────────────

async function callGroq(model, messages) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set in environment variables.');
  }

  const payload = JSON.stringify({
    model,
    max_tokens: 400,   // attack responses only need to be long enough to detect pass/fail
    messages,
  });

  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    try {
      const text = await fetchWithTimeout(payload, apiKey);
      const json = JSON.parse(text);

      if (json.error) {
        throw new Error(`Groq error: ${json.error.message ?? JSON.stringify(json.error)}`);
      }

      const content = json?.choices?.[0]?.message?.content;
      const finishReason = json?.choices?.[0]?.finish_reason;

      // Model hit a content filter and returned no text — return a synthetic
      // refusal string so detectors always have something to evaluate.
      if ((content === null || content === undefined || content === '') && finishReason === 'content_filter') {
        return '[Content filtered by model safety system — request was refused]';
      }

      return typeof content === 'string' ? content : (content == null ? '' : String(content));

    } catch (err) {
      const isThrottling = err.statusCode === 429;
      const isTimeout    = err.message?.includes('timed out');

      if ((isThrottling || isTimeout) && attempt < MAX_RETRIES) {
        const delay = isThrottling ? 2000 : Math.pow(2, attempt) * 1000; // 2s on 429, 1s/2s on timeout
        await sleep(delay);
        attempt++;
        continue;
      }

      throw err;
    }
  }
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

function fetchWithTimeout(payload, apiKey) {
  return new Promise((resolve, reject) => {
    const url = new URL(GROQ_API_URL);

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
      reject(new Error(`Groq call timed out after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        clearTimeout(timer);
        if (res.statusCode >= 400) {
          const err = new Error(`Groq HTTP ${res.statusCode}: ${body}`);
          err.statusCode = res.statusCode;
          reject(err);
        } else {
          resolve(body);
        }
      });
    });

    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}