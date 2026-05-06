/**
 * Scope3Network — Admin-only visualization of value-chain (Scope 3) suppliers.
 *
 * Renders a radial network graph (custom SVG) with the company at the center
 * and each supplier orbiting around it. Edge thickness is proportional to that
 * supplier's contribution to total Scope 3 emissions. Below the graph: a top-
 * emitters bar chart, plus a sortable supplier directory table.
 *
 * All numbers come from /api/scope3/suppliers — no mock data.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import MI from '../components/MI';

/* Semantic node color: red for top emitters, slate for zero, emerald otherwise */
const getNodeColor = (supplier, sortedSuppliers) => {
  if (supplier.scope3_tco2e === 0) return '#64748b'; // slate-500
  const topThreshold = Math.ceil(sortedSuppliers.length * 0.25);
  const rank = sortedSuppliers.findIndex(s => s.id === supplier.id);
  return rank < topThreshold ? '#f87171' : '#34d399'; // red-400 : emerald-400
};

/* ─── Radial supplier network — pure SVG, no external graph libs ─────────── */
const SupplierNetwork = ({ suppliers, totalScope3 }) => {
  const size   = 540;
  const center = size / 2;
  const radius = 200;

  const sortedByEmissions = useMemo(
    () => [...suppliers].sort((a, b) => b.scope3_tco2e - a.scope3_tco2e),
    [suppliers],
  );

  const nodes = useMemo(() => {
    if (!suppliers.length) return [];
    return suppliers.map((s, i) => {
      const angle = (i / suppliers.length) * 2 * Math.PI - Math.PI / 2;
      return {
        ...s,
        x:      center + radius * Math.cos(angle),
        y:      center + radius * Math.sin(angle),
        color:  getNodeColor(s, sortedByEmissions),
        weight: totalScope3 > 0 ? 1 + (s.scope3_tco2e / totalScope3) * 5 : 1,
      };
    });
  }, [suppliers, totalScope3, sortedByEmissions]);

  if (!suppliers.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="w-14 h-14 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center">
          <MI icon="hub" className="text-slate-400 text-2xl" />
        </div>
        <div>
          <p className="text-slate-300 text-sm font-semibold">No suppliers connected yet</p>
          <p className="text-slate-500 text-xs mt-1">Invite suppliers from the dashboard to start mapping your value chain.</p>
        </div>
        <button className="h-9 inline-flex items-center gap-2 rounded-md border border-slate-600 text-slate-200 bg-transparent hover:bg-slate-800 px-4 text-xs font-semibold transition-colors duration-200">
          + Commence Network Analysis
        </button>
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[560px] mx-auto">
      <defs>
        {/* Reduced glow by 50% vs previous version */}
        <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#10b981" stopOpacity="0.27" />
          <stop offset="60%"  stopColor="#10b981" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0"    />
        </radialGradient>
        {/* Institutional edge — no neon, just a faint slate line */}
        <linearGradient id="edgeGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#475569" stopOpacity="0.05" />
          <stop offset="50%"  stopColor="#64748b" stopOpacity="0.40" />
          <stop offset="100%" stopColor="#475569" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Reduced hub glow */}
      <circle cx={center} cy={center} r={radius + 30} fill="url(#hubGlow)" />

      {/* Orbit ring */}
      <circle cx={center} cy={center} r={radius}
        fill="none" stroke="rgba(100,116,139,0.15)" strokeDasharray="3 6" />

      {/* Connection lines — thickness = emission share */}
      {nodes.map((n) => (
        <line key={`edge-${n.id}`}
          x1={center} y1={center} x2={n.x} y2={n.y}
          stroke="url(#edgeGrad)"
          strokeWidth={n.weight}
          strokeLinecap="round"
          opacity={0.75}
        />
      ))}

      {/* Animated data-flow pulse */}
      {nodes.map((n, i) => (
        <circle key={`pulse-${n.id}`} r="2.5" fill={n.color} opacity="0.7">
          <animateMotion
            dur={`${3 + (i % 3)}s`}
            repeatCount="indefinite"
            path={`M ${center} ${center} L ${n.x} ${n.y}`}
          />
          <animate
            attributeName="opacity" values="0;0.8;0.8;0"
            dur={`${3 + (i % 3)}s`} repeatCount="indefinite"
          />
        </circle>
      ))}

      {/* Supplier nodes — color encodes compliance risk */}
      {nodes.map((n) => (
        <g key={`node-${n.id}`}>
          <circle cx={n.x} cy={n.y} r="14" fill="#1e293b" stroke={n.color} strokeWidth="1.5" />
          <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central"
            fill={n.color} fontSize="11" fontWeight="700">
            {(n.name || '?').slice(0, 2).toUpperCase()}
          </text>
          <text x={n.x} y={n.y + 30} textAnchor="middle"
            fill="rgba(248,250,252,0.55)" fontSize="9.5" fontWeight="500">
            {(n.name || 'Supplier').slice(0, 18)}
          </text>
          <text x={n.x} y={n.y + 43} textAnchor="middle"
            fill={n.color} fontSize="9" fontWeight="700">
            {n.scope3_tco2e > 0 ? `${n.scope3_tco2e} tCO₂e` : '—'}
          </text>
        </g>
      ))}

      {/* Central hub */}
      <circle cx={center} cy={center} r="42"
        fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.35)" strokeWidth="1.5" />
      <circle cx={center} cy={center} r="32"
        fill="#0f172a" stroke="rgba(16,185,129,0.25)" strokeWidth="1" />
      <text x={center} y={center - 4} textAnchor="middle"
        fill="#34d399" fontSize="10" fontWeight="800" letterSpacing="2">
        YOUR
      </text>
      <text x={center} y={center + 8} textAnchor="middle"
        fill="#f8fafc" fontSize="11" fontWeight="700">
        COMPANY
      </text>
    </svg>
  );
};

