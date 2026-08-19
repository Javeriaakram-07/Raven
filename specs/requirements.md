# Raven — Requirements Specification

**Version:** 2.0  
**Date:** 2026-08-20  
**Status:** Current — reflects implemented system

---

## 1. Overview

Raven is a web-based AI system prompt vulnerability scanner. It lets chatbot builders paste their system prompt and immediately discover whether it is susceptible to prompt injection, jailbreaks, information-leakage, insecure output, excessive agency, or persona non-adherence attacks — without needing API access to their live bot or any external credentials on the user's side.

---

## 2. Problem Statement

Chatbot builders using wrapper platforms (Voiceflow, Botpress, Custom GPTs, Bedrock Agents, LangChain, etc.) only control the system prompt. They have no straightforward way to test whether that prompt is exploitable before going live. Raven fills that gap by loading the user's system prompt into a sandboxed test model via Groq and systematically firing a library of known attack patterns against it.

---

## 3. Users & Roles

| Role | Description |
|------|-------------|
| **Scanner** | Primary user — a chatbot builder or security-conscious developer who pastes their system prompt and runs a scan. No account required. |
| **Admin** (future) | Manages the attack library, views aggregate scan telemetry. Out of scope for v1. |

---

## 4. Functional Requirements

### 4.1 System Prompt Input

- **FR-01:** The user must be able to paste a system prompt (plain text, up to 8,000 characters) into a textarea on the main page.
- **FR-02:** The UI must show a live character count, warn at 7,000 characters, and show an error state at 8,000 characters.
- **FR-03:** The user can clear the textarea at any time before or after a scan.
- **FR-04:** The system prompt must never be stored server-side beyond the duration of a single scan request.
- **FR-05:** Three example prompts (weak / medium / strong) must be available as one-click loaders to aid demos and testing.

### 4.2 Scan Execution

- **FR-06:** A "Run Scan" button initiates the scan. It must be disabled while a scan is in progress.
- **FR-07:** The backend must load the user-provided system prompt into a sandboxed model via Groq (model: `openai/gpt-oss-20b`).
- **FR-08:** The backend must execute all 25 attacks in the active attack library in parallel batches of 5.
- **FR-09:** For each attack the backend must record: attack name, category, OWASP ref, severity, payload sent, model response, pass/fail/error verdict, plain-language explanation, and remediation hint.
- **FR-10:** Individual attack calls must time out at 20 seconds. The overall scan must complete within 3 minutes.
- **FR-11:** If Groq returns a throttling (429) or timeout error, the backend must retry up to 2 times with exponential back-off (1s, 2s) before marking that attack as "error".
- **FR-12:** Individual attack failures must not abort the whole scan — all 25 attacks must always be attempted.

### 4.3 Real-Time Progress

- **FR-13:** The backend must stream scan progress to the frontend via Server-Sent Events (SSE).
- **FR-14:** The SSE stream must emit a `progress` event after each attack completes, containing: `{ completed, total, attackName, verdict }`.
- **FR-15:** The SSE stream must emit a `complete` event with the full scan result object when all attacks are done.
- **FR-16:** The SSE stream must emit an `error` event with a clean, user-safe message if the scan fails.
- **FR-17:** The frontend progress bar must display a real percentage, attack counter, rotating phase labels, and the name + verdict of the last completed attack.

### 4.4 Attack Library

- **FR-18:** Attacks must be stored in `backend/src/data/attacks.json` so they can be expanded without code changes.
- **FR-19:** Each attack entry must contain: `id`, `name`, `category`, `owasp_ref`, `severity`, `payload`, `detection_type`, `detection_value`, `remediation_hint`.
- **FR-20:** The library must cover at least 25 attacks spanning six categories: Prompt Injection, Sensitive Information Disclosure, System Prompt Leakage, Insecure Output Handling, Excessive Agency, and Persona Non-Adherence.
- **FR-21:** Attack payloads must use indirect, social-engineering framings rather than obvious jailbreak phrases, so tests measure the system prompt's resilience rather than the base model's safety training.

### 4.5 Detection System

