# System Architecture: GreenLedger AI

---

## 1. Technology Stack

| Layer | Technology | Justification |
|---|---|---|
| **Frontend** | React.js (Vite), Tailwind CSS | Fast dev, responsive, component-based |
| **Backend API** | Node.js + Express.js | REST API, JWT auth, S3 orchestration |
| **Database** | MongoDB (Mongoose) | Flexible schema for extracted KPI JSON |
| **File Storage** | AWS S3 | Secure enterprise document storage |
| **AI Microservice** | Python 3.11 + FastAPI | Async processing, AWS SDK native support |
| **AI Models** | AWS Bedrock | Claude 3 Haiku (extraction) + Claude 3.5 Sonnet (complex docs) |
| **Auth** | JWT (jsonwebtoken) + bcryptjs | Stateless, role-aware tokens |
| **Image Processing** | Pillow + pdf2image (Python) | Convert scanned docs to base64 for Bedrock Vision |

---

## 2. System Architecture Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React/Vite)                    │
│  Home | Register | Login | Admin Dashboard | AI War Room        │
│  Team Portal | Supplier Portal                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │ REST API (Axios)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BACKEND (Node.js / Express)                   │
│  /auth    → Register, Login, JWT generation                     │
│  /users   → Admin creates Team/Supplier accounts                │
│  /upload  → Receives file, saves to S3, triggers AI engine      │
│  /docs    → Document status CRUD                                │
│  /report  → Compiles verified KPIs into final BRSR JSON         │
└──────────┬────────────────────────────┬────────────────────────-┘
           │ Mongoose                   │ HTTP POST to AI Engine
           ▼                            ▼
┌──────────────────┐       ┌────────────────────────────────────┐
│   MongoDB Atlas  │       │   Python AI Microservice (FastAPI) │
│                  │◄──────│                                    │
│  users           │       │  1. Receive S3 URI + doc type      │
│  documents       │       │  2. Fetch file from S3             │
│  companies       │       │  3. Convert to base64 if image/PDF │
│  kpi_results     │       │  4. Send to AWS Bedrock            │
└──────────────────┘       │  5. Parse extracted raw values     │
                           │  6. Run SEBI math (Python only)    │
           │               │  7. POST results to Node.js /sync  │
           ▼               └──────────────┬─────────────────────┘
┌──────────────────┐                      │
│     AWS S3       │◄─────────────────────┘
│  Raw documents   │        AWS Bedrock API (boto3)
│  (PDF/images)    │        ┌─────────────────────────┐
└──────────────────┘        │  Claude 3 Haiku          │
                            │  (fast, cheap extraction)│
                            │  Claude 3.5 Sonnet       │
                            │  (complex mapping)       │
                            └─────────────────────────┘
