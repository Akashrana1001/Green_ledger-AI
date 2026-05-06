import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import UploadWidget from '../components/UploadWidget';
import MI from '../components/MI';

/* ─── Change Password Modal ──────────────────────────────────────────────── */
const ChangePasswordModal = ({ onClose, forced = false }) => {
  const { login } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.newPassword.length < 8) {
      setError('New password must be at least 8 characters'); return;
    }
    if (form.newPassword !== form.confirm) {
      setError('Passwords do not match'); return;
    }
    setSaving(true);
    try {
      const res = await axiosClient.post('/api/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword:     form.newPassword,
      });
      if (res.data.token) login(res.data.token);
      toast.success('Password changed successfully');
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-[#0e0e10] border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-emerald-700/50 focus:ring-1 focus:ring-emerald-700/20 transition-all';

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
      <div className="glass-panel rounded-2xl p-8 w-full max-w-md">

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${forced ? 'bg-amber-500/20 shadow-amber-500/20' : 'bg-gradient-to-br from-emerald-500 to-green-700 shadow-emerald-500/25'}`}>
              <MI icon="lock_reset" className="text-white text-xl" />
            </div>
            <div>
              <h3 className="font-bold text-white">{forced ? 'Set Your Password' : 'Change Password'}</h3>
              <p className="text-zinc-500 text-xs">
                {forced ? 'Your account uses a temporary password — please set a new one.' : 'Enter your current and new password.'}
              </p>
            </div>
          </div>
          {/* Only show close button if not a forced change */}
          {!forced && (
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-1">
              <MI icon="close" className="text-xl" />
            </button>
          )}
        </div>

        {forced && (
          <div className="mb-5 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2">
            <MI icon="warning" className="text-amber-400 text-base flex-shrink-0 mt-0.5" />
            <p className="text-amber-300 text-xs leading-relaxed">
              You are using a temporary password created by your admin.
              You must set a new personal password before you can continue.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm flex items-center gap-2">
            <MI icon="error" className="text-base flex-shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              {forced ? 'Temporary Password' : 'Current Password'}
            </label>
            <input name="currentPassword" type="password" value={form.currentPassword}
              onChange={handleChange} required autoComplete="current-password"
              className={inputClass} placeholder="Enter current password" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">New Password</label>
            <input name="newPassword" type="password" value={form.newPassword}
              onChange={handleChange} required minLength={8} autoComplete="new-password"
              className={inputClass} placeholder="Minimum 8 characters" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Confirm New Password</label>
            <input name="confirm" type="password" value={form.confirm}
              onChange={handleChange} required autoComplete="new-password"
              className={inputClass} placeholder="Repeat new password" />
          </div>

          <div className="flex gap-3 pt-2">
            {!forced && (
              <button type="button" onClick={onClose}
                className="flex-1 border border-white/10 rounded-lg py-3 text-zinc-400 text-sm hover:border-white/20 hover:text-white transition-all">
                Cancel
              </button>
            )}
            <button type="submit" disabled={saving}
              className={`flex-1 ${forced ? 'ai-gradient-bg' : 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500'} disabled:opacity-50 rounded-lg py-3 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(16,185,129,0.2)]`}>
              {saving ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
                  </svg>
                  Saving…
                </>
              ) : (
                <><MI icon="lock_reset" className="text-base" /> {forced ? 'Set New Password' : 'Update Password'}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─── Password change form — embedded inside Settings tab ───────────────── */
const PasswordTabForm = ({ onClose }) => {
  const { login } = useAuth();
  const [form,   setForm]   = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const inputClass = 'w-full bg-[#0e0e10] border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-emerald-700/50 focus:ring-1 focus:ring-emerald-700/20 transition-all';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.newPassword.length < 8) { setError('New password must be at least 8 characters'); return; }
    if (form.newPassword !== form.confirm) { setError('Passwords do not match'); return; }
    setSaving(true);
    try {
      const res = await axiosClient.post('/api/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword:     form.newPassword,
      });
      if (res.data.token) login(res.data.token);
      toast.success('Password updated');
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm flex items-center gap-2">
          <MI icon="error" className="text-base flex-shrink-0" /> {error}
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-2">Current Password</label>
        <input name="currentPassword" type="password" value={form.currentPassword} onChange={handleChange}
          required autoComplete="current-password" className={inputClass} placeholder="Your current password" />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-2">New Password</label>
        <input name="newPassword" type="password" value={form.newPassword} onChange={handleChange}
          required minLength={8} autoComplete="new-password" className={inputClass} placeholder="Minimum 8 characters" />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-2">Confirm New Password</label>
        <input name="confirm" type="password" value={form.confirm} onChange={handleChange}
          required autoComplete="new-password" className={inputClass} placeholder="Repeat new password" />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose}
          className="flex-1 border border-white/10 rounded-lg py-3 text-zinc-400 text-sm hover:border-white/20 hover:text-white transition-all">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 disabled:opacity-50 rounded-lg py-3 text-white font-bold text-sm transition-all flex items-center justify-center gap-2">
          {saving
            ? <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg> Saving…</>
            : <><MI icon="lock_reset" className="text-base" /> Update Password</>
          }
        </button>
      </div>
    </form>
  );
};

