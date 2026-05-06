const express = require('express');
const mongoose = require('mongoose');
const Document = require('../models/Document');
const KpiResult = require('../models/KpiResult');
const QualitativeResponse = require('../models/QualitativeResponse');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');
const { buildKpiUpdateFields } = require('./sync.routes');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');

const router = express.Router();

const MANDATORY_CATEGORIES = [
  'electricity_bill', 'fuel_consumption', 'water_usage',
  'waste_records', 'hr_wages_data', 'accounts_payable',
];

// GET /api/report/kpis — Admin only; short-lived cache (busted on sync) so the
// War Room dashboard reflects newly verified documents within a few seconds.
router.get('/kpis', authMiddleware, allowRoles('Admin'), cacheMiddleware(5), async (req, res) => {
  try {
    const kpiResult = await KpiResult.findOne({
      companyId: req.user.companyId,
      financialYear: '2024-25',
    });

    const verifiedDocs = await Document.find({
      companyId: req.user.companyId,
      status: 'verified',
    }).select('brsrCategory');

    const verifiedCategories = [...new Set(verifiedDocs.map((d) => d.brsrCategory))];
    const mandatoryComplete = MANDATORY_CATEGORIES.every((cat) => verifiedCategories.includes(cat));

    res.status(200).json({
      kpiResult: kpiResult || null,
      verifiedCategories,
      mandatoryComplete,
      mandatoryCategories: MANDATORY_CATEGORIES,
    });
  } catch (err) {
    console.error('Get KPIs error:', err);
    res.status(500).json({ message: 'Server error fetching KPIs' });
  }
});

