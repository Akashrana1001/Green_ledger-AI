# GreenLedger AI — Scalability & Production Readiness Plan
### Hackathon Build Phase: May 6, 10:00 AM onwards
### Goal: Demonstrate enterprise-grade scalability to judges; lay the foundation for a real SaaS product.

---

## ⚠️ HACKATHON DAY — THREE NON-NEGOTIABLE RULES

> Read this before touching a single config file on demo day.

```
┌─────────────────────────────────────────────────────────────────────┐
│  RULE 1 — PATH B (EC2 + Amplify) IS BANNED DURING THE HACKATHON    │
│                                                                     │
│  EC2, SSH keys, security groups, and Linux env vars are time        │
│  vampires. One wrong port number = 4 hours of debugging.            │
│  Path B exists in this doc as a FUTURE ROADMAP for the pitch deck.  │
│  You will not touch it during the 12-hour build window.             │
│  Path A (Railway + Vercel) gives you public URLs in 10 minutes.     │
├─────────────────────────────────────────────────────────────────────┤
│  RULE 2 — S3 HAS A 15-MINUTE TIMEBOX                                │
│                                                                     │
│  If the PDF does not appear in the S3 console within 15 minutes,   │
│  you set LOCAL_MODE=true and move on. The magic of this project is  │
│  the agentic AI extraction — not where the PDF is stored.           │
│  An IAM 403 error does not get to kill your AI demo.               │
├─────────────────────────────────────────────────────────────────────┤
│  RULE 3 — LOCALHOST + NGROK IS "PLAN A.2", NOT A FAILURE            │
│                                                                     │
│  Running the engine locally = zero network latency, zero cloud      │
│  timeouts, instant UI updates. If Railway has issues, spin up       │
│  ngrok in 90 seconds and put the architecture diagram on screen.   │
│  Say: "We're running locally for speed — the system is designed     │
│  for AWS ALB as shown here." Judges respect engineering pragmatism. │
└─────────────────────────────────────────────────────────────────────┘
```

### The Only Decision Tree You Need on Demo Day

```
Start here → Is the full stack working on localhost?
                     │
                    YES ──→ Attempt Railway deployment (Path A, Step 1–4)
                     │             │
                     │            Works in < 30 min?
                     │             │         │
                     │            YES        NO ──→ Switch to Plan A.2 (ngrok)
                     │             │                  immediately. Don't debug.
                     │             ▼
                     │       Do you have S3 working?
                     │             │
                     │            YES (< 15 min) ──→ Keep LOCAL_MODE=false
                     │             │
                     │            NO (> 15 min)  ──→ Set LOCAL_MODE=true, move on
                     │
                    NO ──→ Fix localhost FIRST. Never deploy broken code.
```

---

## Status at Plan Creation

| Layer | Current State | Target State |
|---|---|---|
| Rate Limiting | ✅ Done — 100 req/15 min per IP | Add per-user token-based limits for enterprise tiers |
| Redis Caching | ✅ Done — 60s TTL on `/api/report/kpis` | Extend to all heavy read routes |
| System Health UI | ✅ Done — Live stats panel in War Room | Add historical sparklines |
| AI Queue | ✅ Done — BullMQ + Redis, graceful fallback | Add dead-letter queue + retry alerts |
| Deployment | ❌ Local dev only | AWS managed services |
| Database | ❌ Local/Atlas free tier | Atlas dedicated or DocumentDB |
| Observability | ❌ console.log only | Structured logs + CloudWatch |
| Load Testing | ❌ Not done | Scripted 50-concurrent-document proof |

---

## Phase 1: Backend Resilience ✅ COMPLETE

### 1.1 API Rate Limiting
- `express-rate-limit` applied to all `/api/*` routes
- 100 requests / 15 min / IP, health endpoints exempt
- Standard `RateLimit-*` response headers

### 1.2 Redis Cache Layer
- `cacheMiddleware.js` wraps any GET route in a Redis check
- Cache key: `gl:cache:{companyId}:{url}` — per-tenant isolation
- 60 s TTL on `/api/report/kpis`, 200 ms failsafe timeout
- In-process hit/miss counter feeds the System Health Panel

---

## Phase 2: Frontend Visibility ✅ COMPLETE

### 2.1 System Health Panel
- 4 real-time metric cards: Redis hit rate, active workers, queue depth, avg processing time
- Live terminal log window with 15 log template families
- Pause/Resume toggle, auto-scroll, monospace timestamps

---

## Phase 3: AWS Enterprise Deployment

### What to ACTUALLY do during the hackathon vs. what to show on slides

```
DURING HACKATHON (Path A only):         FOR THE PITCH DECK (talk about, don't build):
─────────────────────────────────        ──────────────────────────────────────────────
✅ S3 (15-min timebox)                   📊 ALB + Auto Scaling Group
✅ Railway (Node.js + Python)            📊 EC2 cluster with PM2
✅ Vercel (React frontend)               📊 CloudWatch observability
✅ Redis via Railway add-on              📊 ACM SSL certificate
                                         📊 Route 53 custom domain
```

### 3.1 Document Storage — AWS S3

> ⏱ **15-MINUTE HARD TIMEBOX. If the PDF is not in the S3 console after 15 minutes, set `LOCAL_MODE=true` and move on. The AI demo is more important than where the PDF lives.**

**What:** `LOCAL_MODE=false` is already set in both `.env` files. S3 bucket `greenledger-21` already exists. This is already done — just verify it works.

