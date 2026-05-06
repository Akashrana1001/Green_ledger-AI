const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const Document = require('../models/Document');
const KpiResult = require('../models/KpiResult');
const { uploadToS3 } = require('../services/s3Service');
const { triggerProcessing } = require('../services/aiEngineService');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');

/**
 * Authoritative map: each brsrCategory → the KpiResult dot-paths it writes to
 * (derived from kpi_calculator.py) + the insight category strings to strip.
 *
 * Used by the CASCADE DELETE operation — nullifies only the fields that this
 * specific document was responsible for, leaving unrelated categories intact.
 */
const CATEGORY_CASCADE = {
  electricity_bill: {
    env: ['scope2_tco2e', 'total_energy_kwh', 'total_energy_gj',
          'ghg_intensity_ppp', 'ghg_intensity_per_rupee'],
    insightCategories: ['energy', 'ghg'],
  },
  fuel_consumption: {
    env: ['scope1_tco2e', 'ghg_intensity_ppp', 'ghg_intensity_per_rupee'],
    insightCategories: ['ghg'],
  },
  water_usage: {
    env: ['total_water_kl', 'water_recycled_pct',
          'water_intensity', 'water_intensity_per_rupee'],
    insightCategories: ['water'],
  },
  waste_records: {
    env: ['total_waste_mt', 'waste_recovered_pct', 'waste_intensity'],
    insightCategories: ['waste'],
  },
  hr_wages_data: {
    social: ['female_wage_pct', 'small_town_wage_pct', 'wellbeing_spend_pct_revenue'],
    insightCategories: ['social'],
  },
  supplier_msme_cert: {
    social: ['msme_procurement_pct'],
    insightCategories: ['social'],
  },
  posh_records: {
    social: ['posh_complaints_count'],
    insightCategories: ['social'],
  },
  governance_report: {
    gov: ['related_party_purchase_pct', 'related_party_sales_pct',
          'regulatory_fines_count', 'regulatory_fines_inr',
          'anti_competitive_cases', 'conflict_of_interest_complaints'],
    insightCategories: ['governance'],
  },
  accounts_payable: {
    gov: ['accounts_payable_days'],
    insightCategories: ['governance'],
  },
  cyber_security_log: {
    gov: ['data_breach_pct_incidents'],
    insightCategories: ['governance'],
  },
  safety_incidents_log: {
    social: ['ltifr_employees', 'ltifr_workers', 'fatalities_employees',
             'fatalities_workers', 'total_recordable_injuries_employees', 'safety_training_pct'],
    insightCategories: ['social'],
  },
  air_emissions_log: {
    env: ['nox_mt', 'sox_mt', 'pm_mt', 'pop_mt', 'voc_mt', 'hap_mt'],
    insightCategories: ['ghg', 'air emissions'],
  },
  scope3_emissions_data: {
    env: ['scope3_tco2e'],
    insightCategories: ['ghg'],
  },
  workforce_records: {
    social: ['permanent_employees_total', 'permanent_employees_male', 'permanent_employees_female',
             'other_employees_total', 'contract_employees_total', 'differently_abled_employees',
             'permanent_workers_total', 'permanent_workers_male', 'permanent_workers_female',
             'other_workers_total', 'differently_abled_workers',
             'median_wage_male_inr', 'median_wage_female_inr', 'median_wage_ratio',
             'women_in_board_pct', 'women_in_kmp_pct', 'turnover_rate_male',
             'turnover_rate_female', 'union_membership_pct', 'human_rights_training_pct'],
    insightCategories: ['social'],
  },
  consumer_complaints: {
    gov: ['data_privacy_complaints', 'advertising_complaints', 'cyber_security_complaints',
          'essential_services_complaints', 'restrictive_trade_complaints',
          'unfair_trade_complaints', 'product_recall_voluntary', 'product_recall_forced'],
    insightCategories: ['governance'],
  },
  employee_benefits: {
    social: ['health_insurance_employees_pct', 'health_insurance_workers_pct',
             'accident_insurance_employees_pct', 'accident_insurance_workers_pct',
             'maternity_benefits_pct', 'paternity_benefits_pct', 'daycare_facilities_pct',
             'pf_coverage_pct', 'gratuity_coverage_pct', 'esi_coverage_pct'],
    insightCategories: ['social'],
  },
  financial_statements: {
    env: ['total_energy_gj', 'renewable_energy_gj', 'energy_intensity_per_rupee',
          'renewable_energy_pct',
          'water_withdrawal_surface_kl', 'water_withdrawal_ground_kl',
          'water_withdrawal_third_party_kl', 'water_discharged_kl',
          'hazardous_waste_mt', 'non_hazardous_waste_mt', 'plastic_waste_mt', 'ewaste_mt',
          'waste_recycled_mt', 'waste_reused_mt', 'waste_landfill_mt',
          'bio_medical_waste_mt', 'construction_waste_mt', 'battery_waste_mt',
          'radioactive_waste_mt', 'waste_incinerated_mt',
          // Intensity ratios depend on revenue — must be invalidated together
          'ghg_intensity_ppp', 'ghg_intensity_per_rupee',
          'water_intensity', 'water_intensity_per_rupee', 'waste_intensity'],
    fin: ['revenue_inr_crore'],
    insightCategories: ['energy', 'water', 'waste', 'governance'],
  },
};