// GET /api/report/generate — Admin only; blocked until all mandatory categories verified
router.get('/generate', authMiddleware, allowRoles('Admin'), async (req, res) => {
  try {
    const verifiedDocs = await Document.find({
      companyId: req.user.companyId,
      status: 'verified',
    }).select('brsrCategory');

    const verifiedCategories = [...new Set(verifiedDocs.map((d) => d.brsrCategory))];
    const missing = MANDATORY_CATEGORIES.filter((cat) => !verifiedCategories.includes(cat));

    if (missing.length > 0) {
      return res.status(400).json({
        message: 'Cannot generate report: mandatory categories not yet verified',
        missingCategories: missing,
      });
    }

    const kpiResult = await KpiResult.findOne({
      companyId: req.user.companyId,
      financialYear: '2024-25',
    }).populate('companyId', 'companyName CIN industrySector yearOfIncorporation registeredAddress website stockExchange paidUpCapital reportingBoundary brContactName brContactEmail brContactPhone');

    if (!kpiResult) {
      return res.status(404).json({ message: 'No KPI data found for this company' });
    }

    const qualDoc = await QualitativeResponse.findOne({
      companyId: req.user.companyId,
      financialYear: '2024-25',
    }).populate('responses.answeredBy', 'fullName');

    await KpiResult.findByIdAndUpdate(kpiResult._id, {
      reportStatus: 'complete',
      generatedAt: new Date(),
      $push: { auditTrail: { action: 'BRSR report generated', triggeredBy: null } },
    });

    const company = kpiResult.companyId;
    const env = kpiResult.environmentalKpis || {};
    const soc = kpiResult.socialKpis || {};
    const gov = kpiResult.governanceKpis || {};
    const fin = kpiResult.financialData || {};

    /* ── Section A arrays — extract from extractedRawValues of verified docs ── */

    // Query ALL verified docs — Section A arrays can appear in any document type
    // (users often upload full annual reports / BRSR reports under various categories).
    const sectionADocs = await Document.find({
      companyId: req.user.companyId,
      status: 'verified',
    }).select('brsrCategory extractedRawValues');

    // First non-null hit from a list of key names (multi-name LLM key lookup)
    const pick = (obj, ...keys) => {
      for (const k of keys) { const v = obj?.[k]; if (v !== undefined && v !== null) return v; }
      return undefined;
    };
    // First non-empty array hit from a list of key names
    const arrOf = (obj, ...keys) => {
      for (const k of keys) { const v = obj?.[k]; if (Array.isArray(v) && v.length) return v; }
      return null;
    };

    let businessActivities = [];
    let products           = [];
    let subsidiaries       = [];
    let materialIssues     = [];
    let operations         = { national: {}, international: {} };

    for (const doc of sectionADocs) {
      const raw = doc.extractedRawValues || {};

      // Q14 — Details of business activities (LLM field: products_services / business_activities)
      if (!businessActivities.length) {
        const src = arrOf(raw, 'products_services', 'business_activities', 'business_activity',
                                'main_activities', 'activities');
        if (src) {
          businessActivities = src
            .map(item => ({
              mainActivity:     pick(item, 'description_of_main_activity', 'main_activity', 'mainActivity', 'activity') || '',
              businessActivity: pick(item, 'description_of_business_activity', 'business_activity', 'businessActivity', 'description') || '',
              turnoverPct:      pick(item, 'percentage_of_turnover', 'turnover_pct', 'turnoverPct', 'pct_of_turnover') ?? null,
            }))
            .filter(r => r.mainActivity || r.businessActivity);
        }
      }

      // Q15 — Products/Services sold by the entity
      if (!products.length) {
        // Try dedicated product arrays first
        const src = arrOf(raw, 'products_sold', 'products', 'services_sold',
                               'products_services_sold', 'product_list', 'service_list');
        if (src) {
          products = src
            .map(item => ({
              product:    pick(item, 'product', 'product_service', 'name', 'service', 'description') || '',
              nicCode:    pick(item, 'nic_code', 'nicCode', 'nic', 'NIC_code', 'NIC') || '',
              turnoverPct: pick(item, 'percentage_of_turnover', 'turnover_pct', 'turnoverPct', 'contribution_pct') ?? null,
            }))
            .filter(r => r.product);
        }
        // Fallback: products_services is the same source as Q14 — use business_activity
        // field as the product/service name (it's the more specific of the two columns).
        if (!products.length) {
          const fallbackSrc = arrOf(raw, 'products_services', 'business_activities',
                                         'business_activity', 'main_activities', 'activities');
          if (fallbackSrc) {
            products = fallbackSrc
              .map(item => ({
                product:    pick(item, 'description_of_business_activity', 'business_activity',
                                       'businessActivity', 'description_of_main_activity',
                                       'main_activity', 'activity') || '',
                nicCode:    pick(item, 'nic_code', 'nicCode', 'nic') || '',
                turnoverPct: pick(item, 'percentage_of_turnover', 'turnover_pct', 'turnoverPct') ?? null,
              }))
              .filter(r => r.product);
          }
        }
      }

      // Q21 — Holding / Subsidiary / Associate companies
      if (!subsidiaries.length) {
        const src = arrOf(raw, 'subsidiaries', 'holding_companies', 'subsidiary_details',
                               'associate_companies', 'joint_ventures', 'group_companies');
        if (src) {
          subsidiaries = src
            .map(item => ({
              name:        pick(item, 'name', 'company_name', 'entity_name') || '',
              type:        pick(item, 'type', 'relationship', 'category', 'entity_type') || '',
              sharesPct:   pick(item, 'shares_pct', 'percentage_held', 'shareholding_pct', 'stake') ?? null,
              participates: pick(item, 'participates', 'br_participation', 'br_initiatives', 'br_participation_yes_no') || '',
            }))
            .filter(r => r.name);
        }
      }

      // Q24 — Material responsible business conduct issues
      if (!materialIssues.length) {
        const src = arrOf(raw, 'material_issues', 'material_risks', 'esg_risks',
                               'material_topics', 'material_matters', 'key_risks');
        if (src) {
          materialIssues = src
            .map(item => ({
              issue:      pick(item, 'issue', 'material_issue', 'topic', 'name', 'risk') || '',
              type:       pick(item, 'type', 'risk_opportunity', 'category', 'r_or_o') || '',
              rationale:  pick(item, 'rationale', 'reason', 'basis', 'why') || '',
              mitigation: pick(item, 'mitigation', 'approach', 'response', 'adaptation') || '',
              financial:  pick(item, 'financial_implications', 'financial', 'financial_impact', 'implication') || '',
            }))
            .filter(r => r.issue);
        }
      }

      // Q16 — Operations / locations
      if (!operations.national.plants && !operations.national.offices) {
        const locs = pick(raw, 'locations', 'operations', 'plant_locations', 'office_locations');
        if (locs && typeof locs === 'object' && !Array.isArray(locs)) {
          operations = {
            national: {
              plants:  pick(locs, 'national_plants', 'plants_national') ?? locs.national?.plants ?? null,
              offices: pick(locs, 'national_offices', 'offices_national') ?? locs.national?.offices ?? null,
              total:   pick(locs, 'national_total') ?? locs.national?.total ?? null,
            },
            international: {
              plants:  pick(locs, 'international_plants') ?? locs.international?.plants ?? null,
              offices: pick(locs, 'international_offices') ?? locs.international?.offices ?? null,
              total:   pick(locs, 'international_total') ?? locs.international?.total ?? null,
            },
          };
        }
      }
    }

    const report = {
      reportMetadata: {
        standard: 'SEBI BRSR',
        version: '2023-24',
        generatedAt: new Date().toISOString(),
        financialYear: kpiResult.financialYear,
        company: {
          name: company.companyName,
          CIN: company.CIN,
          sector: company.industrySector,
        },
      },

      sectionA: {
        title: 'General Disclosures',
        companyDetails: {
          companyName: company.companyName,
          CIN: company.CIN,
          industrySector: company.industrySector,
          yearOfIncorporation: company.yearOfIncorporation,
          registeredAddress: company.registeredAddress,
          website: company.website,
          stockExchange: company.stockExchange,
          paidUpCapital: company.paidUpCapital,
          reportingBoundary: company.reportingBoundary || 'standalone',
          brContact: { name: company.brContactName, email: company.brContactEmail, phone: company.brContactPhone },
        },
        financialData: {
          revenueInrCrore: fin.revenue_inr_crore,
          totalEmployees: fin.total_employees,
          financialYear: fin.financial_year || kpiResult.financialYear,
        },
        // Section A array tables — extracted above from verified docs' extractedRawValues
        businessActivities,
        products,
        subsidiaries,
        materialIssues,
        operations,
        // Q18 Employees & Workers — derived from verified KpiResult social KPIs
        employees: (() => {
          const safePct = (n, d) => (d > 0 ? Math.round((n / d) * 10000) / 100 : null);
          const pA  = soc.permanent_employees_total  || 0;
          const pM  = soc.permanent_employees_male   || 0;
          const pF  = soc.permanent_employees_female || 0;
          const oA  = soc.other_employees_total      || 0;
          const tA  = pA + oA;
          const pwA = soc.permanent_workers_total    || 0;
          const pwM = soc.permanent_workers_male     || 0;
          const pwF = soc.permanent_workers_female   || 0;
          const owA = soc.other_workers_total        || 0;
          const twA = pwA + owA;
          return {
            permEmpA:      pA || null, permEmpMaleN: pM || null, permEmpMalePct: safePct(pM, pA),
            permEmpFemN:   pF || null, permEmpFemPct: safePct(pF, pA),
            otherEmpA:     oA || null, otherEmpMaleN: null, otherEmpMalePct: null,
            otherEmpFemN:  null,       otherEmpFemPct: null,
            totalEmpA:     tA || null, totalEmpMaleN: pM || null, totalEmpMalePct: safePct(pM, tA),
            totalEmpFemN:  pF || null, totalEmpFemPct: safePct(pF, tA),
            permWrkA:      pwA || null, permWrkMaleN: pwM || null, permWrkMalePct: safePct(pwM, pwA),
            permWrkFemN:   pwF || null, permWrkFemPct: safePct(pwF, pwA),
            otherWrkA:     owA || null, otherWrkMaleN: null, otherWrkMalePct: null,
            otherWrkFemN:  null,        otherWrkFemPct: null,
            totalWrkA:     twA || null, totalWrkMaleN: pwM || null, totalWrkMalePct: safePct(pwM, twA),
            totalWrkFemN:  pwF || null, totalWrkFemPct: safePct(pwF, twA),
          };
        })(),
        // Q19 Women representation — from social KPIs
        women: {
          boardTotal: null,
          boardNo:    null,
          boardPct:   soc.women_in_board_pct || null,
          kmpTotal:   null,
          kmpNo:      null,
          kmpPct:     soc.women_in_kmp_pct   || null,
        },
      },

      sectionB: {
        title: 'Management and Process Disclosures',
        completionStatus: {
          answered: qualDoc ? qualDoc.responses.filter(r => r.status === 'answered').length : 0,
          total: 31,
        },
        responses: qualDoc ? qualDoc.responses.map(r => ({
          questionId: r.questionId,
          status: r.status,
          answerYesNo: r.answerYesNo,
          answer: r.answer,
          webLink: r.webLink,
          notes: r.notes,
          answeredBy: r.answeredBy?.fullName,
          answeredAt: r.answeredAt,
        })) : [],
      },

      sectionC: {
        title: 'Principle-wise Performance Disclosure',

        principle1_ethics: {
          title: 'Businesses should conduct and govern themselves with integrity',
          regulatoryFinesCount: gov.regulatory_fines_count,
          regulatoryFinesInr: gov.regulatory_fines_inr,
          antiCompetitiveCases: gov.anti_competitive_cases,
          conflictOfInterestComplaints: gov.conflict_of_interest_complaints,
          relatedPartyPurchasePct: gov.related_party_purchase_pct,
          relatedPartySalesPct: gov.related_party_sales_pct,
        },

        principle3_employee_wellbeing: {
          title: 'Businesses should respect and promote the well-being of all employees',
          ltifr: {
            employees: soc.ltifr_employees,
            workers: soc.ltifr_workers,
          },
          fatalities: {
            employees: soc.fatalities_employees,
            workers: soc.fatalities_workers,
          },
          recordableInjuries: {
            employees: soc.total_recordable_injuries_employees,
          },
          wellbeingSpendPctRevenue: soc.wellbeing_spend_pct_revenue,
          safetyTrainingPct: soc.safety_training_pct,
          turnoverRate: {
            permanentMale: soc.turnover_rate_male,
            permanentFemale: soc.turnover_rate_female,
          },
          benefitCoverage: {
            healthInsuranceEmployeesPct: soc.health_insurance_employees_pct,
            healthInsuranceWorkersPct: soc.health_insurance_workers_pct,
            accidentInsuranceEmployeesPct: soc.accident_insurance_employees_pct,
            accidentInsuranceWorkersPct: soc.accident_insurance_workers_pct,
            maternityBenefitsPct: soc.maternity_benefits_pct,
            paternityBenefitsPct: soc.paternity_benefits_pct,
            daycareFacilitiesPct: soc.daycare_facilities_pct,
            pfCoveragePct: soc.pf_coverage_pct,
            gratuityCoveragePct: soc.gratuity_coverage_pct,
            esiCoveragePct: soc.esi_coverage_pct,
          },
        },

        principle5_human_rights: {
          title: 'Businesses should respect and promote human rights',
          medianWageMaleInr: soc.median_wage_male_inr,
          medianWageFemaleInr: soc.median_wage_female_inr,
          genderPayRatio: soc.median_wage_ratio,
          poshComplaintsCount: soc.posh_complaints_count,
          femaleWagePct: soc.female_wage_pct,
          humanRightsTrainingPct: soc.human_rights_training_pct,
        },

        principle6_environment: {
          title: 'Businesses should respect and make efforts to protect and restore the environment',

          energy: {
            totalEnergyKwh: env.total_energy_kwh,
            totalEnergyGj: env.total_energy_gj,
            renewableEnergyGj: env.renewable_energy_gj,
            renewableEnergyPct: env.renewable_energy_pct,
            intensityPerRupee: env.energy_intensity_per_rupee,
          },

          ghg: {
            scope1Tco2e: env.scope1_tco2e,
            scope2Tco2e: env.scope2_tco2e,
            scope3Tco2e: env.scope3_tco2e,
            intensityPpp: env.ghg_intensity_ppp,
            intensityPerRupee: env.ghg_intensity_per_rupee,
          },

          water: {
            withdrawalSurfaceKl: env.water_withdrawal_surface_kl,
            withdrawalGroundKl: env.water_withdrawal_ground_kl,
            withdrawalThirdPartyKl: env.water_withdrawal_third_party_kl,
            totalConsumptionKl: env.total_water_kl,
            dischargedKl: env.water_discharged_kl,
            recycledPct: env.water_recycled_pct,
            intensityPerRupee: env.water_intensity_per_rupee,
            intensityPerRevenue: env.water_intensity,
          },

          waste: {
            totalMt: env.total_waste_mt,
            hazardousMt: env.hazardous_waste_mt,
            nonHazardousMt: env.non_hazardous_waste_mt,
            plasticMt: env.plastic_waste_mt,
            ewasteMt: env.ewaste_mt,
            bioMedicalMt: env.bio_medical_waste_mt,
            constructionMt: env.construction_waste_mt,
            batteryMt: env.battery_waste_mt,
            radioactiveMt: env.radioactive_waste_mt,
            recycledMt: env.waste_recycled_mt,
            reusedMt: env.waste_reused_mt,
            landfillMt: env.waste_landfill_mt,
            incineratedMt: env.waste_incinerated_mt,
            recoveredPct: env.waste_recovered_pct,
            intensityPerRevenue: env.waste_intensity,
          },

          airEmissions: {
            noxMt: env.nox_mt,
            soxMt: env.sox_mt,
            pmMt: env.pm_mt,
            popMt: env.pop_mt,
            vocMt: env.voc_mt,
            hapMt: env.hap_mt,
          },
        },

        principle8_inclusive_growth: {
          title: 'Businesses should promote inclusive growth and equitable development',
          msmeProcurementPct: soc.msme_procurement_pct,
          smallTownWagePct: soc.small_town_wage_pct,
        },

        principle9_consumer: {
          title: 'Businesses should engage with and provide value to their consumers responsibly',
          dataBreachPctIncidents: gov.data_breach_pct_incidents,
          accountsPayableDays: gov.accounts_payable_days,
          consumerComplaints: {
            dataPrivacy: gov.data_privacy_complaints,
            advertising: gov.advertising_complaints,
            cyberSecurity: gov.cyber_security_complaints,
            essentialServices: gov.essential_services_complaints,
            restrictiveTrade: gov.restrictive_trade_complaints,
            unfairTrade: gov.unfair_trade_complaints,
          },
          productRecalls: {
            voluntary: gov.product_recall_voluntary,
            forced: gov.product_recall_forced,
          },
        },
      },

      workforce: {
        permanentEmployeesTotal: soc.permanent_employees_total,
        permanentEmployeesMale: soc.permanent_employees_male,
        permanentEmployeesFemale: soc.permanent_employees_female,
        otherEmployeesTotal: soc.other_employees_total,
        contractEmployeesTotal: soc.contract_employees_total,
        differentlyAbledEmployees: soc.differently_abled_employees,
        womenInBoardPct: soc.women_in_board_pct,
        // Workers — BRSR Q18
        permanentWorkersTotal: soc.permanent_workers_total,
        permanentWorkersMale: soc.permanent_workers_male,
        permanentWorkersFemale: soc.permanent_workers_female,
        otherWorkersTotal: soc.other_workers_total,
        differentlyAbledWorkers: soc.differently_abled_workers,
        unionMembershipPct: soc.union_membership_pct,
        womenInKmpPct: soc.women_in_kmp_pct,
      },
    };

    res.status(200).json({ report });
  } catch (err) {
    console.error('Generate report error:', err);
    res.status(500).json({ message: 'Server error generating report' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
 * GET /api/report/analytics — Admin only
 * Returns four aggregated datasets for the AdminDashboard AnalyticsPanel:
 *   supplierProgress — per-supplier doc status counts
 *   categoryStatus   — per-BRSR-category verified/pending/processing/failed
 *   timeline         — monthly upload + verified counts (last 6 months)
 *   ghg              — Scope 1/2/3 tCO2e from KpiResult
 * ─────────────────────────────────────────────────────────────────────── */
router.get('/analytics', authMiddleware, allowRoles('Admin'), async (req, res) => {
  try {
    const companyOid = new mongoose.Types.ObjectId(req.user.companyId);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    /* 1 ── Supplier document verification progress ─────────────────────── */
    const supplierProgress = await Document.aggregate([
      { $match: { companyId: companyOid } },
      {
        $lookup: {
          from: 'users', localField: 'uploadedBy',
          foreignField: '_id', as: 'uploader',
        },
      },
      { $unwind: { path: '$uploader', preserveNullAndEmptyArrays: false } },
      { $match: { 'uploader.role': 'Supplier' } },
      {
        $group: {
          _id: { uploaderId: '$uploadedBy', name: '$uploader.fullName' },
          verified: { $sum: { $cond: [{ $eq: ['$status', 'verified'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          processing: { $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
      { $sort: { '_id.name': 1 } },
      {
        $project: {
          _id: 0, name: '$_id.name',
          verified: 1, pending: 1, processing: 1, failed: 1, total: 1,
        },
      },
    ]);

    /* 2 ── BRSR category completion across all uploaders ───────────────── */
    const categoryStatus = await Document.aggregate([
      { $match: { companyId: companyOid } },
      {
        $group: {
          _id: '$brsrCategory',
          verified: { $sum: { $cond: [{ $eq: ['$status', 'verified'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          processing: { $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        },
      },
      {
        $project: {
          _id: 0, category: '$_id',
          verified: 1, pending: 1, processing: 1, failed: 1,
        },
      },
    ]);

    /* 3 ── Monthly upload timeline (last 6 months) ──────────────────────── */
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const timelineRaw = await Document.aggregate([
      { $match: { companyId: companyOid, createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          uploads: { $sum: 1 },
          verified: { $sum: { $cond: [{ $eq: ['$status', 'verified'] }, 1, 0] } },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const timeline = timelineRaw.map(t => ({
      month: `${MONTHS[t._id.month - 1]} ${t._id.year}`,
      uploads: t.uploads,
      verified: t.verified,
    }));

    /* 4 ── GHG scope totals from KpiResult ─────────────────────────────── */
    const kpi = await KpiResult.findOne({
      companyId: companyOid,
      financialYear: '2024-25',
    }).select('environmentalKpis.scope1_tco2e environmentalKpis.scope2_tco2e environmentalKpis.scope3_tco2e');

    const ghg = {
      scope1: kpi?.environmentalKpis?.scope1_tco2e || 0,
      scope2: kpi?.environmentalKpis?.scope2_tco2e || 0,
      scope3: kpi?.environmentalKpis?.scope3_tco2e || 0,
    };

    res.status(200).json({ supplierProgress, categoryStatus, timeline, ghg });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ message: 'Server error loading analytics' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
 * POST /api/report/recalculate — Admin only
 *
 * Replays every verified document's already-stored calculatedKpis back
 * through buildKpiUpdateFields and writes the result to KpiResult.
 *
 * Why this is needed:
 *   Documents get verified once. If the Python KPI calculator had a bug
 *   (e.g., "765.81 Crores" parsed as 0), the wrong values land in KpiResult.
 *   After fixing the calculator the documents are already verified — their
 *   calculatedKpis on the Document record are now correct (re-triggered or
 *   updated by the engine), but KpiResult still holds the stale 0s.
 *   This endpoint reconciles that without touching the Python engine.
 * ─────────────────────────────────────────────────────────────────────── */
router.post('/recalculate', authMiddleware, allowRoles('Admin'), async (req, res) => {
  try {
    const verifiedDocs = await Document.find({
      companyId: req.user.companyId,
      status: 'verified',
    }).select('brsrCategory calculatedKpis');

    if (!verifiedDocs.length) {
      return res.status(200).json({ message: 'No verified documents found — nothing to recalculate', updated: 0 });
    }

    // Accumulate all update fields across every verified document.
    // Later documents overwrite earlier ones for the same field (last-write wins),
    // which is correct because each category produces disjoint KPI keys.
    const allFields = {};
    for (const doc of verifiedDocs) {
      if (!doc.calculatedKpis || typeof doc.calculatedKpis !== 'object') continue;
      const fields = buildKpiUpdateFields(doc.brsrCategory, doc.calculatedKpis);
      Object.assign(allFields, fields);
    }

    if (!Object.keys(allFields).length) {
      return res.status(200).json({ message: 'No calculable KPI fields found in verified documents', updated: 0 });
    }

    // Upsert KpiResult and apply all accumulated fields in one write
    let kpiResult = await KpiResult.findOne({
      companyId: req.user.companyId,
      financialYear: '2024-25',
    });
    if (!kpiResult) {
      kpiResult = await KpiResult.create({
        companyId: req.user.companyId,
        financialYear: '2024-25',
        reportStatus: 'in_progress',
        auditTrail: [{ action: 'KPI result created via recalculate', triggeredBy: req.user.userId }],
      });
    }

    await KpiResult.findByIdAndUpdate(kpiResult._id, {
      $set: allFields,
      $push: {
        auditTrail: {
          action: `KPIs recalculated from ${verifiedDocs.length} verified document(s)`,
          triggeredBy: req.user.userId,
        },
      },
    });

    res.json({
      message: `KPI summary recalculated from ${verifiedDocs.length} verified document(s)`,
      updated: Object.keys(allFields).length,
      categories: [...new Set(verifiedDocs.map(d => d.brsrCategory))],
    });
  } catch (err) {
    console.error('Recalculate KPIs error:', err);
    res.status(500).json({ message: 'Server error recalculating KPIs' });
  }
});

module.exports = router;
