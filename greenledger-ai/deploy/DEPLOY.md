# GreenLedger AI — Production Deployment Runbook

A 10-step, copy-pasteable deployment guide. Estimated time: **~30 minutes**.

---

## 0 · Prerequisites (do these FIRST, all can be opened in browser tabs in parallel)

| # | What | Where |
|---|------|-------|
| 0a | Create a free Redis Cloud database (us-east-1 region) | https://redis.com/try-free |
| 0b | Confirm MongoDB Atlas IP whitelist has `0.0.0.0/0` | https://cloud.mongodb.com → Network Access |
| 0c | Push this repo to GitHub (so Amplify can pull it) | github.com → New repo → push |
| 0d | Have your AWS console open (Cognizant account is fine) | https://console.aws.amazon.com |

Save these values somewhere — you'll paste them later:
- **REDIS_URL** from step 0a (looks like `rediss://default:xxx@redis-xxxx.cloud.redislabs.com:18745`)
- **MongoDB Atlas password**
- **AWS STS credentials** (your current `ASIAZGGE…` ones)
- **GitHub repo URL**

---

## 1 · Launch the EC2 instance (3 minutes)

AWS Console → **EC2** → **Launch instances**

| Setting | Value |
|---|---|
| Name | `greenledger-prod` |
| AMI | **Ubuntu Server 22.04 LTS** (free tier eligible) |
| Instance type | **t3.medium** (2 vCPU, 4 GB RAM — minimum for Bedrock + Node + Python) |
| Key pair | Create new → name it `greenledger-key` → **download the .pem** |
| Network — VPC | Default |
| Network — Auto-assign public IP | **Enable** |
| Firewall (security group) | Create new → see rules below |
| Storage | 30 GB gp3 |

**Security group rules** (Allow):

| Type | Port | Source | Purpose |
|---|---|---|---|
| SSH | 22 | My IP | terminal access |
| Custom TCP | 5000 | 0.0.0.0/0 | Node backend (frontend hits this) |
| HTTP | 80 | 0.0.0.0/0 | (optional, if you add nginx later) |

> Do **NOT** open port 8000 to the public — the AI engine binds to `127.0.0.1` only.

Click **Launch** → wait 60s → copy the **Public IPv4 address** (e.g. `54.123.45.67`).

---

## 2 · SSH in & bootstrap (5 minutes)

From your laptop terminal:
```bash
chmod 400 ~/Downloads/greenledger-key.pem
ssh -i ~/Downloads/greenledger-key.pem ubuntu@54.123.45.67
```

Then on the EC2 box:
```bash
git clone https://github.com/<YOUR-USERNAME>/<YOUR-REPO>.git GreenLedger-Main
cd ~/GreenLedger-Main/greenledger-ai
chmod +x deploy/*.sh
./deploy/ec2-bootstrap.sh
```

The bootstrap script prints **one** `sudo` command (from `pm2 startup`) — run it once so PM2 survives reboots.

---

## 3 · Configure backend (3 minutes)

```bash
cd ~/GreenLedger-Main/greenledger-ai/backend
npm ci --omit=dev
cp ../deploy/backend.env.production.template .env
nano .env   # fill in every <ANGLE_BRACKET> value
```

