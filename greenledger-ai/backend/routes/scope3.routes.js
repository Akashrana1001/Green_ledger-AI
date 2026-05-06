/**
 * /api/scope3 — Value-Chain (Scope 3) supplier aggregation
 *
 * Aggregates emissions data from supplier-uploaded documents so the Admin
 * dashboard can render a network graph of value-chain partners. Returns
 * only data scoped to the requesting Admin's company; no cross-company
 * leakage.
 */
const express = require('express');
const User = require('../models/User');
const Document = require('../models/Document');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');

const router = express.Router();

/* ─────────────────────────────────────────────────────────────────────────
 * GET /api/scope3/suppliers — supplier-level emissions roll-up
 *
 * Returns:
 *   {
 *     suppliers: [{ id, name, email, docCount, verifiedCount,
 *                   scope3_tco2e, water_kl, waste_mt, lastActivity }],
 *     totals:    { totalScope3, supplierCount, verifiedDocs, totalDocs,
 *                  topEmitter, verifiedPct }
 *   }
 *
 * Numbers are summed from the per-document `calculatedKpis` field — no
 * mock data, no LLM-side math.
 * ─────────────────────────────────────────────────────────────────────── */
router.get('/suppliers', authMiddleware, allowRoles('Admin'), async (req, res) => {
  try {
    const companyId = req.user.companyId;

    // Pull all suppliers in this company
    const suppliers = await User.find({ companyId, role: 'Supplier' })
      .select('fullName email phone department designation createdAt')
      .lean();

    // Pull every document belonging to those suppliers — single query, then
    // partition in memory to avoid N+1 round-trips.
    const supplierIds = suppliers.map(s => s._id);
    const docs = await Document.find({ companyId, uploadedBy: { $in: supplierIds } })
      .select('uploadedBy status calculatedKpis brsrCategory updatedAt createdAt')
      .lean();

    // Group documents by supplier id
    const byUser = new Map();
    for (const d of docs) {
      const k = String(d.uploadedBy);
      if (!byUser.has(k)) byUser.set(k, []);
      byUser.get(k).push(d);
    }

    const supplierRows = suppliers.map(s => {
      const list = byUser.get(String(s._id)) || [];
      const verified = list.filter(d => d.status === 'verified');

      // Sum the relevant numeric KPIs across this supplier's verified docs.
      let scope3 = 0, water = 0, waste = 0;
      for (const d of verified) {
        const k = d.calculatedKpis || {};
        if (typeof k.scope3_tco2e   === 'number') scope3 += k.scope3_tco2e;
        if (typeof k.total_water_kl === 'number') water  += k.total_water_kl;
        if (typeof k.total_waste_mt === 'number') waste  += k.total_waste_mt;
      }

      const lastActivity = list
        .map(d => d.updatedAt || d.createdAt)
        .sort((a, b) => new Date(b) - new Date(a))[0] || s.createdAt;

      return {
        id:             String(s._id),
        name:           s.fullName,
        email:          s.email,
        department:     s.department || '',
        designation:    s.designation || '',
        docCount:       list.length,
        verifiedCount:  verified.length,
        scope3_tco2e:   Number(scope3.toFixed(2)),
        water_kl:       Number(water.toFixed(2)),
        waste_mt:       Number(waste.toFixed(2)),
        lastActivity,
      };
    });

    // Aggregate totals
    const totalScope3   = supplierRows.reduce((acc, s) => acc + s.scope3_tco2e, 0);
    const totalDocs     = docs.length;
    const verifiedDocs  = docs.filter(d => d.status === 'verified').length;
    const verifiedPct   = totalDocs ? Math.round((verifiedDocs / totalDocs) * 100) : 0;
    const topEmitter    = [...supplierRows].sort((a, b) => b.scope3_tco2e - a.scope3_tco2e)[0] || null;

    res.json({
      suppliers: supplierRows,
      totals: {
        totalScope3:    Number(totalScope3.toFixed(2)),
        supplierCount:  suppliers.length,
        verifiedDocs,
        totalDocs,
        verifiedPct,
        topEmitter:     topEmitter ? { name: topEmitter.name, scope3_tco2e: topEmitter.scope3_tco2e } : null,
      },
    });
  } catch (err) {
    console.error('Scope 3 aggregation error:', err);
    res.status(500).json({ message: 'Failed to load supplier graph' });
  }
});

module.exports = router;
