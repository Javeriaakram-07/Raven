import { useState, useCallback } from 'react';

// In dev, Vite proxies /api → localhost:3001 so the cookie stays same-origin.
// In production, VITE_API_URL is injected at build time from frontend/.env.production
// and points to the Render backend (https://raven-m0cy.onrender.com).
const API_BASE = import.meta.env.VITE_API_URL ?? '';

/**
 * useScan — manages all scan state and the SSE-based API call.
 *
 * Returns:
 *   status:    'idle' | 'scanning' | 'complete' | 'error'
 *   progress:  { completed, total, attackName, verdict } | null
 *   results:   full scan result object | null
 *   error:     safe string | null
 *   startScan: (systemPrompt: string) => void
 *   reset:     () => void
 */
export function useScan() {
  const [status,   setStatus]   = useState('idle');
  const [progress, setProgress] = useState(null);
  const [results,  setResults]  = useState(null);
  const [error,    setError]    = useState(null);

  const startScan = useCallback(async (systemPrompt) => {
    setStatus('scanning');
    setProgress(null);
    setResults(null);
    setError(null);

    try {
      // POST to start the scan — server responds with an SSE stream
      const response = await fetch(`${API_BASE}/api/scan`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',  // send raven_uid cookie with every request
        body:        JSON.stringify({ systemPrompt }),
      });

      // Non-2xx before stream opens — validation error, rate limit, etc.
      // Backend always sends { error: "<clean message>" } for these.
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Scan request failed. Please try again.');
      }

      // Read the SSE stream line-by-line
      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer       = '';
      let currentEvent = 'message';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete last line

        for (const line of lines) {
          if (line.startsWith(':')) continue; // keep-alive ping

          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
            continue;
          }

          if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim();
            try {
              const payload = JSON.parse(raw);

              if (currentEvent === 'progress') {
                setProgress(payload);
              } else if (currentEvent === 'complete') {
                setResults(payload);
                setStatus('complete');
              } else if (currentEvent === 'error') {
                throw new Error(payload.error || 'Scan failed on server.');
              }
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) {
                console.warn('[useScan] could not parse SSE data:', raw);
              } else {
                throw parseErr;
              }
            }
            currentEvent = 'message'; // reset after consuming data line
          }
        }
      }

    } catch (err) {
      console.error('[useScan] error:', err);
      setError(
        err.message && !err.message.includes('fetch')
          ? err.message
          : 'Unable to reach the scanning service. Please check your connection and try again.'
      );
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setProgress(null);
    setResults(null);
    setError(null);
  }, []);

  return { status, progress, results, error, startScan, reset };
}
