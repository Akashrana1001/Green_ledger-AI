const mongoose = require('mongoose');

const responseItemSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: ['unassigned', 'assigned', 'answered'], default: 'unassigned' },
    answer: { type: String, default: '' },
    answerYesNo: { type: String, enum: ['yes', 'no', ''], default: '' },
    webLink: { type: String, default: '' },
    notes: { type: String, default: '' },
    answeredAt: { type: Date, default: null },
    answeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false }
);

const qualitativeResponseSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    financialYear: { type: String, required: true, default: '2024-25' },
    responses: { type: [responseItemSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('QualitativeResponse', qualitativeResponseSchema);
