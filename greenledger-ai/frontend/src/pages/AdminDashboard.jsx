import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { BRSR_PRINCIPLES } from '../constants/brsrPrinciples';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import AnalyticsPanel from '../components/AnalyticsPanel';
import MI from '../components/MI';
import NotificationPanel from '../components/NotificationPanel';
import { AdminSidebarLinks } from '../components/AdminSidebar';

/* ─── Create User Modal (with BRSR Principle Assignment) ────────────────── */
const CreateUserModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({ fullName: '', email: '', role: 'TeamMember' });
  const [selectedPrinciples,  setSelectedPrinciples]  = useState([]);
  const [takenPrinciples,     setTakenPrinciples]     = useState({});  // { P1: 'Ravi', P6: 'Priya' }
  const [loadingPrinciples,   setLoadingPrinciples]   = useState(false);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  /* After creation, backend returns a one-time temp password for the admin to share */
  const [tempPassword, setTempPassword] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  /* Fetch already-taken principles whenever role switches to TeamMember */
  useEffect(() => {
    if (form.role !== 'TeamMember') { setSelectedPrinciples([]); return; }
    setLoadingPrinciples(true);
    axiosClient.get('/api/auth/assigned-principles')
      .then(res => setTakenPrinciples(res.data.taken || {}))
      .catch(() => setTakenPrinciples({}))
      .finally(() => setLoadingPrinciples(false));
  }, [form.role]);

  const togglePrinciple = (id) => {
    if (takenPrinciples[id]) return;
    setSelectedPrinciples(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = { fullName: form.fullName, email: form.email, role: form.role };
      if (form.role === 'TeamMember') payload.assignedPrinciples = selectedPrinciples;
      const res = await axiosClient.post('/api/auth/create-user', payload);
      onCreated();
      setTempPassword(res.data.tempPassword);   // show copy-step instead of closing
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create user';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const inputClass = 'w-full bg-[#0e0e10] border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-emerald-700/50 focus:ring-1 focus:ring-emerald-700/20 transition-all';

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
      <div className="glass-panel rounded-2xl p-8 w-full max-w-lg my-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-700 rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/25">
              <MI icon="person_add" className="text-white text-xl" />
            </div>
            <div>
              <h3 className="font-bold text-white">Create New User</h3>
              <p className="text-zinc-500 text-xs">Add a team member or supplier</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-1">
            <MI icon="close" className="text-xl" />
          </button>
        </div>

        {/* ── Temp-password success step ────────────────────────────────── */}
        {tempPassword && (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-950/30 border border-emerald-700/35 rounded-xl">
              <p className="text-emerald-400 text-xs font-bold flex items-center gap-2 mb-1">
                <MI icon="check_circle" className="text-base" fill /> Account created successfully
              </p>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Share this one-time temporary password with <span className="text-white font-semibold">{form.fullName}</span> via a secure channel.
                They can change it after their first login.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">Temporary Password</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-emerald-300 font-mono text-sm tracking-wider select-all">
                  {tempPassword}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-3 bg-zinc-800 border border-white/10 rounded-lg text-xs font-bold text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
                >
                  <MI icon={copied ? 'check' : 'content_copy'} className="text-base" />
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full ai-gradient-bg hover:opacity-90 rounded-lg py-3 text-white font-bold text-sm transition-all"
            >
              Done
            </button>
          </div>
        )}

        {/* ── Creation form (hidden once user is created) ────────────── */}
        {!tempPassword && (
        <>
        {error && (
          <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm flex items-center gap-2">
            <MI icon="error" className="text-base flex-shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic fields */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Full Name</label>
            <input name="fullName" value={form.fullName} onChange={handleChange} required
              className={inputClass} placeholder="Ravi Shankar" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              Email
              {form.role === 'TeamMember' && (
                <span className="ml-2 text-zinc-600 font-normal">— must use your company domain</span>
              )}
            </label>
            <input name="email" type="email" value={form.email} onChange={handleChange} required
              className={inputClass} placeholder={form.role === 'TeamMember' ? 'ravi@yourcompany.com' : 'supplier@anycompany.com'} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Role</label>
            <select name="role" value={form.role} onChange={handleChange}
              className={inputClass + ' appearance-none'}>
              <option value="TeamMember">Team Member</option>
              <option value="Supplier">Supplier</option>
            </select>
          </div>

          {/* ── BRSR Principle Assignment (TeamMember only) ──────────────── */}
          {form.role === 'TeamMember' && (
            <div className="border border-white/10 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-zinc-900/60 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-zinc-300">Assign BRSR Principles</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">Each principle can only be owned by one team member</p>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-950/30 border border-emerald-900/40 px-2 py-0.5 rounded-full">
                  {selectedPrinciples.length}/9 selected
                </span>
              </div>

              {loadingPrinciples ? (
                <div className="p-4 flex items-center gap-2 text-zinc-600 text-xs">
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
                  </svg>
                  Checking availability…
                </div>
              ) : (
                <div className="p-3 space-y-1.5 max-h-56 overflow-y-auto"
                  style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(16,185,129,0.15) transparent' }}>
                  {BRSR_PRINCIPLES.map(({ id, short, icon, ngrbc }) => {
                    const takenBy  = takenPrinciples[id];
                    const selected = selectedPrinciples.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={!!takenBy}
                        onClick={() => togglePrinciple(id)}
                        className={[
                          'w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all',
                          takenBy
                            ? 'border-white/5 bg-zinc-900/30 opacity-45 cursor-not-allowed'
                            : selected
                              ? 'border-emerald-600/45 bg-emerald-950/25 cursor-pointer'
                              : 'border-white/8 hover:border-emerald-800/40 hover:bg-emerald-950/10 cursor-pointer',
                        ].join(' ')}
                      >
                        {/* Custom checkbox */}
                        <div className={[
                          'w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors',
                          selected ? 'bg-emerald-500 border-emerald-500' : takenBy ? 'border-zinc-700 bg-transparent' : 'border-zinc-600 bg-transparent',
                        ].join(' ')}>
                          {selected && <MI icon="check" className="text-white text-[10px]" />}
                        </div>

                        {/* P-badge */}
                        <span className="text-[10px] font-black text-emerald-700 w-6 flex-shrink-0">{id}</span>

                        {/* Icon */}
                        <MI icon={icon} className={`text-base flex-shrink-0 ${selected ? 'text-emerald-400' : 'text-zinc-600'}`} />

                        {/* Name */}
                        <span className={`flex-1 text-xs font-medium ${selected ? 'text-white' : takenBy ? 'text-zinc-600' : 'text-zinc-400'}`}>
                          {short}
                          <span className="font-normal text-zinc-700 ml-1">· {ngrbc}</span>
                        </span>

                        {/* Taken by */}
                        {takenBy && (
                          <span className="text-[10px] text-zinc-600 flex-shrink-0">→ {takenBy}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-white/10 rounded-lg py-3 text-zinc-400 text-sm hover:border-white/20 hover:text-white transition-all">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 disabled:opacity-50 rounded-lg py-3 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(16,185,129,0.2)]">
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
                  </svg>
                  Creating…
                </>
              ) : (
                <><MI icon="person_add" className="text-base" /> Create User</>
              )}
            </button>
          </div>
        </form>
        </>
        )}
      </div>
    </div>
  );
};

/* ─── Role Badge ─────────────────────────────────────────────────────────── */
const RoleBadge = ({ role }) => {
  const cfg = {
    Admin:      'bg-green-900/20 text-green-400 border border-green-800/30',
    TeamMember: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    Supplier:   'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg[role] || cfg.TeamMember}`}>{role}</span>
  );
};

/* ─── Status Chip ────────────────────────────────────────────────────────── */
const StatusChip = ({ status }) => {
  const cfg = {
    pending:    'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    processing: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    verified:   'bg-green-900/20 text-green-400 border border-green-700/30',
    failed:     'bg-red-500/10 text-red-400 border border-red-500/20',
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg[status] || cfg.pending}`}>{status}</span>
  );
};

/* ─── Inference Mode Toggle (AWS Bedrock ⇄ Local Ollama) ─────────────────── */
const InferenceModeToggle = () => {
  const [mode, setMode] = useState('aws');     // 'aws' | 'local'
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef(null);

  /* Load current persisted mode */
  useEffect(() => {
    axiosClient.get('/api/settings/inference-mode')
      .then(res => setMode(res.data.mode || 'aws'))
      .catch(() => {});
  }, []);

  /* Close on outside click */
  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const switchTo = async (target) => {
    if (target === mode) { setOpen(false); return; }
    setSwitching(true);
    try {
      // When switching to local, verify Ollama is actually reachable first
      if (target === 'local') {
        const probe = await axiosClient.get('/api/health/engine').catch(() => null);
        if (!probe?.data?.ollama_connected) {
          toast.error('Local Ollama not detected on localhost:11434. Install & start it, then try again.');
          setSwitching(false);
          return;
        }
      }
      const res = await axiosClient.post('/api/settings/inference-mode', { mode: target });
      setMode(res.data.mode);
      toast.success(target === 'aws'
        ? 'Switched to AWS Bedrock'
        : 'Switched to Local Ollama');
      setOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to switch mode');
    } finally {
      setSwitching(false);
    }
  };

  const isLocal = mode === 'local';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title={isLocal ? 'Inference: Local Ollama' : 'Inference: AWS Bedrock'}
        className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all
          ${isLocal
            ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/15'
            : 'bg-emerald-500/10 border-emerald-700/40 text-emerald-400 hover:bg-emerald-500/15'
          }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isLocal ? 'bg-amber-400' : 'bg-emerald-400'} animate-pulse`} />
        <MI icon={isLocal ? 'computer' : 'cloud'} className="text-sm" />
        <span className="tracking-wider uppercase">{isLocal ? 'Local' : 'AWS'}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-11 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl shadow-black/60 p-2 w-72 z-50">
          <div className="px-2 py-2 border-b border-white/10 mb-1">
            <p className="text-white text-xs font-bold">Inference Mode</p>
            <p className="text-zinc-500 text-[10px] mt-0.5">
              Hackathon default: AWS Bedrock. Local Ollama is for dev/offline runs.
            </p>
          </div>

          <button
            onClick={() => switchTo('aws')}
            disabled={switching}
            className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors text-left
              ${mode === 'aws' ? 'bg-emerald-950/40 border border-emerald-800/40' : 'hover:bg-white/5 border border-transparent'}`}
          >
            <MI icon="cloud" className={`text-lg flex-shrink-0 mt-0.5 ${mode === 'aws' ? 'text-emerald-400' : 'text-zinc-500'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-bold flex items-center gap-2">
                AWS Bedrock
                {mode === 'aws' && <MI icon="check_circle" className="text-emerald-400 text-sm" fill />}
              </p>
              <p className="text-zinc-500 text-[10px] mt-0.5 leading-snug">
                Claude on AWS Bedrock (ap-south-1). Required for hackathon submission.
              </p>
            </div>
          </button>

          <button
            onClick={() => switchTo('local')}
            disabled={switching}
            className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors text-left mt-1
              ${mode === 'local' ? 'bg-amber-950/40 border border-amber-700/40' : 'hover:bg-white/5 border border-transparent'}`}
          >
            <MI icon="computer" className={`text-lg flex-shrink-0 mt-0.5 ${mode === 'local' ? 'text-amber-400' : 'text-zinc-500'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-bold flex items-center gap-2">
                Local Ollama
                {mode === 'local' && <MI icon="check_circle" className="text-amber-400 text-sm" fill />}
              </p>
              <p className="text-zinc-500 text-[10px] mt-0.5 leading-snug">
                Runs on your machine via localhost:11434. We auto-verify before switching.
              </p>
            </div>
          </button>

          {switching && (
            <p className="text-center text-zinc-500 text-[10px] mt-2 animate-pulse">Verifying engine…</p>
          )}
        </div>
      )}
    </div>
  );
};

/* Document Vault category groups — matches BRSR categories in the backend */
const VAULT_GROUPS = [
  {
    icon: 'bolt',
    label: 'Utilities',
    color: 'text-yellow-400',
    categories: ['electricity_bill', 'fuel_consumption', 'water_usage', 'waste_records', 'air_emissions_log'],
  },
  {
    icon: 'account_balance',
    label: 'Financials',
    color: 'text-sky-400',
    categories: ['financial_statements', 'accounts_payable', 'scope3_emissions_data'],
  },
  {
    icon: 'badge',
    label: 'HR & People',
    color: 'text-violet-400',
    categories: ['hr_wages_data', 'employee_benefits', 'workforce_records', 'safety_incidents_log', 'posh_records'],
  },
  {
    icon: 'policy',
    label: 'Governance',
    color: 'text-slate-300',
    categories: ['governance_report', 'cyber_security_log', 'consumer_complaints'],
  },
  {
    icon: 'local_shipping',
    label: 'Suppliers',
    color: 'text-emerald-400',
    categories: ['supplier_msme_cert'],
  },
];

/* ─── Collapsible details pane shown when a team-member row is clicked ───── */
const ExpandedUserPane = ({ user: u, documents }) => {
  const userDocs     = documents.filter(d => d.uploadedBy?._id === u._id);
  const verifiedDocs = userDocs.filter(d => d.status === 'verified');
  const confidence   = userDocs.length > 0
    ? Math.round((verifiedDocs.length / userDocs.length) * 100)
    : 0;

  const principleData = (u.assignedPrinciples || []).map(pid => {
    const principle = BRSR_PRINCIPLES.find(p => p.id === pid);
    const docCount  = userDocs.filter(d =>
      (principle?.categories || []).includes(d.brsrCategory)
    ).length;
    return { pid, short: principle?.short || pid, docCount };
  });
  const maxPrincDocs = Math.max(...principleData.map(p => p.docCount), 1);

  const auditTrail = [...userDocs]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);

  const STATUS_COLOR = {
    verified:   'text-emerald-400',
    failed:     'text-red-400',
    processing: 'text-amber-400',
    pending:    'text-slate-500',
  };
  const STATUS_ICON = { verified: '✓', failed: '✕', processing: '↻', pending: '○' };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-6 py-5 bg-slate-900/70 border-t border-slate-700/50">

      {/* Chunk 1 — Profile & Confidence Score */}
      <div className="space-y-4">
        <p className="gl-overline">Profile Overview</p>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-md bg-emerald-900/30 border border-emerald-800/40 flex items-center justify-center text-emerald-300 font-bold text-sm flex-shrink-0">
            {(u.fullName?.[0] || '?').toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-slate-50 font-semibold text-sm leading-5">{u.fullName}</p>
            <p className="text-slate-400 text-xs leading-5 truncate">{u.email}</p>
            {u.phone && <p className="text-slate-500 text-xs leading-5">{u.phone}</p>}
          </div>
        </div>

        <div className="rounded-md bg-slate-800 border border-slate-700 p-4 space-y-2">
          <p className="gl-overline mb-1">Auditor Confidence</p>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold tabular-nums leading-none ${
              confidence >= 80 ? 'text-emerald-400'
              : confidence >= 50 ? 'text-amber-400'
              : 'text-red-400'
            }`}>{confidence}%</span>
            <span className="text-xs text-slate-500">
              {verifiedDocs.length} of {userDocs.length} doc{userDocs.length !== 1 ? 's' : ''} verified
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                confidence >= 80 ? 'bg-emerald-500'
                : confidence >= 50 ? 'bg-amber-500'
                : 'bg-red-500'
              }`}
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>

        <button className="w-full h-9 flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors duration-200">
          <MI icon="mail" className="text-sm" />
          Message Member
        </button>
      </div>

      {/* Chunk 2 — Principle Coverage Map */}
      <div className="space-y-3">
        <p className="gl-overline">Principle Coverage Map</p>
        {principleData.length === 0 ? (
          <p className="text-slate-600 text-xs">No principles assigned yet</p>
        ) : (
          principleData.map(({ pid, short, docCount }) => {
            const barPct = Math.max(
              Math.round((docCount / maxPrincDocs) * 100),
              docCount > 0 ? 6 : 0,
            );
            return (
              <div key={pid} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-500 border border-emerald-900/40 flex-shrink-0">
                      {pid}
                    </span>
                    <span className="text-xs text-slate-400 truncate">{short}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 tabular-nums flex-shrink-0">
                    {docCount} doc{docCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Chunk 3 — Audit Trail */}
      <div className="space-y-3">
        <p className="gl-overline">Audit Trail</p>
        {auditTrail.length === 0 ? (
          <p className="text-slate-600 text-xs">No audit activity yet</p>
        ) : (
          <div className="space-y-2">
            {auditTrail.map(doc => {
              const timeStr = new Date(doc.createdAt)
                .toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
              return (
                <div key={doc._id} className="flex items-start gap-2">
                  <span className={`font-mono text-[11px] flex-shrink-0 mt-0.5 ${STATUS_COLOR[doc.status] || 'text-slate-500'}`}>
                    {STATUS_ICON[doc.status] || '·'}
                  </span>
                  <p className="font-mono text-[11px] leading-5 min-w-0">
                    <span className="text-slate-500">{timeStr}: </span>
                    <span className={`${
                      doc.status === 'verified'   ? 'text-emerald-400'
                      : doc.status === 'failed'   ? 'text-red-400'
                      : 'text-amber-400'
                    }`}>
                      {doc.status === 'verified'    ? 'Verified'
                       : doc.status === 'failed'    ? 'Failed audit'
                       : doc.status === 'processing'? 'Processing'
                       : 'Uploaded'}
                    </span>
                    <span className="text-slate-600"> · </span>
                    <span className="text-slate-300">
                      {(doc.originalFileName?.length ?? 0) > 30
                        ? `${doc.originalFileName.slice(0, 30)}…`
                        : (doc.originalFileName || 'Document')}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── AdminDashboard ─────────────────────────────────────────────────────── */

/* ── (unused after refactor — kept as dead-code guard) ───────────────────── */
const useSidebarActive = (to) => {
  const location = useLocation();
  if (to === '/admin/dashboard') {
    return location.pathname === '/admin/dashboard' && !location.hash;
  }
  if (to.includes('#')) {
    const [pathname, hash] = to.split('#');
    return location.pathname === pathname && location.hash === `#${hash}`;
  }
  return location.pathname === to;
};

/* ── CollapsibleSection — reusable accordion for main page content ───────── */
/* Uses max-height CSS transition (universally supported, compositor-friendly).
 * Opening eases slower so content "falls in"; closing snaps faster.         */
const CollapsibleSection = ({
  icon, iconColor = 'text-blue-400',
  title, subtitle,
  badge,
  defaultOpen = true,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="glass-panel rounded-2xl overflow-hidden">
      {/* ── Header / toggle ─────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 border-b border-white/10 hover:bg-white/[0.02] transition-colors duration-150 group"
      >
        <div className="flex items-center gap-3">
          <MI icon={icon} className={`${iconColor} text-xl`} />
          <div className="text-left">
            <h2 className="font-bold text-white text-sm">{title}</h2>
            {subtitle && (
              <p className="text-zinc-600 text-xs mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {badge}
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{ display: 'flex' }}
          >
            <MI icon="expand_more" className="text-zinc-500 text-2xl group-hover:text-zinc-300 transition-colors" />
          </motion.span>
        </div>
      </button>

      {/* ── Collapsible body ─────────────────────────────────────────── */}
      <div
        style={{
          maxHeight: open ? '4000px' : '0px',
          overflow: 'hidden',
          transition: open
            ? 'max-height 380ms cubic-bezier(0.4, 0, 0.2, 1)'
            : 'max-height 220ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {children}
      </div>
    </div>
  );
};

/* ── All Documents sidebar dropdown ─────────────────────────────────────── */
/* Animation: CSS grid-template-rows 0fr→1fr — pure compositor path, no JS
 * layout measurement, no framer-motion height:auto jank. The chevron still
 * uses a tiny framer-motion rotate so it stays consistent with the rest of
 * the app, but that only affects transform (cheap GPU layer).              */
const AllDocumentsDropdown = ({ documents }) => {
  const [open, setOpen] = useState(false);

  const total    = documents.length;
  const verified = documents.filter(d => d.status === 'verified').length;
  const pending  = documents.filter(d => d.status === 'pending' || d.status === 'processing').length;
  const failed   = documents.filter(d => d.status === 'failed').length;

  const countFor = (categories) =>
    documents.filter(d => categories.includes(d.brsrCategory)).length;

  return (
    <div>
      {/* ── Toggle button ──────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors duration-150 text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
      >
        <MI icon="folder_open" className="text-xl" />
        <span className="flex-1 text-left">All Documents</span>

        {total > 0 && (
          <span className="tabular-nums font-mono text-[10px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-zinc-500">
            {total}
          </span>
        )}

        {/* Rotate-only — cheap transform layer, never layout */}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          style={{ display: 'flex', transformOrigin: 'center' }}
        >
          <MI icon="expand_more" className="text-zinc-600 text-lg" />
        </motion.span>
      </button>

      {/* ── max-height CSS transition — universal, compositor-friendly ──── */}
      <div
        style={{
          maxHeight: open ? '400px' : '0px',
          overflow: 'hidden',
          transition: open
            ? 'max-height 240ms cubic-bezier(0.4, 0, 0.2, 1)'
            : 'max-height 180ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div>
          <div className="ml-4 mt-0.5 pb-2 border-l border-white/[0.07] pl-3 space-y-0.5">

            {/* ── Status summary row ──────────────────────────────────── */}
            <div className="flex items-center gap-2 px-3 py-2 mb-1">
              {verified > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  {verified} verified
                </span>
              )}
              {pending > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-amber-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                  {pending} pending
                </span>
              )}
              {failed > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-red-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                  {failed} failed
                </span>
              )}
            </div>

            {/* ── Category group rows ─────────────────────────────────── */}
            {VAULT_GROUPS.map(({ icon, label, color, categories }) => {
              const count = countFor(categories);
              if (count === 0) return null;
              const vCount = documents.filter(
                d => categories.includes(d.brsrCategory) && d.status === 'verified'
              ).length;
              return (
                <Link
                  key={label}
                  to="/admin/war-room"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors duration-150"
                >
                  <MI icon={icon} className={`${color} text-sm flex-shrink-0`} fill />
                  <span className="flex-1 truncate">{label}</span>
                  <span className="font-mono text-[10px] tabular-nums text-zinc-600">
                    {vCount}/{count}
                  </span>
                </Link>
              );
            })}

            {total === 0 && (
              <p className="px-3 py-2 text-[11px] text-zinc-700">No documents yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── AdminDashboard ─────────────────────────────────────────────────────── */
const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [error, setError] = useState('');
  const profileRef = useRef(null);

  /* Close profile dropdown when clicking outside */
  useEffect(() => {
    const handleOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await axiosClient.get('/api/auth/users');
      setUsers(res.data.users);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await axiosClient.get('/api/documents');
      setDocuments(res.data.documents);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load documents');
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); fetchDocuments(); }, [fetchUsers, fetchDocuments]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleDeleteDocument = async (doc) => {
    const kpiWarning = doc.status === 'verified'
      ? '\n\nThis document has been verified — its extracted KPIs and AI insights will be permanently removed from the BRSR report.'
      : '';
    if (!window.confirm(
      `Permanently delete "${doc.originalFileName}"?${kpiWarning}\n\nThis action cannot be undone.`
    )) return;

    try {
      const res = await axiosClient.delete(`/api/documents/${doc._id}`);
      // Optimistic update: remove instantly without a round-trip refetch
      setDocuments(prev => prev.filter(d => d._id !== doc._id));
      const msg = res.data?.kpisCleared
        ? `Document deleted · KPIs for "${doc.brsrCategory.replace(/_/g, ' ')}" cleared from report`
        : 'Document deleted';
      toast.success(msg);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete document');
    }
  };

  const verifiedCount = documents.filter((d) => d.status === 'verified').length;
  const completionPct = documents.length > 0 ? Math.round((verifiedCount / documents.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {showModal && <CreateUserModal onClose={() => setShowModal(false)} onCreated={fetchUsers} />}

      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-5 py-3 rounded-xl flex items-center gap-2">
          <MI icon="error" className="text-base" /> {error}
        </div>
      )}

      {/* Fixed Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#050505] border-b border-white/10 flex items-center px-6 gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 flex-shrink-0 w-56">
          <div className="w-8 h-8 ai-gradient-bg rounded-lg flex items-center justify-center">
            <MI icon="eco" className="text-white text-base" fill />
          </div>
          <span className="font-bold text-base tracking-tight">GreenLedger AI</span>
        </Link>

        {/* Center nav */}
        <nav className="flex-1 hidden md:flex items-center justify-center gap-8 text-sm">
          <span className="text-emerald-400 font-semibold border-b-2 border-emerald-500 pb-0.5">Dashboard</span>
          <span className="text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors">Analytics</span>
          <span className="text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors">Audit Log</span>
        </nav>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2">
          <Link to="/admin/questionnaire"
            className="hidden md:flex items-center gap-2 px-4 py-2 bg-[#1c1b1d] border border-white/10 rounded-lg text-sm text-zinc-300 hover:border-white/20 transition-all">
            <MI icon="assignment" className="text-base" /> Questionnaire
          </Link>
          <Link to="/admin/war-room"
            className="flex items-center gap-2 px-4 py-2 ai-gradient-bg rounded-lg text-sm font-bold hover:opacity-90 transition-opacity">
            <MI icon="visibility" className="text-base" />
            <span className="hidden sm:block">AI War Room</span>
          </Link>
          <InferenceModeToggle />
          <NotificationPanel />
          {/* Profile avatar + dropdown — NOT a logout trigger */}
          <div ref={profileRef} className="relative">
            <div
              className="w-9 h-9 bg-emerald-500/15 border border-emerald-800/40 rounded-full flex items-center justify-center text-emerald-400 font-bold text-sm flex-shrink-0 cursor-pointer hover:bg-emerald-500/25 transition-colors"
              onClick={() => setShowProfileMenu(v => !v)}
              title="Profile"
            >
              {(user?.fullName?.[0] || 'A').toUpperCase()}
            </div>

            {showProfileMenu && (
              <div className="absolute right-0 top-11 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl shadow-black/60 p-1.5 w-52 z-50">
                {/* User info */}
                <div className="px-3 py-2.5 border-b border-white/10 mb-1">
                  <p className="text-white text-xs font-bold truncate">{user?.fullName || 'Admin'}</p>
                  <p className="text-zinc-500 text-[10px] truncate">{user?.email || ''}</p>
                </div>

                <button
                  onClick={() => { setShowProfileMenu(false); navigate('/admin/profile'); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <MI icon="person" className="text-base" /> View Profile
                </button>
                <button
                  onClick={() => { setShowProfileMenu(false); navigate('/admin/questionnaire'); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <MI icon="settings" className="text-base" /> Settings
                </button>

                <div className="border-t border-white/10 my-1" />

                <button
                  onClick={() => { setShowProfileMenu(false); handleLogout(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <MI icon="logout" className="text-base" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Fixed Left Sidebar */}
      <aside className="fixed top-16 left-0 bottom-0 w-64 bg-[#050505] border-r border-white/10 z-40 hidden md:flex flex-col">
        <nav className="flex-1 p-3 pt-4 space-y-1 overflow-y-auto">
          <AdminSidebarLinks />

          {/* ── All Documents dropdown ───────────────────────────────── */}
          <AllDocumentsDropdown documents={documents} />
        </nav>
        <div className="p-4 space-y-2 border-t border-white/10">
          <button
            onClick={() => setShowModal(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-purple-500/40 text-green-400 hover:bg-green-900/20 rounded-lg text-sm font-medium transition-all">
            <MI icon="add" className="text-base" /> New Audit
          </button>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-zinc-600 hover:text-zinc-400 text-sm transition-colors rounded-lg hover:bg-white/5">
            <MI icon="logout" className="text-xl" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 mt-16 p-6 md:p-10 space-y-8">
        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Admin Dashboard</h1>
            <p className="text-zinc-500 text-sm">Welcome back, {user?.fullName || 'Admin'} · SEBI BRSR Core oversight</p>
          </div>
          <button className="hidden md:flex items-center gap-2 px-4 py-2.5 border border-white/10 rounded-lg text-sm text-zinc-400 hover:border-white/20 hover:text-white transition-all">
            <MI icon="download" className="text-base" /> Export Logs
          </button>
        </div>

        {/* Bento Stats 3-col */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Total Users */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Total Users</p>
              <MI icon="group" className="text-green-400 text-xl" />
            </div>
            <p className="text-5xl font-black text-white mb-4">{loadingUsers ? '—' : users.length}</p>
            <div className="w-full bg-white/5 rounded-full h-1.5">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full" style={{ width: `${Math.min((users.length / 20) * 100, 100)}%` }} />
            </div>
            <p className="text-zinc-700 text-xs mt-2">Registered accounts</p>
          </div>

          {/* Documents Submitted */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Documents Submitted</p>
              <MI icon="folder_open" className="text-blue-400 text-xl" />
            </div>
            <p className="text-5xl font-black text-white mb-4">{loadingDocs ? '—' : documents.length}</p>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(documents.length, 12) }).map((_, i) => (
                <div key={i} className="h-4 w-2 bg-blue-500/30 rounded-sm" style={{ height: `${12 + Math.random() * 12}px` }} />
              ))}
            </div>
            <p className="text-zinc-700 text-xs mt-2">ESG documents in vault</p>
          </div>

          {/* Verification Progress */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Verification Progress</p>
              <MI icon="verified" className="text-emerald-400 text-xl" />
            </div>
            <p className="text-5xl font-black text-white mb-4">{loadingDocs ? '—' : `${completionPct}%`}</p>
            <div className="w-full bg-white/5 rounded-full h-2">
              <div className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-2 rounded-full transition-all duration-700"
                style={{ width: `${completionPct}%` }} />
            </div>
            <p className="text-zinc-700 text-xs mt-2">{verifiedCount} of {documents.length} verified</p>
          </div>
        </div>

        {/* Team Members table */}
        <div id="team" className="glass-panel rounded-2xl overflow-hidden scroll-mt-24">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MI icon="group" className="text-green-400 text-xl" />
              <div>
                <h2 className="font-bold text-white text-sm">Team Members &amp; Suppliers</h2>
                <p className="text-zinc-600 text-xs">{users.length} registered account{users.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#b76dff]/10 border border-green-800/40 text-green-400 hover:bg-purple-500/20 rounded-lg text-sm font-medium transition-all">
              <MI icon="person_add" className="text-base" /> Add User
            </button>
          </div>
          {loadingUsers && <LoadingSpinner message="Loading users..." />}
          {!loadingUsers && users.length === 0 && (
            <EmptyState icon={() => <MI icon="group" className="text-4xl text-zinc-700" />}
              title="No team members yet"
              message="Click 'Add User' to create your first team member or supplier account." />
          )}
          {!loadingUsers && users.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#09090b]">
                  <tr className="border-b border-white/10 text-zinc-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-3 text-left">Name</th>
                    <th className="px-6 py-3 text-left">Email</th>
                    <th className="px-6 py-3 text-left">Role</th>
                    <th className="px-6 py-3 text-left">Principles</th>
                    <th className="px-6 py-3 text-left">Docs</th>
                    <th className="px-6 py-3 text-left">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const userDocCount = documents.filter((d) => d.uploadedBy?._id === u._id).length;
                    const isExpanded   = expandedUserId === u._id;
                    return (
                      <Fragment key={u._id}>
                        <tr
                          onClick={() => setExpandedUserId(isExpanded ? null : u._id)}
                          className={`cursor-pointer transition-colors border-b border-white/5 ${
                            isExpanded ? 'bg-slate-800/50' : 'hover:bg-white/5'
                          }`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-green-1000/20 border border-green-900/30 rounded-full flex items-center justify-center text-green-400 font-bold text-xs flex-shrink-0">
                                {(u.fullName?.[0] || '?').toUpperCase()}
                              </div>
                              <span className="text-white font-medium">{u.fullName}</span>
                              <ChevronDown
                                size={14}
                                className={`text-slate-500 flex-shrink-0 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                                aria-hidden="true"
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-zinc-400">{u.email}</td>
                          <td className="px-6 py-4"><RoleBadge role={u.role} /></td>
                          <td className="px-6 py-4">
                            {(u.assignedPrinciples?.length > 0) ? (
                              <div className="flex flex-wrap gap-1">
                                {u.assignedPrinciples.map(p => (
                                  <span key={p}
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/35 text-emerald-500 border border-emerald-900/35"
                                    title={BRSR_PRINCIPLES.find(b => b.id === p)?.name || p}
                                  >
                                    {p}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-zinc-700 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-zinc-400">{userDocCount}</td>
                          <td className="px-6 py-4 text-zinc-600 text-xs">{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                        </tr>

                        <AnimatePresence>
                          {isExpanded && (
                            <tr key={`${u._id}-pane`}>
                              <td colSpan={6} className="p-0 border-b border-slate-700/50">
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                                  style={{ overflow: 'hidden' }}
                                >
                                  <ExpandedUserPane user={u} documents={documents} />
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* All Documents — collapsible table */}
        <div id="vault" className="scroll-mt-24">
          <CollapsibleSection
            icon="folder_open"
            iconColor="text-blue-400"
            title="All Documents"
            subtitle={`${documents.length} document${documents.length !== 1 ? 's' : ''} in vault`}
            badge={
              documents.length > 0 && (
                <span className="text-[10px] font-mono tabular-nums bg-white/5 border border-white/10 rounded px-2 py-0.5 text-zinc-500">
                  {documents.filter(d => d.status === 'verified').length} ✓
                </span>
              )
            }
            defaultOpen={true}
          >
            {loadingDocs && <LoadingSpinner message="Loading documents..." />}
            {!loadingDocs && documents.length === 0 && (
              <EmptyState
                icon={() => <MI icon="folder_open" className="text-4xl text-zinc-700" />}
                title="No documents yet"
                message="Documents will appear here once team members or suppliers upload them."
              />
            )}
            {!loadingDocs && documents.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#09090b]">
                    <tr className="border-b border-white/10 text-zinc-500 text-xs uppercase tracking-wider">
                      <th className="px-6 py-3 text-left">Document Name</th>
                      <th className="px-6 py-3 text-left">Uploaded By</th>
                      <th className="px-6 py-3 text-left">Category</th>
                      <th className="px-6 py-3 text-left">Date</th>
                      <th className="px-6 py-3 text-left">Status</th>
                      <th className="px-6 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {documents.map((doc) => (
                      <tr key={doc._id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 text-zinc-300 max-w-[200px]">
                          <div className="flex items-center gap-2">
                            <MI icon="description" className="text-zinc-600 text-base flex-shrink-0" />
                            <span className="truncate">{doc.originalFileName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-zinc-400">{doc.uploadedBy?.fullName || '—'}</td>
                        <td className="px-6 py-4 text-zinc-500 capitalize text-xs">{doc.brsrCategory.replace(/_/g, ' ')}</td>
                        <td className="px-6 py-4 text-zinc-600 text-xs">{new Date(doc.createdAt).toLocaleDateString('en-IN')}</td>
                        <td className="px-6 py-4"><StatusChip status={doc.status} /></td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleDeleteDocument(doc)}
                            title="Delete document"
                            className="text-zinc-600 hover:text-red-400 transition-colors p-1"
                          >
                            <MI icon="delete" className="text-xl" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleSection>
        </div>
        {/* ── Analytics & Insights — collapsible ───────────────────── */}
        <div id="analytics" className="scroll-mt-24">
          <CollapsibleSection
            icon="insights"
            iconColor="text-emerald-400"
            title="ESG Analytics & Insights"
            subtitle="Live from your document vault · refreshes on page load"
            badge={
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-950/30 border border-emerald-900/30 px-2.5 py-0.5 rounded-full">
                Real data only
              </span>
            }
            defaultOpen={true}
          >
            <div className="p-6">
              <AnalyticsPanel embedded />
            </div>
          </CollapsibleSection>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
