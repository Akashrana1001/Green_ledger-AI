/**
 * EsgScoreGauge — Deterministic 0–100 ESG health score.
 *
 * Runs entirely on KpiResult data already in React state — no new API calls.
 * Weighted formula across 9 KPIs → SVG arc gauge + pillar breakdown.
 *
 * Scoring (100 pts total):
 *   Environmental 40 pts: renewable %, waste recovery %, water recycled %, GHG intensity
 *   Social        35 pts: female wage parity, wellbeing spend %, LTIFR
 *   Governance    25 pts: payable days, data breach %, regulatory fines
 */
import { useState, useMemo } from 'react';
import MI from './MI';

/* ── Helpers ────────────────────────────────────────────────────────────── */
const clamp  = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const safe   = (v)         => (typeof v === 'number' && isFinite(v) ? v : null);
const round1 = (v)         => Math.round(v * 10) / 10;

/** Linear score: goodEdge → maxPts, badEdge → 0. */
const linear = (v, goodEdge, badEdge, maxPts) => {
  if (safe(v) === null) return 0;
  const t = clamp((v - badEdge) / (goodEdge - badEdge), 0, 1);
  return round1(t * maxPts);
};

/* ── Pillar scoring ─────────────────────────────────────────────────────── */
function scoreEnvironmental(env) {
  if (!env) return { score: 0, max: 40, items: [] };

  const renewable = linear(safe(env.renewable_energy_pct), 100, 0, 12);
  const waste     = linear(safe(env.waste_recovered_pct),  100, 0, 10);
  const water     = linear(safe(env.water_recycled_pct),   100, 0, 10);

  // GHG intensity: lower = better. 0 = 8 pts, ≥5 tCO₂/Cr = 0 pts.
  const ghgRaw = safe(env.ghg_intensity_per_rupee);
  const ghg    = ghgRaw === null ? 0 : round1(Math.max(0, 8 * (1 - ghgRaw / 5)));

  return {
    score: renewable + waste + water + ghg,
    max: 40,
    items: [
      { label: 'Renewable Energy', value: env.renewable_energy_pct, pts: renewable, max: 12, unit: '%',        icon: 'solar_power' },
      { label: 'Waste Recovery',   value: env.waste_recovered_pct,  pts: waste,     max: 10, unit: '%',        icon: 'recycling'   },
      { label: 'Water Recycled',   value: env.water_recycled_pct,   pts: water,     max: 10, unit: '%',        icon: 'water_drop'  },
      { label: 'GHG Intensity',    value: ghgRaw,                   pts: ghg,       max: 8,  unit: 'tCO₂/Cr', icon: 'co2', invert: true },
    ],
  };
}

function scoreSocial(soc) {
  if (!soc) return { score: 0, max: 35, items: [] };

  const femWage  = linear(safe(soc.female_wage_pct), 100, 0, 15);

  // Wellbeing: ≥5% of revenue = full marks
  const wbRaw    = safe(soc.wellbeing_spend_pct_revenue);
  const wellbeing = wbRaw === null ? 0 : round1(clamp(wbRaw / 5, 0, 1) * 10);

  // LTIFR: 0 = 10 pts, ≥10 = 0 pts
  const ltRaw  = safe(soc.ltifr_employees);
  const ltifr  = ltRaw  === null ? 0 : round1(Math.max(0, 10 * (1 - ltRaw / 10)));

  return {
    score: femWage + wellbeing + ltifr,
    max: 35,
    items: [
      { label: 'Female Wage Parity', value: soc.female_wage_pct,            pts: femWage,   max: 15, unit: '%',     icon: 'diversity_3'      },
      { label: 'Wellbeing Spend',    value: soc.wellbeing_spend_pct_revenue, pts: wellbeing, max: 10, unit: '% rev', icon: 'favorite'         },
      { label: 'Safety (LTIFR)',     value: soc.ltifr_employees,             pts: ltifr,     max: 10, unit: 'rate',  icon: 'health_and_safety', invert: true },
    ],
  };
}