/**
 * Build a MongoDB $unset document for all KPI fields owned by this category.
 * Also return the insight categories to strip from ai_insights[].
 */
const buildCascadeUnset = (brsrCategory) => {
  const cascade = CATEGORY_CASCADE[brsrCategory];
  if (!cascade) return { unset: {}, insightCategories: [] };

  const unset = {};
  for (const field of (cascade.env || [])) {
    unset[`environmentalKpis.${field}`] = '';
  }
  for (const field of (cascade.social || [])) {
    unset[`socialKpis.${field}`] = '';
  }
  for (const field of (cascade.gov || [])) {
    unset[`governanceKpis.${field}`] = '';
  }
  for (const field of (cascade.fin || [])) {
    unset[`financialData.${field}`] = '';
  }
  return { unset, insightCategories: cascade.insightCategories || [] };
};

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      '.pdf', '.png', '.jpg', '.jpeg', '.xlsx', '.xls', '.docx',
      '.txt', '.md', '.csv', '.log', '.tsv',
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Unsupported file type'));
  },
});

const getFileType = (originalName) => {
  const ext = path.extname(originalName).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (['.png', '.jpg', '.jpeg'].includes(ext)) return 'image';
  if (['.xlsx', '.xls'].includes(ext)) return 'excel';
  if (['.docx'].includes(ext)) return 'word';
  if (['.txt', '.md', '.csv', '.log', '.tsv'].includes(ext)) return 'text';
  return 'pdf';
};

const VALID_CATEGORIES = [
  'electricity_bill', 'fuel_consumption', 'water_usage', 'waste_records',
  'hr_wages_data', 'supplier_msme_cert', 'posh_records', 'governance_report',
  'accounts_payable', 'cyber_security_log',
  'safety_incidents_log', 'air_emissions_log', 'scope3_emissions_data',
  'workforce_records', 'financial_statements',
  'employee_benefits', 'consumer_complaints',
];

/**
 * Enqueue a document for processing via BullMQ.
 * Falls back to direct triggerProcessing() if Redis is unavailable.
 *
 * CRITICAL: ioredis is configured with maxRetriesPerRequest:null (required by
 * BullMQ) + lazyConnect:true. If Redis is offline, queue.add() will *hang
 * forever* instead of rejecting — the catch block never fires and the upload
 * route stalls until the browser's axios timeout. We race against a 4-second
 * timeout so the fallback path actually gets exercised.
 *
 * jobId uniqueness: BullMQ deduplicates by jobId — adding a job whose id already
 * exists in Redis is a silent no-op (returns the existing job, never re-runs).
 * `removeOnComplete: 100` keeps the last 100 completed jobs around, so reprocess
 * / retry of an already-finished document would otherwise vanish without trace.
 * We append a timestamp so every enqueue is unique while keeping the documentId
 * visible in BullMQ dashboards.
 */