**Verify in 3 steps:**
1. Upload any small PDF through the dashboard
2. Go to AWS console → S3 → `greenledger-21` → `documents/` folder
3. If the file appears → S3 is working ✅. If you see a 403/SignatureDoesNotMatch error → set `LOCAL_MODE=true` in both `.env` files and do not spend another minute on it.

**Timebox trigger conditions** (if any of these happen, flip to `LOCAL_MODE=true` immediately):
- AWS returns `403 Forbidden` or `InvalidSignature` after 1 retry
- The bucket name or region is mismatched
- You're spending time reading IAM documentation

**What to say to judges if LOCAL_MODE=true:**
> "We're routing uploads through local storage today for demo reliability. Our S3 integration is implemented — you can see the `uploadToS3()` function in `s3Service.js` and the bucket is live on AWS."

### 3.2 Database — MongoDB Atlas ✅ ALREADY DONE

The Atlas URI in `backend/.env` is already connected and working. Nothing to do here.

If judges ask: "Atlas M0 cluster in us-east-1. Mongoose connection pooling. All queries scoped by `companyId` for multi-tenant isolation."

### 3.3–3.5 EC2, Amplify, ALB/ASG — FUTURE ROADMAP, NOT FOR HACKATHON DAY

> **These are in the document for the pitch deck, not for tomorrow.**
> Mention them confidently: "Post-hackathon we deploy both services to EC2 behind an Application Load Balancer with Auto Scaling. The `LOCAL_MODE` flag is the only difference between local and production — the code is already cloud-agnostic."

Keep the architecture diagram below to show during the presentation. That diagram, combined with a live Railway deployment, tells the full scalability story without a single EC2 instance.

---

## Phase 4: The Stress Test — Live Demo Proof 🔲

**Goal:** Run this during the demo while the System Health Panel is visible on screen. Judges watch queue depth spike and drain in real-time — better than any slide.

### 4.1 Load Test Script (`load_test.js`)
Not a complex framework — just a Node.js script that fires concurrent requests.

What it does:
1. Authenticates as Admin → gets JWT
2. Fires 50 document upload requests simultaneously (Promise.allSettled)
3. Polls `GET /api/system/health` every 2 s and prints queue depth to terminal
4. Reports: how many succeeded, how many were rate-limited, final queue depth

Expected outcome:
- The first ~100 requests per 15 min window pass the rate limiter
- BullMQ catches all uploads and processes them sequentially (concurrency=1)
- Node.js main thread never blocks — uploads return 201 immediately
- System Health Panel shows queue depth rising then draining
- No MongoDB writes are lost

### 4.2 Demo Script (60-second proof)
```
1. Show empty queue + System Health Panel
2. Run: node load_test.js --count=20
3. Watch terminal log: [BullMQ] Queue depth: 18 waiting · 1 active
4. Watch KPI cards update as documents process
5. Show completed queue — all 20 docs verified
6. Line: "Enterprise queuing — any volume, zero data loss."
```

---

## Phase 5: Observability (Post-Hackathon / Week 1) 🔲

### 5.1 Structured Logging
Replace all `console.log/error` with a structured logger (Winston or Pino).
Every log line should be a JSON object: `{ level, timestamp, service, companyId, message, durationMs }`.
This enables CloudWatch Insights queries like: "average processing time for electricity_bill documents in the last 24h."

### 5.2 AWS CloudWatch
- Push Node.js and Python logs to CloudWatch Log Groups
- Create metric filters for: error rate, avg processing time, queue depth
- Set alarms: alert on error rate > 5% or queue depth > 50 for > 5 min

### 5.3 Error Tracking
Add Sentry (free tier) to both frontend and backend.
Every unhandled exception gets a stack trace, user context, and companyId automatically.
One Sentry alert in the pitch deck is more impressive than 100 console.log statements.

---

## Phase 6: Security Hardening (Post-Hackathon / Week 2) 🔲

### 6.1 Secrets Management
Move all secrets from `.env` files to AWS Secrets Manager.
Node.js fetches secrets on startup via `@aws-sdk/client-secrets-manager`.
No secret ever touches the filesystem or git history.

### 6.2 HTTPS End-to-End
- ALB terminates TLS (ACM certificate, free)
- EC2 only accepts traffic from ALB security group (not the open internet)
- Add `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options` headers

### 6.3 JWT Hardening
- Rotate `JWT_SECRET` via Secrets Manager without redeployment
- Add JWT refresh token flow (current tokens expire in 7d — too long for enterprise)
- Implement token revocation list in Redis for logout-all-devices

### 6.4 Input Validation
Add `express-validator` to all POST routes that accept user text.
Specifically: `POST /api/chat/ask` (the question field) and `POST /api/auth/register` (all string fields).

---

## Phase 7: Multi-Tenancy at Scale (Post-Hackathon / Month 1) 🔲

The current architecture is already multi-tenant (every query is scoped by `companyId`).
To scale to thousands of companies:

### 7.1 Database Sharding Strategy
- Shard MongoDB Atlas by `companyId` — each shard holds N companies
- Index every collection on `{ companyId: 1, createdAt: -1 }` (already the dominant query pattern)
- Consider: dedicated Atlas cluster per enterprise client (Fortune 500 tier)

### 7.2 Horizontal Scaling the AI Engine
The current bottleneck is `concurrency: 1` in the BullMQ worker.
Scale plan:
```
Current:  1 EC2 → 1 Node process → 1 BullMQ worker → 1 Python worker
Target:   N EC2 → M Node clusters → M BullMQ workers → P Python workers (Bedrock parallelism)
```
- Each EC2 instance runs its own BullMQ worker pulling from the same Redis queue
- Add EC2 instances to the ASG → instant horizontal scale
- Bedrock has no concurrency limit — the Python engine scales linearly with EC2 count

