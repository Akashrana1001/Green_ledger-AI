const mongoose = require('mongoose');

const processingLogEntrySchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },
    message: { type: String, required: true },
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    s3Key: { type: String, required: true },
    s3Url: { type: String, required: true },
    originalFileName: { type: String, required: true },
    fileType: { type: String, enum: ['pdf', 'image', 'excel', 'word', 'text'], required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    brsrCategory: {
      type: String,
      enum: [
        'electricity_bill',
        'fuel_consumption',
        'water_usage',
        'waste_records',
        'hr_wages_data',
        'supplier_msme_cert',
        'posh_records',
        'governance_report',
        'accounts_payable',
        'cyber_security_log',
        'safety_incidents_log',
        'air_emissions_log',
        'scope3_emissions_data',
        'workforce_records',
        'financial_statements',
        'employee_benefits',
        'consumer_complaints',
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'verified', 'failed'],
      default: 'pending',
    },
    extractedRawValues:  { type: mongoose.Schema.Types.Mixed, default: null },
    calculatedKpis:      { type: mongoose.Schema.Types.Mixed, default: null },
    processingLog:       { type: [processingLogEntrySchema], default: [] },
    processingTimeS:     { type: Number, default: null },
    completedAt:         { type: Date,   default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Document', documentSchema);
