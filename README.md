# Raven — AI System Prompt Vulnerability Scanner

**Live:** [ravenprompt.tech](https://www.ravenprompt.tech) &nbsp;|&nbsp; **Docs:** [ravenprompt.tech/docs](https://www.ravenprompt.tech/docs)

Raven lets you paste your chatbot's system prompt and instantly discover whether it is vulnerable to prompt injection, jailbreaks, information leakage, or persona breaks — no API key to your live bot required.

It loads your system prompt into a sandboxed test model, fires 25 attack payloads across six [OWASP LLM Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/) categories, evaluates each response with a hybrid detection system, then generates a risk score and actionable remediation advice.

---

## Live URLs

| Service | URL |
|---------|-----|
| Frontend | https://www.ravenprompt.tech |
| Docs | https://www.ravenprompt.tech/docs |
| Privacy | https://www.ravenprompt.tech/docs/privacy |
| Terms | https://www.ravenprompt.tech/docs/terms |

---

## Local Development

### Prerequisites

- Node.js 18+
- A free [Groq API key](https://console.groq.com) (no credit card required)
- A free [Hugging Face token](https://huggingface.co/settings/tokens) (for the refusal classifier)

### 1. Configure your API keys

```bash
cd backend
cp .env.example .env
```

Edit `.env`:

```
GROQ_API_KEY=your_groq_key_here
GROQ_MODEL=openai/gpt-oss-20b
HF_API_KEY=your_hf_token_here
FRONTEND_URL=http://localhost:5173
PORT=3001
NODE_ENV=development
```

### 2. Start the backend

```bash
cd backend
npm install
npm start
```

API available at `http://localhost:3001`.

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

---

## Usage

1. Paste your chatbot's system prompt (up to 8,000 characters).
2. Or click **Weak / Medium / Strong** to load a pre-built example.
3. Click **Run Scan**.
4. Watch the live progress bar as attacks complete.
5. Review the results — risk score, per-category breakdown, explanations, and remediation hints.
6. Export as **JSON** or **PDF**.

---

## Architecture

```
frontend (React + Vite)  →  ravenprompt.tech
         ↕ SSE stream + POST /api/scan
backend  (Express)       →  raven-m0cy.onrender.com
         ↕ Groq API (attack calls)
         ↕ HF Inference API (refusal classifier, edge cases only)
```

System prompts are **never stored** — in-memory only for the duration of the request.

### Rate limiting

| Layer | Limit |
|-------|-------|
| IP-based | 10 requests / 15 min per IP |
| Cookie-based | 2 scans / rolling hour per browser |
| Global lock | 1 scan running at a time server-wide |

Dev mode (localhost) bypasses the cookie and lock limits automatically.

---

## Detection System

Hybrid approach — fast patterns first, classifier only for edge cases:

| Type | Fails when |
|------|-----------|
| `keyword_match` | Response contains a flagged keyword |
| `keyword_absent` | Response missing an expected refusal marker |
| `regex_match` | Response matches a forbidden pattern |
| `refusal_absent` | Model did not refuse (two-tier: unambiguous phrases + ambiguous-opener context check) |
| `prompt_leak` | Response contains 80+ chars verbatim from the system prompt |
| `pii_pattern` | Response contains email, URL, or code injection patterns |
| `persona_adherence` | Model revealed its underlying identity or provider |

---

## OWASP Coverage (25 attacks)

| Category | Ref | Count |
|----------|-----|-------|
| Prompt Injection | LLM01 | 5 |
| Sensitive Information Disclosure | LLM02 | 5 |
| System Prompt Leakage | LLM06 | 4 |
| Insecure Output Handling | LLM03 | 4 |
| Excessive Agency | LLM08 | 4 |
| Persona Non-Adherence | LLM01 | 3 |

Add attacks by editing `backend/src/data/attacks.json` — no code changes required.

---

## Project Structure

```
raven/
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── routes/scan.js
│   │   ├── middleware/scanLimiter.js
│   │   ├── services/groq.js
│   │   ├── services/classifier.js
│   │   ├── services/scanner.js
│   │   ├── detection/detectors.js
│   │   ├── utils/errorMapper.js
│   │   └── data/attacks.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   ├── hooks/useScan.js
│   │   └── styles/index.css
│   ├── public/docs/        ← static HTML docs pages
│   └── .env.production
└── specs/
    ├── requirements.md
    ├── design.md
    └── tasks.md
```

---

## Deployment

**Backend** is deployed on [Render](https://render.com). Required environment variables in the Render dashboard:

```
GROQ_API_KEY=...
GROQ_MODEL=openai/gpt-oss-20b
HF_API_KEY=...
FRONTEND_URL=https://www.ravenprompt.tech
NODE_ENV=production
```

**Frontend** is deployed as static files. The production API URL is baked in at build time via `frontend/.env.production`:

```
VITE_API_URL=https://raven-m0cy.onrender.com
```

---

## Author

Built by [Javeria Akram](https://www.linkedin.com/in/javeria-akram-10b607334/) — CS student at PUCIT, FCIT. Campus Ambassador at GeeksforGeeks. Working across agentic AI, cybersecurity, and web development.
