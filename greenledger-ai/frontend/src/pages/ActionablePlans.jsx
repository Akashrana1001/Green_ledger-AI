import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import MI from '../components/MI';
import { AdminSidebarLinks } from '../components/AdminSidebar';

/* ── Category visual config (mirrors ActionableInsights.jsx) ─────────────── */
const CATEGORY_CFG = {
  energy: {
    icon: 'bolt', color: 'text-yellow-400',
    headerBg: 'bg-yellow-950/20 hover:bg-yellow-950/30',
    border: 'border-yellow-800/30',
    accent: '#ca8a04',
    badgeBg: 'bg-yellow-950/50 text-yellow-300 border-yellow-700/40',
    impactBg: 'bg-yellow-950/30 border-yellow-700/30 text-yellow-300',
    label: 'Energy',
  },
  water: {
    icon: 'water_drop', color: 'text-sky-400',
    headerBg: 'bg-sky-950/20 hover:bg-sky-950/30',
    border: 'border-sky-800/30',
    accent: '#0284c7',
    badgeBg: 'bg-sky-950/50 text-sky-300 border-sky-700/40',
    impactBg: 'bg-sky-950/30 border-sky-700/30 text-sky-300',
    label: 'Water',
  },
  waste: {
    icon: 'recycling', color: 'text-orange-400',
    headerBg: 'bg-orange-950/20 hover:bg-orange-950/30',
    border: 'border-orange-800/30',
    accent: '#ea580c',
    badgeBg: 'bg-orange-950/50 text-orange-300 border-orange-700/40',
    impactBg: 'bg-orange-950/30 border-orange-700/30 text-orange-300',
    label: 'Waste',
  },
  ghg: {
    icon: 'co2', color: 'text-emerald-400',
    headerBg: 'bg-emerald-950/20 hover:bg-emerald-950/30',
    border: 'border-emerald-800/30',
    accent: '#059669',
    badgeBg: 'bg-emerald-950/50 text-emerald-300 border-emerald-700/40',
    impactBg: 'bg-emerald-950/30 border-emerald-700/30 text-emerald-300',
    label: 'GHG Emissions',
  },
  social: {
    icon: 'groups', color: 'text-violet-400',
    headerBg: 'bg-violet-950/20 hover:bg-violet-950/30',
    border: 'border-violet-800/30',
    accent: '#7c3aed',
    badgeBg: 'bg-violet-950/50 text-violet-300 border-violet-700/40',
    impactBg: 'bg-violet-950/30 border-violet-700/30 text-violet-300',
    label: 'Social',
  },
  governance: {
    icon: 'policy', color: 'text-slate-300',
    headerBg: 'bg-slate-900/40 hover:bg-slate-800/40',
    border: 'border-slate-700/30',
    accent: '#71717a',
    badgeBg: 'bg-slate-800/60 text-slate-300 border-slate-600/40',
    impactBg: 'bg-slate-800/40 border-slate-600/30 text-slate-300',
    label: 'Governance',
  },
};

const FALLBACK_CFG = CATEGORY_CFG.ghg;
const CATEGORY_ORDER = ['ghg', 'energy', 'water', 'waste', 'social', 'governance'];

