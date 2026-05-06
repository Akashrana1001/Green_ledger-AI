# Product Requirements Document (PRD): GreenLedger AI
### Cognizant Hackathon Submission | SEBI BRSR Compliance Platform

---

## 1. Problem Statement

Every year, India's top 1,000 listed companies (by market cap) are **legally mandated by SEBI** to submit a Business Responsibility and Sustainability Report (BRSR). This report spans 9 ESG principles, covers 46+ quantifiable KPIs across Environmental, Social, and Governance domains, and requires mathematically validated figures that external assurance providers (Big 4 auditors) must certify.

**The current reality is broken:**

- ESG data lives in silos — utility bills in PDF, HR data in Excel, supplier invoices in scanned images, and governance data in Word documents across 5–15 departments.
- Manual consolidation by Big 4 consultants (Deloitte, EY, KPMG, PwC) costs ₹40–80 lakhs per company per year.
- No existing tool handles **unstructured data natively** (scanned PDFs, utility bill images, mixed-language documents).
- Calculations like GHG Intensity (PPP-adjusted), POSH incident ratios, MSME procurement percentages, and Water Circularity are done manually in Excel — creating massive audit risk.
- The **BRSR Core** (introduced SEBI 2023) has added ~46 mandatory KPIs with third-party assurance requirements that most companies are not ready for.

**The result:** Companies either miss deadlines, submit inaccurate data, or burn crores on consulting fees — every single year.

---

## 2. Market Opportunity & Size

| Segment | Detail | Size |
|---|---|---|
| Primary Market | Top 1,000 SEBI-listed companies (BRSR mandatory) | ₹800 Cr+ / year |
| Secondary Market | Supply chain / Value Chain reporting (10x–50x multiplier) | ₹4,000–40,000 Cr |
| Global ESG Software Market | Projected by 2028 | $2.5B+ |
| Big 4 ESG Consulting India | Annual fees being disrupted | ₹2,000–3,000 Cr |
| Regulatory Expansion | SEBI expanding BRSR Core to more companies annually | Growing 40% YoY |

**India-specific trigger:** SEBI Circular SEBI/HO/CFD/CFD-SEC-2/P/CIR/2023/122 mandates BRSR Core with reasonable assurance — creating urgent, non-deferrable demand.

---

## 3. Existing Solutions & Their Flaws

| Solution | What They Do | Critical Flaw |
|---|---|---|
| IBM Envizi | Large enterprise ESG platform | Requires structured manual data entry; no AI document reading; costs $200K+ per implementation |
| Workiva | Reporting & compliance platform | No native AI; form-fill approach; not India BRSR-specific |
| Salesforce Net Zero Cloud | ESG data management | Tied to Salesforce CRM; no unstructured doc ingestion; expensive |
| Sweep, Persefoni | Carbon accounting tools | Scope 1/2/3 only; does not cover BRSR Social/Governance pillars |
| Manual + Excel | Current Indian market reality | Human error, no audit trail, 3–6 months effort, ₹40–80L cost |

**None of the above can:** Ingest a scanned electricity bill image, extract kWh, apply the correct GHG grid emission factor, calculate tCO₂e, and map it to BRSR Principal 6 Essential Indicator — automatically.

---

## 4. Our Solution: GreenLedger AI

GreenLedger AI is an **AI-first, BRSR-native compliance engine** that:

1. **Ingests** raw, unstructured documents (PDFs, scanned images, Excel dumps) from multiple departments and suppliers via a secure role-based portal.
2. **Extracts** structured metrics using AWS Bedrock (Claude 3 Haiku for cost-efficient extraction; Claude 3.5 Sonnet for complex document mapping).
3. **Calculates** all 46+ BRSR Core KPIs using deterministic Python math — the AI extracts numbers, Python calculates, never the reverse.
4. **Validates** outputs against SEBI-approved formulas with full audit trails.
5. **Generates** a final BRSR-compliant JSON report ready for submission and assurance provider review.

