import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import MI from './MI';

/* ── Data Gap Protocol — sentinel emitted by extraction_prompts.py when
 *    the source document does not contain the requested field.
 *    Surfacing this to the user is the whole point of the protocol —
 *    we render a manual-input row instead of silently displaying 0.    */
const DATA_NOT_FOUND = 'DATA_NOT_FOUND';
const isMissing = (v) => v === DATA_NOT_FOUND;

/* ── Display formatters ─────────────────────────────────────────────────── */

const UNIT_BY_SUFFIX = [
  ['_tco2e',         'tCO₂e'    ],
  ['_kwh',           'kWh'      ],
  ['_kl',            'KL'       ],
  ['_mt',            'MT'       ],
  ['_pct',           '%'        ],
  ['_pct_revenue',   '% revenue'],
  ['_pct_incidents', '% events' ],
  ['_days',          'days'     ],
  ['_count',         ''         ],
  ['_per_m_hrs',     '/M hrs'   ],
  ['_inr_cr',        '₹ Cr'     ],
];

const UNIT_BY_KEY = {
  ltifr_employees: 'per M hrs',
  ltifr_workers:   'per M hrs',
  ghg_intensity_per_rupee: 'tCO₂e/₹Cr',
  ghg_intensity_ppp: 'tCO₂e/₹Cr (PPP)',
  water_intensity:   'KL/₹Cr',
  waste_intensity:   'MT/₹Cr',
};

const detectUnit = (key) => {
  if (UNIT_BY_KEY[key]) return UNIT_BY_KEY[key];
  const k = key.toLowerCase();
  for (const [suffix, unit] of UNIT_BY_SUFFIX) {
    if (k.endsWith(suffix)) return unit;
  }
  return '';
};

const TOKENS = {
  tco2e: 'tCO₂e', ghg: 'GHG', kwh: 'kWh', kl: 'KL', mt: 'MT',
  msme: 'MSME', posh: 'POSH', ppp: 'PPP', ltifr: 'LTIFR',
  hr: 'HR', dpo: 'DPO', inr: 'INR', cr: 'Cr', pct: '%',
};

const titleCase = (raw) =>
  raw
    .replace(/_pct$/, '')
    .split('_')
    .map(part => TOKENS[part] || part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatValue = (val) => {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return '—';
    if (Number.isInteger(val)) return val.toLocaleString('en-IN');
    return val.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

/* ── Risk classification ────────────────────────────────────────────────── */

/**
 * Returns 'critical' | 'warn' | null based on key + value.
 * Critical = pulses red; warn = pulses amber; null = no animation.
 */
const classifyRisk = (key, value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  const k = key.toLowerCase();

  if (Number.isFinite(num)) {
    // Critical thresholds
    if (k.includes('fatalit')           && num > 0)   return 'critical';
    if (k.includes('breach')            && num > 0)   return 'critical';
    if (k.includes('regulatory_fine')   && num > 0)   return 'critical';
    if (k.includes('major_accident')    && num > 0)   return 'critical';

    // Warning thresholds
    if (k.includes('complaint')         && num > 0)   return 'warn';
    if (k.includes('safety_training')   && num < 100) return 'warn';
    if (k === 'renewable_energy_pct'    && num < 30)  return 'warn';
    if (k === 'water_recycled_pct'      && num < 25)  return 'warn';
    if (k === 'msme_procurement_pct'    && num < 20)  return 'warn';
    if (k === 'female_wage_pct'         && num < 30)  return 'warn';
    if (k === 'data_breach_pct_incidents' && num > 0) return 'warn';
  }
  return null;
};

const RISK_STYLES = {
  critical: {
    border: 'border-red-500/40',
    bg:     'bg-red-950/20',
    label:  'text-red-300',
    value:  'text-red-200',
    glow:   'shadow-[0_0_18px_-4px_rgba(248,113,113,0.55)]',
    chipBg: 'bg-red-500/15 border-red-500/30 text-red-300',
    chipLabel: 'CRITICAL',
    icon:   'gpp_maybe',
  },
  warn: {
    border: 'border-amber-500/35',
    bg:     'bg-amber-950/15',
    label:  'text-amber-300',
    value:  'text-amber-200',
    glow:   'shadow-[0_0_16px_-4px_rgba(251,191,36,0.45)]',
    chipBg: 'bg-amber-500/15 border-amber-500/25 text-amber-300',
    chipLabel: 'WATCH',
    icon:   'warning',
  },
};

/* ── Sub-components ─────────────────────────────────────────────────────── */

const ACCENT = {
  emerald: {
    headerBg:    'bg-emerald-950/30',
    headerBord:  'border-emerald-700/20',
    panelBord:   'border-emerald-700/25',
    iconBg:      'bg-emerald-500/15 border-emerald-500/30',
    iconText:    'text-emerald-400',
    title:       'text-emerald-300',
    count:       'text-emerald-500/80',
    rowBord:     'border-emerald-700/15',
    rowLabel:    'text-emerald-300/80',
    enterFromX:  -8,
  },
  cyan: {
    headerBg:    'bg-cyan-950/30',
    headerBord:  'border-cyan-700/20',
    panelBord:   'border-cyan-700/25',
    iconBg:      'bg-cyan-500/15 border-cyan-500/30',
    iconText:    'text-cyan-400',
    title:       'text-cyan-300',
    count:       'text-cyan-500/80',
    rowBord:     'border-cyan-700/15',
    rowLabel:    'text-cyan-300/80',
    enterFromX:  8,
  },
};

/* ── Manual-input row — shown when the AI flagged DATA_NOT_FOUND ───────── */
const ManualEntryRow = ({ k, accent, onSave }) => {
  const unit = detectUnit(k);
  const label = titleCase(k);
  const a = ACCENT[accent];

  const [draft,  setDraft]  = useState('');
  const [saved,  setSaved]  = useState(false);

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (onSave) onSave(k, trimmed);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="rounded-lg border bg-amber-950/15 border-amber-500/30 px-3.5 py-2.5">
      {/* Top row — label + status chip (chip is in-flow, never overlaps controls) */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-mono text-[10.5px] uppercase tracking-wider truncate text-amber-300/80">
          {label}
        </span>
        <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider border bg-amber-500/15 border-amber-500/30 text-amber-300">
          <MI icon="warning" className="text-[10px]" fill />
          DATA NOT FOUND
        </span>
      </div>

      {/* Bottom row — manual input controls */}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); }}
          placeholder="Enter value manually"
          className="flex-1 min-w-0 bg-black/40 border border-amber-500/25 focus:border-amber-400/60 rounded px-2 py-1 text-amber-100 text-xs font-bold tabular-nums outline-none transition-colors"
        />
        {unit && (
          <span className="text-[9px] font-mono text-amber-400/70 shrink-0">{unit}</span>
        )}
        <button
          type="button"
          onClick={commit}
          disabled={!draft.trim()}
          title="Save manual value"
          className="shrink-0 flex items-center justify-center w-7 h-7 rounded bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 text-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <MI icon={saved ? 'check' : 'save'} className="text-xs" />
        </button>
      </div>
    </div>
  );
};