/* ── Single plan row inside an accordion panel ───────────────────────────── */
const PlanRow = ({ insight, index, cfg }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05, duration: 0.25 }}
    className="flex gap-5 py-5 border-b border-white/5 last:border-0"
  >
    {/* Step number */}
    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
      <span className="text-xs font-black text-zinc-500 tabular-nums">
        {String(index + 1).padStart(2, '0')}
      </span>
    </div>

    <div className="flex-1 min-w-0 space-y-2">
      {/* Title — 18px as required */}
      <h4 className="text-white font-semibold leading-snug" style={{ fontSize: '18px' }}>
        {insight.title}
      </h4>

      {/* Description — 16px as required */}
      <p className="text-zinc-400 leading-relaxed" style={{ fontSize: '16px' }}>
        {insight.description}
      </p>

      {/* Projected impact */}
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold ${cfg.impactBg}`}>
        <MI icon="trending_up" className="text-base flex-shrink-0" />
        <span className="font-mono">{insight.estimated_impact}</span>
      </div>
    </div>
  </motion.div>
);

/* ── Category accordion panel ────────────────────────────────────────────── */
const AccordionPanel = ({ categoryKey, plans, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const cfg = CATEGORY_CFG[categoryKey] ?? FALLBACK_CFG;

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-colors duration-200 ${cfg.border}`}
      style={{ borderLeftWidth: '3px', borderLeftColor: cfg.accent }}
    >
      {/* Header / toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between px-6 py-5 transition-colors duration-200 ${cfg.headerBg}`}
      >
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-black/20 border ${cfg.border}`}>
            <MI icon={cfg.icon} className={`${cfg.color} text-xl`} fill />
          </div>
          <div className="text-left">
            <p className="text-white font-bold" style={{ fontSize: '18px' }}>
              {cfg.label}
            </p>
            <p className="text-zinc-500 text-sm mt-0.5">
              {plans.length} recommendation{plans.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${cfg.badgeBg}`}>
            {plans.length} plan{plans.length !== 1 ? 's' : ''}
          </span>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <MI icon="expand_more" className="text-zinc-400 text-2xl" />
          </motion.div>
        </div>
      </button>

      {/* Plan list */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-6 pb-2 bg-black/20">
              {plans.map((plan, i) => (
                <PlanRow key={i} insight={plan} index={i} cfg={cfg} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── ActionablePlans page ────────────────────────────────────────────────── */
const ActionablePlans = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [insights, setInsights]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [totalDocs, setTotalDocs] = useState(0);

  const handleLogout = () => { logout(); navigate('/login'); };

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/api/report/kpis');
      const raw = res.data?.kpiResult?.ai_insights || [];
      setInsights(raw);
      setTotalDocs(res.data?.verifiedCount || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  /* Collapse any LLM-variant category string → canonical CATEGORY_ORDER key.
   * The LLM often returns "GHG", "ghg emissions", "carbon", "social impact",
   * etc. Everything that doesn't hit an explicit alias falls back to 'ghg'
   * (FALLBACK_CFG) so it always merges rather than spawning a phantom panel. */
  const CATEGORY_ALIASES = {
    // GHG
    'ghg':              'ghg',
    'ghg emissions':    'ghg',
    'greenhouse':       'ghg',
    'greenhouse gas':   'ghg',
    'carbon':           'ghg',
    'emissions':        'ghg',
    'climate':          'ghg',
    'scope 1':          'ghg',
    'scope 2':          'ghg',
    'scope 3':          'ghg',
    'co2':              'ghg',
    // Energy
    'energy':           'energy',
    'electricity':      'energy',
    'fuel':             'energy',
    'power':            'energy',
    'renewable':        'energy',
    // Water
    'water':            'water',
    'water usage':      'water',
    'water consumption':'water',
    // Waste
    'waste':            'waste',
    'waste management': 'waste',
    'recycling':        'waste',
    // Social
    'social':           'social',
    'hr':               'social',
    'workforce':        'social',
    'employees':        'social',
    'human resources':  'social',
    'people':           'social',
    'wellbeing':        'social',
    'msme':             'social',
    // Governance
    'governance':       'governance',
    'compliance':       'governance',
    'ethics':           'governance',
    'regulatory':       'governance',
    'finance':          'governance',
    'financial':        'governance',
    'procurement':      'governance',
    'payable':          'governance',
    'accounts':         'governance',
  };

  const normalizeCategory = (raw) => {
    const key = (raw || '').toLowerCase().trim();
    return CATEGORY_ALIASES[key] || (CATEGORY_ORDER.includes(key) ? key : 'ghg');
  };

  /* Single-pass grouping — every insight lands in exactly one canonical bucket */
  const grouped = {};
  insights.forEach(insight => {
    const key = normalizeCategory(insight.category);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(insight);
  });

  /* Render in CATEGORY_ORDER so the sequence is always deterministic */
  const orderedGrouped = CATEGORY_ORDER.reduce((acc, key) => {
    if (grouped[key]) acc[key] = grouped[key];
    return acc;
  }, {});

  const categoryCount = Object.keys(orderedGrouped).length;

  return (
    <div className="min-h-screen bg-[#050505] text-white">

      {/* ── Top Header ──────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#050505] border-b border-white/10 flex items-center justify-between px-8">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 ai-gradient-bg rounded-lg flex items-center justify-center">
              <MI icon="eco" className="text-white text-base" fill />
            </div>
            <span className="font-bold text-base tracking-tight">GreenLedger AI</span>
          </Link>
          <nav className="hidden md:flex gap-6 text-sm">
            <Link to="/admin/dashboard" className="text-zinc-400 hover:text-white transition-colors">Dashboard</Link>
            <Link to="/admin/war-room"  className="text-zinc-400 hover:text-white transition-colors">AI War Room</Link>
            <span className="text-emerald-400 font-semibold border-b-2 border-emerald-700 pb-0.5">Actionable Plans</span>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/war-room"
            className="flex items-center gap-2 px-4 py-2 border border-white/10 rounded-lg text-sm text-zinc-300 hover:border-white/20 transition-all"
          >
            <MI icon="arrow_back" className="text-base" /> Back to War Room
          </Link>
          <button onClick={handleLogout} className="text-zinc-400 hover:text-white transition-colors">
            <MI icon="logout" className="text-xl" />
          </button>
        </div>
      </header>

      {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
      <aside className="fixed left-0 top-16 w-64 h-[calc(100vh-64px)] z-40 bg-[#050505] border-r border-white/10 flex flex-col">
        <div className="p-3 pt-4 space-y-1">
          <AdminSidebarLinks />
        </div>

        {/* Category jump-links */}
        {!loading && categoryCount > 0 && (
          <div className="mt-4 px-4">
            <p className="gl-overline px-1 mb-2">Jump to Category</p>
            <div className="space-y-0.5">
              {Object.keys(orderedGrouped).map(key => {
                const cfg = CATEGORY_CFG[key] ?? FALLBACK_CFG;
                return (
                  <a
                    key={key}
                    href={`#cat-${key}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"
                  >
                    <MI icon={cfg.icon} className={`${cfg.color} text-sm`} fill />
                    {cfg.label}
                    <span className="ml-auto text-zinc-700">{grouped[key].length}</span>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-auto p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 text-zinc-600 hover:text-zinc-400 text-sm transition-colors rounded-lg hover:bg-white/5 w-full"
          >
            <MI icon="logout" className="text-xl" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="ml-64 pt-24 px-10 pb-16">

        {/* Page header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl ai-gradient-bg flex items-center justify-center">
                <MI icon="lightbulb" className="text-white text-xl" fill />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white tracking-tight">Actionable Plans</h1>
                <p className="text-zinc-400 text-sm mt-0.5">
                  AI-generated sustainability recommendations · SEBI BRSR Core
                </p>
              </div>
            </div>
          </div>
          {!loading && insights.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-2xl font-black text-white tabular-nums">{insights.length}</p>
                <p className="text-zinc-500 text-xs">Total plans</p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-right">
                <p className="text-2xl font-black text-white tabular-nums">{categoryCount}</p>
                <p className="text-zinc-500 text-xs">Categories</p>
              </div>
              <button
                onClick={fetchInsights}
                className="flex items-center gap-1.5 px-4 py-2 border border-emerald-700/40 text-emerald-400 hover:bg-emerald-900/20 rounded-lg text-sm font-medium transition-all"
              >
                <MI icon="refresh" className="text-base" /> Refresh
              </button>
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-32 gap-4">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-zinc-500 text-sm">Loading plans from Chief Sustainability AI…</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="max-w-lg mx-auto py-24 text-center">
            <MI icon="error_outline" className="text-red-400 text-5xl mb-3 block mx-auto" />
            <p className="text-white font-semibold mb-1">Could not load plans</p>
            <p className="text-zinc-500 text-sm">{error}</p>
            <button
              onClick={fetchInsights}
              className="mt-4 px-4 py-2 border border-white/10 rounded-lg text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && insights.length === 0 && (
          <div className="max-w-lg mx-auto py-24 text-center">
            <div className="w-16 h-16 rounded-2xl ai-gradient-bg flex items-center justify-center mx-auto mb-4">
              <MI icon="lightbulb" className="text-white text-3xl" />
            </div>
            <p className="text-white font-semibold text-lg mb-2">No plans generated yet</p>
            <p className="text-zinc-500 text-sm mb-6">
              Upload and verify documents in the AI War Room, then generate your BRSR report to populate this page.
            </p>
            <Link
              to="/admin/war-room"
              className="inline-flex items-center gap-2 px-5 py-2.5 ai-gradient-bg rounded-lg text-white font-semibold text-sm"
            >
              <MI icon="arrow_forward" className="text-base" /> Go to AI War Room
            </Link>
          </div>
        )}

        {/* Accordion list */}
        {!loading && !error && insights.length > 0 && (
          <div className="space-y-4 max-w-4xl">
            {Object.entries(orderedGrouped).map(([key, plans], idx) => (
              <div id={`cat-${key}`} key={key}>
                <AccordionPanel
                  categoryKey={key}
                  plans={plans}
                  defaultOpen={idx === 0}
                />
              </div>
            ))}

            {/* Footer note */}
            <div className="flex items-center gap-2 pt-4">
              <MI icon="info" className="text-zinc-700 text-sm flex-shrink-0" />
              <p className="text-zinc-700 text-xs">
                Recommendations are generated by GreenLedger AI from verified SEBI BRSR metrics.
                Always review with your sustainability team before implementation.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ActionablePlans;
