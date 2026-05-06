import { motion, AnimatePresence } from 'framer-motion';
import MI from './MI';

/* ── Category visual config ─────────────────────────────────────────────── */
const CATEGORY_CFG = {
  energy: {
    icon: 'bolt',
    iconColor: 'text-yellow-400',
    iconBg: 'bg-yellow-950/40 border-yellow-700/35',
    cardBg: 'bg-yellow-950/10',
    cardBorder: 'border-yellow-900/25 hover:border-yellow-700/40',
    accentBorder: '#ca8a04',           // yellow-600
    badgeClass: 'bg-yellow-950/50 text-yellow-300 border-yellow-700/40',
    label: 'Energy',
  },
  water: {
    icon: 'water_drop',
    iconColor: 'text-sky-400',
    iconBg: 'bg-sky-950/40 border-sky-700/35',
    cardBg: 'bg-sky-950/10',
    cardBorder: 'border-sky-900/25 hover:border-sky-700/40',
    accentBorder: '#0284c7',           // sky-600
    badgeClass: 'bg-sky-950/50 text-sky-300 border-sky-700/40',
    label: 'Water',
  },
  waste: {
    icon: 'recycling',
    iconColor: 'text-orange-400',
    iconBg: 'bg-orange-950/40 border-orange-700/35',
    cardBg: 'bg-orange-950/10',
    cardBorder: 'border-orange-900/25 hover:border-orange-700/40',
    accentBorder: '#ea580c',           // orange-600
    badgeClass: 'bg-orange-950/50 text-orange-300 border-orange-700/40',
    label: 'Waste',
  },
  ghg: {
    icon: 'co2',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-950/40 border-emerald-700/35',
    cardBg: 'bg-emerald-950/10',
    cardBorder: 'border-emerald-900/25 hover:border-emerald-700/40',
    accentBorder: '#059669',           // emerald-600
    badgeClass: 'bg-emerald-950/50 text-emerald-300 border-emerald-700/40',
    label: 'GHG',
  },
  social: {
    icon: 'groups',
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-950/40 border-violet-700/35',
    cardBg: 'bg-violet-950/10',
    cardBorder: 'border-violet-900/25 hover:border-violet-700/40',
    accentBorder: '#7c3aed',           // violet-600
    badgeClass: 'bg-violet-950/50 text-violet-300 border-violet-700/40',
    label: 'Social',
  },
  governance: {
    icon: 'policy',
    iconColor: 'text-zinc-300',
    iconBg: 'bg-zinc-800/60 border-zinc-600/35',
    cardBg: 'bg-zinc-900/30',
    cardBorder: 'border-zinc-800/40 hover:border-zinc-600/50',
    accentBorder: '#71717a',           // zinc-500
    badgeClass: 'bg-zinc-800/60 text-zinc-300 border-zinc-600/40',
    label: 'Governance',
  },
};

const FALLBACK_CFG = CATEGORY_CFG.ghg;

/* ── Framer Motion variants ─────────────────────────────────────────────── */
const containerVariants = {
  hidden:  {},
  /* staggerChildren: 0.1 — matches GSAP STAGGER constant for cross-library
   * consistency; 0.14 was causing perceived lag between cards.             */
  visible: { transition: { staggerChildren: 0.1 } },
};

const cardVariants = {
  /* filter:blur removed — allocates a GPU compositing layer per card on
   * mount, which stalls the main thread and causes jank on lower-end GPUs. */
  hidden:  { opacity: 0, x: -20, scale: 0.97 },
  visible: {
    opacity: 1, x: 0, scale: 1,
    /* spring transition matches UploadWidget file cards — uniform feel
     * across all Framer Motion card entrances in the app.                   */
    transition: { type: 'spring', stiffness: 260, damping: 20 },
  },
  exit: { opacity: 0, x: 20, transition: { duration: 0.18, ease: 'easeIn' } },
};