const enqueueOrTrigger = async (documentId, s3Key, brsrCategory, companyId) => {
  const ENQUEUE_TIMEOUT_MS = 4000;
  const jobId = `${documentId}-${Date.now()}`;
  try {
    const { getDocumentQueue } = require('../queues/documentQueue');
    const queue = getDocumentQueue();

    const addPromise = queue.add(
      'process-document',
      { documentId, s3Key, brsrCategory, companyId },
      { jobId }
    );
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`BullMQ enqueue timed out after ${ENQUEUE_TIMEOUT_MS}ms (Redis offline?)`)), ENQUEUE_TIMEOUT_MS)
    );

    await Promise.race([addPromise, timeoutPromise]);
    console.log(`[Queue] Document ${documentId} enqueued in BullMQ (jobId=${jobId})`);
  } catch (queueErr) {
    console.warn(`[Queue] BullMQ unavailable (${queueErr.message}) — falling back to direct AI engine trigger`);
    // Fire-and-forget: don't await; let the upload response return immediately
    triggerProcessing(documentId, s3Key, brsrCategory, companyId);
  }
};

// POST /api/documents/upload
// Wrapped in stage-tagged try/catch so the exact failure point is logged.
// Multer errors (file too large / unsupported type) bubble through Express's
// error pipeline as `err` — caught at the bottom.
router.post('/upload', authMiddleware, (req, res, next) => {
  upload.single('document')(req, res, (multerErr) => {
    if (multerErr) {
      console.error('[Upload][stage:multer] Parse failed:', {
        message: multerErr.message,
        code:    multerErr.code,           // LIMIT_FILE_SIZE / LIMIT_UNEXPECTED_FILE / etc.
        field:   multerErr.field,
      });
      return res.status(400).json({ message: `Upload parse failed: ${multerErr.message}` });
    }
    next();
  });
}, async (req, res) => {
  let stage = 'init';
  try {
    stage = 'validate';
    if (!req.file) {
      console.error('[Upload][stage:validate] req.file is undefined — multipart boundary missing or field name mismatch');
      console.error('  body keys:', Object.keys(req.body || {}));
      console.error('  content-type header:', req.headers['content-type']);
      return res.status(400).json({ message: 'No file uploaded — check Content-Type boundary and field name "document"' });
    }

    const { brsrCategory } = req.body;
    if (!brsrCategory || !VALID_CATEGORIES.includes(brsrCategory)) {
      return res.status(400).json({ message: 'Valid brsrCategory is required' });
    }

    const fileId = randomUUID();
    const ext = path.extname(req.file.originalname);
    const s3Key = `documents/${req.user.companyId}/${fileId}${ext}`;

    stage = 's3-upload';
    const s3Url = await uploadToS3(req.file.buffer, s3Key, req.file.mimetype);
    if (!s3Url) {
      throw new Error('uploadToS3 returned null — storage layer did not return a URL');
    }

    stage = 'db-create';
    const document = await Document.create({
      s3Key,
      s3Url,
      originalFileName: req.file.originalname,
      fileType: getFileType(req.file.originalname),
      uploadedBy: req.user.userId,
      companyId: req.user.companyId,
      brsrCategory,
      status: 'pending',
      processingLog: [{ message: 'Document uploaded, queued for processing' }],
    });

    stage = 'enqueue';
    await enqueueOrTrigger(
      document._id.toString(),
      s3Key,
      brsrCategory,
      req.user.companyId.toString()
    );

    res.status(201).json({
      message: 'Document uploaded successfully',
      document: {
        id: document._id,
        status: 'pending',
        brsrCategory,
        originalFileName: req.file.originalname,
      },
    });
  } catch (err) {
    console.error(`[Upload][stage:${stage}] FAILED:`, {
      message: err.message,
      name:    err.name,
      code:    err.code,
      stack:   err.stack?.split('\n').slice(0, 4).join('\n'),
    });
    res.status(500).json({ message: `Upload failed at stage '${stage}': ${err.message}` });
  }
});

