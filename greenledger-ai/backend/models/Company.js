const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true },
    CIN: { type: String, required: true, unique: true },
    industrySector: { type: String, required: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    financialYear: { type: String, default: '2024-25' },
    // BRSR Section A mandatory fields (optional at registration)
    yearOfIncorporation: { type: String },
    registeredAddress: { type: String },
    website: { type: String },
    stockExchange: { type: String },
    paidUpCapital: { type: String },
    reportingBoundary: { type: String, enum: ['standalone', 'consolidated'], default: 'standalone' },
    brContactName: { type: String },
    brContactEmail: { type: String },
    brContactPhone: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Company', companySchema);