- **FR-22:** Detection must use a hybrid architecture: fast pattern detectors run first; a local ML classifier is used as a fallback for ambiguous refusal cases.
- **FR-23:** Fast pattern detectors must support: `keyword_match`, `keyword_absent`, `regex_match`, `pii_pattern`, `persona_adherence`.
- **FR-24:** The `refusal_absent` and `prompt_leak` detector types must use a local zero-shot classification model (`Xenova/distilbert-base-uncased-mnli`) via `@huggingface/transformers` to distinguish genuine refusals from compliant responses — no external API call.
- **FR-25:** The `prompt_leak` detector must require an 80-character contiguous verbatim match to flag a definitive leak (to avoid false positives on incidental role mentions).
- **FR-26:** The `persona_adherence` detector must flag responses that reveal the underlying model name or provider (Claude, Anthropic, GPT, OpenAI, Gemini, Google, etc.) as a persona breach.
- **FR-27:** The classifier model must be warmed up at server startup so the first scan is not delayed by model loading.

### 4.6 Results & Reporting

- **FR-28:** After a scan, the UI must display an overall risk score: **Low / Medium / High / Critical**.
- **FR-29:** Risk scoring: 0 failures → Low; 1–2 → Medium; 3–5 → High; 6+ → Critical.
- **FR-30:** The results dashboard must list every attack grouped by OWASP category, with categories sorted so those with failures appear first.
- **FR-31:** Each attack card must show: name, severity badge, verdict badge, explanation, remediation hint, collapsible payload with copy button, and collapsible model response.
- **FR-32:** Failed attacks must be visually distinct (red left border) from passed (green) and errored (yellow) attacks.
- **FR-33:** The user must be able to export the full report as a JSON file.
- **FR-34:** The user must be able to export a professionally formatted PDF report with: Raven logo, risk score badge, summary stats, category bar chart, and per-attack findings with remediation hints.

### 4.7 Rate Limiting

- **FR-35:** The backend must assign each browser a unique `raven_uid` HTTP-only cookie (24-hour expiry, sameSite lax) on first visit.
- **FR-36:** Each visitor must be limited to 2 scans per rolling hour (cookie-based, not IP-based).
- **FR-37:** Only one scan may run server-wide at a time (global concurrent lock). Subsequent requests during an active scan must receive a 429 with a clear message.
- **FR-38:** The IP-based express-rate-limit layer (10 requests / 15 min) must remain as a baseline abuse-prevention layer beneath the cookie-based limits.
- **FR-39:** All rate limits must be bypassed automatically for localhost/127.0.0.1 requests in non-production environments.

### 4.8 Error Handling

- **FR-40:** All API errors must be mapped through a centralised `errorMapper.js` before being sent to the frontend. Raw provider names, account IDs, HTTP response bodies, and stack traces must never appear in client-facing messages.
- **FR-41:** The frontend error banner must display whatever clean message the backend sends, without adding its own wrapping or fallback text that could expose internals.

### 4.9 UI / UX

- **FR-42:** The application must be a single-page web app with no required login.
- **FR-43:** The UI must be responsive down to 768px viewport width.
- **FR-44:** The page title, favicon, and footer must identify the application as Raven.

---

## 5. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Security | System prompts are processed in memory only; never written to disk or a database. |
| NFR-02 | Security | Groq API key is loaded from environment variables on the backend; never exposed to the frontend or logged. |
| NFR-03 | Privacy | No scan results are retained after the HTTP response completes. |
| NFR-04 | Performance | Full 25-attack scan must complete in under 3 minutes under normal Groq latency. |
| NFR-05 | Reliability | Individual attack failures must not abort the whole scan. |
| NFR-06 | Maintainability | Adding a new attack requires only editing `attacks.json` — no code changes. |
| NFR-07 | Portability | The app must run locally with `npm install && npm start` in both `backend/` and `frontend/` directories. |
| NFR-08 | Security | The backend must include a `Retry-After` header on 429 responses from the visitor hourly limit. |
| NFR-09 | Dependency security | Both `npm audit` runs must report 0 vulnerabilities in direct/indirect dependencies (transitive ONNX runtime CVEs in the local classifier are documented as accepted risk). |

---

## 6. Out of Scope (v1)

- Live bot connection / real API key integration to a user's own bot
- User accounts or persistent scan history
- Automated remediation / prompt patch generation
- CI/CD pipeline integration or GitHub Action
- Support for models other than `openai/gpt-oss-20b` via Groq (architecture allows swapping via env var)
- Admin dashboard or aggregate telemetry

---

## 7. Assumptions & Constraints

- The operator running Raven has a valid Groq API key with sufficient credits/free-tier quota for `openai/gpt-oss-20b`.
- The backend server has internet access to reach `api.groq.com`.
- The local classifier (`Xenova/distilbert-base-uncased-mnli`) is downloaded on first server startup (~260 MB) and cached locally by `@huggingface/transformers`.
- The frontend is served by Vite dev server on port 5173 in development; in production it can be served as static files from any HTTP server.