```

---

## 3. MongoDB Schema Definitions

### 3.1 Users Collection
```javascript
{
  _id: ObjectId,
  email: String (unique, required),
  password: String (bcrypt hashed),
  role: Enum ['Admin', 'TeamMember', 'Supplier'],
  fullName: String,
  companyId: ObjectId (ref: 'Company'),
  createdBy: ObjectId (ref: 'User'),  // null for Admin self-register
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```

### 3.2 Companies Collection
```javascript
{
  _id: ObjectId,
  companyName: String,
  CIN: String (unique),  // Corporate Identity Number
  industrySector: String,
  adminId: ObjectId (ref: 'User'),
  financialYear: String,  // e.g., "2024-25"
  createdAt: Date
}
```

### 3.3 Documents Collection
```javascript
{
  _id: ObjectId,
  s3Key: String,
  s3Url: String,
  originalFileName: String,
  fileType: Enum ['pdf', 'image', 'excel', 'word'],
  uploadedBy: ObjectId (ref: 'User'),
  companyId: ObjectId (ref: 'Company'),
  brsrCategory: Enum [
    'electricity_bill',
    'fuel_consumption',
    'water_usage',
    'waste_records',
    'hr_wages_data',
    'supplier_msme_cert',
    'posh_records',
    'governance_report',
    'accounts_payable',
    'cyber_security_log'
  ],
  status: Enum ['pending', 'processing', 'verified', 'failed'],
  extractedRawValues: Object,   // Raw values pulled by LLM
  calculatedKpis: Object,       // Final SEBI math results
  processingLog: [{ timestamp: Date, message: String }],
  createdAt: Date,
  updatedAt: Date
}
```

### 3.4 KPI Results Collection
```javascript
{
  _id: ObjectId,
  companyId: ObjectId (ref: 'Company'),
  financialYear: String,
  reportStatus: Enum ['in_progress', 'complete'],
  environmentalKpis: {
    scope1_tco2e: Number,
    scope2_tco2e: Number,
    ghg_intensity_ppp: Number,
    total_energy_kwh: Number,
    renewable_energy_pct: Number,
    total_water_kl: Number,
    water_intensity: Number,
    water_recycled_pct: Number,
    total_waste_mt: Number,
    waste_intensity: Number,
    waste_recovered_pct: Number
  },
  socialKpis: {
    wellbeing_spend_pct_revenue: Number,
    female_wage_pct: Number,
    small_town_wage_pct: Number,
    msme_procurement_pct: Number,
    posh_complaints_count: Number
  },
  governanceKpis: {
    data_breach_pct_incidents: Number,
    accounts_payable_days: Number,
    related_party_purchase_pct: Number,
    related_party_sales_pct: Number
  },
  generatedAt: Date,
  auditTrail: [{ action: String, timestamp: Date, triggeredBy: ObjectId }]
}
```

---

## 4. API Endpoints (Node.js / Express)

### Auth Routes (`/api/auth`)
```
POST /api/auth/register          → Admin self-registration
POST /api/auth/login             → All roles; returns JWT with role
POST /api/auth/create-user       → Admin only; creates Team/Supplier accounts
GET  /api/auth/users             → Admin only; list all company users
```

### Document Routes (`/api/documents`)
```
POST /api/documents/upload       → Authenticated; upload file to S3 + create DB record
GET  /api/documents              → Admin: all docs; Team/Supplier: own docs only
GET  /api/documents/:id/status   → Polling endpoint for processing status
```

### AI Sync Route (`/api/sync`)
```
POST /api/sync/kpi-result        → Called by Python microservice after processing
                                   Updates Document status + KPI Results collection
```

### Report Routes (`/api/report`)
```
GET  /api/report/generate        → Admin only; compiles all verified KPIs → BRSR JSON
GET  /api/report/kpis            → Admin only; returns current KPI summary for dashboard
```

---

## 5. Python AI Engine (FastAPI)

### Endpoints
```
POST /process                    → Receives { s3_key, document_id, brsr_category, company_id }
GET  /health                     → Health check
```

### Processing Pipeline (per document)
```
1. Fetch document from S3 using boto3
2. Detect file type (PDF, image, Excel)
3. If PDF/image → convert to base64 PNG using pdf2image + Pillow
4. Construct minimal token extraction prompt (see prompt templates below)
5. Send to AWS Bedrock (Claude 3 Haiku) with base64 image payload
6. Parse response JSON → extract raw numeric values only
7. Pass raw values to deterministic Python calculator module
8. POST calculated KPIs to Node.js /api/sync/kpi-result
9. Log all steps with timestamps
```

### Prompt Engineering Strategy (Minimal Tokens)
```python
EXTRACTION_PROMPTS = {
    "electricity_bill": """
        Extract ONLY these values from this document as JSON:
        { "kwh_consumed": number, "billing_period_months": number, "state": string }
        Return ONLY the JSON object. No explanation.
    """,
    "water_usage": """
        Extract ONLY: { "kiloliters_consumed": number, "recycled_kl": number, "period_months": number }
        Return ONLY the JSON object. No explanation.
    """,
    "hr_wages_data": """
        Extract ONLY: { "total_wages": number, "female_wages": number,
        "small_town_wages": number, "total_employees": number, "female_employees": number }
        Return ONLY the JSON object. No explanation.
    """
    # ... one prompt template per brsr_category
}
```

---

## 6. SEBI BRSR Core — Deterministic Python Math Module

> ⚠️ These are the ONLY formulas used. The AI never calculates. Python always calculates.

### 6.1 Environmental KPIs

```python
# GHG GRID EMISSION FACTORS (CEA India, tCO2e per MWh)
GRID_EMISSION_FACTORS = {
    "Northern": 0.708, "Southern": 0.906, "Eastern": 1.004,
    "Western": 0.830, "Northeastern": 0.532, "default": 0.820
}

def calc_scope2_emissions(kwh: float, state: str) -> float:
    """Scope 2 GHG = kWh consumed × Grid Emission Factor (tCO2e)"""
    factor = GRID_EMISSION_FACTORS.get(get_grid_region(state), GRID_EMISSION_FACTORS["default"])
    return round((kwh / 1000) * factor, 4)  # Convert kWh to MWh first

def calc_ghg_intensity_ppp(scope1: float, scope2: float, revenue_inr: float) -> float:
    """
    SEBI BRSR Core Formula:
    GHG Intensity = (Scope 1 + Scope 2) tCO2e / Revenue (INR Crore, PPP-adjusted)
    PPP Conversion Factor India 2024: 1 USD = ~23.5 PPP INR (IMF data)
    """
    PPP_FACTOR = 23.5
    revenue_ppp_crore = (revenue_inr / PPP_FACTOR) / 1e7  # Convert to PPP Crore
    return round((scope1 + scope2) / revenue_ppp_crore, 6)

def calc_renewable_energy_pct(renewable_kwh: float, total_kwh: float) -> float:
    """% Energy from Renewable Sources"""
    if total_kwh == 0: return 0.0
    return round((renewable_kwh / total_kwh) * 100, 2)

def calc_water_intensity(total_kl: float, revenue_inr_crore: float) -> float:
    """Water Intensity = Total Water (KL) / Revenue (INR Crore)"""
    if revenue_inr_crore == 0: return 0.0
    return round(total_kl / revenue_inr_crore, 4)

def calc_water_recycled_pct(recycled_kl: float, total_kl: float) -> float:
    """% Water Recovered/Recycled"""
    if total_kl == 0: return 0.0
    return round((recycled_kl / total_kl) * 100, 2)

def calc_waste_intensity(total_waste_mt: float, revenue_inr_crore: float) -> float:
    """Waste Intensity = Total Waste (MT) / Revenue (INR Crore)"""
    if revenue_inr_crore == 0: return 0.0
    return round(total_waste_mt / revenue_inr_crore, 4)

def calc_waste_recovered_pct(recovered_mt: float, total_mt: float) -> float:
    """% Waste Recovered (recycled + reused + other recovery)"""
    if total_mt == 0: return 0.0
    return round((recovered_mt / total_mt) * 100, 2)
```

### 6.2 Social KPIs

```python
def calc_wellbeing_spend_pct(wellbeing_spend_inr: float, total_revenue_inr: float) -> float:
    """
    SEBI BRSR: Employee Well-being Spend %
    = (Health Insurance + Accident Insurance + Maternity/Paternity + Daycare) / Total Revenue × 100
    """
    if total_revenue_inr == 0: return 0.0
    return round((wellbeing_spend_inr / total_revenue_inr) * 100, 4)

def calc_female_wage_pct(female_wages: float, total_wages: float) -> float:
    """SEBI BRSR: Gender Pay Equity = Female Wages / Total Wages × 100"""
    if total_wages == 0: return 0.0
    return round((female_wages / total_wages) * 100, 2)

def calc_small_town_wage_pct(small_town_wages: float, total_wages: float) -> float:
    """SEBI BRSR: Inclusive Development = Wages in Smaller Towns / Total Wages × 100"""
    if total_wages == 0: return 0.0
    return round((small_town_wages / total_wages) * 100, 2)

def calc_msme_procurement_pct(msme_spend: float, total_purchases: float) -> float:
    """SEBI BRSR: Supplier Fairness = MSME/Small Producer Spend / Total Purchases × 100"""
    if total_purchases == 0: return 0.0
    return round((msme_spend / total_purchases) * 100, 2)
```

### 6.3 Governance KPIs

```python
def calc_data_breach_pct(breach_incidents: int, total_cyber_events: int) -> float:
    """SEBI BRSR: Data Security = Breach Incidents / Total Cyber Events × 100"""
    if total_cyber_events == 0: return 0.0
    return round((breach_incidents / total_cyber_events) * 100, 2)

def calc_accounts_payable_days(accounts_payable: float, cogs: float) -> float:
    """
    SEBI BRSR: Financial Fairness
    Days Payable Outstanding (DPO) = Accounts Payable / (COGS / 365)
    """
    if cogs == 0: return 0.0
    return round(accounts_payable / (cogs / 365), 1)

def calc_related_party_pct(related_party_amount: float, total_amount: float) -> float:
    """Concentration of Related Party Transactions %"""
    if total_amount == 0: return 0.0
    return round((related_party_amount / total_amount) * 100, 2)
```

---

## 7. Environment Variables

### Node.js Backend (`.env`)
```
PORT=5000
MONGO_URI=mongodb+srv://...
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=greenledger-documents
AI_ENGINE_URL=http://localhost:8000
```

### Python AI Engine (`.env`)
```
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=greenledger-documents
BEDROCK_MODEL_HAIKU=anthropic.claude-3-haiku-20240307-v1:0
BEDROCK_MODEL_SONNET=anthropic.claude-3-5-sonnet-20241022-v2:0
NODE_BACKEND_URL=http://localhost:5000
```

---

## 8. Folder Structure

```
greenledger-ai/
├── frontend/                    # React + Vite
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── AIWarRoom.jsx
│   │   │   ├── TeamPortal.jsx
│   │   │   └── SupplierPortal.jsx
│   │   ├── components/
│   │   │   ├── ProtectedRoute.jsx
│   │   │   ├── DocumentTable.jsx
│   │   │   ├── KPICard.jsx
│   │   │   ├── UploadWidget.jsx
│   │   │   └── EmptyState.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   └── api/
│   │       └── axiosClient.js
│   └── package.json
│
├── backend/                     # Node.js + Express
│   ├── models/
│   │   ├── User.js
│   │   ├── Company.js
│   │   ├── Document.js
│   │   └── KpiResult.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── document.routes.js
│   │   ├── sync.routes.js
│   │   └── report.routes.js
│   ├── middleware/
│   │   ├── authMiddleware.js    # JWT verification
│   │   └── roleMiddleware.js    # RBAC enforcement
│   ├── services/
│   │   ├── s3Service.js
│   │   └── aiEngineService.js
│   └── server.js
│
├── ai-engine/                   # Python + FastAPI
│   ├── main.py                  # FastAPI app entry point
│   ├── routers/
│   │   └── process.py
│   ├── services/
│   │   ├── bedrock_client.py    # AWS Bedrock boto3 wrapper
│   │   ├── s3_fetcher.py        # Fetch docs from S3
│   │   ├── doc_converter.py     # PDF/image → base64
│   │   └── kpi_calculator.py   # All SEBI math (ONLY place math happens)
│   ├── prompts/
│   │   └── extraction_prompts.py
│   └── requirements.txt
│
├── PRD.md
├── ARCHITECTURE.md
├── TASKS.md
├── CLAUDE.md
└── WORKDONETILLNOW.md
```