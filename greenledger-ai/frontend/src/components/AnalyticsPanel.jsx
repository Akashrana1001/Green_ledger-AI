import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar, Cell,
  PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import axiosClient from '../api/axiosClient';
import LoadingSpinner from './LoadingSpinner';
import MI from './MI';

/* ── Design-system colour tokens ─────────────────────────────────────────── */
const C = {
  emerald: '#10b981',
  sky:     '#38bdf8',
  orange:  '#f97316',
  red:     '#ef4444',
  violet:  '#8b5cf6',
  cyan:    '#06b6d4',
  zinc:    '#3f3f46',
  grid:    'rgba(255,255,255,0.05)',
  tick:    '#71717a',
};

const TOTAL_CATEGORIES = 17;

/* ── Dark-themed recharts tooltip ────────────────────────────────────────── */
const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-white/15 rounded-xl px-4 py-3 shadow-2xl shadow-black/60 text-xs min-w-[150px]">
      {label && (
        <p className="text-zinc-400 font-semibold mb-2 border-b border-white/10 pb-1.5">{label}</p>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: entry.color || entry.fill }} />
            <span className="text-zinc-400">{entry.name}</span>
          </div>
          <span className="text-white font-bold">
            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ── Per-chart empty state ───────────────────────────────────────────────── */
const ChartEmpty = ({ icon, message }) => (
  <div className="h-48 flex flex-col items-center justify-center gap-3">
    <MI icon={icon} className="text-4xl text-zinc-800" />
    <p className="text-zinc-600 text-xs text-center max-w-[220px] leading-relaxed">{message}</p>
  </div>
);

