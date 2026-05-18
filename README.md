# GreenLedger AI

**Replaced a ₹40–80L/year Big-4 BRSR consulting workflow with a fully automated AI pipeline.**

Top 10 Finalist at Cognizant Technoverse 2026 among 5,600+ teams across India.

> 🎥 **[Watch 60-sec Demo →](#)** ← add your Loom link here

---

## The Problem

Every listed Indian company must file a BRSR Core report with SEBI annually. The current workflow: hire a Big-4 consultant, pay ₹40–80L, wait months, get a PDF.

The consultant manually reads utility bills, invoices, and scanned documents, then fills in 46+ KPIs by hand. It is slow, expensive, and error-prone.

---

## The Solution

GreenLedger ingests raw corporate documents — utility bills, scanned invoices, ESG data files — and produces a legally audit-grade BRSR Core report automatically.

**AWS Bedrock (Claude) reads unstructured documents and extracts only raw values. Deterministic Python then computes all 46+ SEBI KPIs.** The LLM never touches the math. Every output has a full timestamped audit trail.

---

## Architecture

```
React (Vite) ──► Node.js / Express ──► Python FastAPI ──► AWS Bedrock (Claude)
                       │                      │
                       ├── MongoDB Atlas       ├── AWS S3 (documents)
                       └── Redis / BullMQ      └── AWS SNS (compliance alerts)
```

---

## Key Engineering Decisions

**Strict LLM / math separation** — Claude extracts raw values only. Python owns all calculations. This makes every output legally defensible and reproducible.

**Async document queue** — BullMQ processes heavy document ingestion jobs in the background. The main server stays non-blocking under concurrent load.

**RBAC portal** — Three roles: Admin, Team Member, Supplier. Each sees only what they need.

**Real-time AI War Room** — Live processing status streamed to the frontend via Redis Pub/Sub and WebSockets.

**Context-aware ESG chat widget** — Ask questions about your own BRSR data in natural language.

---

## KPIs Computed

| Category | Metrics |
|---|---|
| Environmental | Scope 1/2/3 GHG, energy intensity, water intensity, waste recovery %, renewable energy % |
| Social | Wellbeing spend %, female wage parity, MSME procurement %, POSH complaints, LTIFR |
| Governance | DPO, data breach incidents %, related-party transactions % |

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Node.js, Express, BullMQ, JWT |
| AI Engine | Python FastAPI, boto3, PyMuPDF |
| Models | AWS Bedrock — Claude Haiku 4.5 + Sonnet 4.5 |
| Database | MongoDB Atlas |
| Queue | BullMQ on Redis Cloud |
| Storage | AWS S3 |
| Alerts | AWS SNS |

---

## Local Setup

```bash
# Backend
cd backend && npm install && cp .env.example .env && npm run dev

# AI Engine
cd ai-engine && python -m venv venv
source venv/bin/activate && pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev
```

---

## What I Can Build For You

If you need a document ingestion pipeline, an LLM system with audit-grade outputs, or a multi-service AI backend — [let's talk](mailto:sandeepakash537@gmail.com).
