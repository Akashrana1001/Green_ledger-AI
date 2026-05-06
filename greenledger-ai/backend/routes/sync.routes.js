const express = require('express');
const Document = require('../models/Document');
const KpiResult = require('../models/KpiResult');
const { invalidateCache } = require('../middleware/cacheMiddleware');

const router = express.Router();

// POST /api/sync/kpi-result — called by Python AI engine (no user auth, internal service call)
router.post('/kpi-result', async (req, res) => {
  try {
    const { documentId, extractedRawValues, calculatedKpis, status, logMessage, aiInsights, processingTimeS } = req.body;

    if (!documentId || !status) {
      return res.status(400).json({ message: 'documentId and status are required' });
    }

    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const logEntry = { message: logMessage || `Processing ${status}` };
    const isTerminal = status === 'verified' || status === 'failed';
    await Document.findByIdAndUpdate(documentId, {
      status,
      extractedRawValues:  extractedRawValues || null,
      calculatedKpis:      calculatedKpis || null,
      ...(typeof processingTimeS === 'number' && { processingTimeS: Math.round(processingTimeS * 10) / 10 }),
      ...(isTerminal && { completedAt: new Date() }),
      $push: { processingLog: logEntry },
    });

    if (status === 'verified' && calculatedKpis) {
      let kpiResult = await KpiResult.findOne({
        companyId: document.companyId,
        financialYear: '2024-25',
      });

      if (!kpiResult) {
        kpiResult = await KpiResult.create({
          companyId: document.companyId,
          financialYear: '2024-25',
          reportStatus: 'in_progress',
          auditTrail: [{ action: 'KPI result created', triggeredBy: null }],
        });
      }

      const updateFields = buildKpiUpdateFields(document.brsrCategory, calculatedKpis);
      if (Object.keys(updateFields).length > 0) {
        await KpiResult.findByIdAndUpdate(kpiResult._id, { $set: updateFields });
      }

      /* Bust the cached /api/report/kpis response so the AI War Room dashboard
       * picks up the new values on its very next poll instead of waiting up to
       * 60 seconds for the stale entry to expire. Same for /analytics. */
      const cid = String(document.companyId);
      await Promise.all([
        invalidateCache(cid, '/api/report/kpis'),
        invalidateCache(cid, '/api/report/analytics'),
      ]);

      /* Merge AI insights — replace any existing insights for the same categories,
         accumulate insights across different categories. */
      if (Array.isArray(aiInsights) && aiInsights.length > 0) {
        const current = await KpiResult.findById(kpiResult._id).select('ai_insights');
        const incomingCategories = new Set(aiInsights.map(i => i.category));
        const retained = (current?.ai_insights || []).filter(i => !incomingCategories.has(i.category));
        await KpiResult.findByIdAndUpdate(kpiResult._id, {
          $set: { ai_insights: [...retained, ...aiInsights] },
        });
      }
    }

    res.status(200).json({ message: 'KPI result synced successfully' });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ message: 'Server error syncing KPI result' });
  }
});

/* KPIs where exactly 0 is a meaningful compliance result (zero incidents,
 * fines, breaches, etc.).  For every other field, 0 is treated as a failed
 * extraction and skipped — preventing a fresh extraction from wiping out
 * previously-valid dashboard data. */
const ZERO_ALLOWED = new Set([
  // POSH / labour
  'posh_complaints_count',
  'fatalities_employees', 'fatalities_workers',
  'total_recordable_injuries_employees',
  // Cyber / data security
  'data_breach_pct_incidents',
  'data_privacy_complaints', 'cyber_security_complaints',
  // Governance — counts
  'regulatory_fines_count', 'regulatory_fines_inr',
  'anti_competitive_cases', 'conflict_of_interest_complaints',
  // Consumer complaints (Principle 9)
  'advertising_complaints', 'essential_services_complaints',
  'restrictive_trade_complaints', 'unfair_trade_complaints',
  'product_recall_voluntary', 'product_recall_forced',
]);