/* ─── Tooltip for the bar chart ──────────────────────────────────────────── */
const ChartTooltip = ({ active, payload, topEmitterSet }) => {
  if (!active || !payload?.length) return null;
  const d            = payload[0].payload;
  const isHighEmitter = topEmitterSet?.has(d.id);
  return (
    <div className="bg-slate-900 border border-slate-700 rounded px-3 py-2.5 text-xs min-w-[160px]">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-slate-50 font-semibold">{d.name}</span>
        {isHighEmitter && (
          <span className="bg-red-900/50 text-red-400 ring-1 ring-red-800/40 rounded-md px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap">
            High Emitter
          </span>
        )}
      </div>
      <div className="flex justify-between gap-6">
        <span className="text-slate-400">Scope 3</span>
        <span className="text-emerald-400 font-semibold tabular-nums">{d.scope3_tco2e} tCO₂e</span>
      </div>
      <div className="flex justify-between gap-6 mt-1">
        <span className="text-slate-400">Documents</span>
        <span className="text-slate-300 tabular-nums">{d.docCount}</span>
      </div>
    </div>
  );
};

/* ─── Page ───────────────────────────────────────────────────────────────── */
const Scope3Network = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ suppliers: [], totals: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    axiosClient.get('/api/scope3/suppliers')
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.message || 'Failed to load supplier graph'))
      .finally(() => setLoading(false));
  }, []);

  const { suppliers, totals } = data;
  const top10 = useMemo(
    () => [...(suppliers || [])]
      .sort((a, b) => b.scope3_tco2e - a.scope3_tco2e)
      .slice(0, 10),
    [suppliers],
  );
  // Top 25% of listed suppliers = "High Emitter" (red badge)
  const topEmitterSet = useMemo(() => {
    const cutoff = Math.ceil(top10.length * 0.25);
    return new Set(top10.slice(0, cutoff).map(s => s.id));
  }, [top10]);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50">

      {/* Top header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700/60 flex items-center px-6 gap-4">
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 ai-gradient-bg rounded-lg flex items-center justify-center">
            <MI icon="eco" className="text-white text-base" fill />
          </div>
          <span className="font-bold text-base tracking-tight">GreenLedger AI</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm ml-6">
          <Link to="/admin/dashboard" className="text-zinc-400 hover:text-white transition-colors">Dashboard</Link>
          <Link to="/admin/questionnaire" className="text-zinc-400 hover:text-white transition-colors">Compliance</Link>
          <span className="text-emerald-400 font-semibold border-b-2 border-emerald-500 pb-0.5">Scope 3 Network</span>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link to="/admin/war-room"
            className="hidden md:flex items-center gap-2 px-4 py-2 ai-gradient-bg rounded-lg text-sm font-bold hover:opacity-90 transition-opacity">
            <MI icon="visibility" className="text-base" /> AI War Room
          </Link>
          <button onClick={handleLogout}
            className="w-9 h-9 flex items-center justify-center text-zinc-500 hover:text-white border border-white/10 rounded-lg transition-colors">
            <MI icon="logout" className="text-xl" />
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="pt-24 px-6 md:px-10 pb-20 max-w-7xl mx-auto relative z-10">

        {/* Page heading */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold tracking-[0.22em] text-emerald-500 uppercase">Value Chain Analytics</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-950/50 border border-emerald-700/40 text-[9px] font-bold text-emerald-300 uppercase tracking-widest">Live</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">
            Scope 3 Supplier Network
          </h1>
          <p className="text-zinc-500 text-sm max-w-2xl leading-relaxed">
            Real-time map of your value-chain emissions. Each node is an active supplier;
            edge thickness scales with their contribution to total Scope 3 tCO₂e.
            Numbers come from supplier-uploaded documents — never the LLM.
          </p>
        </motion.div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm flex items-center gap-2">
            <MI icon="error" className="text-base" /> {error}
          </div>
        )}

        {loading && <LoadingSpinner message="Building supplier network…" />}

        {!loading && !error && totals && (
          <>
            {/* Hero stats */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10"
            >
              <StatCard
                icon="cloud" iconColor="text-emerald-400"
                label="Total Scope 3"
                value={totals.totalScope3 > 0 ? totals.totalScope3.toLocaleString() : '—'}
                unit="tCO₂e"
                accent="from-emerald-500 to-green-700"
              />
              <StatCard
                icon="hub" iconColor="text-cyan-400"
                label="Active Suppliers"
                value={totals.supplierCount}
                unit="connected"
                accent="from-cyan-500 to-blue-700"
              />
              <StatCard
                icon="trending_up" iconColor="text-orange-400"
                label="Top Emitter"
                value={totals.topEmitter?.name?.split(' ')[0] || '—'}
                unit={totals.topEmitter ? `${totals.topEmitter.scope3_tco2e} tCO₂e` : 'no data'}
                accent="from-orange-500 to-amber-700"
              />
              <StatCard
                icon="verified" iconColor="text-emerald-400"
                label="Verified Submissions"
                value={`${totals.verifiedPct}%`}
                unit={`${totals.verifiedDocs} of ${totals.totalDocs} docs`}
                accent="from-emerald-500 to-green-700"
              />
            </motion.div>

            {/* Network graph */}
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="gl-card p-8 md:p-10 mb-10"
            >
              <div className="flex items-start justify-between mb-6 gap-4">
                <div>
                  <h2 className="text-base font-semibold leading-6 text-slate-50">Value Chain Map</h2>
                  <p className="text-slate-500 text-xs mt-1">
                    Node color encodes compliance risk — red = high emitter, slate = zero emissions
                  </p>
                </div>
                <div className="hidden md:flex items-center gap-4 text-xs flex-shrink-0">
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <span className="w-2 h-2 rounded-sm bg-red-400" /> High Emitter
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <span className="w-2 h-2 rounded-sm bg-emerald-400" /> Active
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <span className="w-2 h-2 rounded-sm bg-slate-500" /> Zero emissions
                  </span>
                </div>
              </div>
              <SupplierNetwork suppliers={suppliers} totalScope3={totals.totalScope3} />
              {totals.totalScope3 === 0 && suppliers.length > 0 && (
                <div className="mt-6 flex justify-center">
                  <button className="h-9 inline-flex items-center gap-2 rounded-md border border-slate-600 text-slate-200 bg-transparent hover:bg-slate-800 px-4 text-xs font-semibold transition-colors duration-200">
                    + Commence Network Analysis
                  </button>
                </div>
              )}
            </motion.div>

            {/* Top emitters bar chart */}
            {top10.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.25 }}
                className="gl-card p-6 md:p-8 mb-10"
              >
                <div className="mb-5">
                  <h2 className="text-base font-semibold leading-6 text-slate-50">Top Emitters</h2>
                  <p className="text-slate-500 text-xs mt-1">Suppliers ranked by Scope 3 contribution · top 25% flagged High Emitter</p>
                </div>
                <div style={{ width: '100%', height: 56 + top10.length * 32 }}>
                  <ResponsiveContainer>
                    <BarChart data={top10} layout="vertical"
                      margin={{ top: 8, right: 32, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,0.20)" horizontal={false} />
                      <XAxis type="number"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        axisLine={{ stroke: 'rgba(71,85,105,0.30)' }}
                        tickLine={false} />
                      <YAxis type="category" dataKey="name" width={150}
                        tick={{ fill: '#cbd5e1', fontSize: 11 }}
                        axisLine={{ stroke: 'rgba(71,85,105,0.30)' }}
                        tickLine={false} />
                      <Tooltip
                        content={<ChartTooltip topEmitterSet={topEmitterSet} />}
                        cursor={{ fill: 'rgba(71,85,105,0.08)' }}
                      />
                      <Bar dataKey="scope3_tco2e" radius={[0, 4, 4, 0]}>
                        {top10.map((s) => (
                          <Cell
                            key={s.id}
                            fill={topEmitterSet.has(s.id) ? '#f87171' : '#34d399'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}

            {/* Supplier directory table */}
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 }}
              className="gl-card overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold leading-6 text-slate-50">Supplier Directory</h2>
                  <p className="text-slate-500 text-xs">{suppliers.length} active partner{suppliers.length !== 1 ? 's' : ''}</p>
                </div>
                <Link to="/admin/dashboard"
                  className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1">
                  Manage in Dashboard <MI icon="arrow_forward" className="text-sm" />
                </Link>
              </div>

              {suppliers.length === 0 ? (
                <EmptyState icon={() => <MI icon="hub" className="text-4xl text-slate-600" />}
                  title="No suppliers connected"
                  message="Invite suppliers from the Admin Dashboard to start collecting Scope 3 data." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-900/60">
                      <tr className="border-b border-slate-700 text-slate-500 text-xs uppercase tracking-wider">
                        <th className="px-6 py-3 text-left">Supplier</th>
                        <th className="px-6 py-3 text-left">Email</th>
                        <th className="px-6 py-3 text-right">Scope 3 (tCO₂e)</th>
                        <th className="px-6 py-3 text-right">Water (KL)</th>
                        <th className="px-6 py-3 text-right">Waste (MT)</th>
                        <th className="px-6 py-3 text-right">Docs</th>
                        <th className="px-6 py-3 text-left">Last Activity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40">
                      {[...suppliers].sort((a, b) => b.scope3_tco2e - a.scope3_tco2e).map((s) => {
                        const nodeColor = getNodeColor(s, [...suppliers].sort((a, b) => b.scope3_tco2e - a.scope3_tco2e));
                        const isHighEmitter = topEmitterSet.has(s.id);
                        return (
                          <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-md flex items-center justify-center font-bold text-xs flex-shrink-0"
                                  style={{
                                    background: `${nodeColor}18`,
                                    color: nodeColor,
                                    border: `1px solid ${nodeColor}40`,
                                  }}>
                                  {(s.name?.[0] || '?').toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-slate-50 font-medium">{s.name}</p>
                                    {isHighEmitter && (
                                      <span className="bg-red-900/50 text-red-400 ring-1 ring-red-800/40 rounded-md px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap">
                                        High Emitter
                                      </span>
                                    )}
                                  </div>
                                  {s.designation && <p className="text-slate-600 text-[11px]">{s.designation}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-400">{s.email}</td>
                            <td className="px-6 py-4 text-right">
                              <span className={`font-semibold tabular-nums ${isHighEmitter ? 'text-red-400' : 'text-emerald-400'}`}>
                                {s.scope3_tco2e.toLocaleString()}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right text-slate-400 tabular-nums">{s.water_kl.toLocaleString()}</td>
                            <td className="px-6 py-4 text-right text-slate-400 tabular-nums">{s.waste_mt.toLocaleString()}</td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-slate-300 tabular-nums">{s.verifiedCount}</span>
                              <span className="text-slate-600">/{s.docCount}</span>
                            </td>
                            <td className="px-6 py-4 text-slate-600 text-xs">
                              {s.lastActivity ? new Date(s.lastActivity).toLocaleDateString('en-IN') : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
};

/* ─── Stat card ──────────────────────────────────────────────────────────── */
const StatCard = ({ icon, iconColor, label, value, unit }) => (
  <div className="gl-card p-5">
    <div className="flex items-center justify-between mb-3">
      <p className="gl-overline">{label}</p>
      <MI icon={icon} className={`${iconColor} text-xl`} />
    </div>
    <p className="text-2xl font-bold text-slate-50 mb-1 tabular-nums">{value}</p>
    <p className="text-slate-500 text-xs">{unit}</p>
  </div>
);

export default Scope3Network;
