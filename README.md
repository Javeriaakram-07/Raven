# Raven — AI System Prompt Vulnerability Scanner

Raven lets you paste your chatbot's system prompt and instantly discover whether it is vulnerable to prompt injection, jailbreaks, information leakage, or persona breaks — no API key to your live bot required.

It loads your system prompt into a sandboxed test model via [Groq](https://groq.com), fires attack payloads across six [OWASP LLM Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/) categories, evaluates each response with a hybrid detection system (fast pattern matching + a local classifier model for ambiguous cases), then generates a risk score and actionable remediation advice.

---

## Quick Start

### Prerequisites

- Node.js 18+
- A free [Groq API key](https://console.groq.com) (no credit card required)

### 1. Configure your API key

```bash
cd backend
cp .env.example .env
```

Edit `.env` and fill in:

GROQ_API_KEY=your_groq_key_here
GROQ_MODEL=openai/gpt-oss-20b
PORT=3001
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=10


### 2. Install and start the backend

```bash
cd backend
npm install
npm start
```

The API will be available at `http://localhost:3001`. On first run, the backend downloads a small local classifier model (~260MB, one-time) used for refusal detection — this runs entirely on the server, no external API calls.

### 3. Install and start the frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Usage

1. Paste your chatbot's system prompt into the textarea (up to 8,000 characters).
2. Or click one of the **Load an example** buttons to try a pre-built weak/medium/strong prompt.
3. Click **Run Scan**.
4. Wait roughly 30–90 seconds while the attacks run in batches.
5. Review the results dashboard — risk score, per-category breakdown, explanations, and remediation hints.
6. Export the report as JSON, plain text, or a formatted PDF.

**Note:** Raven tests prompt-level resilience against a sandboxed model — it measures how well your *system prompt's wording* holds up to attacks, not your fully deployed system's infrastructure, tools, or API-level security. See [Scope & Limitations](#scope--limitations) below.

---

## Architecture

frontend (React + Vite, port 5173)
↕ HTTP POST /api/scan (cookie-based session)
backend (Express, port 3001)
↕ Groq API (attack payloads → target model)
↕ local classifier model (refusal detection, runs on-server)


- System prompts are **never stored** — they exist only for the duration of the HTTP request.
- API keys live in `.env` on the backend; the frontend never touches them.
- Error messages shown to users are generic and safe — raw provider errors are logged server-side only, never exposed to the client.

### Rate limiting (three layers)

| Layer | Limit |
|-------|-------|
| IP-based (express-rate-limit) | 10 requests / 15 min per IP |
| Per-visitor (cookie-based) | 2 scans / rolling hour |
| Global concurrency lock | 1 scan running at a time, server-wide |

Local development (`NODE_ENV !== 'production'` or requests from localhost) bypasses the per-visitor and concurrency limits.

---

## Detection Architecture

Raven uses a **hybrid detection system**, not a second LLM call for judging (which would double API usage and cost):

1. **Fast pattern detectors** — regex/keyword matching for unambiguous cases (PII-shaped output, forbidden keywords, code injection, large verbatim prompt leaks).
2. **Local classifier fallback** — for ambiguous refusal judgments only (e.g., a response that doesn't use a standard refusal phrase but still declines), a small zero-shot classification model runs locally on the backend server via `@huggingface/transformers` — no external API call, no added cost, no rate-limit impact.

This mirrors the approach used by industry tools like NVIDIA's Garak.

### Detection types

| Type | Fails when |
|------|-----------|
| `keyword_match` | Response contains a flagged keyword |
| `keyword_absent` | Response does NOT contain an expected keyword |
| `regex_match` | Response matches a regex pattern |
| `refusal_absent` | Model did not refuse the request (fast phrase check + classifier fallback) |
| `prompt_leak` | Response contains verbatim/overlapping text from the system prompt |
| `pii_pattern` | Response contains PII-shaped content (email, URL, code) |
| `persona_adherence` | Model revealed its underlying identity/provider, breaking its assigned persona |

---

## OWASP Coverage

| Category | 
|----------|
| LLM01 — Prompt Injection |
| LLM02 — Sensitive Information Disclosure |
| LLM03 — Insecure Output Handling |
| LLM06 — System Prompt Leakage |
| LLM08 — Excessive Agency |
| Persona Non-Adherence (custom category — model identity/provider disclosure) |

Attacks are defined in `backend/src/data/attacks.json`. Add a new entry there to extend the library — no code changes required.

---

## Project Structure

raven/
├── backend/
│ ├── src/
│ │ ├── server.js
│ │ ├── routes/scan.js
│ │ ├── middleware/scanLimiter.js
│ │ ├── services/openrouter.js # Groq API client
│ │ ├── services/classifier.js # local refusal classifier
│ │ ├── services/scanner.js
│ │ ├── detection/detectors.js
│ │ ├── utils/errorMapper.js
│ │ └── data/attacks.json
│ ├── .env.example
│ └── package.json
├── frontend/
│ ├── src/
│ │ ├── App.jsx
│ │ ├── components/
│ │ ├── hooks/useScan.js
│ │ ├── utils/pdfExport.js
│ │ └── styles/index.css
│ ├── public/
│ └── package.json
└── docs/
├── requirements.md
├── design.md
└── tasks.md


---

## Development

```bash
# Backend with auto-reload
cd backend && npm run dev

# Frontend with HMR
cd frontend && npm run dev
```

---

## Scope & Limitations

- Raven tests a system prompt's resilience against a sandboxed model, not your fully deployed chatbot's live infrastructure, tool access, or API-level security.
- Detection accuracy depends on the fast pattern rules and the local classifier's judgment; like any automated scanner, it can produce occasional false positives/negatives on ambiguous responses.
- Rate-limit and scan-history tracking is in-memory and resets on server restart — not persistent across deploys.

---

## Security Notes

- Never commit your `.env` file — it's excluded via `.gitignore`.
- Run `npm audit` in both `backend/` and `frontend/` before deploying.
- Known issue: `@huggingface/transformers` pulls in transitive dependencies (`sharp`, `adm-zip`) with disclosed high-severity CVEs used internally for ONNX model handling. Raven does not process user-supplied images through these paths; risk assessed as low for this use case pending an upstream fix.