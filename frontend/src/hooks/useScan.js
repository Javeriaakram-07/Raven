import { useState, useCallback } from 'react';

/**
 * useScan — manages all scan state and the SSE-based API call.
 *
 * Returns:
 *   status:    'idle' | 'scanning' | 'complete' | 'error'
 *   progress:  { completed: number, total: number, attackName: string, verdict: string } | null
 *   results:   scan response object | null
 *   error:     error message string | null
 *   startScan: (systemPrompt: string) => void
 *   reset:     () => void
 */
export function useScan() {
  const [status, setStatus]     = useState('idle');
  const [progress, setProgress] = useState(null);
  const [results, setResults]   = useState(null);
  const [error, setError]       = useState(null);

  const startScan = useCallback(async (systemPrompt) => {
    setStatus('scanning');
    setProgress(null);
    setResults(null);
    setError(null);

    try {
      // POST to start the scan — the server responds with an SSE stream
      const response = await fetch('/api/scan', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',   // send raven_uid cookie with every request
        body:        JSON.stringify({ systemPrompt }),
      });

      // Non-2xx before the stream starts — validation error, rate limit, etc.
      // Backend always sends { error: "<clean message>" } for these.
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Scan request failed. Please try again.');
      }

      // Read the SSE stream line-by-line
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = 'message';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete last line

        for (const line of lines) {
          if (line.startsWith(':')) continue; // keep-alive comment

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
              // If it was a thrown Error re-throw, otherwise just a bad JSON line
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
      // The error message is already clean — either from the backend mapper
      // or a network-level failure before the backend was reached.
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