function scoreGovernance(gov) {
  if (!gov) return { score: 0, max: 25, items: [] };

  // Payable days: ≤45 = full, ≥90 = 0
  const pdRaw = safe(gov.accounts_payable_days);
  const pd    = pdRaw === null ? 0 : round1(Math.max(0, 10 * (1 - clamp(pdRaw - 45, 0, 45) / 45)));

  // Data breach: 0% = 8 pts
  const dbRaw = safe(gov.data_breach_pct_incidents);
  const db    = dbRaw === null ? 0 : round1(Math.max(0, 8 * (1 - dbRaw / 100)));

  // Regulatory fines: 0 = 7 pts; each fine –2 pts
  const fRaw  = safe(gov.regulatory_fines_count);
  const fines = fRaw  === null ? 0 : round1(Math.max(0, 7 - fRaw * 2));

  return {
    score: pd + db + fines,
    max: 25,
    items: [
      { label: 'Payable Days',    value: gov.accounts_payable_days,     pts: pd,    max: 10, unit: 'days',  icon: 'payments', invert: true },
      { label: 'Data Breach',     value: gov.data_breach_pct_incidents, pts: db,    max: 8,  unit: '%',     icon: 'security', invert: true },
      { label: 'Regulatory Risk', value: gov.regulatory_fines_count,    pts: fines, max: 7,  unit: 'fines', icon: 'gavel',    invert: true },
    ],
  };
}

/* ── SVG arc constants ───────────────────────────────────────────────────── */
const R    = 80;
const CX   = 100;
const CY   = 100;
const CIRC = 2 * Math.PI * R;
const ARC  = CIRC * 0.75; // 270° sweep

