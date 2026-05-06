const express    = require('express');
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const axios      = require('axios');
const { authenticator } = require('otplib');
const qrcode     = require('qrcode');
const User       = require('../models/User');
const Company    = require('../models/Company');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles     = require('../middleware/roleMiddleware');

const router = express.Router();

/* ── JWT factory — fullName, email, tosAccepted now in payload ─────────── */
const signToken = (user) =>
  jwt.sign(
    {
      userId:             user._id,
      role:               user.role,
      companyId:          user.companyId,
      fullName:           user.fullName,
      email:              user.email,
      tosAccepted:        user.tosAccepted        || false,
      mustChangePassword: user.mustChangePassword || false,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

/* ── Short-lived temp token used only during 2FA challenge ─────────────── */
const signTempToken = (userId) =>
  jwt.sign(
    { userId, purpose: '2fa_challenge' },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );

/* ─────────────────────────────────────────────────────────────────────────
 * POST /api/auth/register — Admin self-registration
 * Accepts optional googleId for Google-SSO-initiated registrations
 * ─────────────────────────────────────────────────────────────────────── */
router.post('/register', async (req, res) => {
  try {
    const {
      companyName, CIN, industrySector, fullName, email, password,
      yearOfIncorporation, registeredAddress, website, stockExchange,
      paidUpCapital, reportingBoundary, brContactName, brContactEmail, brContactPhone,
      googleId,
    } = req.body;

    if (!companyName || !CIN || !industrySector || !fullName || !email) {
      return res.status(400).json({ message: 'Company Name, CIN, Industry Sector, Full Name and Email are required' });
    }
    if (!password && !googleId) {
      return res.status(400).json({ message: 'Password is required for email registration' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(409).json({ message: 'Email already registered' });

    const existingCompany = await Company.findOne({ CIN });
    if (existingCompany) return res.status(409).json({ message: 'Company CIN already registered' });

    const company = await Company.create({
      companyName, CIN, industrySector, financialYear: '2024-25',
      yearOfIncorporation, registeredAddress, website, stockExchange,
      paidUpCapital,
      reportingBoundary: reportingBoundary || undefined,
      brContactName, brContactEmail, brContactPhone,
    });

    const user = await User.create({
      email,
      /* Google users get a random unusable password — they can never log in via password */
      password: googleId ? crypto.randomBytes(32).toString('hex') : password,
      role: 'Admin',
      fullName,
      companyId: company._id,
      createdBy: null,
      googleId: googleId || null,
    });

    company.adminId = user._id;
    await company.save();

    const token = signToken(user);
    res.status(201).json({
      message: 'Admin registered successfully',
      token,
      user: { id: user._id, email: user.email, role: user.role, fullName: user.fullName, tosAccepted: false },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
 * POST /api/auth/login — All roles
 * Returns { requiresTwoFactor, tempToken } when 2FA is enabled
 * ─────────────────────────────────────────────────────────────────────── */
const MAX_LOGIN_ATTEMPTS = 3;

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email, isActive: true });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    /* Account-lock gate — only Admin can unlock via /api/auth/unlock-user/:id */
    if (user.accountLocked) {
      return res.status(423).json({
        message: 'Account locked due to too many failed login attempts. Contact your Admin to reset your password.',
        locked: true,
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const update   = { failedLoginAttempts: attempts };
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        update.accountLocked = true;
        update.lockedAt      = new Date();
      }
      await User.findByIdAndUpdate(user._id, update);

      if (update.accountLocked) {
        return res.status(423).json({
          message: 'Account locked due to too many failed login attempts. Contact your Admin to reset your password.',
          locked: true,
        });
      }
      return res.status(401).json({
        message: 'Invalid credentials',
        attemptsRemaining: MAX_LOGIN_ATTEMPTS - attempts,
      });
    }

    /* Success — reset the attempt counter */
    if (user.failedLoginAttempts > 0) {
      await User.findByIdAndUpdate(user._id, { failedLoginAttempts: 0 });
    }

    /* 2FA gate — issue temp token instead of full JWT */
    if (user.twoFactorEnabled) {
      return res.status(200).json({
        requiresTwoFactor: true,
        tempToken: signTempToken(user._id),
      });
    }

    const token = signToken(user);
    res.status(200).json({
      message: 'Login successful',
      token,
      user: { id: user._id, email: user.email, role: user.role, fullName: user.fullName, tosAccepted: user.tosAccepted, companyId: user.companyId },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
 * POST /api/auth/google — Google OAuth login
 * Body: { accessToken }
 * Flow: verify with Google → find existing user → return JWT or 2FA challenge
 * ─────────────────────────────────────────────────────────────────────── */
router.post('/google', async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ message: 'Google access token is required' });

    /* Verify access token and fetch profile from Google */
    const gRes = await axios.get(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${accessToken}`
    );
    const { email, name, id: googleId } = gRes.data;

    let user = await User.findOne({ email, isActive: true });

    if (!user) {
      /* No account found — tell the frontend to redirect to register with pre-filled data */
      return res.status(404).json({
        newUser: true,
        profile: { email, name, googleId },
        message: 'No account found. Please complete registration.',
      });
    }

    /* Attach googleId if this is the first Google login for an existing account */
    if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
    }

    /* 2FA gate */
    if (user.twoFactorEnabled) {
      return res.status(200).json({
        requiresTwoFactor: true,
        tempToken: signTempToken(user._id),
      });
    }

    const token = signToken(user);
    res.status(200).json({
      message: 'Google login successful',
      token,
      user: { id: user._id, email: user.email, role: user.role, fullName: user.fullName, tosAccepted: user.tosAccepted },
    });
  } catch (err) {
    if (err.response?.status === 401) {
      return res.status(401).json({ message: 'Invalid or expired Google token' });
    }
    console.error('Google auth error:', err);
    res.status(500).json({ message: 'Server error during Google authentication' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
 * PUT /api/auth/accept-tos — Admin accepts Terms of Service
 * Issues a new JWT with tosAccepted: true
 * ─────────────────────────────────────────────────────────────────────── */
router.put('/accept-tos', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { tosAccepted: true },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });

    const token = signToken(user);
    res.status(200).json({ message: 'Terms accepted', token });
  } catch (err) {
    console.error('Accept TOS error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
 * GET /api/auth/profile — return the logged-in user's editable profile
 * ─────────────────────────────────────────────────────────────────────── */
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('fullName email role phone department designation bio assignedPrinciples createdAt');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
 * PATCH /api/auth/profile — update the logged-in user's profile
 * Editable fields: fullName, phone, department, designation, bio
 * Email is intentionally read-only (it's the identifier).
 * Returns a refreshed JWT because fullName lives in the token payload.
 * ─────────────────────────────────────────────────────────────────────── */
router.patch('/profile', authMiddleware, async (req, res) => {
  try {
    const allowed = ['fullName', 'phone', 'department', 'designation', 'bio'];
    const update = {};
    for (const k of allowed) {
      if (typeof req.body[k] === 'string') update[k] = req.body[k].trim();
    }
    if (update.fullName === '') {
      return res.status(400).json({ message: 'Full name cannot be empty' });
    }
    const user = await User.findByIdAndUpdate(req.user.userId, update, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // fullName is part of the JWT payload — re-sign so client display stays consistent
    const token = signToken(user);
    res.json({
      message: 'Profile updated',
      token,
      user: {
        fullName: user.fullName,  email: user.email, role: user.role,
        phone: user.phone, department: user.department,
        designation: user.designation, bio: user.bio,
      },
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
 * POST /api/auth/change-password
 * Available to all authenticated roles.
 * Body: { currentPassword, newPassword }
 * Clears mustChangePassword so the forced-change banner disappears.
 * Returns a fresh JWT reflecting the updated flag.
 * ─────────────────────────────────────────────────────────────────────── */
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'New password must be different from the current one' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const valid = await user.comparePassword(currentPassword);
    if (!valid) return res.status(403).json({ message: 'Current password is incorrect' });

    user.password           = newPassword;   // pre-save hook hashes it
    user.mustChangePassword = false;          // clear the forced-change flag
    await user.save();

    const token = signToken(user);
    res.json({ message: 'Password changed successfully', token });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Server error changing password' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
 * POST /api/auth/2fa/setup — Generate TOTP secret & QR code
 * Returns { qrCodeDataUrl, secret } — secret is saved but 2FA NOT yet enabled
 * ─────────────────────────────────────────────────────────────────────── */
router.post('/2fa/setup', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, 'GreenLedger AI', secret);
    const qrCodeDataUrl = await qrcode.toDataURL(otpauth);

    /* Save secret but don't enable 2FA until user confirms with a valid code */
    user.twoFactorSecret = secret;
    await user.save();

    res.status(200).json({ qrCodeDataUrl, secret });
  } catch (err) {
    console.error('2FA setup error:', err);
    res.status(500).json({ message: 'Server error during 2FA setup' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
 * POST /api/auth/2fa/confirm — Confirm setup with first valid TOTP code
 * Enables 2FA on the account
 * ─────────────────────────────────────────────────────────────────────── */
router.post('/2fa/confirm', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.twoFactorSecret) return res.status(400).json({ message: '2FA setup not initiated' });

    const isValid = authenticator.verify({ token: String(code), secret: user.twoFactorSecret });
    if (!isValid) return res.status(400).json({ message: 'Invalid code. Ensure your authenticator app time is synced.' });

    user.twoFactorEnabled = true;
    await user.save();

    res.status(200).json({ message: '2FA enabled successfully' });
  } catch (err) {
    console.error('2FA confirm error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
 * POST /api/auth/2fa/verify — Complete login after 2FA challenge
 * Body: { tempToken, code }
 * ─────────────────────────────────────────────────────────────────────── */
router.post('/2fa/verify', async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      return res.status(400).json({ message: 'Temp token and code are required' });
    }

    /* Decode and validate the temp token */
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Verification session expired. Please log in again.' });
    }

    if (decoded.purpose !== '2fa_challenge') {
      return res.status(401).json({ message: 'Invalid verification token' });
    }

    const user = await User.findById(decoded.userId);
    if (!user || !user.twoFactorEnabled) {
      return res.status(401).json({ message: 'Invalid verification request' });
    }

    const isValid = authenticator.verify({ token: String(code), secret: user.twoFactorSecret });
    if (!isValid) return res.status(400).json({ message: 'Invalid authenticator code' });

    const token = signToken(user);
    res.status(200).json({
      message: 'Two-factor authentication successful',
      token,
      user: { id: user._id, email: user.email, role: user.role, fullName: user.fullName, tosAccepted: user.tosAccepted },
    });
  } catch (err) {
    console.error('2FA verify error:', err);
    res.status(500).json({ message: 'Server error during 2FA verification' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
 * Domain-bounded email helpers
 * ─────────────────────────────────────────────────────────────────────── */

/**
 * Collapse a company name to a lowercase slug with no whitespace or symbols.
 * "Tata Motors" → "tatamotors"   "AT&T Inc." → "atinc"
 */
function normalizeCompanyName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Return true when the email's domain starts with the normalized company slug.
 * Supports any TLD (.com, .in, .co.uk, etc.) as long as the domain prefix matches.
 *
 * company "Tata"  → slug "tata"
 *   ram@tata.com      ✅  domain starts with "tata"
 *   ram@tata.in       ✅
 *   ram@tatamotors.com ✅  (also starts with "tata")
 *   ram@gmail.com     ❌
 */
function isCompanyDomain(email, companySlug) {
  const domain = (email.split('@')[1] || '').toLowerCase();
  return domain.startsWith(companySlug);
}

/**
 * Generate a secure 16-char temporary password.
 * Format: Gl-<12 base64url chars> — guarantees uppercase, lowercase, digit, and
 * a symbol in the prefix so the password satisfies standard complexity rules.
 */
function generateTempPassword() {
  return `Gl-${crypto.randomBytes(9).toString('base64url')}`;
}

/* ─────────────────────────────────────────────────────────────────────────
 * POST /api/auth/create-user — Admin only
 *
 * Domain rules:
 *   TeamMember — email domain MUST start with the Admin's company slug.
 *                Returns 403 if the domain doesn't match.
 *   Supplier   — any email is accepted (suppliers are external partners).
 *
 * Password:
 *   Admin does NOT set the password. A secure temporary password is
 *   auto-generated and returned once in the response so the Admin can
 *   share it with the new user via a secure channel.
 * ─────────────────────────────────────────────────────────────────────── */
router.post('/create-user', authMiddleware, allowRoles('Admin'), async (req, res) => {
  try {
    const { fullName, email, role, assignedPrinciples } = req.body;

    if (!fullName || !email || !role) {
      return res.status(400).json({ message: 'fullName, email and role are required' });
    }
    if (!['TeamMember', 'Supplier'].includes(role)) {
      return res.status(400).json({ message: "role must be 'TeamMember' or 'Supplier'" });
    }

    /* Domain validation — TeamMembers must use a company email */
    if (role === 'TeamMember') {
      const company = await Company.findById(req.user.companyId).select('companyName');
      if (!company) return res.status(404).json({ message: 'Admin company not found' });

      const slug = normalizeCompanyName(company.companyName);
      if (!isCompanyDomain(email, slug)) {
        return res.status(403).json({
          message: `Team Member email must use a company domain (expected domain starting with "${slug}"). ` +
                   `Supplier accounts can use any email address.`,
        });
      }
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(409).json({ message: 'Email already registered' });

    const tempPassword = generateTempPassword();

    const user = await User.create({
      email,
      password:            tempPassword,
      role,
      fullName,
      companyId:           req.user.companyId,
      createdBy:           req.user.userId,
      assignedPrinciples:  role === 'TeamMember' ? (assignedPrinciples || []) : [],
      mustChangePassword:  true,   // cleared when the user sets their own password
    });

    res.status(201).json({
      message:       'User created successfully',
      tempPassword,                             // return once — Admin shares via secure channel
      user: { id: user._id, email: user.email, role: user.role, fullName: user.fullName },
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ message: 'Server error creating user' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
 * GET /api/auth/locked-users — Admin only
 * Returns users in this company whose accounts are locked due to failed logins.
 * Drives the bell-icon notification panel in AdminDashboard.
 * ─────────────────────────────────────────────────────────────────────── */
router.get('/locked-users', authMiddleware, allowRoles('Admin'), async (req, res) => {
  try {
    const lockedUsers = await User.find({
      companyId: req.user.companyId,
      accountLocked: true,
      isActive: true,
    })
      .select('fullName email role failedLoginAttempts lockedAt')
      .sort({ lockedAt: -1 });

    res.status(200).json({ lockedUsers, count: lockedUsers.length });
  } catch (err) {
    console.error('Get locked users error:', err);
    res.status(500).json({ message: 'Server error fetching locked users' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
 * POST /api/auth/unlock-user/:userId — Admin only
 * Resets failed-attempt counter, generates a new temp password, and forces the
 * user to change it on next login. The new password is returned ONCE so the
 * Admin can share it with the user via a secure channel.
 * ─────────────────────────────────────────────────────────────────────── */
router.post('/unlock-user/:userId', authMiddleware, allowRoles('Admin'), async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.userId,
      companyId: req.user.companyId,   // scope: only users in the Admin's company
    });
    if (!user) return res.status(404).json({ message: 'User not found in your company' });
    if (user.role === 'Admin') {
      return res.status(403).json({ message: 'Admin accounts cannot be unlocked through this flow' });
    }

    const newTempPassword = generateTempPassword();
    user.password            = newTempPassword;   // pre-save hook hashes it
    user.failedLoginAttempts = 0;
    user.accountLocked       = false;
    user.lockedAt            = null;
    user.mustChangePassword  = true;               // force change on next login
    await user.save();

    res.status(200).json({
      message:      'Account unlocked. Share the new temporary password with the user via a secure channel.',
      tempPassword: newTempPassword,
      user:         { id: user._id, email: user.email, fullName: user.fullName, role: user.role },
    });
  } catch (err) {
    console.error('Unlock user error:', err);
    res.status(500).json({ message: 'Server error unlocking user' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
 * GET /api/auth/users — Admin only
 * ─────────────────────────────────────────────────────────────────────── */
router.get('/users', authMiddleware, allowRoles('Admin'), async (req, res) => {
  try {
    const users = await User.find({ companyId: req.user.companyId })
      .select('-password -twoFactorSecret')
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 });

    res.status(200).json({ users });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ message: 'Server error fetching users' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
 * GET /api/auth/assigned-principles — Admin only
 * Returns a map of { principleId: assignedToFullName } for the company's
 * active TeamMembers. The frontend uses this to grey-out taken principles
 * in the Create User modal exclusion logic.
 * ─────────────────────────────────────────────────────────────────────── */
router.get('/assigned-principles', authMiddleware, allowRoles('Admin'), async (req, res) => {
  try {
    const members = await User.find({
      companyId: req.user.companyId,
      role: 'TeamMember',
      isActive: true,
    }).select('fullName assignedPrinciples');

    const taken = {};
    members.forEach(u => {
      (u.assignedPrinciples || []).forEach(p => {
        taken[p] = u.fullName;
      });
    });

    res.status(200).json({ taken });
  } catch (err) {
    console.error('Get assigned principles error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