### 7.3 CDN for Document Downloads
Serve S3 documents via CloudFront CDN.
Signed URLs (15 min TTL) for secure access — no public S3 bucket.

---

## Demo Narrative — What to Say in Each Deployment Scenario

The judges don't care which machine the code runs on. They care that you built something real, that it scales, and that you can explain why. Here is the exact narrative for each scenario:

**If fully deployed on Railway + Vercel:**
> "The full stack is live — Node.js on Railway, Python FastAPI on Railway, React on Vercel,
> MongoDB Atlas, Redis, and AWS Bedrock. You can hit this URL from your phone right now.
> Our BullMQ queue processes documents asynchronously — watch the System Health Panel as
> I upload this document."

**If running on localhost + ngrok (Plan A.2):**
> "We're running locally today for zero-latency processing — Bedrock responses are under
> 5 seconds with no cloud hops. Our Railway deployment is live [show tab], and as you can
> see from this architecture diagram, the entire system is designed for horizontal scaling
> behind an AWS ALB. The `LOCAL_MODE` flag is literally the only difference."

**If S3 is off (LOCAL_MODE=true):**
> "We're storing documents locally today — our S3 integration is implemented in `s3Service.js`
> and our bucket is live on AWS. I made a deliberate call not to let an IAM permission issue
> slow down the AI demo. The extraction pipeline is identical either way."

**The line that works for every situation:**
> "The code is cloud-agnostic. `LOCAL_MODE=false` and valid AWS credentials is the
> only delta between what you're seeing and a production deployment."

---

## Execution Priority for Hackathon Day (May 6)

```
Hour 0:     Confirm localhost is fully working end-to-end. Do not skip this.

Hour 0–1:   Deploy to Railway (Node.js + Python + Redis)
            → If Railway works in 30 min → continue
            → If Railway takes > 30 min → switch to Plan A.2 (ngrok), move on

Hour 1:     Deploy frontend to Vercel
            → Update VITE_API_BASE_URL to Railway backend URL
            → Update FRONTEND_URL in backend to Vercel URL
            → Takes 10 min

Hour 1–1:15 Verify S3 with a real upload
            → If PDF appears in S3 console → keep LOCAL_MODE=false ✅
            → If 403/IAM error → set LOCAL_MODE=true immediately, move on

Hour 1.5–3: Phase 4 — Write and run the load test script
            → This is your most powerful live demo moment
            → Run it on Railway OR on localhost — both prove the same thing

Hour 3+:    Polish, rehearse the demo narrative, prep the architecture slide
            → Do NOT start EC2 or Amplify. Time is better spent rehearsing.

Rule: If anything takes > 30 min to debug → cut it and move to the next item.
      A polished localhost demo beats a half-broken Railway deployment every time.
```

---

## Architecture Diagram (for Pitch Deck)

```
┌──────────────────────────────────────────────────────────────────────┐
│                        GreenLedger AI — Production                   │
│                                                                      │
│  Users (Browser)                                                     │
│       │                                                              │
│       ▼                                                              │
│  AWS Amplify (React + Vite)  ──── HTTPS ────────────────────┐        │
│                                                              │        │
│                              Application Load Balancer       │        │
│                              (HTTPS/443, ACM cert)           │        │
│                                     │                        │        │
│             ┌───────────────────────┴───────────────────┐   │        │
│             ▼                                           ▼   │        │
│     EC2 Node.js :5000                        EC2 FastAPI :8000       │
│     (PM2 cluster, 2 workers)                 (uvicorn, 2 workers)    │
│             │                                           │             │
│             ▼                                           │             │
│     Redis :6379 (local)  ◄────── BullMQ Queue ─────────┘             │
│     • API cache (60s TTL)                                            │
│     • Job queue                                                      │
│             │                                                        │
│             ▼                                                        │
│     MongoDB Atlas (ap-south-1)      AWS S3 (ap-south-1)             │
│     • All structured data           • PDF/image documents            │
│     • Sharded by companyId          • CloudFront CDN                 │
│                                                                      │
│                    ┌──────────────────┐                              │
│                    │  AWS Bedrock     │  ← Claude 3 Haiku            │
│                    │  (Mumbai region) │    (AI extraction)           │
│                    └──────────────────┘                              │
└──────────────────────────────────────────────────────────────────────┘
```

---

---

# DEMO DEPLOYMENT GUIDE — Step by Step
### "Do exactly this, in this order, and the demo will not crash."

> **Current state before you start:**
> - MongoDB Atlas ✅ already connected
> - AWS S3 bucket `greenledger-21` ✅ already exists
> - AWS Bedrock ✅ already configured with Claude models
> - `LOCAL_MODE=false` ✅ already set in both `.env` files
>
> **What's still localhost:**
> - Node.js backend → `localhost:5000`
> - Python FastAPI → `localhost:8000`
> - React frontend → `localhost:5173`
>
> **What this guide does:** gives each service a public URL in ~45 minutes.

---

## PRE-FLIGHT CHECKLIST (Do this FIRST — 10 minutes)

Open a terminal and confirm everything runs locally before touching any cloud service.

