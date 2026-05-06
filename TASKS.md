# Development Roadmap: GreenLedger AI
### Track every task here. Claude Code: check boxes off as features are completed.

---

## Phase 0: Project Scaffolding
- [ ] Create root `greenledger-ai/` folder with `frontend/`, `backend/`, `ai-engine/` subfolders
- [ ] Initialize React + Vite project in `frontend/` (`npm create vite@latest`)
- [ ] Install frontend dependencies: `react-router-dom`, `axios`, `tailwindcss`, `lucide-react`
- [ ] Initialize Node.js + Express in `backend/` (`npm init -y`)
- [ ] Install backend dependencies: `express`, `mongoose`, `dotenv`, `bcryptjs`, `jsonwebtoken`, `multer`, `@aws-sdk/client-s3`, `cors`, `axios`
- [ ] Initialize Python FastAPI in `ai-engine/` (`python -m venv venv`)
- [ ] Install Python dependencies: `fastapi`, `uvicorn`, `boto3`, `python-dotenv`, `httpx`, `pdf2image`, `Pillow`, `python-multipart`
- [ ] Create all `.env` files (from `ARCHITECTURE.md` Section 7) — add to `.gitignore`
- [ ] Setup `tailwind.config.js` and import in `index.css`

---

## Phase 1: Backend — Database Models & Auth

### Models
- [ ] Create `backend/models/Company.js` (schema in `ARCHITECTURE.md` Section 3.2)
- [ ] Create `backend/models/User.js` (schema in `ARCHITECTURE.md` Section 3.1) — include bcrypt pre-save hook for password hashing
- [ ] Create `backend/models/Document.js` (schema in `ARCHITECTURE.md` Section 3.3) — all status enums and brsrCategory enums
- [ ] Create `backend/models/KpiResult.js` (schema in `ARCHITECTURE.md` Section 3.4)

### Auth Routes
- [ ] Create `backend/middleware/authMiddleware.js` — JWT verification, attach `req.user`
- [ ] Create `backend/middleware/roleMiddleware.js` — `allowRoles('Admin')` middleware factory
- [ ] Create `POST /api/auth/register` — Admin self-register, creates User + Company documents
- [ ] Create `POST /api/auth/login` — All roles; compare bcrypt hash; return JWT containing `{ userId, role, companyId }`
- [ ] Create `POST /api/auth/create-user` — Admin only (middleware enforced); creates TeamMember or Supplier account with provided credentials; `createdBy` = Admin ID
- [ ] Create `GET /api/auth/users` — Admin only; returns all users in company (no passwords)
- [ ] Setup `backend/server.js` — connect MongoDB, mount all routes, CORS config

### Testing Phase 1
- [ ] Test register with Postman/REST client
- [ ] Test login returns valid JWT
- [ ] Test create-user blocked for non-Admin JWT
- [ ] Check off in `WORKDONETILLNOW.md`

---

## Phase 2: Backend — Document Upload & S3

- [ ] Create `backend/services/s3Service.js` — `uploadToS3(fileBuffer, key, contentType)` using `@aws-sdk/client-s3` PutObjectCommand
- [ ] Create `POST /api/documents/upload` — Auth middleware → multer (memory storage) → upload to S3 → create Document record in MongoDB with `status: 'pending'` → trigger AI engine (async, fire-and-forget)
- [ ] Create `backend/services/aiEngineService.js` — `triggerProcessing(documentId, s3Key, brsrCategory, companyId)` → POST to Python FastAPI
- [ ] Create `GET /api/documents` — Admin: returns all company docs; TeamMember/Supplier: returns only their own docs
- [ ] Create `GET /api/documents/:id/status` — Returns current status + processingLog for polling
- [ ] Create `POST /api/sync/kpi-result` — Called by Python; receives `{ documentId, extractedRawValues, calculatedKpis, status }` → updates Document + KpiResult collections
- [ ] Test upload flow end-to-end (without AI engine running)
- [ ] Check off in `WORKDONETILLNOW.md`

---

## Phase 3: Frontend — Auth Pages (No Fake Data)

### Setup
- [ ] Create `frontend/src/context/AuthContext.jsx` — stores JWT in localStorage; provides `user`, `login()`, `logout()` to all components
- [ ] Create `frontend/src/api/axiosClient.js` — axios instance with `baseURL` from env; request interceptor attaches `Authorization: Bearer <token>`
- [ ] Create `frontend/src/components/ProtectedRoute.jsx` — reads role from JWT; redirects if unauthorized

### Pages
- [ ] Build `frontend/src/pages/Home.jsx` — Static marketing page; CTAs to `/register` and `/login`; no data fetching
- [ ] Build `frontend/src/pages/Register.jsx` — Admin signup form; fields: Company Name, Admin Name, Email, Password, CIN, Industry Sector; calls `POST /api/auth/register`; redirects to `/login` on success; shows real API error messages
- [ ] Build `frontend/src/pages/Login.jsx` — Single form for all roles; calls `POST /api/auth/login`; on success stores JWT and redirects based on role (`Admin` → `/admin/dashboard`, `TeamMember` → `/team/portal`, `Supplier` → `/supplier/portal`)
- [ ] Setup `App.jsx` routes with `ProtectedRoute` wrappers per role
- [ ] Check off in `WORKDONETILLNOW.md`

