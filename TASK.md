# GreenLedger AI — Hackathon "Wow Factor" Task List
### Rule: One feature at a time. Build → Test → Tick. Never break existing flow.

---

## Status Legend
- [ ] TODO
- [~] IN PROGRESS
- [x] DONE

---

## Feature 1: ESG Risk Score Gauge  ✅ DONE
**Effort:** 1–2 hours | **Type:** Pure frontend | **Impact:** Instant visual wow

### Steps
- [ ] 1a. Create `frontend/src/components/EsgScoreGauge.jsx`
       - SVG arc gauge (270° sweep), score 0–100
       - Color bands: 0–39 red, 40–69 amber, 70–100 green
       - Animated fill (CSS stroke-dashoffset transition)
       - Pillar breakdown below: Environmental / Social / Governance sub-scores
       - Deterministic weighted formula using existing kpiData fields (no new API)
       - EmptyState when kpiData is null / no verified docs yet
- [ ] 1b. Mount in `AIWarRoom.jsx`
       - Import and render above KPI cards section
       - Pass `kpiData?.kpiResult` as prop
- [ ] 1c. Verify build is clean (`npx vite build`)
- [ ] 1d. Tick this task and update WORKDONETILLNOW.md

### Scoring formula (deterministic, no LLM)
Environmental (40 pts):
  - Renewable energy % → up to 12 pts  (100% = 12, 0% = 0)
  - Waste recovery %   → up to 10 pts
  - Water recycled %   → up to 10 pts
  - GHG intensity      → up to 8 pts (lower = better; clamp at a reasonable ceiling)

Social (35 pts):
  - Female wage parity → up to 15 pts (100% = 15)
  - Wellbeing spend %  → up to 10 pts (≥5% = full marks)
  - LTIFR employees    → up to 10 pts (0 = 10, higher = fewer points)

Governance (25 pts):
  - Payable days       → up to 10 pts (≤45 days = 10)
  - Data breach %      → up to 8 pts (0% = 8)
  - Regulatory fines   → up to 7 pts (0 fines = 7)

---

## Feature 2: "Show Your Work" Audit Trail Modal  ✅ DONE
**Effort:** 2–3 hours | **Type:** Frontend modal + tiny backend route | **Impact:** Kills the hallucination objection

### Steps
- [ ] 2a. Add `GET /api/documents/:id/audit` backend route in `document.routes.js`
       - Auth middleware (any role, own docs only for non-Admin)
       - Returns: `{ originalFileName, brsrCategory, status, extractedRawValues, calculatedKpis, processingLog }`
       - No new model needed — just a lean select query on Document
- [ ] 2b. Create `frontend/src/components/AuditTrailModal.jsx`
       - 3-column pipeline view: "Document" → "AI Extracted" → "Calculated KPI"
       - Left col: filename, category, status badge, upload date
       - Middle col: key-value pairs from extractedRawValues (skip DATA_NOT_FOUND values)
       - Right col: key-value pairs from calculatedKpis with SEBI formula label
       - Bottom: processingLog timeline (timestamps + messages)
       - Close on backdrop click or Escape key
       - Shows LoadingSpinner while fetching
- [ ] 2c. Wire into AIWarRoom.jsx document table
       - Add "🔍 Audit" icon button per row (verified docs only, show for all)
       - onClick → fetch /api/documents/:id/audit → open modal
- [ ] 2d. Verify build is clean
- [ ] 2e. Tick and update WORKDONETILLNOW.md

---

## Feature 3: "Chat with your ESG Report" Widget  ✅ DONE
**Effort:** 4–6 hours | **Type:** New backend route + frontend chat UI | **Impact:** The live demo closer

### Steps
- [ ] 3a. Create `POST /api/chat/ask` backend route (new file `backend/routes/chat.routes.js`)
       - Auth middleware (Admin only)
       - Body: `{ question: string }`
       - Fetches KpiResult for company from MongoDB
       - Builds a compact context string from environmentalKpis + socialKpis + governanceKpis
       - Calls Ollama (LOCAL_MODE) or Bedrock Haiku (AWS) — reuse resolveLocalMode()
       - Ollama: POST to /api/chat with model + messages
       - Bedrock: boto3-style call via the ai-engine proxy OR direct from Node using @aws-sdk
       - Returns `{ answer: string }`
       - Mount in server.js: `app.use('/api/chat', chatRoutes)`
