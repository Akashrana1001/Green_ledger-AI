require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');

const authRoutes = require('./routes/auth.routes');
const documentRoutes = require('./routes/document.routes');
const syncRoutes = require('./routes/sync.routes');
const reportRoutes = require('./routes/report.routes');
const qualitativeRoutes = require('./routes/qualitative.routes');
const scope3Routes = require('./routes/scope3.routes');
const settingsRoutes = require('./routes/settings.routes');
const chatRoutes     = require('./routes/chat.routes');
const systemRoutes   = require('./routes/system.routes');

const app = express();

/* CORS: allow a comma-separated list of origins so we can support both Vite's
 * default (:5173) and the customised dev port (:3000) without redeploying.
 * Must be registered BEFORE the rate limiter so OPTIONS preflight requests
 * receive CORS headers even when rate-limit headers are also being written. */
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000,http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin/curl/Postman (no Origin header) and any whitelisted origin
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked: origin '${origin}' not in ${allowedOrigins.join(', ')}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

if (process.env.LOCAL_MODE === 'true') {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
  console.log('LOCAL_MODE: serving uploads from ./uploads/');
}

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'GreenLedger API' }));

// Proxy AI engine health — avoids CORS issues from the browser
app.get('/api/health/engine', async (req, res) => {
  try {
    const aiUrl = process.env.AI_ENGINE_URL || 'http://localhost:8000';
    const response = await axios.get(`${aiUrl}/health`, { timeout: 3000 });
    res.json(response.data);
  } catch {
    res.status(503).json({ status: 'offline', service: 'GreenLedger AI Engine' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/qualitative', qualitativeRoutes);
app.use('/api/scope3', scope3Routes);
app.use('/api/settings', settingsRoutes);
app.use('/api/chat',    chatRoutes);
app.use('/api/system', systemRoutes);

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');

    // Start BullMQ worker — falls back gracefully if Redis is not running
    try {
      const { startDocumentWorker } = require('./workers/documentWorker');
      startDocumentWorker();
    } catch (workerErr) {
      console.warn('Could not start BullMQ worker (Redis may be offline):', workerErr.message);
      console.warn('Document processing will use direct trigger (fire-and-forget) as fallback.');
    }

    app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