const MetricRow = ({ k, value, accent, onManualEntry }) => {
  // Data Gap Protocol — render manual-input UI when AI couldn't extract this field
  if (isMissing(value)) {
    return <ManualEntryRow k={k} accent={accent} onSave={onManualEntry} />;
  }

  const risk = classifyRisk(k, value);
  const unit = detectUnit(k);
  const label = titleCase(k);
  const formatted = formatValue(value);
  const r = risk ? RISK_STYLES[risk] : null;
  const a = ACCENT[accent];

  const pulseAnimation = risk
    ? { scale: [1, 1.012, 1], opacity: [1, 0.95, 1] }
    : {};
  const pulseTransition = risk
    ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
    : {};

  return (
    <motion.div
      animate={pulseAnimation}
      transition={pulseTransition}
      className={`relative flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border backdrop-blur-sm ${
        r ? `${r.border} ${r.bg} ${r.glow}` : `${a.rowBord} bg-white/[0.015]`
      }`}
    >
      {r && (
        <span className={`absolute -top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider border ${r.chipBg} flex items-center gap-1`}>
          <MI icon={r.icon} className="text-[10px]" fill />
          {r.chipLabel}
        </span>
      )}
      <span className={`font-mono text-[10.5px] uppercase tracking-wider truncate ${r ? r.label : a.rowLabel}`}>
        {label}
      </span>
      <div className="flex items-baseline gap-1.5 shrink-0">
        <span className={`font-bold text-sm tabular-nums ${r ? r.value : 'text-white'}`}>
          {formatted}
        </span>
        {unit && (
          <span className={`text-[9px] font-mono ${r ? r.label : 'text-zinc-500'}`}>
            {unit}
          </span>
        )}
      </div>
    </motion.div>
  );
};