- [ ] 3b. Add Python proxy endpoint `POST /chat` in `ai-engine/main.py`
       - Accepts `{ question, kpi_context, local_mode }`
       - Routes to Ollama or Bedrock depending on local_mode
       - Returns `{ answer }`
       - Reuses existing ollama_client.generate_text() and bedrock_client patterns
- [ ] 3c. Create `frontend/src/components/EsgChatWidget.jsx`
       - Floating button: bottom-right, fixed position, emerald gradient
       - Click → chat panel slides up (framer-motion)
       - Message list with user bubbles (right) and AI bubbles (left, with GreenLedger icon)
       - Input bar + send button
       - Suggested starter questions rendered as clickable chips on first open:
         "How can we reduce our Scope 1 emissions?"
         "Why is our female wage parity at X%?"
         "What's our biggest ESG risk right now?"
       - Shows LoadingSpinner while waiting for response
       - POST to /api/chat/ask, display answer
- [ ] 3d. Mount in `AIWarRoom.jsx` (render outside the main layout, fixed position)
- [ ] 3e. Verify build is clean, test with Ollama running
- [ ] 3f. Tick and update WORKDONETILLNOW.md

---

## Feature 4 (Stretch): Document Provenance Tooltips
**Effort:** 1–2 hours | **Type:** Pure frontend | **Impact:** Auditability polish

### Steps
- [ ] 4a. In `AIWarRoom.jsx`, build a `categoryToDoc` map from the `documents` state
       - `{ [brsrCategory]: { originalFileName, completedAt, brsrCategory } }` for verified docs
- [ ] 4b. Wrap KpiCard with a tooltip showing "Source: [filename] · Verified [date]"
       - Use a simple CSS title tooltip or a small Tooltip component
- [ ] 4c. Tick and update WORKDONETILLNOW.md

---

## Feature 5 (Stretch): Industry Benchmarking Bands on KPI Cards
**Effort:** 1–2 hours | **Type:** Pure frontend | **Impact:** Business intelligence sizzle

### Steps
- [ ] 5a. Create `frontend/src/constants/industryBenchmarks.js`
       - Static object: SEBI sector medians for scope2 intensity, female_wage_pct, waste_recovery, etc.
- [ ] 5b. Update KpiCard in AIWarRoom to show:
       - A small bar showing user value vs. sector median
       - "Better than X% of peers" label
- [ ] 5c. Tick and update WORKDONETILLNOW.md

---

## Feature 6: Enterprise SaaS UI Overhaul  ✅ DONE
**Effort:** 2–3 hours | **Type:** className-only refactor | **Constraint:** Zero logic changes

### Steps
- [ ] 6a. Update `frontend/src/index.css` — redefine `glass-panel`, `ai-gradient-bg`, scrollbar styles
- [ ] 6b. Overhaul `AIWarRoom.jsx` — enterprise layout, tight tables, clean cards
- [ ] 6c. Overhaul `EsgScoreGauge.jsx` — clean card wrapper, professional typography
- [ ] 6d. Overhaul `AuditTrailModal.jsx` — enterprise modal shell
- [ ] 6e. Overhaul `EsgChatWidget.jsx` — clean chat panel
- [ ] 6f. `npx vite build` → 0 errors
- [ ] 6g. Tick and update WORKDONETILLNOW.md

---

## Completion Checklist
- [x] Feature 1: ESG Score Gauge
- [x] Feature 2: Audit Trail Modal
- [x] Feature 3: Chat Widget
- [ ] Feature 4: Provenance Tooltips (stretch)
- [ ] Feature 5: Benchmarking Bands (stretch)
- [x] Feature 6: Enterprise SaaS UI Overhaul
- [ ] Final: `npx vite build` clean
- [ ] Final: Backend `node server.js` starts without error
- [ ] Final: WORKDONETILLNOW.md updated