```
# Terminal 1 — Start Redis (WSL or Docker)
wsl redis-server
# OR:
docker run -d -p 6379:6379 redis

# Terminal 2 — Start backend
cd D:\GreenLedger-Main\greenledger-ai\backend
node server.js
# Should print: MongoDB connected | Backend running on port 5000

# Terminal 3 — Start Python engine
cd D:\GreenLedger-Main\greenledger-ai\ai-engine
venv\Scripts\uvicorn main:app --reload --port 8000
# Should print: Application startup complete

# Terminal 4 — Start frontend
cd D:\GreenLedger-Main\greenledger-ai\frontend
npm run dev
# Should print: Local: http://localhost:5173
```

Open `http://localhost:5173` → log in → upload a test document → confirm it processes end-to-end.
**Do NOT proceed to deployment if this doesn't work on localhost first.**

---

## PATH A — Railway + Vercel (Recommended, ~45 min total)

This is the safest path for demo day. Railway is extremely reliable and deploys Node.js + Python in minutes. No VPC, no security groups, no SSH.

---

### STEP 1: Deploy Node.js Backend to Railway (15 min)

**1.1 Create Railway account**
1. Open browser → go to `https://railway.app`
2. Click **"Start a New Project"** (big button, center of screen)
3. Click **"Sign in with GitHub"**
4. Authorize Railway — click **"Authorize railway-app"** (green button)
5. You are now on the Railway dashboard

**1.2 Deploy the backend service**
1. Click **"New Project"** (top right, purple button)
2. Click **"Deploy from GitHub repo"**
3. Search for your repo name → click it → click **"Deploy Now"**
4. Railway auto-detects Node.js — wait 2 min for initial build

**1.3 Set the root directory (critical — Railway must deploy only the backend, not the root)**
1. Click on the service card that appeared
2. Click **"Settings"** tab (top of the service panel)
3. Scroll to **"Root Directory"** field
4. Type: `greenledger-ai/backend`
5. Click **"Save"**
6. Click **"Deploy"** to re-trigger with the correct root

**1.4 Add environment variables**
1. Click **"Variables"** tab
2. Click **"New Variable"** and add each line below one by one:

```
PORT                          = 5000
MONGO_URI                     = [paste your Atlas URI from backend/.env]
JWT_SECRET                    = [paste from backend/.env]
JWT_EXPIRES_IN                = 7d
LOCAL_MODE                    = false
AWS_S3_REGION                 = us-east-1
AWS_S3_ACCESS_KEY_ID          = [paste from backend/.env]
AWS_S3_SECRET_ACCESS_KEY      = [paste from backend/.env]
S3_BUCKET_NAME                = greenledger-21
REDIS_HOST                    = [leave empty for now — see Step 3]
REDIS_PORT                    = 6379
AI_ENGINE_URL                 = [fill in after Step 2]
FRONTEND_URL                  = [fill in after Step 4]
```

> For REDIS_HOST: skip for now, come back after Step 3.

**1.5 Get your backend public URL**
1. Click **"Settings"** tab
2. Scroll to **"Networking"** section
3. Click **"Generate Domain"**
4. Copy the URL — looks like: `https://backend-production-xxxx.up.railway.app`
5. Save this URL — you will need it in Steps 2 and 4

**1.6 Verify the backend is live**
Open a new browser tab → paste your Railway URL + `/api/health`
Example: `https://backend-production-xxxx.up.railway.app/api/health`
You should see: `{"status":"ok","service":"GreenLedger API"}`
If you see this → backend is deployed ✅

---

### STEP 2: Deploy Python FastAPI to Railway (10 min)

**2.1 Add a second service to the same Railway project**
1. Go back to your Railway project dashboard
2. Click **"+ New"** (top right of the project canvas)
3. Click **"GitHub Repo"** → select the same repo
4. Click **"Deploy Now"**

**2.2 Set root directory for the Python service**
1. Click the new service card
2. Click **"Settings"** tab
3. Root Directory → type: `greenledger-ai/ai-engine`
4. Click **"Save"** → **"Deploy"**

**2.3 Set start command for FastAPI**
1. Still in **"Settings"** tab
2. Scroll to **"Start Command"** field
3. Type: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Click **"Save"** → **"Deploy"**

**2.4 Add environment variables for Python service**
1. Click **"Variables"** tab
2. Add each line:

```
LOCAL_MODE                        = false
AWS_S3_REGION                     = us-east-1
AWS_S3_ACCESS_KEY_ID              = [same as backend]
AWS_S3_SECRET_ACCESS_KEY          = [same as backend]
S3_BUCKET_NAME                    = greenledger-21
AWS_BEDROCK_REGION                = us-east-1
AWS_BEDROCK_ACCESS_KEY_ID         = [paste from ai-engine/.env]
AWS_BEDROCK_SECRET_ACCESS_KEY     = [paste from ai-engine/.env]
BEDROCK_MODEL_HAIKU               = us.anthropic.claude-3-5-haiku-20241022-v1:0
BEDROCK_MODEL_SONNET              = us.anthropic.claude-4-6-sonnet-v1:0
NODE_BACKEND_URL                  = [paste the backend Railway URL from Step 1.5]
AWS_SNS_TOPIC_ARN                 = [paste from ai-engine/.env]
AWS_SNS_REGION                    = us-east-1
AWS_SNS_ACCESS_KEY_ID             = [paste from ai-engine/.env]
AWS_SNS_SECRET_ACCESS_KEY         = [paste from ai-engine/.env]
GHG_ALERT_THRESHOLD_TCO2E        = 10000
FRONTEND_URL                      = [fill in after Step 4]
POPPLER_PATH                      = [leave empty — Linux path auto-detected]
```

