import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import axiosClient from '../api/axiosClient';
import MI from './MI';

/**
 * Bell-icon dropdown showing accounts locked due to failed-login attempts.
 * Admins click "Reset Password & Unlock" to issue a new temp password,
 * which is shown once for sharing with the user via secure channel.
 */
const NotificationPanel = () => {
  const [open, setOpen]                 = useState(false);
  const [lockedUsers, setLockedUsers]   = useState([]);
  const [loading, setLoading]           = useState(false);
  const [unlocking, setUnlocking]       = useState(null);   // userId currently being unlocked
  const [revealed, setRevealed]         = useState(null);   // { user, tempPassword }
  const [copied, setCopied]             = useState(false);
  const panelRef                        = useRef(null);

  const fetchLocked = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/api/auth/locked-users');
      setLockedUsers(res.data.lockedUsers || []);
    } catch {
      setLockedUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /* Poll every 30s when closed; refresh immediately on open */
  useEffect(() => {
    fetchLocked();
    const id = setInterval(fetchLocked, 30000);
    return () => clearInterval(id);
  }, [fetchLocked]);

  /* Click-outside to close */
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
        setRevealed(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const handleUnlock = async (userId) => {
    setUnlocking(userId);
    try {
      const res = await axiosClient.post(`/api/auth/unlock-user/${userId}`);
      setRevealed({ user: res.data.user, tempPassword: res.data.tempPassword });
      setLockedUsers(prev => prev.filter(u => u._id !== userId));
      toast.success('Account unlocked — share the new password with the user');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to unlock account');
    } finally {
      setUnlocking(null);
    }
  };

  const copyPassword = () => {
    if (!revealed?.tempPassword) return;
    navigator.clipboard.writeText(revealed.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const formatLockedAt = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return d.toLocaleDateString();
  };

  const count = lockedUsers.length;

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => { setOpen(v => !v); setRevealed(null); if (!open) fetchLocked(); }}
        className="relative w-9 h-9 flex items-center justify-center text-zinc-500 hover:text-white border border-white/10 rounded-lg transition-colors"
        title={count ? `${count} account${count === 1 ? '' : 's'} locked` : 'Notifications'}
      >
        <MI icon="notifications" className="text-xl" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#0a0a0a]">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl shadow-black/60 w-96 z-50 max-h-[80vh] flex flex-col">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-bold">Notifications</p>
              <p className="text-zinc-500 text-[11px]">
                {count === 0 ? 'No alerts' : `${count} account${count === 1 ? '' : 's'} need attention`}
              </p>
            </div>
            <button
              onClick={fetchLocked}
              className="text-zinc-500 hover:text-white text-xs flex items-center gap-1"
              disabled={loading}
            >
              <MI icon={loading ? 'sync' : 'refresh'} className={`text-base ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Revealed temp password (after unlock) */}
          {revealed && (
            <div className="m-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <div className="flex items-start gap-2 mb-2">
                <MI icon="lock_open" className="text-emerald-400 text-base mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-bold truncate">{revealed.user.fullName}</p>
                  <p className="text-emerald-400 text-[11px] truncate">{revealed.user.email} unlocked</p>
                </div>
              </div>
              <p className="text-zinc-400 text-[11px] mb-2">
                Share this temporary password securely. The user must change it on first login.
              </p>
              <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-md p-2">
                <code className="flex-1 text-emerald-300 text-xs font-mono select-all break-all">
                  {revealed.tempPassword}
                </code>
                <button
                  onClick={copyPassword}
                  className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold rounded"
                >
                  {copied ? 'COPIED' : 'COPY'}
                </button>
              </div>
              <button
                onClick={() => setRevealed(null)}
                className="mt-2 text-zinc-500 hover:text-white text-[11px] underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Locked-users list */}
          <div className="flex-1 overflow-y-auto">
            {loading && lockedUsers.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 text-xs">Loading...</div>
            ) : count === 0 ? (
              <div className="p-6 text-center">
                <MI icon="check_circle" className="text-emerald-500/50 text-3xl mb-2" />
                <p className="text-zinc-500 text-xs">All accounts active</p>
              </div>
            ) : (
              lockedUsers.map(u => (
                <div key={u._id} className="px-4 py-3 border-b border-white/5 hover:bg-white/[0.02]">
                  <div className="flex items-start gap-2 mb-2">
                    <div className="w-8 h-8 bg-red-500/15 border border-red-500/30 rounded-full flex items-center justify-center text-red-400 font-bold text-xs flex-shrink-0">
                      <MI icon="lock" className="text-base" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-bold truncate">{u.fullName}</p>
                      <p className="text-zinc-500 text-[11px] truncate">{u.email}</p>
                      <p className="text-amber-400 text-[10px] mt-0.5">
                        Locked after {u.failedLoginAttempts} failed attempts · {formatLockedAt(u.lockedAt)}
                      </p>
                    </div>
                    <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-[9px] font-bold rounded uppercase">
                      {u.role}
                    </span>
                  </div>
                  <button
                    onClick={() => handleUnlock(u._id)}
                    disabled={unlocking === u._id}
                    className="w-full py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-50 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold rounded transition-colors flex items-center justify-center gap-1"
                  >
                    <MI icon={unlocking === u._id ? 'sync' : 'key'} className={`text-sm ${unlocking === u._id ? 'animate-spin' : ''}`} />
                    {unlocking === u._id ? 'Resetting...' : 'Reset Password & Unlock'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
