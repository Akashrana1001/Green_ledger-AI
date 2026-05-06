/**
 * POST /api/chat/ask — "Chat with your ESG Report"
 *
 * Takes a plain-language question, injects the company's verified KPI data
 * as context, and routes the call to Ollama (LOCAL_MODE) or the AI engine's
 * /chat proxy (AWS Bedrock).  No RAG needed — the full KpiResult JSON fits
 * comfortably in a single LLM context window.
 */
const express    = require('express');
const axios      = require('axios');
const KpiResult  = require('../models/KpiResult');
const authMiddleware = require('../middleware/authMiddleware');
const { resolveLocalMode } = require('../services/aiEngineService');

const router = express.Router();

/* Build a compact, token-efficient context string from the KPI document. */
function buildKpiContext(kpiResult) {
  if (!kpiResult) return 'No verified KPI data available yet.';

  const env = kpiResult.environmentalKpis || {};
  const soc = kpiResult.socialKpis        || {};
  const gov = kpiResult.governanceKpis    || {};
  const fin = kpiResult.financialData     || {};

  const lines = [];

  const add = (label, value, unit = '') => {
    if (value !== null && value !== undefined && value !== 0 || value === 0) {
      lines.push(`${label}: ${value}${unit ? ' ' + unit : ''}`);
    }
  };

  lines.push('=== ENVIRONMENTAL ===');
  add('Scope 1 GHG',          env.scope1_tco2e,          'tCO₂e');
  add('Scope 2 GHG',          env.scope2_tco2e,          'tCO₂e');
  add('Scope 3 GHG',          env.scope3_tco2e,          'tCO₂e');
  add('Total Energy',         env.total_energy_kwh,       'kWh');
  add('Renewable Energy',     env.renewable_energy_pct,   '%');
  add('Total Water',          env.total_water_kl,         'KL');
  add('Water Recycled',       env.water_recycled_pct,     '%');
  add('Total Waste',          env.total_waste_mt,         'MT');
  add('Waste Recovered',      env.waste_recovered_pct,    '%');
  add('GHG Intensity',        env.ghg_intensity_per_rupee,'tCO₂e/Cr');

  lines.push('=== SOCIAL ===');
  add('Female Wage Parity',    soc.female_wage_pct,            '%');
  add('Wellbeing Spend',       soc.wellbeing_spend_pct_revenue,'% of revenue');
  add('MSME Procurement',      soc.msme_procurement_pct,       '%');
  add('LTIFR Employees',       soc.ltifr_employees,            'per million hrs');
  add('LTIFR Workers',         soc.ltifr_workers,              'per million hrs');
  add('Fatalities (Employees)',soc.fatalities_employees,       '');
  add('Permanent Employees',   soc.permanent_employees_total,  '');
  add('Women on Board',        soc.women_in_board_pct,         '%');

  lines.push('=== GOVERNANCE ===');
  add('Payable Days',          gov.accounts_payable_days,      'days');
  add('Data Breach',           gov.data_breach_pct_incidents,  '% of cyber events');
  add('Related Party Buy',     gov.related_party_purchase_pct, '%');
  add('Regulatory Fines',      gov.regulatory_fines_count,     'incidents');

  lines.push('=== FINANCIAL ===');
  add('Revenue',               fin.revenue_inr_crore,          'INR Crore');

  return lines.filter(Boolean).join('\n');
}

/* POST /api/chat/ask */
router.post('/ask', authMiddleware, async (req, res) => {
  try {
    const { question } = req.body || {};
    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ message: 'question is required' });
    }

    const kpiResult = await KpiResult.findOne({
      companyId: req.user.companyId,
      financialYear: '2024-25',
    });

    const kpiContext = buildKpiContext(kpiResult);
    const localMode  = await resolveLocalMode(req.user.companyId);
    const aiUrl      = process.env.AI_ENGINE_URL || 'http://localhost:8000';

    let answer;

    if (localMode) {
      /* ── LOCAL: call Ollama directly via AI engine proxy ─────────────── */
      const res2 = await axios.post(
        `${aiUrl}/chat`,
        { question: question.trim(), kpi_context: kpiContext, local_mode: true },
        { timeout: 120000 }
      );
      answer = res2.data?.answer || 'No response from local model.';
    } else {
      /* ── AWS: route through AI engine (it holds the Bedrock credentials) */
      const res2 = await axios.post(
        `${aiUrl}/chat`,
        { question: question.trim(), kpi_context: kpiContext, local_mode: false },
        { timeout: 60000 }
      );
      answer = res2.data?.answer || 'No response from AI engine.';
    }

    res.json({ answer });
  } catch (err) {
    const detail = err.response?.data?.detail || err.response?.data?.message || err.message;
    console.error('Chat ask error:', detail);
    res.status(500).json({ message: `Chat failed: ${detail}` });
  }
});

module.exports = router;