// GET /api/documents
router.get('/', authMiddleware, async (req, res) => {
  try {
    const filter = { companyId: req.user.companyId };
    if (req.user.role !== 'Admin') {
      filter.uploadedBy = req.user.userId;
    }

    const documents = await Document.find(filter)
      .populate('uploadedBy', 'fullName email role')
      .sort({ createdAt: -1 });

    res.status(200).json({ documents });
  } catch (err) {
    console.error('Get documents error:', err);
    res.status(500).json({ message: 'Server error fetching documents' });
  }
});

// GET /api/documents/:id/audit — full extraction + calculation trace for the Audit Trail modal
router.get('/:id/audit', authMiddleware, async (req, res) => {
  try {
    const filter = { _id: req.params.id, companyId: req.user.companyId };
    if (req.user.role !== 'Admin') filter.uploadedBy = req.user.userId;

    const document = await Document.findOne(filter).select(
      'originalFileName brsrCategory status fileType createdAt completedAt ' +
      'processingTimeS extractedRawValues calculatedKpis processingLog'
    );
    if (!document) return res.status(404).json({ message: 'Document not found' });

    res.json({ document });
  } catch (err) {
    console.error('Audit trail error:', err);
    res.status(500).json({ message: 'Server error fetching audit trail' });
  }
});

// GET /api/documents/:id/status
router.get('/:id/status', authMiddleware, async (req, res) => {
  try {
    const filter = { _id: req.params.id, companyId: req.user.companyId };
    if (req.user.role !== 'Admin') {
      filter.uploadedBy = req.user.userId;
    }

    const document = await Document.findOne(filter).select('status processingLog originalFileName brsrCategory');
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.status(200).json({ document });
  } catch (err) {
    console.error('Get status error:', err);
    res.status(500).json({ message: 'Server error fetching status' });
  }
});

// POST /api/documents/:id/retry — Admin only; re-enqueues document for AI processing
router.post('/:id/retry', authMiddleware, allowRoles('Admin'), async (req, res) => {
  try {
    const document = await Document.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    await Document.findByIdAndUpdate(document._id, {
      status: 'pending',
      extractedRawValues: null,
      calculatedKpis: null,
      $push: { processingLog: { message: 'Manual retry triggered by Admin — re-queued' } },
    });

    await enqueueOrTrigger(
      document._id.toString(),
      document.s3Key,
      document.brsrCategory,
      document.companyId.toString()
    );

    res.status(200).json({ message: 'Processing re-queued', documentId: document._id });
  } catch (err) {
    console.error('Retry error:', err);
    res.status(500).json({ message: 'Server error triggering retry' });
  }
});