---
## 5. Uniqueness Score: 9.2 / 10
| Dimension | Score | Reasoning |
|---|---|---|
| Technical Moat | 9/10 | AWS Bedrock + deterministic Python math combo is rare |
| Market Specificity | 10/10 | Explicitly built for SEBI BRSR Core — no competitor does this |
| AI Approach | 9/10 | Unstructured doc → structured KPI extraction at minimal token cost |
| Regulatory Accuracy | 9/10 | PPP-adjusted intensity, BRSR Core formulas, audit trail |
| Scalability | 9/10 | Microservice architecture; supplier portal scales to thousands |
---


## 6. Core Features & RBAC (Role-Based Access Control)
### Admin
- Self-register via dedicated Admin Signup page
- Create login credentials for Team Members and Suppliers (they **cannot** self-register)
- Access the Master Dashboard — view all submitted/pending documents across all roles
- Monitor the AI War Room — see processing status of each document
- Trigger "Generate Report" to compile verified KPIs into a final BRSR report
- View company-wide ESG KPI progress

### Team Members
- Cannot self-register. Admin creates their account and shares credentials.
- Log in via unified Login page
- View only their assigned document upload tasks
- Upload internal corporate documents (electricity bills, HR data, governance logs, environmental records)
- View upload/processing status

### Suppliers
- Cannot self-register. Admin creates their account and shares credentials.
- Log in via unified Login page
- Upload Value Chain documents (energy bills, labor declarations, MSME certificates, water usage logs)
- View upload status only

### AI Engine (Automated, no human login)
- Triggered by Node.js backend upon document upload
- Processes documents via AWS Bedrock
- Extracts raw values and maps to BRSR KPI schema
- Python calculates all formulas deterministically
- Returns structured verified JSON to MongoDB

---

## 7. Pages & UI Requirements

### 7.1 Home Page (`/`)
- Marketing landing page explaining the product
- CTAs: "Admin Sign Up" and "Login"
- No fake data. Static content only.

### 7.2 Admin Register Page (`/register`)
- Only accessible to Admins
- Fields: Company Name, Admin Name, Email, Password, CIN (Corporate Identity Number), Industry Sector
- On success: redirects to Login

### 7.3 Unified Login Page (`/login`)
- Single login form for Admin, Team Members, and Suppliers
- Role detection based on JWT payload
- Redirects to role-specific dashboard post-login

### 7.4 Admin Dashboard (`/admin/dashboard`)
- Table of all Team Members with their assigned document categories and submission status (Submitted / Pending)
- Table of all Suppliers with upload status
- Overall document completion percentage (real data from DB only)
- Navigation to AI War Room

### 7.5 AI War Room (`/admin/ai-engine`)
- Live processing queue — shows each document with status: `pending` → `processing` → `verified` / `failed`
- Button: **"Generate BRSR Report"** — only active when all mandatory documents are in `verified` state
- Displays extracted KPI summary cards (real data from DB only)

### 7.6 Team Member Portal (`/team/portal`)
- View assigned document upload categories
- Upload interface for internal documents
- View upload and processing status

### 7.7 Supplier Portal (`/supplier/portal`)
- Upload interface for value chain documents
- View processing status

---

## 8. Non-Negotiable Constraints

1. **NO FAKE DATA:** No hardcoded arrays, mock objects, or placeholder data in React components. All UI renders from live API calls. Empty states must show a proper empty-state UI component.
2. **AWS Bedrock Mandatory:** All AI inference must use AWS Bedrock via `boto3`. No OpenAI, no Gemini, no direct Anthropic API calls.
3. **Math is Deterministic:** Python calculates all BRSR formulas. The LLM only extracts raw values from documents.
4. **RBAC Strict Enforcement:** Team Members and Suppliers cannot access Admin routes under any circumstance.
5. **Audit Trail:** Every extraction, calculation, and report generation must be logged with timestamps in MongoDB.
6. **Token Efficiency:** All Bedrock prompts must be engineered for minimal token consumption (extract only, no summarizing).

---

## 9. Success Metrics (Hackathon Demo)

- Successfully ingest a sample electricity bill PDF → extract kWh → calculate tCO₂e → display on dashboard
- Admin can create a Team Member account → Team Member logs in → uploads a document
- AI War Room shows real-time processing status
- "Generate Report" produces a valid BRSR Core JSON output with at least 5 KPIs populated