**2.5 Get the Python engine public URL**
1. Click **"Settings"** tab → **"Generate Domain"**
2. Copy the URL — looks like: `https://ai-engine-production-xxxx.up.railway.app`
3. Open a new tab → paste URL + `/health`
4. You should see: `{"status":"ok","service":"GreenLedger AI Engine",...}`
5. Python engine is live ✅

**2.6 Go back and fill in AI_ENGINE_URL on the backend service**
1. Click the Node.js service card
2. Click **"Variables"** tab
3. Find `AI_ENGINE_URL` → click the edit icon (pencil)
4. Replace the value with your Python Railway URL from Step 2.5
5. Click **"Save"** — Railway auto-redeploys

---

### STEP 3: Add Managed Redis to Railway (5 min)

**3.1 Add Redis to the project**
1. On the Railway project canvas, click **"+ New"**
2. Click **"Database"**
3. Click **"Add Redis"**
4. Railway creates a Redis instance in 30 seconds

**3.2 Connect Redis to the Node.js backend**
1. Click on the Redis card — you'll see a "Connect" panel
2. Click **"Variables"** tab on the Redis card
3. Copy the value of `REDIS_URL` — looks like `redis://default:password@host:port`

**3.3 Update backend with Redis credentials**
1. Click the Node.js service card → **"Variables"** tab
2. Update `REDIS_HOST` with the Redis hostname (everything between `@` and `:` in the REDIS_URL)
3. Update `REDIS_PORT` with the port number (the number after the last `:`)

> **Shortcut:** Railway also provides `REDIS_HOST` and `REDIS_PORT` as separate variables if you reference the service. In the Variables tab, click **"Add Reference"** → select the Redis service → select `REDIS_HOST` → Railway injects it automatically. Do the same for `REDIS_PORT`.

4. Click **"Save"** — backend redeploys with Redis connected

---

### STEP 4: Deploy React Frontend to Vercel (10 min)

**4.1 Create Vercel account**
1. Open browser → go to `https://vercel.com`
2. Click **"Sign Up"**
3. Click **"Continue with GitHub"** → authorize Vercel
4. You are now on the Vercel dashboard

**4.2 Import the project**
1. Click **"Add New…"** (top right)
2. Click **"Project"**
3. Find your GitHub repo → click **"Import"**

**4.3 Configure the build settings (critical)**
1. You see a configuration screen
2. **Framework Preset** → click the dropdown → select **"Vite"**
3. **Root Directory** → click **"Edit"** → type: `greenledger-ai/frontend` → click **"Continue"**
4. **Build Command** → should auto-fill as `npm run build` — leave it
5. **Output Directory** → should auto-fill as `dist` — leave it

**4.4 Add environment variables**
1. Expand **"Environment Variables"** section
2. Add these two:

```
VITE_API_BASE_URL    = [paste your backend Railway URL from Step 1.5]
                       Example: https://backend-production-xxxx.up.railway.app

VITE_GOOGLE_CLIENT_ID = [paste from your Google Cloud Console, or leave empty to disable Google SSO]
```

3. Click **"Deploy"**
4. Wait ~90 seconds for Vercel to build

**4.5 Get your frontend public URL**
1. When deployment succeeds → click **"Visit"** (takes you to your live app)
2. Copy the URL — looks like: `https://greenledger-ai-xxxx.vercel.app`
3. App should load → register → log in → you're live ✅

**4.6 Go back and update CORS in backend**
This is the step most people forget. Without it, the browser blocks API calls.

1. Go to Railway → click the Node.js service → **"Variables"** tab
2. Find `FRONTEND_URL` → click edit
3. Change value to: `https://greenledger-ai-xxxx.vercel.app`
   (use your actual Vercel URL — no trailing slash)
4. Click **"Save"** — backend redeploys

5. Also update the Python service:
   1. Click the Python service card → **"Variables"** tab
   2. Find `FRONTEND_URL` → update to same Vercel URL
   3. Click **"Save"**

---

### STEP 5: Verify the Full Stack (5 min)

Open your Vercel URL → perform this exact sequence:

```
1. Register a new Admin account
   → should succeed (Atlas write)

2. Log in
   → should redirect to /terms then /admin/dashboard

3. Upload any small PDF document (electricity bill, HR data, etc.)
   → should show "pending" then "processing"
   → Python engine picks it up from S3, processes with Bedrock
   → status changes to "verified"
   → KPI cards populate with real values

4. Open the AI War Room
   → ESG Score Gauge should render
   → System Health Panel should show Redis online
   → Click the "Audit" button on the verified document
   → 3-column pipeline view should show extracted values

5. Click the chat bubble (bottom right)
   → Type: "What is our Scope 2 emission?"
   → Bedrock response should appear within 10 seconds
```

If all 5 steps work → the demo is live and stable ✅

---

## PATH B — EC2 + Amplify (Full AWS, ~3–4 hours)

Use this only if you have AWS experience and want the full AWS story. Otherwise Path A is faster and more reliable for a 12-hour hackathon.

---

### STEP 1: Launch EC2 Instance (15 min)

**1.1 Open EC2 console**
1. Go to `https://console.aws.amazon.com`
2. Sign in → top search bar → type `EC2` → click **"EC2"** (first result)
3. Make sure region (top right dropdown) is set to **"US East (N. Virginia) us-east-1"**
   (your S3 and Bedrock are in us-east-1)
4. Click **"Launch Instance"** (orange button)