---

## Phase 4: Frontend — Portals (No Fake Data)

### Shared Components
- [ ] Create `frontend/src/components/EmptyState.jsx` — reusable component for empty data states (icon + message + optional CTA)
- [ ] Create `frontend/src/components/StatusBadge.jsx` — renders colored pill for `pending` / `processing` / `verified` / `failed`
- [ ] Create `frontend/src/components/UploadWidget.jsx` — file picker with `brsrCategory` selector; calls `POST /api/documents/upload`; shows real upload progress

### Team Member Portal
- [ ] Build `frontend/src/pages/TeamPortal.jsx`
  - Fetches `GET /api/documents` (own docs only)
  - Displays table of submitted documents with `StatusBadge`
  - Shows `EmptyState` if no documents submitted yet
  - Includes `UploadWidget` to submit new documents

### Supplier Portal
- [ ] Build `frontend/src/pages/SupplierPortal.jsx`
  - Same pattern as TeamPortal but for supplier categories (energy bills, MSME certs, labor declarations)
  - Check off in `WORKDONETILLNOW.md`

---

## Phase 5: Frontend — Admin Dashboard (No Fake Data)

- [ ] Build `frontend/src/pages/AdminDashboard.jsx`
  - Fetches `GET /api/auth/users` → renders Team Members table with name, email, and document submission count
  - Fetches `GET /api/documents` → renders all documents with uploader name, category, `StatusBadge`, and upload timestamp
  - Overall completion bar (verified docs / total docs) — calculated client-side from real API data
  - Shows `EmptyState` when no users or documents exist yet
  - Navigation link to AI War Room
- [ ] Build "Create User" modal — form with name, email, password, role (TeamMember/Supplier); calls `POST /api/auth/create-user`; refreshes user list on success
- [ ] Check off in `WORKDONETILLNOW.md`

---

## Phase 6: Python AI Engine

### Core Setup
- [ ] Create `ai-engine/main.py` — FastAPI app with `/process` and `/health` endpoints
- [ ] Create `ai-engine/services/s3_fetcher.py` — `fetch_from_s3(s3_key)` → returns file bytes using boto3 GetObjectCommand
- [ ] Create `ai-engine/services/doc_converter.py` — detects file type; converts PDF pages to base64 PNG using pdf2image; passes image files directly; returns base64 string
- [ ] Create `ai-engine/prompts/extraction_prompts.py` — one minimal extraction prompt dict per `brsrCategory` (from `ARCHITECTURE.md` Section 5)
- [ ] Create `ai-engine/services/bedrock_client.py` — `extract_from_document(base64_img, brsr_category)` — calls `boto3` Bedrock runtime `invoke_model` with Claude 3 Haiku; parses response JSON; falls back to Claude 3.5 Sonnet on parse failure
- [ ] Create `ai-engine/services/kpi_calculator.py` — implement ALL formulas from `ARCHITECTURE.md` Section 6; this file is the ONLY place arithmetic happens
- [ ] Create `ai-engine/routers/process.py` — orchestrates: S3 fetch → convert → Bedrock extract → Python calculate → POST to Node.js `/api/sync/kpi-result`
- [ ] Test with a sample electricity bill PDF
- [ ] Check off in `WORKDONETILLNOW.md`

---

## Phase 7: AI War Room & Report Generation

### AI War Room
- [ ] Build `frontend/src/pages/AIWarRoom.jsx`
  - Fetches `GET /api/documents` every 5 seconds (polling) to show real-time processing queue
  - Each row: filename, category, status (with `StatusBadge`), last log message from `processingLog`
  - KPI summary cards — fetches `GET /api/report/kpis` and renders real verified KPI values
  - Shows `EmptyState` if no documents have been processed yet

### Report Generation
- [ ] Create `GET /api/report/kpis` backend route — aggregates all `verified` document KPIs from `KpiResult` collection for the company
- [ ] Create `GET /api/report/generate` backend route — compiles final BRSR JSON; only callable when all mandatory categories have a `verified` document; returns complete BRSR Core report JSON
- [ ] Add "Generate BRSR Report" button in AI War Room — disabled until all mandatory categories verified; on click calls `/api/report/generate` and displays downloadable JSON
- [ ] Check off in `WORKDONETILLNOW.md`

---

## Phase 8: Polish & Hackathon Demo Prep

- [ ] Add loading spinners on all API calls (no blank screens)
- [ ] Add toast notifications for upload success/failure
- [ ] Add logout button in all dashboards
- [ ] Test full user flow: Admin registers → creates TeamMember → TeamMember uploads electricity bill → AI processes → KPI appears on Admin dashboard → Generate Report
- [ ] Verify NO hardcoded/fake data exists anywhere in React components
- [ ] Write `WORKDONETILLNOW.md` final summary
- [ ] Prepare demo script for Cognizant hackathon judges

---

## Mandatory BRSR Categories Checklist
> Report generation is blocked until all these have a `verified` document:
- [ ] `electricity_bill` (Scope 2 GHG)
- [ ] `fuel_consumption` (Scope 1 GHG)
- [ ] `water_usage`
- [ ] `waste_records`
- [ ] `hr_wages_data` (Social KPIs)
- [ ] `accounts_payable` (Governance KPI)