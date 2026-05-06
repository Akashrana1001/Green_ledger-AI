# GreenLedger AI

AI-first **SEBI BRSR compliance platform** that ingests unstructured corporate documents, extracts ESG metrics with AWS Bedrock (Claude), and produces mathematically validated BRSR Core reports.

Built for the Cognizant Hackathon.

---

## Architecture

```
React (Vite) ──► Node.js / Express ──► Python FastAPI ──► AWS Bedrock
   Amplify         EC2 :5000              EC2 :8000        Claude 4.5 Haiku/Sonnet
                       │                      │
                       ├─► MongoDB Atlas      ├─► AWS S3 (documents)
                       └─► Redis Cloud         └─► AWS SNS (compliance alerts)
                            (BullMQ queue)
```

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router, Framer Motion |
| Backend | Node.js 20, Express, Mongoose, JWT, BullMQ |
| AI Engine | Python 3.11, FastAPI, boto3, PyMuPDF, Pillow |
| Database | MongoDB Atlas |
| Queue | BullMQ on Redis Cloud |
| Storage | AWS S3 |
| AI Models | AWS Bedrock — Claude Haiku 4.5 (extraction) + Sonnet 4.5 (complex docs) |
| Alerts | AWS SNS (email/SMS to admins on threshold breach) |

## Repo layout

```
greenledger-ai/
├── frontend/      # Vite + React (deploys to AWS Amplify)
├── backend/       # Node.js + Express (deploys to EC2 :5000 via PM2)
├── ai-engine/     # FastAPI + boto3 (deploys to EC2 :8000 via PM2, internal-only)
└── deploy/        # Production deployment artifacts (PM2, healthcheck, .env templates)
```

## Local development

```bash
# Backend
cd greenledger-ai/backend && npm install && cp .env.example .env && npm run dev

# AI engine
cd greenledger-ai/ai-engine && python -m venv venv
source venv/bin/activate && pip install -r requirements.txt
cp .env.example .env && uvicorn main:app --reload --port 8000

# Frontend
cd greenledger-ai/frontend && npm install && npm run dev
```

## Production deployment

See **[`greenledger-ai/deploy/DEPLOY.md`](greenledger-ai/deploy/DEPLOY.md)** for the full 10-step runbook (EC2 + Amplify + Redis Cloud, ~30 min).

## Core SEBI BRSR KPIs

The AI engine extracts raw values, then `kpi_calculator.py` deterministically computes:

- **Environmental** — Scope 1/2/3 GHG, energy intensity, water intensity, waste recovery %, renewable energy %
- **Social** — wellbeing spend %, female wage parity, MSME procurement %, POSH complaints, LTIFR
- **Governance** — DPO (accounts payable days), data breach incidents %, related-party transactions %

All math is in deterministic Python — the LLM only extracts raw numbers from unstructured documents.

## License

Proprietary — Cognizant Hackathon submission.
