/**
 * /api/settings — runtime configuration toggles editable from the Admin UI
 *
 * Currently exposes:
 *   GET  /api/settings/inference-mode   → { mode, ollamaReachable? }
 *   POST /api/settings/inference-mode   → { mode } where mode ∈ {'aws','local'}
 *
 * The Admin user toggling to 'local' must have a local Ollama instance
 * reachable at OLLAMA_BASE_URL (default localhost:11434). The frontend
 * pings /api/health/engine before calling POST to surface an actionable
 * error before the user picks 'local'.
 */
const express = require('express');
const Settings = require('../models/Settings');
const Company  = require('../models/Company');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');

const router = express.Router();

/* Get current inference mode for the requesting Admin's company.
 *
 * Resolution order (env is the *initial-state* default only):
 *   1. Persisted Settings.inferenceMode in MongoDB (set by user toggle clicks).
 *   2. Fallback: .env LOCAL_MODE → 'local' if true, else 'aws'.
 *
 * Once the user clicks the toggle, the choice lives in MongoDB and .env stops
 * mattering. The frontend toggle's pre-flight ping is independent of .env.
 */
router.get('/inference-mode', authMiddleware, async (req, res) => {
  try {
    const doc = await Settings.findOne({ companyId: req.user.companyId });
    const envDefault = process.env.LOCAL_MODE === 'true' ? 'local' : 'aws';
    res.json({ mode: doc?.inferenceMode || envDefault });
  } catch (err) {
    console.error('Get inference-mode error:', err);
    res.status(500).json({ message: 'Failed to read settings' });
  }
});

/* Update inference mode (Admin-only) */
router.post('/inference-mode', authMiddleware, allowRoles('Admin'), async (req, res) => {
  try {
    const { mode } = req.body || {};
    if (!['aws', 'local'].includes(mode)) {
      return res.status(400).json({ message: "mode must be 'aws' or 'local'" });
    }
    const doc = await Settings.findOneAndUpdate(
      { companyId: req.user.companyId },
      { $set: { inferenceMode: mode } },
      { upsert: true, new: true }
    );
    res.json({ mode: doc.inferenceMode, message: `Inference mode set to ${mode}` });
  } catch (err) {
    console.error('Set inference-mode error:', err);
    res.status(500).json({ message: 'Failed to update settings' });
  }
});

/* ── Company settings ─────────────────────────────────────────────────────── */

/* GET /api/settings/company — return company record for the Admin's company */
router.get('/company', authMiddleware, allowRoles('Admin'), async (req, res) => {
  try {
    const company = await Company.findById(req.user.companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    res.json({ company });
  } catch (err) {
    console.error('Get company error:', err);
    res.status(500).json({ message: 'Failed to load company' });
  }
});

/* PATCH /api/settings/company — update editable company fields (CIN and companyName are immutable) */
router.patch('/company', authMiddleware, allowRoles('Admin'), async (req, res) => {
  try {
    const EDITABLE = [
      'industrySector', 'yearOfIncorporation', 'registeredAddress',
      'website', 'stockExchange', 'paidUpCapital', 'reportingBoundary',
      'brContactName', 'brContactEmail', 'brContactPhone',
    ];
    const update = {};
    for (const k of EDITABLE) {
      if (typeof req.body[k] === 'string') {
        const v = req.body[k].trim();
        if (k === 'reportingBoundary' && v === '') continue; // keep existing value
        update[k] = v;
      }
    }
    const company = await Company.findByIdAndUpdate(
      req.user.companyId,
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!company) return res.status(404).json({ message: 'Company not found' });
    res.json({ company, message: 'Company details updated' });
  } catch (err) {
    console.error('Update company error:', err);
    res.status(500).json({ message: 'Failed to update company details' });
  }
});

module.exports = router;