const scoreColor = (s) => s >= 70 ? '#10b981' : s >= 40 ? '#f59e0b' : '#ef4444';
const scoreBand  = (s) =>
  s >= 70 ? { label: 'Strong',   cls: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' } :
  s >= 40 ? { label: 'Moderate', cls: 'bg-amber-500/10  border-amber-500/25  text-amber-400'   } :
            { label: 'High Risk', cls: 'bg-red-500/10    border-red-500/25    text-red-400'     };

/* ── PillarRow — one expandable row ────────────────────────────────────── */
const PillarRow = ({ label, score, max, color, icon, items }) => {
  const [open, setOpen] = useState(false);
  const pct = max > 0 ? (score / max) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 group text-left"
      >
        <MI icon={icon} className="text-base flex-shrink-0" style={{ color }} />
        <span className="text-xs font-bold text-zinc-300 flex-1">{label}</span>
        <span className="text-xs font-mono text-zinc-500 tabular-nums">
          {score.toFixed(1)}<span className="text-zinc-700">/{max}</span>
        </span>
        <MI
          icon={open ? 'expand_less' : 'expand_more'}
          className="text-base text-zinc-600 group-hover:text-zinc-400 transition-colors"
        />
      </button>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>

      {/* Expanded item list */}
      {open && (
        <div className="pl-5 pt-1 pb-0.5 space-y-2">
          {items.map(item => {
            const hasData = safe(item.value) !== null;
            const itemPct = item.max > 0 ? (item.pts / item.max) * 100 : 0;
            return (
              <div key={item.label} className="flex items-center gap-2">
                <MI icon={item.icon} className="text-[11px] text-zinc-600 flex-shrink-0" />
                <span className="text-[10px] text-zinc-500 flex-1 leading-none">{item.label}</span>
                {hasData ? (
                  <>
                    <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
                      {typeof item.value === 'number' ? item.value.toFixed(1) : item.value}
                      {item.unit ? ` ${item.unit}` : ''}
                      {item.invert ? ' ↓' : ''}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-600 w-8 text-right tabular-nums">
                      {item.pts.toFixed(1)}
                    </span>
                    <div className="w-10 h-1 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${itemPct}%`, backgroundColor: color, opacity: 0.6 }}
                      />
                    </div>
                  </>
                ) : (
                  <span className="text-[10px] text-zinc-700 italic">no data yet</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ── Main component ─────────────────────────────────────────────────────── */
const EsgScoreGauge = ({ kpiResult }) => {
  const env = kpiResult?.environmentalKpis;
  const soc = kpiResult?.socialKpis;
  const gov = kpiResult?.governanceKpis;

  const envPillar = useMemo(() => scoreEnvironmental(env), [env]);
  const socPillar = useMemo(() => scoreSocial(soc),        [soc]);
  const govPillar = useMemo(() => scoreGovernance(gov),    [gov]);

  const total      = round1(envPillar.score + socPillar.score + govPillar.score);
  const hasData    = !!(env || soc || gov);
  const arcFilled  = hasData ? (total / 100) * ARC : 0;
  const color      = scoreColor(total);
  const band       = scoreBand(total);

  const pillars = [
    { label: 'Environmental', score: envPillar.score, max: 40, color: '#10b981', icon: 'eco',         items: envPillar.items },
    { label: 'Social',        score: socPillar.score, max: 35, color: '#8b5cf6', icon: 'diversity_3', items: socPillar.items },
    { label: 'Governance',    score: govPillar.score, max: 25, color: '#06b6d4', icon: 'policy',      items: govPillar.items },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex flex-col md:flex-row gap-8 items-center md:items-start">

      {/* ── Left: arc gauge ──────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-3 flex-shrink-0">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
          ESG Health Score
        </p>

        <div className="relative w-48 h-48">
          <svg viewBox="0 0 200 200" className="w-full h-full -rotate-[135deg]">
            {/* Background track */}
            <circle
              cx={CX} cy={CY} r={R}
              fill="none"
              strokeWidth="13"
              stroke="#27272a"
              strokeDasharray={`${ARC} ${CIRC - ARC}`}
              strokeLinecap="round"
            />
            {/* Score fill — animates via CSS transition on stroke-dasharray */}
            <circle
              cx={CX} cy={CY} r={R}
              fill="none"
              strokeWidth="13"
              stroke={hasData ? color : 'transparent'}
              strokeDasharray={`${arcFilled} ${CIRC}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 1.4s cubic-bezier(0.34,1.56,0.64,1), stroke 0.6s ease' }}
            />
          </svg>

          {/* Centre overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 pointer-events-none">
            {hasData ? (
              <>
                <span className="text-[42px] font-black text-white leading-none tabular-nums">
                  {total}
                </span>
                <span className="text-[10px] text-zinc-600 font-bold">/ 100</span>
                <span className={`mt-1.5 text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full border ${band.cls}`}>
                  {band.label}
                </span>
              </>
            ) : (
              <>
                <MI icon="pending_actions" className="text-3xl text-zinc-700" />
                <span className="text-[9px] text-zinc-700 text-center mt-1 px-4 leading-snug">
                  Verify docs<br/>to calculate
                </span>
              </>
            )}
          </div>
        </div>

        {/* Pillar mini-scores under gauge */}
        {hasData && (
          <div className="flex items-center gap-5">
            {pillars.map(p => (
              <div key={p.label} className="flex flex-col items-center gap-0.5">
                <span className="text-base font-black text-white tabular-nums">
                  {p.score.toFixed(0)}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: p.color }}>
                  {p.label.slice(0, 3)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Right: pillar breakdown ───────────────────────────────────────── */}
      <div className="flex-1 space-y-4 w-full min-w-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Score Breakdown</h3>
          {hasData && (
            <span className="text-[10px] text-zinc-600">↓ expand pillars</span>
          )}
        </div>

        {pillars.map(p => (
          <PillarRow key={p.label} {...p} />
        ))}

        {!hasData && (
          <p className="text-xs text-zinc-700 italic">
            Score calculates once verified documents are present.
          </p>
        )}

        {hasData && (
          <p className="text-[10px] text-zinc-700 pt-2 border-t border-zinc-800">
            Environmental 40 pts · Social 35 pts · Governance 25 pts
          </p>
        )}
      </div>
    </div>
  );
};

export default EsgScoreGauge;
