#!/bin/bash
# GreenLedger AI — post-deploy health probe.
# Returns exit 0 only when every component answers correctly.
#
#   ./healthcheck.sh                            # uses defaults
#   ./healthcheck.sh https://main.dXYZ.amplifyapp.com   # also probe Amplify

set +e
FRONTEND_URL="${1:-}"
PASS="\033[0;32m✓\033[0m"
FAIL="\033[0;31m✗\033[0m"
ok=0; fail=0

# Pull REDIS_URL from backend .env if present (used by the redis check)
ENV_FILE="$(dirname "$0")/../backend/.env"
if [ -f "$ENV_FILE" ]; then
  export $(grep -E '^REDIS_URL=' "$ENV_FILE" | sed 's/#.*//' | xargs -d '\n' -I{} echo {})
fi

probe() {
  local name="$1" url="$2" expect="$3"
  local body
  body=$(curl -sS --max-time 8 "$url" 2>&1 || true)
  if echo "$body" | grep -q "$expect"; then
    echo -e "  $PASS  $name"
    ok=$((ok+1))
  else
    echo -e "  $FAIL  $name  →  $url"
    echo -e "         got: $(echo "$body" | head -c 140)"
    fail=$((fail+1))
  fi
}

echo ""
echo "═══════════════════════════════════════════════"
echo "  GreenLedger AI · Production Health Check"
echo "═══════════════════════════════════════════════"

echo ""
echo "Backend (Node.js, :5000)"
probe "GET /api/health"        "http://localhost:5000/api/health"        '"status":"ok"'
probe "GET /api/health/engine" "http://localhost:5000/api/health/engine" '"ollama_connected"'

echo ""
echo "AI Engine (FastAPI, :8000 — internal only)"
probe "GET /health"            "http://127.0.0.1:8000/health"            '"status":"ok"'

echo ""
echo "Redis (BullMQ queue backend)"
if [ -n "${REDIS_URL:-}" ]; then
  if redis-cli -u "$REDIS_URL" ping 2>/dev/null | grep -q PONG; then
    echo -e "  $PASS  Redis Cloud reachable"
    ok=$((ok+1))
  else
    echo -e "  $FAIL  Redis Cloud unreachable — check REDIS_URL in backend/.env"
    fail=$((fail+1))
  fi
else
  echo -e "  $FAIL  REDIS_URL not set in backend/.env"
  fail=$((fail+1))
fi

if [ -n "$FRONTEND_URL" ]; then
  echo ""
  echo "Amplify Frontend"
  probe "GET / (HTML title)" "$FRONTEND_URL" "<title>"
fi

echo ""
echo "PM2 process status"
if command -v pm2 &> /dev/null; then
  pm2 jlist 2>/dev/null | python3.11 -c "
import json, sys
try:
    apps = json.loads(sys.stdin.read() or '[]')
    for a in apps:
        status = a.get('pm2_env', {}).get('status', 'unknown')
        name   = a.get('name', '?')
        marker = '\033[0;32m✓\033[0m' if status == 'online' else '\033[0;31m✗\033[0m'
        print(f'  {marker}  {name:30s} {status}')
except Exception as e:
    print(f'  (could not parse pm2 output: {e})')
"
fi

echo ""
echo "═══════════════════════════════════════════════"
if [ $fail -eq 0 ]; then
  echo -e "  \033[1;32m$ok passed · 0 failed — all systems green\033[0m"
  echo "═══════════════════════════════════════════════"
  exit 0
else
  echo -e "  \033[1;31m$fail failed · $ok passed\033[0m"
  echo "═══════════════════════════════════════════════"
  exit 1
fi
