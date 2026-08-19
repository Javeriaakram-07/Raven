# Raven — Implementation Task List

**Version:** 2.0  
**Date:** 2026-08-20

All tasks reflect the current implemented state of the system. Completed tasks are marked ✅. Remaining / future work is marked 🔲.

---

## Phase 1 — Backend Foundation ✅

### Task 1: Project scaffolding ✅
- ✅ `backend/` Node.js ESM project with `package.json`
- ✅ Dependencies: `express`, `dotenv`, `cors`, `cookie-parser`, `express-rate-limit`
- ✅ `backend/.env.example` with `GROQ_API_KEY`, `GROQ_MODEL`, `PORT`, rate limit vars
- ✅ `backend/src/server.js` — Express app, CORS (`credentials: true`), cookie-parser, IP rate limiter, health route
- **Refs:** NFR-02, NFR-07

### Task 2: Groq service ✅
- ✅ `backend/src/services/groq.js` — Node `https` module, no external HTTP library
- ✅ Model: `openai/gpt-oss-20b` (env-configurable)
- ✅ 20-second timeout via `setTimeout` / `req.destroy()`
- ✅ Retry up to 2 times with 1s / 2s exponential back-off on 429 or timeout
- ✅ `invokeModel(systemPrompt, userMessage)` — only exported function (judge removed)
- **Refs:** FR-07, FR-10, FR-11

### Task 3: Attack library ✅
- ✅ `backend/src/data/attacks.json` — 25 attacks across 6 OWASP categories
- ✅ All entries have: `id`, `name`, `category`, `owasp_ref`, `severity`, `payload`, `detection_type`, `detection_value`, `remediation_hint`
- ✅ Payloads use indirect social-engineering framings (no obvious jailbreak phrases)
- ✅ 3 Persona Non-Adherence attacks added (PNA-001, PNA-002, PNA-003)
- **Refs:** FR-18, FR-19, FR-20, FR-21

### Task 4: Local classifier ✅
- ✅ `@huggingface/transformers` installed
- ✅ `backend/src/services/classifier.js` — loads `Xenova/distilbert-base-uncased-mnli` once, cached in memory
- ✅ `isRefusal(text)` — zero-shot classification, returns `true` if refusal confidence > 0.6
- ✅ Warmup call in `server.js` `listen()` callback
- **Refs:** FR-24, FR-27

### Task 5: Hybrid detection system ✅
- ✅ `backend/src/detection/detectors.js` — hybrid pattern + classifier architecture
- ✅ Fast detectors: `keyword_match`, `keyword_absent`, `regex_match`, `pii_pattern`, `persona_adherence`
- ✅ Classifier-backed detectors: `refusal_absent` (position-aware fast path + classifier fallback), `prompt_leak` (80ch verbatim threshold for definitive fail)
- ✅ `persona_adherence` — 30+ identity phrases covering Claude/Anthropic, GPT/OpenAI, Gemini/Google, Mistral, generic LLM self-identification
- ✅ `evaluate(attack, response, systemPrompt)` — async, handles all detection types
- **Refs:** FR-22, FR-23, FR-24, FR-25, FR-26

### Task 6: Scanner service ✅
- ✅ `backend/src/services/scanner.js` — batch orchestration
- ✅ Parallel batches of 5 attacks via `Promise.all`
- ✅ 500ms delay between batches (≤5 req / 500ms — within Groq free tier)
- ✅ Results written to pre-allocated array (preserves original attack order)
- ✅ `onProgress` callback fires after each individual attack
- ✅ Risk scoring: 0 → Low, 1–2 → Medium, 3–5 → High, 6+ → Critical
- ✅ Individual attack errors don't abort scan — all 25 always attempted
- ✅ Uses `logAndMap` for per-attack error messages
- **Refs:** FR-08, FR-09, FR-12, FR-29, NFR-05

### Task 7: Scan API route (SSE) ✅
- ✅ `backend/src/routes/scan.js` — `POST /api/scan`
- ✅ Middleware chain: `visitorHourlyLimit` → `acquireScanLock` → handler
- ✅ SSE stream: `Content-Type: text/event-stream`, `X-Accel-Buffering: no`
- ✅ Emits `progress` events per attack, `complete` event at end, `error` event on failure
- ✅ 15-second keep-alive ping comments
- ✅ `releaseScanLock()` called in `finally` block
- ✅ Input validation: required, string, max 8000 chars — returns JSON 400 before stream opens
- **Refs:** FR-13, FR-14, FR-15, FR-16, FR-37

### Task 8: Error mapper ✅
- ✅ `backend/src/utils/errorMapper.js`
- ✅ `mapError(err)` — classifies by HTTP status, error name, error code, stack origin
- ✅ `logAndMap(context, err)` — logs full raw error to server console, returns safe string
- ✅ 6 fixed user-facing messages — no provider names, account IDs, or stack traces
- ✅ Classification by status code first (most specific), then error type/code
- **Refs:** FR-40, FR-41