const buildKpiUpdateFields = (brsrCategory, kpis) => {
  const fields = {};

  // ── Environmental KPI field names ──────────────────────────────────────────
  const envFields = [
    // Existing
    'scope1_tco2e', 'scope2_tco2e', 'ghg_intensity_ppp',
    'total_energy_kwh', 'renewable_energy_pct',
    'total_water_kl', 'water_intensity', 'water_recycled_pct',
    'total_waste_mt', 'waste_intensity', 'waste_recovered_pct',
    // New
    'scope3_tco2e',
    'total_energy_gj', 'renewable_energy_gj', 'energy_intensity_per_rupee',
    'ghg_intensity_per_rupee',
    'water_intensity_per_rupee',
    'water_withdrawal_surface_kl', 'water_withdrawal_ground_kl',
    'water_withdrawal_third_party_kl', 'water_discharged_kl',
    'hazardous_waste_mt', 'non_hazardous_waste_mt',
    'plastic_waste_mt', 'ewaste_mt',
    'waste_recycled_mt', 'waste_reused_mt', 'waste_landfill_mt',
    'nox_mt', 'sox_mt', 'pm_mt',
    // Additional air pollutants — BRSR Principle 6 Q5
    'pop_mt', 'voc_mt', 'hap_mt',
    // Additional waste types — BRSR Principle 6 Q8
    'bio_medical_waste_mt', 'construction_waste_mt',
    'battery_waste_mt', 'radioactive_waste_mt', 'waste_incinerated_mt',
  ];

  // ── Social KPI field names ─────────────────────────────────────────────────
  const socialFields = [
    // Existing
    'wellbeing_spend_pct_revenue', 'female_wage_pct', 'small_town_wage_pct',
    'msme_procurement_pct', 'posh_complaints_count',
    // New
    'ltifr_employees', 'ltifr_workers',
    'fatalities_employees', 'fatalities_workers',
    'total_recordable_injuries_employees',
    'permanent_employees_total', 'permanent_employees_male', 'permanent_employees_female',
    'contract_employees_total', 'differently_abled_employees',
    'median_wage_male_inr', 'median_wage_female_inr', 'median_wage_ratio',
    'safety_training_pct',
    'turnover_rate_male', 'turnover_rate_female',
    'women_in_board_pct',
    // Workers (BRSR Q18) and additional social fields
    'permanent_workers_total', 'permanent_workers_male', 'permanent_workers_female',
    'other_workers_total', 'other_employees_total', 'differently_abled_workers',
    'women_in_kmp_pct', 'union_membership_pct', 'human_rights_training_pct',
    // Employee benefits (Principle 3 EI 1)
    'health_insurance_employees_pct', 'health_insurance_workers_pct',
    'accident_insurance_employees_pct', 'accident_insurance_workers_pct',
    'maternity_benefits_pct', 'paternity_benefits_pct',
    'daycare_facilities_pct', 'pf_coverage_pct',
    'gratuity_coverage_pct', 'esi_coverage_pct',
  ];

  // ── Governance KPI field names ─────────────────────────────────────────────
  const govFields = [
    // Existing
    'data_breach_pct_incidents', 'accounts_payable_days',
    'related_party_purchase_pct', 'related_party_sales_pct',
    // New
    'regulatory_fines_count', 'regulatory_fines_inr',
    'anti_competitive_cases', 'conflict_of_interest_complaints',
    // Consumer complaints — BRSR Principle 9 EI 3
    'data_privacy_complaints', 'advertising_complaints',
    'cyber_security_complaints', 'essential_services_complaints',
    'restrictive_trade_complaints', 'unfair_trade_complaints',
    'product_recall_voluntary', 'product_recall_forced',
  ];

  // ── Financial data field names ─────────────────────────────────────────────
  const finFields = ['revenue_inr_crore', 'total_employees', 'financial_year'];

  for (const [key, value] of Object.entries(kpis)) {
    // Skip null / undefined — never overwrite existing data with absence
    if (value === null || value === undefined) continue;
    // Skip exact 0 / 0.0 unless this KPI is allowed to be 0 (zero-incident compliance fields).
    // Prevents a failed extraction (defaulted to 0) from wiping a previous valid value.
    if (typeof value === 'number' && value === 0 && !ZERO_ALLOWED.has(key)) continue;

    if (envFields.includes(key)) {
      fields[`environmentalKpis.${key}`] = value;
    } else if (socialFields.includes(key)) {
      fields[`socialKpis.${key}`] = value;
    } else if (govFields.includes(key)) {
      fields[`governanceKpis.${key}`] = value;
    } else if (finFields.includes(key)) {
      fields[`financialData.${key}`] = value;
    }
  }

  return fields;
};

module.exports = router;
module.exports.buildKpiUpdateFields = buildKpiUpdateFields;