/* ── Chart card wrapper ──────────────────────────────────────────────────── */
const ChartCard = ({ icon, title, subtitle, children }) => (
  <div className="glass-panel rounded-2xl p-6">
    <div className="flex items-center gap-3 mb-5">
      <div className="w-8 h-8 bg-emerald-950/40 border border-emerald-800/30 rounded-lg flex items-center justify-center flex-shrink-0">
        <MI icon={icon} className="text-emerald-500 text-base" />
      </div>
      <div>
        <h3 className="text-white font-bold text-sm">{title}</h3>
        {subtitle && <p className="text-zinc-600 text-[10px] mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {children}
  </div>
);

/* ── AnalyticsPanel ──────────────────────────────────────────────────────── */
const AnalyticsPanel = ({ embedded = false }) => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    axiosClient.get('/api/report/analytics')
      .then(res  => setData(res.data))
      .catch(err => setError(err.response?.data?.message || 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="glass-panel rounded-2xl p-10">
      <LoadingSpinner message="Loading analytics…" />
    </div>
  );

  if (error) return (
    <div className="glass-panel rounded-2xl p-6 flex items-center gap-3 text-red-400 text-sm">
      <MI icon="error" className="text-xl flex-shrink-0" /> {error}
    </div>
  );

  if (!data) return null;

  const {
    supplierProgress = [],
    categoryStatus   = [],
    timeline         = [],
    ghg              = {},
  } = data;

  /* ── Donut data: BRSR category coverage ── */
  const verifiedCats   = categoryStatus.filter(c => c.verified   > 0).length;
  const inProgressCats = categoryStatus.filter(c => c.verified === 0 && (c.processing > 0 || c.pending > 0)).length;
  const notStartedCats = TOTAL_CATEGORIES - verifiedCats - inProgressCats;

  const donutData = [
    { name: 'Verified',    value: verifiedCats,   color: C.emerald },
    { name: 'In Progress', value: inProgressCats, color: C.orange  },
    { name: 'Not Started', value: notStartedCats, color: C.zinc    },
  ].filter(d => d.value > 0);

  /* ── GHG bar data ── */
  const ghgData = [
    { name: 'Scope 1', value: +(ghg.scope1 || 0).toFixed(2), color: C.emerald },
    { name: 'Scope 2', value: +(ghg.scope2 || 0).toFixed(2), color: C.cyan    },
    { name: 'Scope 3', value: +(ghg.scope3 || 0).toFixed(2), color: C.violet  },
  ];
  const hasGhg = ghgData.some(d => d.value > 0);

  /* Shared axis / grid props */
  const axisProps = { tick: { fill: C.tick, fontSize: 11 }, axisLine: false, tickLine: false };
  const gridProps = { strokeDasharray: '3 3', stroke: C.grid };

  return (
    <div className="space-y-5">

      {/* Section header — hidden when embedded inside CollapsibleSection */}
      {!embedded && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">ESG Analytics &amp; Insights</h2>
            <p className="text-zinc-500 text-sm mt-0.5">
              Live from your document vault · refreshes on page load
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-950/30 border border-emerald-900/30 px-3 py-1 rounded-full">
            Real data only
          </span>
        </div>
      )}

      {/* 2 × 2 chart grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── 1. Upload Activity AreaChart ───────────────────────────────── */}
        <ChartCard
          icon="timeline"
          title="Document Upload Activity"
          subtitle="Total uploads vs verified — last 6 months"
        >
          {timeline.length === 0 ? (
            <ChartEmpty icon="cloud_off" message="No documents uploaded yet. Upload your first document to see activity here." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={timeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradUploads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#52525b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#52525b" stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="gradVerified" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.emerald} stopOpacity={0.45} />
                    <stop offset="95%" stopColor={C.emerald} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month"   {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip content={<DarkTooltip />} />
                <Area
                  type="monotone" dataKey="uploads" name="Uploads"
                  stroke="#52525b" strokeWidth={1.5}
                  fill="url(#gradUploads)" dot={false}
                />
                <Area
                  type="monotone" dataKey="verified" name="Verified"
                  stroke={C.emerald} strokeWidth={2}
                  fill="url(#gradVerified)"
                  dot={{ r: 3, fill: C.emerald, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* ── 2. Category Coverage Donut ─────────────────────────────────── */}
        <ChartCard
          icon="donut_large"
          title="BRSR Category Coverage"
          subtitle={`${verifiedCats} of ${TOTAL_CATEGORIES} categories have ≥1 verified document`}
        >
          {categoryStatus.length === 0 ? (
            <ChartEmpty icon="folder_off" message="Upload and verify documents across BRSR categories to see coverage." />
          ) : (
            <>
              <div className="relative">
                <ResponsiveContainer width="100%" height={176}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%" cy="50%"
                      innerRadius={56} outerRadius={82}
                      paddingAngle={3} dataKey="value" strokeWidth={0}
                    >
                      {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={<DarkTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Centre label */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-3xl font-black text-white leading-none">{verifiedCats}</p>
                    <p className="text-zinc-500 text-[10px] mt-0.5">of {TOTAL_CATEGORIES}</p>
                  </div>
                </div>
              </div>
              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-4 mt-2">
                {donutData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-zinc-500 text-[10px]">{d.name} ({d.value})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>

        {/* ── 3. Supplier Verification Progress ─────────────────────────── */}
        <ChartCard
          icon="group"
          title="Supplier Document Status"
          subtitle="Per-supplier document verification breakdown"
        >
          {supplierProgress.length === 0 ? (
            <ChartEmpty icon="storefront" message="No supplier documents yet. Create Supplier accounts and ask them to upload ESG documents." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={supplierProgress}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                barSize={Math.max(16, Math.min(32, Math.floor(240 / supplierProgress.length)))}
              >
                <CartesianGrid {...gridProps} />
                <XAxis
                  dataKey="name"
                  {...axisProps}
                  tickFormatter={v => v.length > 10 ? `${v.slice(0, 10)}…` : v}
                />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="verified"   stackId="s" fill={C.emerald} name="Verified"   />
                <Bar dataKey="processing" stackId="s" fill={C.sky}     name="Processing" />
                <Bar dataKey="pending"    stackId="s" fill={C.orange}   name="Pending"   />
                <Bar dataKey="failed"     stackId="s" fill={C.red}      name="Failed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* ── 4. GHG Scope Emissions ─────────────────────────────────────── */}
        <ChartCard
          icon="co2"
          title="GHG Emissions Breakdown"
          subtitle="Scope 1, 2 &amp; 3 in tCO₂e · FY 2024-25"
        >
          {!hasGhg ? (
            <ChartEmpty icon="air" message="No GHG data yet. Verify electricity, fuel, and Scope 3 emission documents to populate." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ghgData} margin={{ top: 4, right: 4, left: -4, bottom: 0 }} barSize={52}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} unit=" t" />
                <Tooltip content={<DarkTooltip />} formatter={v => [`${v} tCO₂e`, '']} />
                <Bar dataKey="value" name="tCO₂e" radius={[6, 6, 0, 0]}>
                  {ghgData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

      </div>
    </div>
  );
};

export default AnalyticsPanel;