/* ── Single insight card ─────────────────────────────────────────────────── */
const InsightCard = ({ insight, index }) => {
  const cfg = CATEGORY_CFG[insight.category?.toLowerCase()] ?? FALLBACK_CFG;

  return (
    <motion.div
      variants={cardVariants}
      className="group"
      layout
    >
      <div
        className={`
          relative p-5 rounded-xl border transition-all duration-300 overflow-hidden
          ${cfg.cardBg} ${cfg.cardBorder}
          hover:shadow-lg
        `}
        style={{
          borderLeft: `2px solid ${cfg.accentBorder}`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03)`,
        }}
      >
        {/* Shine sweep on hover */}
        <div className="card-shine absolute inset-0 pointer-events-none" />

        {/* Step number */}
        <span className="absolute top-3 right-4 text-[10px] font-black text-zinc-700 tabular-nums">
          {String(index + 1).padStart(2, '0')}
        </span>

        <div className="flex items-start gap-4">
          {/* Category icon badge */}
          <div className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center border ${cfg.iconBg}`}>
            <MI icon={cfg.icon} className={`${cfg.iconColor} text-xl`} fill />
          </div>

          <div className="flex-1 min-w-0 pr-4">
            {/* Title + category label */}
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <h4 className="text-white font-bold text-sm leading-snug">{insight.title}</h4>
              <span className={`text-[9px] font-black tracking-[0.15em] uppercase px-2 py-0.5 rounded-full border flex-shrink-0 ${cfg.badgeClass}`}>
                {cfg.label}
              </span>
            </div>

            {/* Description */}
            <p className="text-zinc-400 text-xs leading-relaxed mb-3">{insight.description}</p>

            {/* Estimated impact pill */}
            <div className="inline-flex items-center gap-1.5 bg-emerald-950/50 border border-emerald-700/35 rounded-full px-3 py-1">
              <MI icon="trending_up" className="text-emerald-400 text-sm flex-shrink-0" />
              <span className="text-[10px] font-bold text-emerald-300 tracking-wide">
                {insight.estimated_impact}
              </span>
            </div>

            {/* Formula used — monospace audit trail */}
            {insight.formula_used && (
              <div className="mt-2 flex items-center gap-1.5">
                <MI icon="functions" className="text-zinc-600 text-sm flex-shrink-0" />
                <span className="font-mono text-[10px] text-zinc-600 leading-tight">
                  {insight.formula_used}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ── ActionableInsights ──────────────────────────────────────────────────── */
const ActionableInsights = ({ insights = [] }) => {
  if (!insights?.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Outer container — glowing emerald border signals "AI Intelligence" */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          border: '1px solid rgba(16,185,129,0.22)',
          boxShadow: '0 0 48px rgba(16,185,129,0.10), inset 0 1px 0 rgba(255,255,255,0.04)',
          background: 'linear-gradient(135deg, rgba(16,185,129,0.04) 0%, rgba(0,0,0,0.70) 100%)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Top accent gradient strip */}
        <div
          className="h-px w-full"
          style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(16,185,129,0.6) 40%, rgba(16,185,129,0.6) 60%, transparent 100%)' }}
        />

        {/* Header */}
        <div className="px-6 py-4 border-b border-emerald-900/25 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Pulsing AI live indicator */}
            <div className="relative flex-shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-45" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm tracking-tight">
                AI Actionable Insights
              </h3>
              <p className="text-zinc-500 text-[10px] mt-0.5">
                Chief Sustainability AI · Based on your verified SEBI BRSR metrics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-emerald-500 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-full uppercase tracking-widest">
              {insights.length} Insight{insights.length !== 1 ? 's' : ''}
            </span>
            <MI icon="auto_awesome" className="text-emerald-600 text-base" fill />
          </div>
        </div>

        {/* Insights list — staggered entrance */}
        <div className="p-5">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            <AnimatePresence>
              {insights.map((insight, i) => (
                <InsightCard
                  key={`${insight.category}-${i}`}
                  insight={insight}
                  index={i}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-emerald-900/20 flex items-center gap-2">
          <MI icon="info" className="text-zinc-700 text-sm flex-shrink-0" />
          <p className="text-zinc-700 text-[10px]">
            Recommendations are generated by AI from verified document metrics. Always review before implementation.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default ActionableInsights;