Things to fill in:
- `MONGO_URI` (paste your Atlas password into `<ATLAS_PASSWORD>`)
- `AWS_S3_*` STS credentials (the same ASIAZGGE… you've been using)
- `REDIS_URL` (from step 0a)
- `FRONTEND_URL` — leave as the placeholder for now; we'll update in step 8

`JWT_SECRET` is already pre-filled with a fresh random secret — **do not reuse the dev secret in prod.**

---

## 4 · Configure AI engine (3 minutes)

```bash
cd ~/GreenLedger-Main/greenledger-ai/ai-engine
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

cp ../deploy/ai-engine.env.production.template .env
nano .env   # fill in every <ANGLE_BRACKET> value
```

---

## 5 · Start both services with PM2 (1 minute)

```bash
cd ~/GreenLedger-Main/greenledger-ai
pm2 start ecosystem.config.js
pm2 save
pm2 status
# both apps should show 'online'

pm2 logs --lines 20
# verify: backend says "Server listening on :5000" and "MongoDB connected"
#        ai-engine says "Application startup complete" and "Listening on :8000"
```

If either service shows `errored`, run `pm2 logs <name> --err` to see the stack trace.

---

## 6 · Smoke test the backend (30 seconds)

```bash
./deploy/healthcheck.sh
```

Expected output:
```
  ✓  GET /api/health
  ✓  GET /api/health/engine
  ✓  GET /health
  ✓  Redis Cloud reachable
  ✓  greenledger-backend                online
  ✓  greenledger-ai-engine              online
```

If anything is red — fix it before moving on. The frontend will be useless without a working backend.

---

## 7 · Deploy the frontend to Amplify (5 minutes)

AWS Console → **AWS Amplify** → **Create new app** → **Host web app**

1. **Source provider** → GitHub → authorize → pick your repo + `main` branch
2. **App settings** screen:
   - App name: `greenledger-frontend`
   - **Build settings detection** will probably fail because `package.json` is in a subdirectory. Click **Edit** and **paste the contents of `amplify.yml`** (already at your repo root). Save.
3. **Environment variables** → Add variable:
   - Key: `VITE_API_BASE_URL`
   - Value: `http://54.123.45.67:5000` *(your EC2 public IP, port 5000)*
4. **Save and deploy** → wait ~3 minutes for the build.

When it succeeds, Amplify gives you a domain like:
```
https://main.d3abc1234.amplifyapp.com
```

---

## 8 · Wire CORS — connect the frontend domain back to the backend (1 minute)

SSH back into EC2:
```bash
ssh -i ~/Downloads/greenledger-key.pem ubuntu@54.123.45.67
nano ~/GreenLedger-Main/greenledger-ai/backend/.env
```

Update `FRONTEND_URL`:
```env
FRONTEND_URL=https://main.d3abc1234.amplifyapp.com,http://localhost:3000,http://localhost:5173
```

Save (Ctrl+O, Enter, Ctrl+X), then:
```bash
pm2 restart greenledger-backend --update-env
pm2 logs greenledger-backend --lines 10
```

---

## 9 · End-to-end validation (1 minute)

```bash
./deploy/healthcheck.sh https://main.d3abc1234.amplifyapp.com
```

Now open **`https://main.d3abc1234.amplifyapp.com`** in your browser:

- [ ] Register a new admin account → succeeds
- [ ] Login → redirects to `/admin/dashboard`
- [ ] Upload a sample PDF in Team Portal → status flows pending → processing → verified
- [ ] AI War Room cards populate within ~5 seconds of verification

---

## 10 · Production hardening (do AFTER demo, before going live)

| Today | After demo |
|---|---|
| `.env` files on disk with raw secrets | Move to **AWS Secrets Manager** |
| STS tokens that expire | Attach **IAM Role** to EC2 with `bedrock:InvokeModel`, `s3:GetObject/PutObject`, `sns:Publish` |
| HTTP backend on `:5000` | Put **nginx + Let's Encrypt** in front, terminate TLS at `:443` |
| Atlas IP whitelist `0.0.0.0/0` | Lock down to the **EC2 Elastic IP only** |
| `pm2 logs` only on disk | Pipe to **CloudWatch** via `awslogs` agent |
| No backup | Atlas → continuous backups + daily snapshots |

---

## Daily ops cheat-sheet

```bash
# Tail logs
pm2 logs                            # both apps live
pm2 logs greenledger-backend        # just node
pm2 logs greenledger-ai-engine --err   # just python errors

# Status
pm2 status
pm2 monit                           # live CPU/mem dashboard

# Update code (after `git push` from your laptop)
cd ~/GreenLedger-Main && git pull
cd greenledger-ai/backend && npm ci --omit=dev
cd ../ai-engine && source venv/bin/activate && pip install -r requirements.txt && deactivate
cd .. && pm2 restart all

# Refresh expired Cognizant STS tokens
nano ~/GreenLedger-Main/greenledger-ai/backend/.env
nano ~/GreenLedger-Main/greenledger-ai/ai-engine/.env
pm2 restart all --update-env
```

---

## Common errors

| Symptom | Cause | Fix |
|---|---|---|
| Backend exits with `MongoServerSelectionError` | Atlas IP whitelist missing EC2 IP | Add `0.0.0.0/0` to Network Access |
| Backend logs `[Redis] connection error` repeatedly | `REDIS_URL` wrong | Re-copy from Redis Cloud "Connect" page; needs `rediss://` for TLS |
| AI engine: `botocore.errorfactory.ResourceNotFoundException: anthropic.claude-3-haiku-20240307-v1:0` | Model is Legacy on Cognizant account | Use `us.anthropic.claude-haiku-4-5-20251001-v1:0` (already in template) |
| Frontend → backend → CORS error | Amplify domain not in `FRONTEND_URL` | Add it (comma-separated) → `pm2 restart greenledger-backend --update-env` |
| Bedrock returns `ExpiredTokenException` after a few hours | STS tokens expired | Get fresh creds → update both `.env` files → `pm2 restart all --update-env` |
| Amplify build fails: "no package.json" | `appRoot` not set in `amplify.yml` | Confirm `amplify.yml` IS at the repo ROOT (not inside frontend/) |
