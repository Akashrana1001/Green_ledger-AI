import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import MI from '../components/MI';

const ROLE_REDIRECTS = {
  Admin:      '/admin/dashboard',
  TeamMember: '/team/portal',
  Supplier:   '/supplier/portal',
};

/* ── 6-box OTP input ────────────────────────────────────────────────────── */
const OtpInput = ({ value, onChange }) => {
  const inputs = useRef([]);
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);

  useEffect(() => { inputs.current[0]?.focus(); }, []);

  const handleChange = (i, e) => {
    const char = e.target.value.replace(/\D/g, '');
    if (!char) return;
    const next = [...digits];
    next[i] = char.slice(-1);
    onChange(next.join(''));
    if (i < 5) inputs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      const next = [...digits];
      if (next[i]) {
        next[i] = '';
        onChange(next.join(''));
      } else if (i > 0) {
        next[i - 1] = '';
        onChange(next.join(''));
        inputs.current[i - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      inputs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < 5) {
      inputs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted.padEnd(6, '').slice(0, 6));
    inputs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="flex gap-3 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => (inputs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={[
            'w-12 h-14 text-center text-2xl font-black rounded-xl',
            'bg-zinc-900 border transition-all duration-200',
            'text-white focus:outline-none',
            d
              ? 'border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
              : 'border-white/15 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25',
          ].join(' ')}
        />
      ))}
    </div>
  );
};

/* ── Page ───────────────────────────────────────────────────────────────── */
const TwoFactorVerify = () => {
  const navigate   = useNavigate();
  const location   = useLocation();
  const { login }  = useAuth();
  const [code, setCode]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  /* tempToken is passed via navigation state from Login.jsx */
  const tempToken = location.state?.tempToken;

  useEffect(() => {
    if (!tempToken) navigate('/login', { replace: true });
  }, [tempToken, navigate]);

  const handleVerify = async (e) => {
    e?.preventDefault();
    if (code.replace(/\D/g, '').length < 6) {
      setError('Please enter all 6 digits');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await axiosClient.post('/api/auth/2fa/verify', { tempToken, code });
      login(res.data.token);
      toast.success('Two-factor authentication successful');
      const redirect = ROLE_REDIRECTS[res.data.user.role] || '/';
      navigate(redirect, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Verification failed';
      setError(msg);
      toast.error(msg);
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  /* Auto-submit when all 6 digits are filled */
  useEffect(() => {
    if (code.replace(/\D/g, '').length === 6 && !loading) {
      handleVerify();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col star-bg">
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] green-orb -z-0 opacity-40" />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#050505]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-700 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <MI icon="eco" className="text-white text-base" fill />
            </div>
            <span className="font-bold text-lg tracking-tight">GreenLedger AI</span>
          </Link>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 pt-24 pb-12 relative z-10">
        <div className="w-full max-w-md">
          <div className="glass-card rounded-2xl p-10">

            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-emerald-950/40 border border-emerald-700/40 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_24px_rgba(16,185,129,0.15)]">
                <MI icon="security" className="text-emerald-400 text-3xl" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Two-Factor Authentication</h1>
              <p className="text-zinc-500 text-sm">
                Open your authenticator app and enter the<br />6-digit code for GreenLedger AI
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm flex items-center gap-2">
                <MI icon="error" className="text-base flex-shrink-0" /> {error}
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-6">
              <OtpInput value={code} onChange={setCode} />

              <p className="text-center text-zinc-600 text-xs">
                Code refreshes every 30 seconds · Do not share this code
              </p>

              <button
                type="submit"
                disabled={loading || code.replace(/\D/g, '').length < 6}
                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 disabled:opacity-40 disabled:cursor-not-allowed py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
                    </svg>
                    Verifying…
                  </>
                ) : (
                  <><MI icon="verified_user" className="text-base" /> Verify & Sign In</>
                )}
              </button>
            </form>

            {/* Help */}
            <div className="mt-8 p-4 bg-zinc-900/60 border border-white/8 rounded-xl">
              <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-2">Having trouble?</p>
              <ul className="space-y-1 text-zinc-600 text-xs">
                <li>· Ensure your phone's time is synced automatically</li>
                <li>· Look for "GreenLedger AI" in your authenticator app</li>
                <li>· Codes are valid for 30 seconds — wait for the next one if it fails</li>
              </ul>
            </div>

            <p className="text-center text-zinc-600 text-sm mt-6">
              <Link to="/login" className="text-emerald-500 hover:text-emerald-400 transition-colors font-medium flex items-center justify-center gap-1">
                <MI icon="arrow_back" className="text-sm" /> Back to Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TwoFactorVerify;