**1.2 Configure the instance**
1. **Name:** `greenledger-backend`
2. **AMI:** Click **"Ubuntu"** → select **"Ubuntu Server 22.04 LTS (HVM)"** (free tier eligible)
3. **Instance type:** Select **t3.medium** (2 vCPU, 4 GB RAM) — Python + Node both need headroom
4. **Key pair:** Click **"Create new key pair"** → name it `greenledger-key` → type RSA → format `.pem` → click **"Create"** → `.pem` file downloads automatically → **save this file, you cannot re-download it**
5. **Network settings:** Click **"Edit"**
   - VPC → leave default
   - Auto-assign public IP → **Enable**
   - Click **"Add security group rule"** → Type: Custom TCP → Port: `5000` → Source: `0.0.0.0/0`
   - Click **"Add security group rule"** → Type: Custom TCP → Port: `8000` → Source: `0.0.0.0/0`
   - SSH (port 22) rule should already exist → leave it
6. **Storage:** Change from 8 GB to **20 GB** (Python venv + dependencies are large)
7. Click **"Launch Instance"** (orange button, bottom right)

**1.3 Connect to the instance**
1. Click **"View Instances"** → wait until status shows **"2/2 checks passed"** (takes ~2 min)
2. Copy the **"Public IPv4 address"** — save it
3. Open PowerShell (or Terminal) → run:
   ```
   ssh -i "C:\path\to\greenledger-key.pem" ubuntu@YOUR_PUBLIC_IP
   ```
   Replace `C:\path\to\greenledger-key.pem` with wherever you saved the key file.
   Type `yes` when asked about fingerprint.
4. You should see `ubuntu@ip-xxx-xxx-xxx-xxx:~$` — you are inside the EC2

**1.4 Install dependencies on EC2**
Run these commands one at a time inside the EC2 SSH session:

```bash
# System update
sudo apt update && sudo apt upgrade -y

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Python 3.11 + pip + venv
sudo apt install -y python3.11 python3.11-venv python3-pip

# Redis
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
redis-cli ping
# Should print: PONG

# PM2 (Node.js process manager)
sudo npm install -g pm2

# Poppler (PDF processing for the Python engine)
sudo apt install -y poppler-utils

# Git
sudo apt install -y git
```

**1.5 Clone the repo onto EC2**
```bash
cd ~
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git greenledger
cd greenledger
```
Replace with your actual GitHub URL.

**1.6 Set up Node.js backend on EC2**
```bash
cd ~/greenledger/greenledger-ai/backend
npm install

# Create .env file
nano .env
```
In nano, paste this (fill in your values):
```
PORT=5000
MONGO_URI=[your Atlas URI]
JWT_SECRET=[your JWT secret]
JWT_EXPIRES_IN=7d
LOCAL_MODE=false
AWS_S3_REGION=us-east-1
AWS_S3_ACCESS_KEY_ID=[your key]
AWS_S3_SECRET_ACCESS_KEY=[your secret]
S3_BUCKET_NAME=greenledger-21
REDIS_HOST=localhost
REDIS_PORT=6379
AI_ENGINE_URL=http://localhost:8000
FRONTEND_URL=[your Amplify URL — fill in after Step 3]
```
Press `Ctrl+X` → `Y` → Enter to save.

```bash
# Start with PM2
pm2 start server.js --name greenledger-backend
pm2 save
pm2 startup
# Copy and run the command PM2 prints
```

**1.7 Set up Python FastAPI on EC2**
```bash
cd ~/greenledger/greenledger-ai/ai-engine
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env
nano .env
```
Paste (fill in your values):
```
LOCAL_MODE=false
AWS_S3_REGION=us-east-1
AWS_S3_ACCESS_KEY_ID=[your key]
AWS_S3_SECRET_ACCESS_KEY=[your secret]
S3_BUCKET_NAME=greenledger-21
AWS_BEDROCK_REGION=us-east-1
AWS_BEDROCK_ACCESS_KEY_ID=[your Bedrock key]
AWS_BEDROCK_SECRET_ACCESS_KEY=[your Bedrock secret]
BEDROCK_MODEL_HAIKU=us.anthropic.claude-3-5-haiku-20241022-v1:0
BEDROCK_MODEL_SONNET=us.anthropic.claude-4-6-sonnet-v1:0
NODE_BACKEND_URL=http://localhost:5000
AWS_SNS_TOPIC_ARN=[your SNS ARN]
AWS_SNS_REGION=us-east-1
AWS_SNS_ACCESS_KEY_ID=[your SNS key]
AWS_SNS_SECRET_ACCESS_KEY=[your SNS secret]
GHG_ALERT_THRESHOLD_TCO2E=10000
POPPLER_PATH=
```
Press `Ctrl+X` → `Y` → Enter.

```bash
# Start FastAPI with PM2 (PM2 can manage Python too)
pm2 start "source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000" \
  --name greenledger-ai --interpreter none
pm2 save
```

**1.8 Verify both services are running**
```bash
pm2 status
# Should show both greenledger-backend and greenledger-ai as "online"

curl http://localhost:5000/api/health
# Should print: {"status":"ok","service":"GreenLedger API"}

curl http://localhost:8000/health
# Should print: {"status":"ok","service":"GreenLedger AI Engine",...}
```

**1.9 Test from outside the EC2**
Open a new browser tab on your laptop:
`http://YOUR_EC2_PUBLIC_IP:5000/api/health`
You should see the JSON response.

---

### STEP 2: Update S3 Bucket CORS Policy (5 min)

