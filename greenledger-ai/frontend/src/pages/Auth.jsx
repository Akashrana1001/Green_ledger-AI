import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import MI from '../components/MI';
import PixelSnow from '../components/PixelSnow';

const GOOGLE_CONFIGURED = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
const INDUSTRY_SECTORS = ['Manufacturing', 'Information Technology', 'Financial Services', 'Energy', 'Healthcare', 'Consumer Goods', 'Infrastructure', 'Chemicals', 'Automotive', 'Other'];
const ROLE_REDIRECTS = { Admin: '/admin/dashboard', TeamMember: '/team/portal', Supplier: '/supplier/portal' };

const GoogleButton = ({ onAuthResponse, onPreFill, isLogin, disabled }) => {
  const [loading, setLoading] = useState(false);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        if (isLogin) {
          const res = await axiosClient.post('/api/auth/google', { accessToken: tokenResponse.access_token });
          onAuthResponse(res.data);
        } else {
          const res = await fetch(`https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${tokenResponse.access_token}`);
          const profile = await res.json();
          onPreFill({ name: profile.name, email: profile.email, googleId: profile.id });
          toast.success(`Google account connected: ${profile.email}`);
        }
      } catch (err) {
        if (isLogin) {
          if (err.response?.status === 404 && err.response.data?.newUser) {
            toast('No account found. Please register first.', { icon: 'ℹ️' });
          } else {
            toast.error(err.response?.data?.message || 'Google sign-in failed');
          }
        } else {
          toast.error('Failed to fetch Google profile. Please fill in the form manually.');
        }
      } finally {
        setLoading(false);
      }
    },
    onError: () => toast.error('Google sign-in was cancelled or failed'),
  });

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      type="button"
      onClick={() => googleLogin()}
      disabled={disabled || loading}
      className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white/5 border border-white/12 rounded-xl text-sm text-zinc-300 hover:bg-white/8 hover:border-white/20 hover:text-white disabled:opacity-50 transition-all mb-4"
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
        </svg>
      ) : (
        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      )}
      <span>{loading ? 'Connecting...' : `Continue with Google`}</span>
    </motion.button>
  );
};

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  
  const [isLogin, setIsLogin] = useState(location.pathname === '/login');
  
  useEffect(() => {
    setIsLogin(location.pathname === '/login');
  }, [location.pathname]);

  const [form, setForm] = useState({
    companyName: '', CIN: '', industrySector: '', fullName: '', email: '', password: '',
    registeredAddress: '', website: '', stockExchange: '', paidUpCapital: '',
    yearOfIncorporation: '', reportingBoundary: '', brContactName: '', brContactEmail: '',
  });
  const [showPassword, setShowPwd] = useState(false);
  const [googleId, setGoogleId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [regStep, setRegStep] = useState(1);

  useEffect(() => {
    const profile = location.state?.googleProfile;
    if (profile && !isLogin) {
      setForm(f => ({ ...f, fullName: profile.name || '', email: profile.email || '' }));
      setGoogleId(profile.googleId || null);
    }
  }, [location.state, isLogin]);

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleGooglePreFill = ({ name, email, googleId: gid }) => {
    setForm(f => ({ ...f, fullName: name || '', email: email || '' }));
    setGoogleId(gid);
  };

  const processLoginResponse = (data) => {
    if (data.requiresTwoFactor) {
      navigate('/verify-2fa', { state: { tempToken: data.tempToken }, replace: true });
      return;
    }
    login(data.token);
    toast.success(`Welcome back, ${data.user.fullName}!`);
    navigate(ROLE_REDIRECTS[data.user.role] || '/', { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    if (isLogin) {
      try {
        const res = await axiosClient.post('/api/auth/login', { email: form.email, password: form.password });
        processLoginResponse(res.data);
      } catch (err) {
        const data = err.response?.data || {};
        let msg = data.message || 'Login failed.';
        if (typeof data.attemptsRemaining === 'number') {
          msg += ` (${data.attemptsRemaining} attempt${data.attemptsRemaining === 1 ? '' : 's'} remaining before lockout)`;
        }
        setError(msg);
      } finally {
        setLoading(false);
      }
    } else {
      // Step 1 submit (e.g. Enter key) → advance to step 2 instead of calling API
      if (regStep === 1) {
        setLoading(false);
        if (!form.companyName || !form.CIN || !form.industrySector || !form.fullName || !form.email) {
          setError('Please fill in all required fields before continuing.');
          return;
        }
        if (!googleId && !form.password) {
          setError('Password is required.');
          return;
        }
        setRegStep(2);
        return;
      }

      try {
        const payload = { ...form };
        if (googleId) {
          payload.googleId = googleId;
          delete payload.password;
        }

        // Client-side guard — surface missing step 1 fields without a server round-trip
        const missing = ['companyName','CIN','industrySector','fullName','email']
          .filter(k => !payload[k]);
        if (missing.length) {
          setError(`Missing required fields: ${missing.join(', ')}. Click Back to complete step 1.`);
          setLoading(false);
          return;
        }

        const res = await axiosClient.post('/api/auth/register', payload);
        login(res.data.token);
        toast.success('Company registered!');
        navigate('/terms', { replace: true });
      } catch (err) {
        setError(err.response?.data?.message || 'Registration failed.');
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleMode = () => {
    navigate(isLogin ? '/register' : '/login', { replace: true });
    setRegStep(1);
    setError('');
  };

  const inputClass = 'w-full bg-[#0e0e10] border border-white/10 rounded-lg py-2.5 pl-10 pr-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-emerald-700/50 focus:ring-1 focus:ring-emerald-700/20 transition-all';
  const inputClassNoIcon = 'w-full bg-[#0e0e10] border border-white/10 rounded-lg py-2.5 px-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-emerald-700/50 focus:ring-1 focus:ring-emerald-700/20 transition-all';
  const labelClass = 'block text-xs font-medium text-zinc-400 mb-1';

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <div className="h-screen w-screen bg-[#050505] text-white overflow-hidden relative flex flex-col">
      <div className="absolute inset-0 -z-0 opacity-40">
        <PixelSnow
          color="#10b981"
          speed={0.6}
          brightness={0.4}
          density={0.18}
          variant="square"
          direction={200}
          flakeSize={0.008}
        />
      </div>

      {/* Navbar */}
      <motion.nav 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#050505]/80 backdrop-blur-md"
      >
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <motion.div whileHover={{ rotate: 180 }} transition={{ duration: 0.4 }} className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-green-700 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <MI icon="eco" className="text-white text-sm" fill />
            </motion.div>
            <span className="font-bold text-base tracking-tight">GreenLedger AI</span>
          </Link>
          <button onClick={toggleMode} className="text-sm text-zinc-400 hover:text-white transition-colors border border-white/10 px-3 py-1.5 rounded-lg">
            {isLogin ? 'Create Account' : 'Sign In'}
          </button>
        </div>
      </motion.nav>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 relative z-10 pt-14">
        <motion.div 
          layout
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, type: 'spring', bounce: 0.2 }}
          className={`w-full ${isLogin ? 'max-w-md' : 'max-w-2xl'} glass-card rounded-2xl p-8 relative overflow-hidden`}
        >
          {/* Subtle animated shimmer */}
          <motion.div 
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 5 }}
            className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/[0.05] to-transparent -skew-x-12 pointer-events-none"
          />

          <AnimatePresence mode="wait">
            <motion.div 
              key={isLogin ? 'login' : 'register'}
              initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Header */}
              <div className="text-center mb-6 relative z-10">
                <motion.div whileHover={{ scale: 1.1, rotate: 5 }} className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-700 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                  <MI icon={isLogin ? 'lock' : 'business'} className="text-white text-xl" />
                </motion.div>
                <h1 className="text-xl font-bold text-white tracking-tight mb-1">
                  {isLogin ? 'Welcome back' : 'Create Account'}
                </h1>
                <p className="text-zinc-500 text-xs">
                  {isLogin ? 'Sign in to your dashboard' : 'Register your company as an Admin'}
                </p>
              </div>

              {error && (
                <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs flex items-center gap-2 relative z-10">
                  <MI icon="error" className="text-sm flex-shrink-0" /> {error}
                </div>
              )}

              <div className="relative z-10">
                {GOOGLE_CONFIGURED && (
                  !isLogin && googleId ? (
                    <div className="mb-4 p-2 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-lg text-xs flex items-center gap-2">
                      <MI icon="check_circle" className="text-sm flex-shrink-0" fill />
                      <span>Google connected: {form.email}</span>
                      <button type="button" onClick={() => { setGoogleId(null); setForm(f => ({ ...f, email: '', fullName: '' })); }} className="ml-auto text-zinc-500 hover:text-zinc-300">Disconnect</button>
                    </div>
                  ) : (
                    <GoogleButton onAuthResponse={processLoginResponse} onPreFill={handleGooglePreFill} isLogin={isLogin} disabled={loading} />
                  )
                )}
              </div>

              <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
                {isLogin ? (
                  // LOGIN FORM
                  <motion.div variants={containerVariants} initial="hidden" animate="show">
                    <motion.div variants={itemVariants} className="mb-4">
                      <label className={labelClass}>Email address</label>
                      <div className="relative group">
                        <MI icon="mail" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-emerald-500 text-lg pointer-events-none transition-colors" />
                        <input name="email" type="email" value={form.email} onChange={handleChange} required className={inputClass} placeholder="you@company.com" />
                      </div>
                    </motion.div>

                    <motion.div variants={itemVariants} className="mb-4">
                      <label className={labelClass}>Password</label>
                      <div className="relative group">
                        <MI icon="lock" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-emerald-500 text-lg pointer-events-none transition-colors" />
                        <input name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={handleChange} required className={inputClass} placeholder="••••••••" />
                        <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                          <MI icon={showPassword ? 'visibility_off' : 'visibility'} className="text-lg" />
                        </button>
                      </div>
                    </motion.div>

                    <motion.button variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={loading} className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white py-2.5 rounded-xl font-bold text-sm shadow-[0_0_20px_rgba(16,185,129,0.22)] flex items-center justify-center gap-2 mt-2">
                      {loading ? 'Signing in...' : 'Sign In'}
                    </motion.button>
                  </motion.div>
                ) : (
                  // REGISTER FORM (2 STEPS)
                  <AnimatePresence mode="wait">
                    {regStep === 1 ? (
                      <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelClass}>Admin Full Name</label>
                            <input name="fullName" value={form.fullName} onChange={handleChange} required className={inputClassNoIcon} placeholder="John Doe" />
                          </div>
                          <div>
                            <label className={labelClass}>Company Name</label>
                            <input name="companyName" value={form.companyName} onChange={handleChange} required className={inputClassNoIcon} placeholder="Acme Corp" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelClass}>CIN</label>
                            <input name="CIN" value={form.CIN} onChange={handleChange} required className={inputClassNoIcon} placeholder="L22210MH..." />
                          </div>
                          <div>
                            <label className={labelClass}>Industry Sector</label>
                            <select name="industrySector" value={form.industrySector} onChange={handleChange} required className={inputClassNoIcon + ' appearance-none py-2.5'}>
                              <option value="">Select sector</option>
                              {INDUSTRY_SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelClass}>Email</label>
                            <input name="email" type="email" value={form.email} onChange={handleChange} required readOnly={!!googleId} className={inputClassNoIcon + (googleId ? ' opacity-60' : '')} />
                          </div>
                          {!googleId && (
                            <div>
                              <label className={labelClass}>Password</label>
                              <input name="password" type="password" value={form.password} onChange={handleChange} required={!googleId} minLength={8} className={inputClassNoIcon} />
                            </div>
                          )}
                        </div>

                        <button type="button" onClick={() => setRegStep(2)} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white py-2.5 rounded-xl text-sm transition-all mt-2">
                          Next: BRSR Details (Optional) →
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div key="step2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelClass}>Registered Address</label>
                            <input name="registeredAddress" value={form.registeredAddress} onChange={handleChange} className={inputClassNoIcon} />
                          </div>
                          <div>
                            <label className={labelClass}>Website</label>
                            <input name="website" value={form.website} onChange={handleChange} className={inputClassNoIcon} />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className={labelClass}>Stock Exchange</label>
                            <input name="stockExchange" value={form.stockExchange} onChange={handleChange} className={inputClassNoIcon} />
                          </div>
                          <div>
                            <label className={labelClass}>Paid-up Capital</label>
                            <input name="paidUpCapital" value={form.paidUpCapital} onChange={handleChange} className={inputClassNoIcon} />
                          </div>
                          <div>
                            <label className={labelClass}>Incorporation Yr</label>
                            <input name="yearOfIncorporation" value={form.yearOfIncorporation} onChange={handleChange} className={inputClassNoIcon} />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className={labelClass}>Boundary</label>
                            <select name="reportingBoundary" value={form.reportingBoundary} onChange={handleChange} className={inputClassNoIcon + ' appearance-none py-2.5'}>
                              <option value="">Select</option>
                              <option value="standalone">Standalone</option>
                              <option value="consolidated">Consolidated</option>
                            </select>
                          </div>
                          <div>
                            <label className={labelClass}>BR Contact Name</label>
                            <input name="brContactName" value={form.brContactName} onChange={handleChange} className={inputClassNoIcon} />
                          </div>
                          <div>
                            <label className={labelClass}>BR Contact Email</label>
                            <input name="brContactEmail" value={form.brContactEmail} onChange={handleChange} className={inputClassNoIcon} />
                          </div>
                        </div>

                        <div className="flex gap-3 mt-4">
                          <button type="button" onClick={() => setRegStep(1)} className="w-1/3 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-2.5 rounded-xl text-sm transition-all">
                            ← Back
                          </button>
                          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={loading} className="w-2/3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white py-2.5 rounded-xl font-bold text-sm shadow-[0_0_20px_rgba(16,185,129,0.22)]">
                            {loading ? 'Registering...' : 'Create Account'}
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </form>

              <div className="text-center mt-6 relative z-10">
                <button onClick={toggleMode} className="text-xs text-zinc-500 hover:text-emerald-400 transition-colors font-medium relative group">
                  {isLogin ? "Don't have an account? Register" : "Already have an account? Sign In"}
                  <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-emerald-400 transition-all group-hover:w-full"></span>
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