/* ─── Settings Modal — edit profile fields ───────────────────────────────── */
const SettingsModal = ({ onClose, onSaved }) => {
  const { login } = useAuth();
  const [tab,  setTab]  = useState('profile');   // 'profile' | 'password'
  const [form, setForm] = useState({
    fullName: '', phone: '', department: '', designation: '', bio: '',
  });
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  /* Pre-fill the form with the current saved profile */
  useEffect(() => {
    axiosClient.get('/api/auth/profile')
      .then(res => {
        const u = res.data.user || {};
        setForm({
          fullName:    u.fullName    || '',
          phone:       u.phone       || '',
          department:  u.department  || '',
          designation: u.designation || '',
          bio:         u.bio         || '',
        });
        setEmail(u.email || '');
      })
      .catch(err => setError(err.response?.data?.message || 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.fullName.trim()) { setError('Full name is required'); return; }
    setSaving(true);
    try {
      const res = await axiosClient.patch('/api/auth/profile', form);
      // refresh JWT so the navbar avatar / fullName updates everywhere
      if (res.data.token) login(res.data.token);
      toast.success('Profile updated');
      onSaved?.(res.data.user);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update profile';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-[#0e0e10] border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-emerald-700/50 focus:ring-1 focus:ring-emerald-700/20 transition-all';

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
      <div className="glass-panel rounded-2xl p-8 w-full max-w-lg my-auto">

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-700 rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/25">
              <MI icon="settings" className="text-white text-xl" />
            </div>
            <div>
              <h3 className="font-bold text-white">Account Settings</h3>
              <p className="text-zinc-500 text-xs">Profile details &amp; security</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-1">
            <MI icon="close" className="text-xl" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border border-white/10 rounded-lg overflow-hidden mb-5">
          {[
            { id: 'profile',  icon: 'person',     label: 'Profile'  },
            { id: 'password', icon: 'lock_reset',  label: 'Password' },
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold transition-colors ${
                tab === t.id
                  ? 'bg-emerald-500/15 text-emerald-400 border-r border-white/10 last:border-r-0'
                  : 'text-zinc-500 hover:text-zinc-300 border-r border-white/10 last:border-r-0'
              }`}
            >
              <MI icon={t.icon} className="text-sm" /> {t.label}
            </button>
          ))}
        </div>

        {/* Password tab — inline form (not a nested overlay) */}
        {tab === 'password' && (
          <PasswordTabForm onClose={onClose} />
        )}

        {/* Profile tab */}
        {tab === 'profile' && (
        <>
        {error && (
          <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm flex items-center gap-2">
            <MI icon="error" className="text-base flex-shrink-0" /> {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-zinc-500 text-sm">Loading your profile…</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">Full Name *</label>
              <input name="fullName" value={form.fullName} onChange={handleChange} required
                className={inputClass} placeholder="Ravi Shankar" />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">
                Email <span className="text-zinc-700">· read-only</span>
              </label>
              <input value={email} disabled
                className={inputClass + ' opacity-50 cursor-not-allowed'} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Phone</label>
                <input name="phone" value={form.phone} onChange={handleChange}
                  className={inputClass} placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Department</label>
                <input name="department" value={form.department} onChange={handleChange}
                  className={inputClass} placeholder="Sustainability" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">Designation</label>
              <input name="designation" value={form.designation} onChange={handleChange}
                className={inputClass} placeholder="ESG Analyst" />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">
                Bio <span className="text-zinc-700">· optional</span>
              </label>
              <textarea name="bio" value={form.bio} onChange={handleChange} rows={3}
                className={inputClass + ' resize-none'}
                placeholder="A short note about your role and focus areas…" />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 border border-white/10 rounded-lg py-3 text-zinc-400 text-sm hover:border-white/20 hover:text-white transition-all">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 disabled:opacity-50 rounded-lg py-3 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(16,185,129,0.2)]">
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
                    </svg>
                    Saving…
                  </>
                ) : (
                  <><MI icon="save" className="text-base" /> Save Changes</>
                )}
              </button>
            </div>
          </form>
        )}
        </>
        )}
      </div>
    </div>
  );
};

const STATUS_CHIP = {
  pending:    'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  processing: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  verified:   'bg-emerald-900/20 text-emerald-400 border border-emerald-700/30',
  failed:     'bg-red-500/10 text-red-400 border border-red-500/20',
};

const SIDEBAR_NAV = [
  { icon: 'psychology',   label: 'Intelligence', section: 'upload'    },
  { icon: 'menu_book',    label: 'Ledger',       section: 'docs'      },
  { icon: 'lock',         label: 'Vault',        section: 'upload'    },
  { icon: 'fact_check',   label: 'Audit Logs',   section: 'audit'     },
  { icon: 'settings',     label: 'Settings',     section: 'settings'  },
];

const TeamPortal = () => {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const uploadRef        = useRef(null);
  const docsRef          = useRef(null);
  const [documents,      setDocuments]     = useState([]);
  const [loading,        setLoading]       = useState(true);
  const [error,          setError]         = useState('');
  const [activeSection,  setActiveSection] = useState('upload');
  const [showSettings,   setShowSettings]  = useState(false);
  /* mustChangePassword comes from the JWT — block the portal until resolved */
  const forcePasswordChange = Boolean(user?.mustChangePassword);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await axiosClient.get('/api/documents');
      setDocuments(res.data.documents);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  /* Auto-poll while any document is still being verified — stops as soon as
   * every document is in a terminal state (verified or failed). This is what
   * surfaces the verification result in real-time without forcing the user
   * to refresh manually after upload. */
  useEffect(() => {
    const inFlight = documents.some(d => d.status === 'pending' || d.status === 'processing');
    if (!inFlight) return;
    const id = setInterval(fetchDocuments, 5000);
    return () => clearInterval(id);
  }, [documents, fetchDocuments]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const scrollTo = (ref) => ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const handleSidebarNav = (section) => {
    setActiveSection(section);
    if (section === 'upload')   scrollTo(uploadRef);
    if (section === 'docs')     scrollTo(docsRef);
    if (section === 'audit')    navigate('/team/questionnaire');
    if (section === 'settings') setShowSettings(true);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Forced password-change overlay — non-dismissible until resolved */}
      {forcePasswordChange && (
        <ChangePasswordModal forced onClose={() => {/* blocked until success */}} />
      )}
      {showSettings && !forcePasswordChange && <SettingsModal onClose={() => setShowSettings(false)} />}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] green-orb -z-0 opacity-20 translate-x-1/4 -translate-y-1/4" />
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] green-orb -z-0 opacity-15 -translate-x-1/4 translate-y-1/4" />

      {/* Fixed Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#050505]/85 backdrop-blur-md border-b border-white/10 flex items-center px-6 gap-6">
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-700 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <MI icon="eco" className="text-white text-base" fill />
          </div>
          <span className="font-bold text-base tracking-tight hidden md:block">GreenLedger AI</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-500 flex-1">
          <button onClick={() => handleSidebarNav('upload')} className="text-emerald-400 font-medium hover:text-emerald-300 transition-colors">Intelligence</button>
          <button onClick={() => handleSidebarNav('docs')}   className="hover:text-zinc-300 transition-colors">Ledger</button>
          <button onClick={() => handleSidebarNav('upload')} className="hover:text-zinc-300 transition-colors">Vault</button>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Link to="/team/questionnaire"
            className="hidden md:flex items-center gap-2 px-4 py-2 bg-[#1c1b1d] border border-white/10 rounded-lg text-sm hover:border-emerald-700/30 transition-all">
            <MI icon="assignment" className="text-emerald-400 text-base" /> My Tasks
          </Link>
          <button onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 border border-white/10 rounded-lg text-sm text-zinc-400 hover:text-white hover:border-white/20 transition-all">
            <MI icon="logout" className="text-base" />
            <span className="hidden sm:block">Logout</span>
          </button>
          <div className="w-9 h-9 bg-emerald-500/15 border border-emerald-700/30 rounded-full flex items-center justify-center text-emerald-400 font-bold text-sm flex-shrink-0">
            {(user?.fullName?.[0] || 'T').toUpperCase()}
          </div>
        </div>
      </header>

      {/* Fixed Left Sidebar */}
      <aside className="fixed top-16 left-0 bottom-0 w-64 bg-zinc-950 border-r border-white/10 z-40 hidden md:flex flex-col">
        <div className="p-5 border-b border-white/10">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Team Member Portal</p>
          <p className="text-xs text-zinc-600">Welcome, {user?.fullName || 'Team Member'}</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {SIDEBAR_NAV.map(({ icon, label, section }) => (
            <button
              key={label}
              onClick={() => handleSidebarNav(section)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all text-left ${
                activeSection === section
                  ? 'text-emerald-400 bg-emerald-950/20 border-r-2 border-emerald-600 font-medium'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
            >
              <MI icon={icon} className="text-xl" />
              {label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => handleSidebarNav('upload')}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 rounded-lg text-sm font-bold transition-all shadow-[0_0_16px_rgba(16,185,129,0.2)]">
            <MI icon="cloud_upload" className="text-base" /> New Upload
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 pt-24 px-4 md:px-6 pb-24 relative z-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Team Member Portal</h1>
          <p className="text-zinc-500 text-sm">
            Welcome back, {user?.fullName || 'Team Member'} · Submit ESG documents for AI extraction
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Upload panel */}
          <div className="lg:col-span-5" ref={uploadRef} id="team-upload">
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-green-700 rounded-lg flex items-center justify-center shadow-md shadow-emerald-500/25">
                  <MI icon="cloud_upload" className="text-white text-lg" />
                </div>
                <div>
                  <h2 className="font-bold text-white text-sm">Secure Vault Ingestion</h2>
                  <p className="text-zinc-500 text-xs">AWS S3 encrypted · AI processing starts immediately</p>
                </div>
              </div>
              <UploadWidget onSuccess={fetchDocuments} />
            </div>
          </div>

          {/* Documents table */}
          <div className="lg:col-span-7" ref={docsRef} id="team-docs">
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-white text-sm">My Submitted Documents</h2>
                  <p className="text-zinc-600 text-xs mt-0.5">
                    {documents.length} document{documents.length !== 1 ? 's' : ''} total
                  </p>
                </div>
                <button onClick={fetchDocuments} title="Refresh">
                  <MI icon="refresh" className="text-zinc-500 hover:text-zinc-300 transition-colors text-xl" />
                </button>
              </div>

              {loading && <LoadingSpinner message="Loading your documents..." />}
              {!loading && error && (
                <div className="p-6 text-red-400 text-sm flex items-center gap-2">
                  <MI icon="error" className="text-base" /> {error}
                </div>
              )}
              {!loading && !error && documents.length === 0 && (
                <div className="py-16 text-center">
                  <MI icon="cloud_off" className="text-4xl text-zinc-700 mb-3" />
                  <p className="text-zinc-500 font-medium text-sm">No documents submitted yet</p>
                  <p className="text-zinc-700 text-xs mt-1">Upload your first document using the panel on the left</p>
                </div>
              )}
              {!loading && !error && documents.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#09090b]">
                      <tr className="border-b border-white/10 text-zinc-500 text-xs uppercase tracking-wider">
                        <th className="px-6 py-3 text-left">File</th>
                        <th className="px-6 py-3 text-left">Category</th>
                        <th className="px-6 py-3 text-left">Status</th>
                        <th className="px-6 py-3 text-left">Uploaded</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {documents.map((doc) => (
                        <tr key={doc._id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 text-zinc-300 max-w-[160px]">
                            <div className="flex items-center gap-2">
                              <MI icon="description" className="text-zinc-600 text-base flex-shrink-0" />
                              <span className="truncate">{doc.originalFileName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-zinc-500 capitalize text-xs">{doc.brsrCategory.replace(/_/g, ' ')}</td>
                          <td className="px-6 py-4">
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_CHIP[doc.status] || STATUS_CHIP.pending}`}>
                              {doc.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-zinc-600 text-xs">{new Date(doc.createdAt).toLocaleDateString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-6 py-3 border-t border-white/10 text-zinc-700 text-xs">
                    Showing {documents.length} submission{documents.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-[#09090b] border-t border-white/10 flex items-center justify-around md:hidden z-50">
        <button onClick={() => handleSidebarNav('upload')} className="flex flex-col items-center gap-1 text-emerald-400">
          <MI icon="psychology" className="text-xl" />
          <span className="text-xs">Upload</span>
        </button>
        <button onClick={() => handleSidebarNav('docs')} className="flex flex-col items-center gap-1 text-zinc-500 hover:text-zinc-300">
          <MI icon="menu_book" className="text-xl" />
          <span className="text-xs">Ledger</span>
        </button>
        <Link to="/team/questionnaire" className="flex flex-col items-center gap-1 text-zinc-500">
          <MI icon="assignment" className="text-xl" />
          <span className="text-xs">Tasks</span>
        </Link>
        <button onClick={handleLogout} className="flex flex-col items-center gap-1 text-zinc-500">
          <MI icon="logout" className="text-xl" />
          <span className="text-xs">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default TeamPortal;
