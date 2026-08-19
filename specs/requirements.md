# Raven — Requirements Specification

**Version:** 1.0  
**Date:** 2026-08-15  
**Status:** Approved

---

## 1. Overview

Raven is a web-based AI system prompt vulnerability scanner. It lets chatbot builders paste their system prompt and immediately discover whether it is susceptible to prompt injection, jailbreaks, or information-leakage attacks — without needing API access to their live bot or any external credentials on the user's side.

---

## 2. Problem Statement

Chatbot builders using wrapper platforms (Voiceflow, Botpress, Custom GPTs, Bedrock Agents, LangChain, etc.) only control the system prompt. They have no straightforward way to test whether that prompt is exploitable before going live. Raven fills that gap by spinning up a sandboxed test model, injecting the user's system prompt, and systematically firing a library of known attack patterns against it.

---

## 3. Users & Roles

| Role | Description |
|------|-------------|
| **Scanner** | Primary user — a chatbot builder or security-conscious developer who pastes their system prompt and runs a scan. No account required for basic use. |
| **Admin** (future) | Manages the attack library, views aggregate scan telemetry. Out of scope for v1. |

---

## 4. Functional Requirements

### 4.1 System Prompt Input

- FR-01: The user must be able to paste a system prompt (plain text, up to 8,000 characters) into a textarea on the main page.
- FR-02: The UI must show a character count and warn at 7,000 / error at 8,000 characters.
- FR-03: The user can clear the textarea at any time before or after a scan.
- FR-04: The system prompt must never be stored server-side beyond the duration of a single scan request.

### 4.2 Scan Execution

- FR-05: A "Run Scan" button initiates the scan. It must be disabled while a scan is already in progress.
- FR-06: The backend must load the user-provided system prompt into a sandboxed Claude model via Amazon Bedrock.
- FR-07: The backend must execute every attack in the active attack library sequentially (parallel execution is a v2 optimisation).
- FR-08: For each attack, the backend must record: attack name, category, payload sent, model response, and pass/fail verdict using the attack's detection logic.
- FR-09: The scan must complete within 120 seconds; individual attack calls must time out at 15 seconds.
- FR-10: If Bedrock returns a throttling or service error, the backend must retry up to 2 times with exponential back-off before marking that attack as "error".

### 4.3 Attack Library

- FR-11: Attacks must be stored as a JSON file so they can be expanded without code changes.
- FR-12: Each attack entry must contain: `id`, `name`, `category`, `owasp_ref`, `payload`, `detection_type`, `detection_value`, and `remediation_hint`.
- FR-13: The initial library must cover at least 20 attacks spanning the five OWASP LLM Top 10 categories listed in the brief.
- FR-14: Detection logic must support at minimum three types: `keyword_match` (response contains a keyword), `regex_match`, and `refusal_absent` (model did NOT refuse the request).

### 4.4 Results & Reporting

- FR-15: After a scan, the UI must display an overall risk score: **Low / Medium / High / Critical**.
- FR-16: Risk scoring rules:
  - 0 successful attacks → Low
  - 1–2 successful attacks → Medium
  - 3–5 successful attacks → High
  - 6+ successful attacks → Critical
- FR-17: The results dashboard must list every attack, grouped by category, showing: attack name, verdict (Pass / Fail / Error), a plain-language explanation, and a suggested fix.
- FR-18: Failed attacks (vulnerabilities found) must be visually distinct from passed attacks.
- FR-19: The user must be able to export the full report as a JSON file.
- FR-20: The user must be able to export a human-readable summary as a plain-text file.

### 4.5 UI / UX

- FR-21: The application must be a single-page web app with no required login.
- FR-22: A progress indicator must show scan status (e.g., "Running attack 4 of 22…").
- FR-23: The UI must be responsive down to 768 px viewport width.
- FR-24: The page must be usable without JavaScript disabled (graceful degradation not required; full JS requirement is acceptable).

---

## 5. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Security | System prompts are processed in memory only; never written to disk or a database. |
| NFR-02 | Security | All Bedrock credentials are loaded from environment variables; never exposed to the frontend. |
| NFR-03 | Privacy | No scan results are retained after the HTTP response is sent. |
| NFR-04 | Performance | Scan of 20 attacks must complete in under 60 seconds under normal Bedrock latency. |
| NFR-05 | Reliability | Individual attack failures must not abort the whole scan. |
| NFR-06 | Maintainability | Adding a new attack requires only editing the JSON attack library — no code changes. |
| NFR-07 | Portability | The app must run locally with `npm install && npm start` in both backend and frontend directories. |

---

## 6. Out of Scope (v1)

- Live bot connection / API key integration
- User accounts or persistent scan history
- Automated remediation / patch generation
- Parallel attack execution
- CI/CD pipeline integration
- Support for models other than Claude via Bedrock (architecture allows it in v2)

---

## 7. Assumptions & Constraints

- The operator running Raven has valid AWS credentials with `bedrock:InvokeModel` permission for `anthropic.claude-3-haiku-20240307-v1:0`.
- AWS region is configurable via environment variable (default: `us-east-1`).
- The frontend is served as static files by the backend's Express server in production; in development both run independently on different ports.