The browser needs to be able to access S3 objects.

1. Go to `https://console.aws.amazon.com` → search `S3` → click **S3**
2. Click **"greenledger-21"** (your bucket name)
3. Click **"Permissions"** tab
4. Scroll to **"Cross-origin resource sharing (CORS)"** → click **"Edit"**
5. Paste this JSON:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```
6. Click **"Save changes"**

---

### STEP 3: Deploy Frontend to AWS Amplify (10 min)

**3.1 Open Amplify**
1. Go to `https://console.aws.amazon.com` → search `Amplify` → click **"AWS Amplify"**
2. Click **"Create new app"** (orange button)
3. Click **"Host your web app"**
4. Click **"GitHub"** → click **"Continue"**
5. Authorize AWS Amplify to access GitHub if prompted

**3.2 Select the repo and branch**
1. Repository → search for your repo → select it
2. Branch → select **"main"** (or whichever branch you deploy from)
3. Click **"Next"**

**3.3 Configure build settings**
1. App name → type: `GreenLedger AI`
2. Click **"Edit"** next to the build spec
3. Replace the entire build spec with:
```yaml
version: 1
applications:
  - frontend:
      phases:
        preBuild:
          commands:
            - cd greenledger-ai/frontend
            - npm install
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: greenledger-ai/frontend/dist
        files:
          - '**/*'
      cache:
        paths:
          - greenledger-ai/frontend/node_modules/**/*
    appRoot: greenledger-ai/frontend
```
4. Click **"Save"**

**3.4 Add environment variables**
1. Click **"Advanced settings"** (expandable section)
2. Under **"Environment variables"**, click **"Add"**:

| Variable name | Value |
|---|---|
| `VITE_API_BASE_URL` | `http://YOUR_EC2_PUBLIC_IP:5000` |
| `VITE_GOOGLE_CLIENT_ID` | your Google client ID, or leave empty |

3. Click **"Next"** → **"Save and Deploy"**
4. Wait ~3 min for the build to complete
5. Click **"Visit deployed URL"** — copy this URL (looks like `https://main.xxxxxxxx.amplifyapp.com`)

**3.5 Go back and update CORS on EC2**
On your laptop, SSH back into EC2:
```bash
ssh -i "greenledger-key.pem" ubuntu@YOUR_EC2_PUBLIC_IP
nano ~/greenledger/greenledger-ai/backend/.env
```
Update `FRONTEND_URL` to your Amplify URL:
`FRONTEND_URL=https://main.xxxxxxxx.amplifyapp.com`
Save → `Ctrl+X` → `Y` → Enter

```bash
pm2 restart greenledger-backend
```

---

## ENVIRONMENT VARIABLE MASTER CHECKLIST

Before the demo, verify every service has every value. **Missing one env var is the #1 cause of demo crashes.**
The values for Railway and for Plan A.2 (localhost) are listed side by side.

### Backend — Railway Variable Tab OR backend/.env

| Variable | Railway value | Plan A.2 (localhost) value |
|---|---|---|
| `PORT` | `5000` | `5000` |
| `MONGO_URI` | ← paste Atlas URI | ← same Atlas URI |
| `JWT_SECRET` | ← paste from current .env | ← already in .env |
| `JWT_EXPIRES_IN` | `7d` | `7d` |
| `LOCAL_MODE` | `false` (try S3) or `true` (safe) | `false` or `true` |
| `AWS_S3_REGION` | `us-east-1` | `us-east-1` |
| `AWS_S3_ACCESS_KEY_ID` | ← paste from current .env | ← already in .env |
| `AWS_S3_SECRET_ACCESS_KEY` | ← paste from current .env | ← already in .env |
| `S3_BUCKET_NAME` | `greenledger-21` | `greenledger-21` |
| `REDIS_HOST` | ← Railway Redis host (via service reference) | `localhost` |
| `REDIS_PORT` | `6379` | `6379` |
| `AI_ENGINE_URL` | ← Python Railway service URL | `http://localhost:8000` |
| `FRONTEND_URL` | ← Vercel URL (no trailing slash) | `http://localhost:5173` |

### Python Engine — Railway Variable Tab OR ai-engine/.env

| Variable | Railway value | Plan A.2 value |
|---|---|---|
| `LOCAL_MODE` | `false` | `false` |
| `AWS_S3_REGION` | `us-east-1` | ← already in .env |
| `AWS_S3_ACCESS_KEY_ID` | ← paste | ← already in .env |
| `AWS_S3_SECRET_ACCESS_KEY` | ← paste | ← already in .env |
| `S3_BUCKET_NAME` | `greenledger-21` | ← already in .env |
| `AWS_BEDROCK_REGION` | `us-east-1` | ← already in .env |
| `AWS_BEDROCK_ACCESS_KEY_ID` | ← paste | ← already in .env |
| `AWS_BEDROCK_SECRET_ACCESS_KEY` | ← paste | ← already in .env |
| `BEDROCK_MODEL_HAIKU` | `us.anthropic.claude-3-5-haiku-20241022-v1:0` | ← already in .env |
| `NODE_BACKEND_URL` | ← Backend Railway URL | `http://localhost:5000` |
| `POPPLER_PATH` | *(leave empty — Linux auto-detects)* | `C:\poppler\Library\bin` |

### Frontend — Vercel Environment Variables OR frontend/.env

| Variable | Vercel value | Plan A.2 value |
|---|---|---|
| `VITE_API_BASE_URL` | ← Backend Railway URL (no trailing slash) | ← ngrok HTTPS URL |