const Column = ({ icon, title, subtitle, accent, entries, emptyMsg, onManualEntry }) => {
  const a = ACCENT[accent];
  return (
    <div className={`glass-panel rounded-xl border ${a.panelBord} overflow-hidden`}>
      <div className={`flex items-center justify-between px-4 py-3 ${a.headerBg} border-b ${a.headerBord}`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${a.iconBg}`}>
            <MI icon={icon} className={`${a.iconText} text-base`} fill />
          </div>
          <div>
            <p className={`font-bold text-[11px] uppercase tracking-[0.18em] ${a.title}`}>{title}</p>
            <p className="text-zinc-500 text-[10px]">{subtitle}</p>
          </div>
        </div>
        <span className={`font-mono text-[10px] ${a.count}`}>
          {entries.length} field{entries.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="p-3 space-y-1.5 max-h-[420px] overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-zinc-600 text-xs">
            {emptyMsg}
          </div>
        ) : (
          entries.map(([k, v], i) => (
            <motion.div
              key={k}
              initial={{ opacity: 0, x: a.enterFromX }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.5 + i * 0.05 }}
            >
              <MetricRow k={k} value={v} accent={accent} onManualEntry={onManualEntry} />
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

/* ── Main component ─────────────────────────────────────────────────────── */

const KPIResultsPanel = ({
  calculatedKpis,
  extractedRawValues,
  documentName,
  category,
  onManualEntry,   // optional (key, value) => void — called when admin manually fills a DATA_NOT_FOUND field
}) => {
  const rawEntries = useMemo(
    () => Object.entries(extractedRawValues || {}).filter(([, v]) => v !== undefined),
    [extractedRawValues]
  );
  const kpiEntries = useMemo(
    () => Object.entries(calculatedKpis || {}).filter(([, v]) => v !== undefined),
    [calculatedKpis]
  );

  /* Count of DATA_NOT_FOUND fields — surfaced in the header strip */
  const missingCount = useMemo(
    () => [...rawEntries, ...kpiEntries].filter(([, v]) => isMissing(v)).length,
    [rawEntries, kpiEntries]
  );

  const riskCount = useMemo(() => {
    let critical = 0, warn = 0;
    [...rawEntries, ...kpiEntries].forEach(([k, v]) => {
      if (isMissing(v)) return;          // missing data is its own pill, not a risk
      const r = classifyRisk(k, v);
      if (r === 'critical') critical += 1;
      else if (r === 'warn') warn += 1;
    });
    return { critical, warn };
  }, [rawEntries, kpiEntries]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.4, ease: 'easeOut' }}
      className="glass-panel rounded-xl border border-emerald-700/25 overflow-hidden shadow-[0_0_36px_-14px_rgba(16,185,129,0.5)]"
    >
      {/* Header strip */}
      <div className="px-5 py-4 bg-gradient-to-r from-emerald-950/40 via-emerald-900/15 to-transparent border-b border-emerald-700/25">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center shadow-[0_0_18px_-4px_rgba(16,185,129,0.6)]"
            >
              <MI icon="verified" className="text-emerald-300 text-lg" fill />
            </motion.div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-0.5">
                Verified Extraction · Bedrock Pipeline
              </p>
              <h3 className="font-bold text-white text-sm truncate max-w-md">
                {documentName || 'Document'}
                {category && (
                  <span className="ml-2 text-[10px] font-mono text-zinc-500 capitalize">
                    · {category.replace(/_/g, ' ')}
                  </span>
                )}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {missingCount > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                <MI icon="edit_note" className="text-xs" fill />
                {missingCount} Manual Entry
              </span>
            )}
            {riskCount.critical > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/35 text-red-300 text-[10px] font-bold uppercase tracking-wider">
                <MI icon="gpp_maybe" className="text-xs" fill />
                {riskCount.critical} Critical
              </span>
            )}
            {riskCount.warn > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                <MI icon="warning" className="text-xs" fill />
                {riskCount.warn} Watch
              </span>
            )}
            {missingCount === 0 && riskCount.critical === 0 && riskCount.warn === 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                <MI icon="check_circle" className="text-xs" fill />
                All Clear
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Two-column grid */}
      <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Column
          icon="filter_alt"
          title="Extracted Metrics"
          subtitle="Raw values pulled by Claude vision"
          accent="cyan"
          entries={rawEntries}
          emptyMsg="No raw values extracted"
          onManualEntry={onManualEntry}
        />
        <Column
          icon="calculate"
          title="Calculated SEBI KPIs"
          subtitle="Deterministic Python · BRSR formulas"
          accent="emerald"
          entries={kpiEntries}
          emptyMsg="No KPIs calculated"
        />
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-emerald-700/15 bg-black/30 flex items-center justify-between">
        <span className="font-mono text-[9px] text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
          <MI icon="bolt" className="text-emerald-400 text-[11px]" fill />
          Pipeline · S3 → Bedrock → kpi_calculator.py
        </span>
        <span className="font-mono text-[9px] text-zinc-600">
          {rawEntries.length + kpiEntries.length} datapoints · audit-ready
        </span>
      </div>
    </motion.div>
  );
};

export default KPIResultsPanel;
