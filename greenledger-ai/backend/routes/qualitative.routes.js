const express = require('express');
const QualitativeResponse = require('../models/QualitativeResponse');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');

const router = express.Router();

const QUESTION_IDS = [
  'sb_p1_policy','sb_p2_policy','sb_p3_policy','sb_p4_policy','sb_p5_policy',
  'sb_p6_policy','sb_p7_policy','sb_p8_policy','sb_p9_policy',
  'sb_esg_director','sb_esg_committee','sb_external_assessment',
  'p2_pat_scheme','p2_epr_compliance','p2_sustainable_sourcing',
  'p3_ohsms','p3_equal_opportunity','p3_grievance_mechanism',
  'p4_stakeholder_identification','p4_stakeholder_engagement',
  'p5_anti_corruption_policy','p5_hr_focal_point','p5_hr_grievance_mechanism',
  'p6_zero_liquid_discharge','p6_ecologically_sensitive','p6_ghg_reduction_projects','p6_business_continuity',
  'p7_trade_associations','p8_community_grievance',
  'p9_complaint_mechanism','p9_cyber_security_policy',
];

const ensureDocument = async (companyId) => {
  let doc = await QualitativeResponse.findOne({ companyId, financialYear: '2024-25' });
  if (!doc) {
    doc = await QualitativeResponse.create({
      companyId,
      financialYear: '2024-25',
      responses: QUESTION_IDS.map(id => ({ questionId: id })),
    });
  }
  // Add any missing question entries if new questions were added
  const existingIds = new Set(doc.responses.map(r => r.questionId));
  const missing = QUESTION_IDS.filter(id => !existingIds.has(id));
  if (missing.length > 0) {
    missing.forEach(id => doc.responses.push({ questionId: id }));
    await doc.save();
  }
  return doc;
};

// GET /api/qualitative — Admin: all responses; TeamMember: only their assigned
router.get('/', authMiddleware, async (req, res) => {
  try {
    const doc = await ensureDocument(req.user.companyId);
    await QualitativeResponse.populate(doc, [
      { path: 'responses.assignedTo', select: 'fullName email role' },
      { path: 'responses.answeredBy', select: 'fullName email' },
    ]);

    let responses = doc.responses;
    if (req.user.role !== 'Admin') {
      responses = responses.filter(r => r.assignedTo && r.assignedTo._id?.toString() === req.user.userId);
    }

    const answered = doc.responses.filter(r => r.status === 'answered').length;
    const total = doc.responses.length;

    res.json({ responses, progress: { answered, total } });
  } catch (err) {
    console.error('Get qualitative error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/qualitative/assign — Admin only
router.post('/assign', authMiddleware, allowRoles('Admin'), async (req, res) => {
  try {
    const { questionId, assignedTo } = req.body;
    if (!questionId) return res.status(400).json({ message: 'questionId is required' });

    const doc = await ensureDocument(req.user.companyId);
    const item = doc.responses.find(r => r.questionId === questionId);
    if (!item) return res.status(404).json({ message: 'Question not found' });

    item.assignedTo = assignedTo || null;
    item.status = assignedTo ? (item.status === 'answered' ? 'answered' : 'assigned') : 'unassigned';
    await doc.save();

    res.json({ message: 'Assignment updated', questionId, assignedTo });
  } catch (err) {
    console.error('Assign error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/qualitative/answer — TeamMember or Admin submits answer
router.put('/answer', authMiddleware, async (req, res) => {
  try {
    const { questionId, answer, answerYesNo, webLink, notes } = req.body;
    if (!questionId) return res.status(400).json({ message: 'questionId is required' });

    const doc = await ensureDocument(req.user.companyId);
    const item = doc.responses.find(r => r.questionId === questionId);
    if (!item) return res.status(404).json({ message: 'Question not found' });

    // TeamMembers can only answer questions assigned to them
    if (req.user.role !== 'Admin') {
      if (!item.assignedTo || item.assignedTo.toString() !== req.user.userId) {
        return res.status(403).json({ message: 'This question is not assigned to you' });
      }
    }

    item.answer = answer || '';
    item.answerYesNo = answerYesNo || '';
    item.webLink = webLink || '';
    item.notes = notes || '';
    item.status = 'answered';
    item.answeredAt = new Date();
    item.answeredBy = req.user.userId;
    await doc.save();

    res.json({ message: 'Answer saved', questionId });
  } catch (err) {
    console.error('Answer error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/qualitative/summary — for including in report
router.get('/summary', authMiddleware, allowRoles('Admin'), async (req, res) => {
  try {
    const doc = await QualitativeResponse.findOne({
      companyId: req.user.companyId, financialYear: '2024-25',
    });
    if (!doc) return res.json({ responses: [], progress: { answered: 0, total: QUESTION_IDS.length } });

    const answered = doc.responses.filter(r => r.status === 'answered').length;
    res.json({ responses: doc.responses, progress: { answered, total: QUESTION_IDS.length } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