---

## 30 MINUTES BEFORE THE DEMO — Final Checks

Run through this exact sequence. Do not skip any step.

**Check 1: Backend health**
Open browser → `YOUR_BACKEND_URL/api/health`
Expected: `{"status":"ok","service":"GreenLedger API"}`

**Check 2: AI Engine health**
Open browser → `YOUR_PYTHON_URL/health`
Expected: `{"status":"ok","ollama_connected":false,"local_mode":false,...}`

**Check 3: Register a fresh test account**
Go to your frontend URL → click Register → fill in a test company
Expected: Redirected to /terms → accept → /admin/dashboard loads

**Check 4: Upload a small test document**
Admin Dashboard → click a team member → upload a simple electricity bill PDF (< 1 MB)
Expected: Status shows "processing" then "verified" within 30 seconds (Bedrock is fast)

**Check 5: Verify KPI cards populate**
Go to AI War Room → verify at least one KPI card shows a number (not —)

**Check 6: Test the chat widget**
Click the chat bubble → type: `"What is our Scope 2 emission?"` → wait for response
Expected: A Bedrock-powered answer within 10 seconds

**Check 7: Test PDF download**
AI War Room → click "Generate BRSR" (if mandatory categories are complete)
Expected: A PDF downloads within 15 seconds

**Check 8: Note any warnings for the judges**
If a test document is "failed", note the error — be ready to explain it as a Bedrock timeout (acceptable, retryable)

---

## PLAN A.2 — Localhost + ngrok (Valid First-Class Option)

> This is not a backup plan. This is an equally valid demo strategy.
> Running locally means zero cloud latency, zero timeouts, zero Railway outages.
> Decide to use this **before the demo**, not as a panic response during it.

**When to choose Plan A.2 proactively (before you even try Railway):**
- It's 30 min before the demo and you're still debugging Railway
- Railway is slow or throwing errors you don't understand
- You want absolute certainty the demo won't lag

**How to run Plan A.2 (3 minutes):**

```
Terminal 1 — Redis
  wsl redis-server
  (or: docker run -d -p 6379:6379 redis)

Terminal 2 — Node.js backend
  cd D:\GreenLedger-Main\greenledger-ai\backend
  node server.js
  → prints: MongoDB connected | Backend running on port 5000

Terminal 3 — ngrok (makes localhost:5000 publicly accessible)
  npx ngrok http 5000
  → copy the HTTPS URL: https://abc123.ngrok-free.app

Terminal 4 — Python FastAPI
  cd D:\GreenLedger-Main\greenledger-ai\ai-engine
  venv\Scripts\uvicorn main:app --port 8000

Terminal 5 — React frontend
  cd D:\GreenLedger-Main\greenledger-ai\frontend
  Update .env: VITE_API_BASE_URL=https://abc123.ngrok-free.app
  Update backend .env: FRONTEND_URL=http://localhost:5173
  npm run dev
  → open http://localhost:5173
```

**What to say to judges:**
> "We're running the AI engine locally today for maximum processing speed — Bedrock
> responses are sub-5-second with no cloud hops. Our Railway deployment is live at
> [show the Railway URL in a browser tab], and as you can see from the architecture
> diagram, this is designed to scale horizontally behind an AWS ALB."

**Why this is a strong demo position, not a weak one:**
- Bedrock extraction still happens over the real internet (not local)
- MongoDB Atlas is still cloud (real database)
- S3 uploads still go to the real bucket (if LOCAL_MODE=false)
- The ngrok URL is a real HTTPS endpoint — judges can hit it from their phones
- Zero chance of Railway cold starts killing your live demo

---

## IF SOMETHING BREAKS DURING THE DEMO

For each scenario, the fix takes ≤ 90 seconds. If it takes longer than that — stop, execute Plan A.2.

**Scenario 1: "Frontend blank screen / CORS error"**
→ Open DevTools (F12) → Console → look for "CORS" or "Failed to fetch"
→ Cause: `VITE_API_BASE_URL` wrong, or `FRONTEND_URL` on backend not matching
→ 90-second fix: Vercel dashboard → Environment Variables → update `VITE_API_BASE_URL` → Redeploy
→ If redeploy takes too long → execute Plan A.2

**Scenario 2: "Document stuck on processing"**
→ Cause: `AI_ENGINE_URL` on backend is wrong, or Python service is sleeping (Railway free tier cold starts)
→ 90-second fix: Railway → Python service → click "Deploy" to wake it → retry the upload
→ If Python service stays down → set `LOCAL_MODE=true` in the Python `.env` (Railway variable) and restart

**Scenario 3: "Login returns 500 / MongoDB error"**
→ Cause: Atlas network access is blocking the Railway IP
→ 30-second fix: Go to `cloud.mongodb.com` → your cluster → **Network Access** tab → click **Add IP Address** → type `0.0.0.0/0` → click **Confirm**
→ Takes 15 seconds to propagate — try login again

**Scenario 4: "S3 upload fails (403 or SignatureDoesNotMatch)"**
→ Do not debug IAM. This is exactly what the 15-minute timebox was for.
→ 10-second fix: set `LOCAL_MODE=true` in backend Railway variables → save → redeploy
→ Documents save to disk on the Railway container — demo continues perfectly

**Scenario 5: "Railway is completely down"**
→ Railway has a status page: `https://status.railway.app` — check it
→ If Railway is having an incident → this is not your fault and judges understand
→ Execute Plan A.2 immediately. Show the Railway dashboard URL to judges as proof it exists.
