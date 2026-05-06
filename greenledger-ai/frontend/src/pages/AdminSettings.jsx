import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import MI from '../components/MI';

const INDUSTRY_SECTORS = [
  'Manufacturing', 'Information Technology', 'Financial Services', 'Energy',
  'Healthcare', 'Consumer Goods', 'Infrastructure', 'Chemicals', 'Automotive', 'Other',
];

const iCls = (disabled) =>
  'w-full bg-zinc-900 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white ' +
  'placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 transition-colors' +
  (disabled ? ' opacity-40 cursor-not-allowed' : '');

const lCls = 'block text-xs font-medium text-zinc-400 mb-1.5';

const Section = ({ icon, title, children }) => (
  <div className="glass-panel rounded-2xl p-6">
    <h2 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
      <MI icon={icon} className="text-emerald-500 text-base" />
      {title}
    </h2>
    {children}
  </div>
);

const SaveRow = ({ saving, onCancel }) => (
  <div className="flex gap-3 pt-1">
    <button
      type="submit"
      disabled={saving}
      className="flex-1 ai-gradient-bg hover:opacity-90 disabled:opacity-50 rounded-lg py-2.5 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
    >
      {saving
        ? <><MI icon="sync" className="text-base animate-spin" /> Saving…</>
        : <><MI icon="save" className="text-base" /> Save Changes</>}
    </button>
    <button
      type="button"
      onClick={onCancel}
      className="px-5 py-2.5 bg-zinc-800 border border-white/10 text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors"
    >
      Cancel
    </button>
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────── */

const AdminSettings = () => {
  const { login } = useAuth();

  /* ── Company ── */
  const [company,       setCompany]       = useState(null);
  const [loadingCo,     setLoadingCo]     = useState(true);
  const [editCo,        setEditCo]        = useState(false);
  const [savingCo,      setSavingCo]      = useState(false);
  const [coForm, setCoForm] = useState({
    industrySector: '', yearOfIncorporation: '', registeredAddress: '',
    website: '', stockExchange: '', paidUpCapital: '',
    reportingBoundary: 'standalone', brContactName: '', brContactEmail: '', brContactPhone: '',
  });

  /* ── Inference mode ── */
  const [inferenceMode, setInferenceMode] = useState(null);
  const [loadingMode,   setLoadingMode]   = useState(true);
  const [savingMode,    setSavingMode]    = useState(false);

  /* ── Password change ── */
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPw,  setSavingPw]  = useState(false);
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });

  useEffect(() => {
    axiosClient.get('/api/settings/company')
      .then(res => {
        const c = res.data.company;
        setCompany(c);
        setCoForm({
          industrySector:     c.industrySector     || '',
          yearOfIncorporation: c.yearOfIncorporation || '',
          registeredAddress:  c.registeredAddress  || '',
          website:            c.website            || '',
          stockExchange:      c.stockExchange      || '',
          paidUpCapital:      c.paidUpCapital      || '',
          reportingBoundary:  c.reportingBoundary  || 'standalone',
          brContactName:      c.brContactName      || '',
          brContactEmail:     c.brContactEmail     || '',
          brContactPhone:     c.brContactPhone     || '',
        });
      })
      .catch(() => toast.error('Failed to load company settings'))
      .finally(() => setLoadingCo(false));

    axiosClient.get('/api/settings/inference-mode')
      .then(res => setInferenceMode(res.data.mode))
      .catch(() => setInferenceMode('local'))
      .finally(() => setLoadingMode(false));
  }, []);

  const handleCoChange = e => setCoForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSaveCompany = async e => {
    e.preventDefault();
    setSavingCo(true);
    try {
      const res = await axiosClient.patch('/api/settings/company', coForm);
      setCompany(res.data.company);
      setEditCo(false);
      toast.success('Company details saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSavingCo(false);
    }
  };

  const handleCancelCompany = () => {
    setCoForm({
      industrySector:     company.industrySector     || '',
      yearOfIncorporation: company.yearOfIncorporation || '',
      registeredAddress:  company.registeredAddress  || '',
      website:            company.website            || '',
      stockExchange:      company.stockExchange      || '',
      paidUpCapital:      company.paidUpCapital      || '',
      reportingBoundary:  company.reportingBoundary  || 'standalone',
      brContactName:      company.brContactName      || '',
      brContactEmail:     company.brContactEmail     || '',
      brContactPhone:     company.brContactPhone     || '',
    });
    setEditCo(false);
  };

  const handleToggleInference = async (mode) => {
    if (mode === inferenceMode || savingMode) return;
    setSavingMode(true);
    try {
      const res = await axiosClient.post('/api/settings/inference-mode', { mode });
      setInferenceMode(res.data.mode);
      toast.success(`AI engine switched to ${mode === 'aws' ? 'AWS Bedrock' : 'Local Ollama'}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update mode');
    } finally {
      setSavingMode(false);
    }
  };

  const handleChangePassword = async e => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setSavingPw(true);
    try {
      const res = await axiosClient.post('/api/auth/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      if (res.data.token) login(res.data.token);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password changed successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#050505] border-b border-white/10 flex items-center px-6 gap-4">
        <Link to="/admin/dashboard" className="flex items-center gap-2 flex-shrink-0 w-56">
          <div className="w-8 h-8 ai-gradient-bg rounded-lg flex items-center justify-center">
            <MI icon="eco" className="text-white text-base" fill />
          </div>
          <span className="font-bold text-base tracking-tight">GreenLedger AI</span>
        </Link>
        <div className="flex-1" />
        <Link
          to="/admin/dashboard"
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-white/10 rounded-lg text-sm text-zinc-300 hover:border-white/20 transition-all"
        >
          <MI icon="arrow_back" className="text-base" /> Dashboard
        </Link>
      </header>

      {/* Body */}
      <div className="pt-24 pb-16 px-6 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          <div>
            <h1 className="text-2xl font-black text-white mb-1">Settings</h1>
            <p className="text-zinc-500 text-sm">Manage company details, AI inference mode, and account security.</p>
          </div>

          {/* ── Company Details ────────────────────────────────────────── */}
          {loadingCo ? (
            <div className="glass-panel rounded-2xl p-8 flex justify-center">
              <LoadingSpinner message="Loading company…" />
            </div>
          ) : (
            <Section icon="business" title="Company Details">
              <form onSubmit={handleSaveCompany} className="space-y-4">
                {/* Read-only identity fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lCls}>Company Name <span className="text-zinc-600">(read-only)</span></label>
                    <input value={company?.companyName || ''} disabled className={iCls(true)} />
                  </div>
                  <div>
                    <label className={lCls}>CIN <span className="text-zinc-600">(read-only)</span></label>
                    <input value={company?.CIN || ''} disabled className={iCls(true)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lCls}>Industry Sector</label>
                    <select
                      name="industrySector"
                      value={coForm.industrySector}
                      onChange={handleCoChange}
                      disabled={!editCo}
                      className={iCls(!editCo) + ' appearance-none'}
                    >
                      <option value="">Select sector</option>
                      {INDUSTRY_SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lCls}>Year of Incorporation</label>
                    <input
                      name="yearOfIncorporation"
                      value={coForm.yearOfIncorporation}
                      onChange={handleCoChange}
                      disabled={!editCo}
                      placeholder="2005"
                      className={iCls(!editCo)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lCls}>Website</label>
                    <input
                      name="website"
                      value={coForm.website}
                      onChange={handleCoChange}
                      disabled={!editCo}
                      placeholder="https://company.com"
                      className={iCls(!editCo)}
                    />
                  </div>
                  <div>
                    <label className={lCls}>Registered Address</label>
                    <input
                      name="registeredAddress"
                      value={coForm.registeredAddress}
                      onChange={handleCoChange}
                      disabled={!editCo}
                      placeholder="123 MG Road, Mumbai 400001"
                      className={iCls(!editCo)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={lCls}>Stock Exchange</label>
                    <input
                      name="stockExchange"
                      value={coForm.stockExchange}
                      onChange={handleCoChange}
                      disabled={!editCo}
                      placeholder="BSE / NSE"
                      className={iCls(!editCo)}
                    />
                  </div>
                  <div>
                    <label className={lCls}>Paid-up Capital</label>
                    <input
                      name="paidUpCapital"
                      value={coForm.paidUpCapital}
                      onChange={handleCoChange}
                      disabled={!editCo}
                      placeholder="₹500 Cr"
                      className={iCls(!editCo)}
                    />
                  </div>
                  <div>
                    <label className={lCls}>Reporting Boundary</label>
                    <select
                      name="reportingBoundary"
                      value={coForm.reportingBoundary}
                      onChange={handleCoChange}
                      disabled={!editCo}
                      className={iCls(!editCo) + ' appearance-none'}
                    >
                      <option value="standalone">Standalone</option>
                      <option value="consolidated">Consolidated</option>
                    </select>
                  </div>
                </div>

                {/* BR Contact */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={lCls}>BR Contact Name</label>
                    <input
                      name="brContactName"
                      value={coForm.brContactName}
                      onChange={handleCoChange}
                      disabled={!editCo}
                      placeholder="Meena Sharma"
                      className={iCls(!editCo)}
                    />
                  </div>
                  <div>
                    <label className={lCls}>BR Contact Email</label>
                    <input
                      name="brContactEmail"
                      type="email"
                      value={coForm.brContactEmail}
                      onChange={handleCoChange}
                      disabled={!editCo}
                      placeholder="esg@company.com"
                      className={iCls(!editCo)}
                    />
                  </div>
                  <div>
                    <label className={lCls}>BR Contact Phone</label>
                    <input
                      name="brContactPhone"
                      value={coForm.brContactPhone}
                      onChange={handleCoChange}
                      disabled={!editCo}
                      placeholder="+91 98765 43210"
                      className={iCls(!editCo)}
                    />
                  </div>
                </div>

                {editCo ? (
                  <SaveRow saving={savingCo} onCancel={handleCancelCompany} />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditCo(true)}
                    className="ai-gradient-bg hover:opacity-90 rounded-lg px-5 py-2.5 text-white font-bold text-sm flex items-center gap-2 transition-all"
                  >
                    <MI icon="edit" className="text-base" /> Edit Details
                  </button>
                )}
              </form>
            </Section>
          )}

          {/* ── AI Inference Mode ──────────────────────────────────────── */}
          <Section icon="smart_toy" title="AI Inference Mode">
            {loadingMode ? (
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <MI icon="sync" className="animate-spin text-base" /> Loading…
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-zinc-400 text-sm">
                  Choose where AI document extraction runs. Switching takes effect on the next document upload.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { mode: 'aws',   icon: 'cloud',    label: 'AWS Bedrock',   sub: 'Claude 3 Haiku · 2–8s · Production' },
                    { mode: 'local', icon: 'computer', label: 'Local Ollama',  sub: 'llama3:8b · 60–180s · Development' },
                  ].map(({ mode, icon, label, sub }) => (
                    <button
                      key={mode}
                      type="button"
                      disabled={savingMode}
                      onClick={() => handleToggleInference(mode)}
                      className={`relative p-4 rounded-xl border text-left transition-all ${
                        inferenceMode === mode
                          ? 'border-emerald-500/60 bg-emerald-950/20'
                          : 'border-white/10 bg-zinc-900/40 hover:border-white/20'
                      } ${savingMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {inferenceMode === mode && (
                        <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-emerald-400 rounded-full" />
                      )}
                      <MI icon={icon} className={`text-2xl mb-2 ${inferenceMode === mode ? 'text-emerald-400' : 'text-zinc-500'}`} />
                      <p className={`text-sm font-bold ${inferenceMode === mode ? 'text-white' : 'text-zinc-300'}`}>{label}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* ── Change Password ────────────────────────────────────────── */}
          <Section icon="lock" title="Change Password">
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className={lCls}>Current Password</label>
                <div className="relative">
                  <input
                    type={showPw.current ? 'text' : 'password'}
                    value={pwForm.currentPassword}
                    onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                    required
                    placeholder="Enter current password"
                    className={iCls(false) + ' pr-10'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(p => ({ ...p, current: !p.current }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    <MI icon={showPw.current ? 'visibility_off' : 'visibility'} className="text-lg" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lCls}>New Password</label>
                  <div className="relative">
                    <input
                      type={showPw.new ? 'text' : 'password'}
                      value={pwForm.newPassword}
                      onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                      required
                      minLength={8}
                      placeholder="Min 8 characters"
                      className={iCls(false) + ' pr-10'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(p => ({ ...p, new: !p.new }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      <MI icon={showPw.new ? 'visibility_off' : 'visibility'} className="text-lg" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className={lCls}>Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showPw.confirm ? 'text' : 'password'}
                      value={pwForm.confirmPassword}
                      onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                      required
                      placeholder="Repeat new password"
                      className={iCls(false) + ' pr-10'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(p => ({ ...p, confirm: !p.confirm }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      <MI icon={showPw.confirm ? 'visibility_off' : 'visibility'} className="text-lg" />
                    </button>
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={savingPw}
                className="ai-gradient-bg hover:opacity-90 disabled:opacity-50 rounded-lg px-5 py-2.5 text-white font-bold text-sm flex items-center gap-2 transition-all"
              >
                {savingPw
                  ? <><MI icon="sync" className="text-base animate-spin" /> Changing…</>
                  : <><MI icon="key" className="text-base" /> Change Password</>}
              </button>
            </form>
          </Section>

        </motion.div>
      </div>
    </div>
  );
};

export default AdminSettings;
