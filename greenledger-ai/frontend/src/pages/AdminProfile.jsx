import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import MI from '../components/MI';

const ROLE_COLORS = {
  Admin:      'text-emerald-400 bg-emerald-950/40 border-emerald-700/40',
  TeamMember: 'text-sky-400 bg-sky-950/40 border-sky-700/40',
  Supplier:   'text-orange-400 bg-orange-950/40 border-orange-700/40',
};

const inputClass =
  'w-full bg-zinc-900 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 transition-colors';

/* ── Stat pill ────────────────────────────────────────────────────────────── */
const StatPill = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 bg-zinc-900/60 border border-white/8 rounded-xl px-4 py-3">
    <div className="w-8 h-8 bg-emerald-950/40 border border-emerald-800/30 rounded-lg flex items-center justify-center flex-shrink-0">
      <MI icon={icon} className="text-emerald-500 text-base" />
    </div>
    <div className="min-w-0">
      <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-semibold">{label}</p>
      <p className="text-white text-sm font-bold truncate">{value || '—'}</p>
    </div>
  </div>
);

/* ── AdminProfile ─────────────────────────────────────────────────────────── */
const AdminProfile = () => {
  const { login } = useAuth();

  const [profile,  setProfile]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [error,    setError]    = useState('');

  const [form, setForm] = useState({
    fullName:    '',
    phone:       '',
    department:  '',
    designation: '',
    bio:         '',
  });

  /* Fetch on mount */
  useEffect(() => {
    axiosClient.get('/api/auth/profile')
      .then(res => {
        const u = res.data.user;
        setProfile(u);
        setForm({
          fullName:    u.fullName    || '',
          phone:       u.phone       || '',
          department:  u.department  || '',
          designation: u.designation || '',
          bio:         u.bio         || '',
        });
      })
      .catch(err => setError(err.response?.data?.message || 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await axiosClient.patch('/api/auth/profile', form);
      /* PATCH returns a refreshed JWT — update localStorage + AuthContext */
      if (res.data.token) login(res.data.token);
      setProfile(p => ({ ...p, ...res.data.user }));
      setEditMode(false);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({
      fullName:    profile.fullName    || '',
      phone:       profile.phone       || '',
      department:  profile.department  || '',
      designation: profile.designation || '',
      bio:         profile.bio         || '',
    });
    setEditMode(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <LoadingSpinner message="Loading profile…" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="text-red-400 text-sm flex items-center gap-2">
        <MI icon="error" className="text-xl" /> {error}
      </div>
    </div>
  );

  const initials = (profile?.fullName || 'A')
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : '—';

  return (
    <div className="min-h-screen bg-[#050505] text-white">

      {/* ── Header ─────────────────────────────────────────────────────── */}
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

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="pt-24 pb-16 px-6 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >

          {/* Avatar + name hero */}
          <div className="glass-panel rounded-2xl p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 ai-gradient-bg rounded-full flex items-center justify-center text-3xl font-black text-white select-none">
                {initials}
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-2 border-zinc-950 flex items-center justify-center">
                <MI icon="check" className="text-white text-xs" />
              </div>
            </div>

            <div className="flex-1 min-w-0 text-center sm:text-left">
              <h1 className="text-2xl font-black text-white leading-tight">
                {profile?.fullName}
              </h1>
              <p className="text-zinc-500 text-sm mt-0.5">{profile?.email}</p>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-3">
                <span className={`text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-full border ${ROLE_COLORS[profile?.role] || ROLE_COLORS.Admin}`}>
                  {profile?.role}
                </span>
                <span className="text-zinc-600 text-[10px]">Since {memberSince}</span>
              </div>
            </div>

            <button
              onClick={() => setEditMode(e => !e)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                editMode
                  ? 'bg-zinc-800 text-zinc-300 border border-white/10 hover:bg-zinc-700'
                  : 'ai-gradient-bg text-white hover:opacity-90'
              }`}
            >
              <MI icon={editMode ? 'close' : 'edit'} className="text-base" />
              {editMode ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatPill icon="work"       label="Designation" value={profile?.designation} />
            <StatPill icon="apartment"  label="Department"  value={profile?.department}  />
            <StatPill icon="call"       label="Phone"       value={profile?.phone}        />
            <StatPill icon="admin_panel_settings" label="Role" value={profile?.role}      />
          </div>

          {/* Edit / view form */}
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
              <MI icon="person" className="text-emerald-500 text-base" />
              Profile Information
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Full Name</label>
                  <input
                    name="fullName"
                    value={form.fullName}
                    onChange={handleChange}
                    disabled={!editMode}
                    required
                    className={inputClass + (!editMode ? ' opacity-50 cursor-not-allowed' : '')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email <span className="text-zinc-600">(read-only)</span></label>
                  <input
                    value={profile?.email || ''}
                    disabled
                    className={inputClass + ' opacity-40 cursor-not-allowed'}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Phone</label>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    disabled={!editMode}
                    placeholder="+91 98765 43210"
                    className={inputClass + (!editMode ? ' opacity-50 cursor-not-allowed' : '')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Designation</label>
                  <input
                    name="designation"
                    value={form.designation}
                    onChange={handleChange}
                    disabled={!editMode}
                    placeholder="Chief Sustainability Officer"
                    className={inputClass + (!editMode ? ' opacity-50 cursor-not-allowed' : '')}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Department</label>
                  <input
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    disabled={!editMode}
                    placeholder="ESG & Sustainability"
                    className={inputClass + (!editMode ? ' opacity-50 cursor-not-allowed' : '')}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Bio</label>
                  <textarea
                    name="bio"
                    value={form.bio}
                    onChange={handleChange}
                    disabled={!editMode}
                    rows={3}
                    placeholder="Brief professional bio…"
                    className={inputClass + ' resize-none' + (!editMode ? ' opacity-50 cursor-not-allowed' : '')}
                  />
                </div>
              </div>

              {editMode && (
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 ai-gradient-bg hover:opacity-90 disabled:opacity-50 rounded-lg py-2.5 text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    {saving
                      ? <><MI icon="sync" className="text-base animate-spin" /> Saving…</>
                      : <><MI icon="save" className="text-base" /> Save Changes</>
                    }
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-5 py-2.5 bg-zinc-800 border border-white/10 text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </form>
          </div>

        </motion.div>
      </div>
    </div>
  );
};

export default AdminProfile;