### Task 9: Rate limiting middleware ✅
- ✅ `backend/src/middleware/scanLimiter.js`
- ✅ `assignVisitorCookie` — `crypto.randomUUID()`, HTTP-only, sameSite lax, 24h, secure in prod
- ✅ `visitorHourlyLimit` — `Map<uid, timestamp[]>`, 2 scans / rolling hour, `Retry-After` header
- ✅ `acquireScanLock` / `releaseScanLock` — boolean global mutex
- ✅ Dev bypass for `127.0.0.1` / `::1` in non-production
- ✅ Periodic cleanup every 10 min (prevents Map growth on long-running server)
- **Refs:** FR-35, FR-36, FR-37, FR-38, FR-39, NFR-08

---

## Phase 2 — Frontend ✅

### Task 10: Frontend scaffold ✅
- ✅ Vite + React project, `frontend/package.json`
- ✅ Dependencies: `react`, `react-dom`, `jspdf`
- ✅ Dev dependencies: `vite`, `@vitejs/plugin-react`
- ✅ `vite.config.js` — proxy `/api` → `http://localhost:3001`
- ✅ `index.html` at project root (Vite standard)
- ✅ `src/styles/index.css` — pure CSS, dark theme, CSS variables
- **Refs:** FR-42, FR-43

### Task 11: PromptInput component ✅
- ✅ Controlled textarea, max 8000 chars
- ✅ Live character counter — warn at 7000, error at 8000, over-limit border style
- ✅ Clear button
- ✅ 3 example prompt loaders: Weak / Medium / Strong
- **Refs:** FR-01, FR-02, FR-03, FR-05

### Task 12: useScan hook ✅
- ✅ State: `status`, `progress`, `results`, `error`
- ✅ `fetch` with `credentials: 'include'` (cookie round-trip)
- ✅ Pre-stream 4xx/5xx handled via `response.ok` check
- ✅ SSE stream read via `response.body.getReader()`
- ✅ Line buffering, `event:` / `data:` parsing
- ✅ `progress`, `complete`, `error` event handlers
- ✅ Network-level errors (before backend reached) handled with safe fallback message
- **Refs:** FR-13, FR-14, FR-15, FR-16, FR-41

### Task 13: ScanButton + ProgressBar ✅
- ✅ ScanButton disabled while scanning or prompt invalid/over-limit
- ✅ ProgressBar: real percentage, animated fill bar, 10 rotating phase labels, attack counter, last attack name + verdict colour
- **Refs:** FR-06, FR-17

### Task 14: ResultsDashboard ✅
- ✅ RiskBadge — colour-coded, icon per level
- ✅ Summary stats — 4 stat cards (total / passed / failed / errored), colour-coded values
- ✅ CategorySection — groups by OWASP category, sorted by fail count descending
- ✅ AttackCard — collapsible, failed attacks expanded by default, verdict dot + severity badge + verdict badge
- ✅ AttackCard body — explanation, remediation hint (fail only), payload with copy-to-clipboard, model response preview (scrollable)
- ✅ Smooth scroll to results after scan completes
- **Refs:** FR-28, FR-30, FR-31, FR-32

### Task 15: ExportButtons ✅
- ✅ JSON export — `Blob` + `URL.createObjectURL` + `<a download>`
- ✅ PDF export — jsPDF, dark theme, Raven logo circle, risk badge, stat cards, category bar chart, findings table, footer on every page
- ✅ Loading state on PDF button during generation
- **Refs:** FR-33, FR-34

### Task 16: Error handling ✅
- ✅ Error banner in `App.jsx` — shown on `status === 'error'`, displays backend message directly
- ✅ "Try again" button resets state
- **Refs:** FR-40, FR-41

---

## Phase 3 — Integration & Polish ✅

### Task 17: End-to-end wiring ✅
- ✅ Frontend `credentials: 'include'` → cookie sent with every scan
- ✅ CORS `credentials: true` on backend → cookie accepted cross-origin in dev
- ✅ SSE stream consumed and rendered correctly
- ✅ 25 attacks fire, results render grouped by category

### Task 18: Security hardening ✅
- ✅ No prompt stored after request
- ✅ API key never in frontend bundle
- ✅ All errors go through `errorMapper.js`
- ✅ `npm audit` — 0 vulnerabilities in `backend/` and `frontend/`
- ✅ ONNX transitive CVEs documented as accepted risk (unexploitable in this context)

### Task 19: Performance ✅
- ✅ Parallel batches — scan completes in ~60–90s vs 6+ min sequential
- ✅ Batch delay reduced from 1500ms to 500ms (judge calls removed)
- ✅ Classifier warmed up at startup — no cold-start delay on first scan

---

## Phase 4 — Remaining / Future Work 🔲

### Task 20: README update 🔲
- 🔲 Update `README.md` to reflect Groq (not Bedrock), 25 attacks, hybrid detection, PDF export, rate limiting
- 🔲 Add classifier warm-up note (first startup downloads ~260MB)

### Task 21: Production deployment prep 🔲
- 🔲 Serve frontend `dist/` as static files from Express in production
- 🔲 Set `NODE_ENV=production` to enable cookie `secure` flag and rate limits for all IPs
- 🔲 Document environment variable configuration for production

### Task 22: Attack library expansion 🔲
- 🔲 Add attacks for LLM04 (Model Denial of Service) and LLM09 (Misinformation)
- 🔲 Review and refresh payloads periodically as model safety training evolves

### Task 23: Demo prep 🔲
- 🔲 Test all 3 example prompts against live Groq — confirm Low / High / Critical outputs
- 🔲 Record demo walkthrough
- 🔲 Prepare screenshots for portfolio/presentation