// POST /api/documents/:id/reprocess — Admin + TeamMember (own docs only)
// Re-runs the full AI extraction + KPI calculation pipeline against the
// document already in S3. Unlike /retry, this works for ANY status (verified,
// failed, pending) — useful for re-running after calculator bug fixes.
router.post('/:id/reprocess', authMiddleware, async (req, res) => {
  let stage = 'init';
  try {
    stage = 'find-document';
    const query = req.user.role === 'Admin'
      ? { _id: req.params.id, companyId: req.user.companyId }
      : { _id: req.params.id, uploadedBy: req.user.userId, companyId: req.user.companyId };

    const document = await Document.findOne(query);
    if (!document) {
      console.warn(`[Reprocess] Document ${req.params.id} not found or not accessible by user ${req.user.userId}`);
      return res.status(404).json({ message: 'Document not found or not accessible' });
    }
    if (!document.s3Key) {
      console.warn(`[Reprocess] Document ${document._id} missing s3Key — cannot reprocess`);
      return res.status(400).json({ message: 'Document has no S3 key — cannot reprocess' });
    }

    console.log(`[Reprocess] doc=${document._id} category=${document.brsrCategory} s3Key=${document.s3Key}`);

    stage = 'reset-status';
    // Reset to processing so the UI shows the correct state immediately
    await Document.findByIdAndUpdate(document._id, {
      status: 'processing',
      $push: { processingLog: { message: 'Re-processing triggered via Re-check button' } },
    });

    stage = 'enqueue';
    await enqueueOrTrigger(
      document._id.toString(),
      document.s3Key,
      document.brsrCategory,
      document.companyId.toString(),
    );

    console.log(`[Reprocess] doc=${document._id} successfully handed off to AI pipeline`);
    res.status(200).json({ message: 'Re-processing started', documentId: document._id });
  } catch (err) {
    console.error(`[Reprocess][stage:${stage}] FAILED:`, {
      message: err.message,
      name:    err.name,
      code:    err.code,
      stack:   err.stack?.split('\n').slice(0, 4).join('\n'),
    });
    res.status(500).json({ message: `Reprocess failed at stage '${stage}': ${err.message}` });
  }
});

// DELETE /api/documents/:id — Admin only; cascade-deletes document + its KPIs + its insights
router.delete('/:id', authMiddleware, allowRoles('Admin'), async (req, res) => {
  try {
    const document = await Document.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const { brsrCategory, companyId } = document;

    // ── 1. Remove from storage (S3 or local) ──────────────────────────────────
    if (process.env.LOCAL_MODE === 'true') {
      const localFilename = document.s3Key.replace(/\//g, '_');
      const localPath = path.join(__dirname, '..', 'uploads', localFilename);
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    } else {
      try {
        const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
        const s3Client = new S3Client({
          region: process.env.AWS_S3_REGION,
          credentials: {
            accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
          },
        });
        await s3Client.send(new DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: document.s3Key,
        }));
      } catch (s3Err) {
        // Storage failure is non-fatal — DB record + KPIs must still be cleaned up
        console.error('S3 delete failed (continuing cascade):', s3Err.message);
      }
    }

    // ── 2. Remove document record from MongoDB ─────────────────────────────────
    await Document.findByIdAndDelete(document._id);

    // ── 3. Cascade: only touch KpiResult if this document was verified ─────────
    //    Unverified docs never wrote KPIs, so there is nothing to strip.
    if (document.status === 'verified') {
      const kpiResult = await KpiResult.findOne({ companyId, financialYear: '2024-25' });

      if (kpiResult) {
        const { unset, insightCategories } = buildCascadeUnset(brsrCategory);

        // 3a. $unset all KPI fields owned by this category
        const ops = {};
        if (Object.keys(unset).length > 0) {
          ops.$unset = unset;
        }

        // 3b. Strip ai_insights entries whose category matches this doc's category
        if (insightCategories.length > 0) {
          const stripped = (kpiResult.ai_insights || []).filter(
            (ins) => !insightCategories.includes(ins.category)
          );
          ops.$set = { ai_insights: stripped };
        }

        if (Object.keys(ops).length > 0) {
          await KpiResult.findByIdAndUpdate(kpiResult._id, ops);
          console.log(
            `[CascadeDelete] doc=${document._id} category=${brsrCategory} ` +
            `unset=${Object.keys(unset).length} fields, stripped insights for [${insightCategories.join(',')}]`
          );
        }
      }
    }

    // Return 200 with metadata so the frontend can display a targeted toast
    res.status(200).json({
      message: 'Document and associated KPIs deleted',
      deletedDocumentId: document._id,
      category: brsrCategory,
      kpisCleared: document.status === 'verified',
    });
  } catch (err) {
    console.error('Delete document error:', err);
    res.status(500).json({ message: 'Server error deleting document' });
  }
});

module.exports = router;
