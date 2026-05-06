const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: false, default: null }, // null for Google-only accounts
    role:     { type: String, enum: ['Admin', 'TeamMember', 'Supplier'], required: true },
    fullName: { type: String, required: true },
    companyId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',    default: null  },
    isActive:   { type: Boolean, default: true },
    /* Google SSO */
    googleId:   { type: String, default: null },
    /* Two-Factor Authentication */
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret:  { type: String,  default: null  },
    /* Terms of Service */
    tosAccepted: { type: Boolean, default: false },
    /* Set true when Admin creates the account; cleared on first self-set password */
    mustChangePassword: { type: Boolean, default: false },
    /* Failed-login lockout — 3 wrong passwords lock the account; only Admin can unlock */
    failedLoginAttempts: { type: Number, default: 0 },
    accountLocked:       { type: Boolean, default: false },
    lockedAt:            { type: Date, default: null },
    /* SEBI BRSR Principles assigned to this TeamMember (e.g. ['P1','P3','P6']) */
    assignedPrinciples: [{ type: String }],
    /* Optional profile fields editable from Team Member settings modal */
    phone:       { type: String, default: '' },
    department:  { type: String, default: '' },
    designation: { type: String, default: '' },
    bio:         { type: String, default: '' },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false; // Google-only account — password login not available
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
