import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ── Load .env FIRST before anything else reads process.env ───────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../.env') });

// ── Imports ───────────────────────────────────────────────────────────────────
import express      from 'express';
import cors         from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit    from 'express-rate-limit';
import { scanRouter }          from './routes/scan.js';
import { isRefusal }           from './services/classifier.js';
import { logAndMap }           from './utils/errorMapper.js';
import { assignVisitorCookie } from './middleware/scanLimiter.js';

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json({ limit: '64kb' }));

// CORS — credentials: true so the raven_uid cookie round-trips from the browser
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
  ],
  methods:          ['POST', 'GET'],
  allowedHeaders:   ['Content-Type'],
  credentials:      true,   // required for cookies to be sent cross-origin
}));

// Cookie parser — must come before assignVisitorCookie
app.use(cookieParser());

// Assign a unique visitor ID cookie to every request that doesn't have one
app.use(assignVisitorCookie);

// IP-based baseline abuse limiter (existing layer — stays as-is)
const ipLimiter = rateLimit({
  windowMs:        parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:             parseInt(process.env.RATE_LIMIT_MAX)        || 10,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many scan requests. Please wait before trying again.' },
});

app.use('/api/scan', ipLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'raven-backend', version: '1.0.0' });
});

app.use('/api', scanRouter);

// ── Global error handler ──────────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  const safeMessage = logAndMap('[server]', err);
  res.status(500).json({ error: safeMessage });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const isProd = process.env.NODE_ENV === 'production';
  console.log(`Raven backend running on http://localhost:${PORT}`);
  console.log(`Environment:  ${isProd ? 'production' : 'development (rate limits bypassed for localhost)'}`);
  console.log(`OpenRouter model: ${process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4-5'}`);
  console.log(`OpenRouter key:   ${process.env.OPENROUTER_API_KEY ? process.env.OPENROUTER_API_KEY.slice(0, 8) + '...' : '(not set — check .env)'}`);

  isRefusal('test')
    .then(() => console.log('[classifier] Warmed up and ready.'))
    .catch(err => console.warn('[classifier] Warm-up failed (will retry on first scan):', err.message));
});
