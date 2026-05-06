/**
 * PM2 ecosystem — single source of truth for production process management.
 *
 * Layout:
 *   greenledger-backend     → Node.js Express server on :5000   (public via security group)
 *   greenledger-ai-engine   → FastAPI/uvicorn server on :8000   (127.0.0.1 only — internal)
 *
 * Critical PM2 quirks baked in below:
 *   - interpreter: 'none' on the AI engine prevents PM2 from prepending node
 *     to a Python binary (otherwise: "SyntaxError: invalid syntax").
 *   - script points at the venv binary directly so the venv's site-packages
 *     are inherited without sourcing activate (PM2 spawns without a shell).
 *   - max_memory_restart guards against memory leaks taking down the box.
 *
 * Deploy from /home/ubuntu/GreenLedger-Main/greenledger-ai with:
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup        (then run the printed sudo command once)
 */
module.exports = {
  apps: [
    {
      name: 'greenledger-backend',
      cwd: './backend',
      script: 'server.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: { NODE_ENV: 'production' },
      error_file: '/home/ubuntu/.pm2/logs/backend-err.log',
      out_file:   '/home/ubuntu/.pm2/logs/backend-out.log',
      time: true,
      kill_timeout: 5000,
    },
    {
      name: 'greenledger-ai-engine',
      cwd: './ai-engine',
      script: './venv/bin/uvicorn',
      args:   'main:app --host 127.0.0.1 --port 8000 --workers 1',
      interpreter: 'none',
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      error_file: '/home/ubuntu/.pm2/logs/ai-err.log',
      out_file:   '/home/ubuntu/.pm2/logs/ai-out.log',
      time: true,
      kill_timeout: 10000,
    },
  ],
};
