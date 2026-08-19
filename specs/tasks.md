# Raven — Implementation Task List

**Version:** 1.0  
**Date:** 2026-08-15

Tasks are ordered by dependency. Each task references the relevant requirements (FR/NFR) and design sections.

---

## Phase 1 — Backend Foundation (Days 1–2)

### Task 1: Project scaffolding
- [ ] Init `backend/` Node project (`npm init`)
- [ ] Install dependencies: `express`, `@aws-sdk/client-bedrock-runtime`, `dotenv`, `cors`, `express-rate-limit`
- [ ] Create `backend/.env.example` with `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `PORT`
- [ ] Create `backend/src/server.js` with Express app, CORS, rate-limit, and health check route
- **Refs:** NFR-02, NFR-07, Design §3

### Task 2: Bedrock service
- [ ] Create `backend/src/services/bedrock.js`
- [ ] Wrap `BedrockRuntimeClient` + `InvokeModelCommand` for Claude 3 Haiku
- [ ] Add 15-second timeout via `AbortController`
- [ ] Add retry logic (2 retries, exponential back-off) on throttling
- **Refs:** FR-06, FR-09, FR-10, Design §3.2

### Task 3: Attack library
- [ ] Create `backend/src/data/attacks.json` with all 22 attacks
- [ ] Validate schema: every entry has `id`, `name`, `category`, `owasp_ref`, `severity`, `payload`, `detection_type`, `detection_value`, `remediation_hint`
- **Refs:** FR-11, FR-12, FR-13, Design §4

### Task 4: Detection logic
- [ ] Create `backend/src/detection/detectors.js`
- [ ] Implement `keyword_match`, `keyword_absent`, `regex_match`, `refusal_absent`, `prompt_leak` detectors
- [ ] Each detector returns `{ verdict: 'pass'|'fail', explanation: string }`
- **Refs:** FR-14, Design §3.4

### Task 5: Scanner service
- [ ] Create `backend/src/services/scanner.js`
- [ ] Load attack library, iterate attacks, call Bedrock, run detector, accumulate results
- [ ] Implement risk scoring (FR-16)
- [ ] Ensure individual attack errors don't abort scan (NFR-05)
- **Refs:** FR-07, FR-08, FR-15, FR-16, Design §3.3

### Task 6: Scan API route
- [ ] Create `backend/src/routes/scan.js`
- [ ] `POST /api/scan` — validate input, call scanner, return structured response
- [ ] Input validation: required, string, max 8000 chars
- [ ] Error handling: 400, 503, 500 responses
- **Refs:** FR-01, FR-05, Design §3.1

---

## Phase 2 — Frontend (Days 5–9)

### Task 7: Frontend scaffold
- [ ] Init `frontend/` Vite + React project
- [ ] Install only: `vite`, `react`, `react-dom`
- [ ] Configure `vite.config.js` proxy: `/api` → `http://localhost:3001`
- [ ] Create base CSS with dark theme, CSS variables for colours
- **Refs:** FR-21, FR-23, Design §5.3

### Task 8: PromptInput component
- [ ] Textarea, character counter, warning at 7000 / error at 8000
- [ ] Clear button
- [ ] Controlled component tied to App state
- **Refs:** FR-01, FR-02, FR-03

### Task 9: useScan hook
- [ ] State: `status`, `progress`, `results`, `error`
- [ ] `startScan(systemPrompt)` — calls `POST /api/scan`, handles loading/error states
- [ ] Polling / streaming not required in v1 (single blocking request)
- **Refs:** FR-05, Design §5.2

### Task 10: ScanButton + ProgressBar
- [ ] Disable ScanButton while scanning
- [ ] ProgressBar shows "Scanning…" with spinner (actual per-attack progress is a v2 feature requiring SSE)
- **Refs:** FR-05, FR-22

### Task 11: ResultsDashboard
- [ ] RiskBadge (colour-coded)
- [ ] SummaryStats (total / passed / failed / errored counts)
- [ ] CategorySection — group AttackCards by OWASP category
- [ ] AttackCard — name, verdict badge, explanation, remediation hint, collapsible model response
- **Refs:** FR-15, FR-17, FR-18, Design §5.1

### Task 12: ExportButtons
- [ ] "Export JSON" — downloads full scan object as `.json`
- [ ] "Export Report" — downloads plain-text summary as `.txt`
- [ ] Both use `URL.createObjectURL` / `<a download>` pattern
- **Refs:** FR-19, FR-20, Design §7

---

## Phase 3 — Integration & Polish (Days 10–13)

### Task 13: End-to-end integration
- [ ] Run full scan with a real system prompt against live Bedrock
- [ ] Verify all 22 attacks fire and results render correctly
- [ ] Check edge cases: empty prompt, 8001-char prompt, Bedrock timeout

### Task 14: Error handling polish
- [ ] Frontend displays friendly error messages on API failure
- [ ] Backend logs errors with context (no sensitive data in logs)

### Task 15: Responsive layout
- [ ] Test at 768px, 1024px, 1440px
- [ ] Attack grid collapses to single column on mobile

### Task 16: Security review
- [ ] Confirm no prompt written to logs or disk
- [ ] Confirm AWS credentials not in frontend bundle
- [ ] Confirm rate limiting works (`express-rate-limit`)
- [ ] Run `npm audit` on both packages

---

## Phase 4 — Demo Prep (Days 14–15)

### Task 17: Sample prompts
- [ ] Add 3 example system prompts (weak, medium, strong) to the UI as "Load example" buttons
- [ ] These demonstrate Low, High, and Critical risk scores for demo purposes

### Task 18: Final polish
- [ ] Favicon, page title, meta description
- [ ] Smooth scroll to results after scan completes
- [ ] Copy-to-clipboard on attack payloads
- [ ] README with setup instructions
