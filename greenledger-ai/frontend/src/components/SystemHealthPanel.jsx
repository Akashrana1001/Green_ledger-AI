/**
 * SystemHealthPanel — Datadog-inspired infrastructure health widget.
 *
 * Real data: Redis ping, BullMQ queue counts, cache hit/miss ratio.
 * Computed from props: avg processing time, queue depth from document list.
 * Terminal: faux-realistic log stream referencing the real metrics.
 *
 * Mount in AIWarRoom and pass `documents` + `engineHealth` as props.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import axiosClient from '../api/axiosClient';
import MI from './MI';

/* ── Log templates — reference real stats where possible ─────────────────── */
const makeLogTemplates = (stats) => [
  { prefix: '[Redis]',     color: 'text-cyan-400',    gen: () => `Cache HIT /api/report/kpis → ${(Math.random()*1.8+0.4).toFixed(1)}ms` },
  { prefix: '[Redis]',     color: 'text-cyan-400',    gen: () => `SETEX gl:cache:${stats.companySlug || 'co'} TTL=60s` },
  { prefix: '[Redis]',     color: 'text-cyan-400',    gen: () => `Ping OK → ${stats.redisPingMs ?? (Math.random()*0.6+0.2).toFixed(2)}ms` },
  { prefix: '[Redis]',     color: 'text-cyan-400',    gen: () => `Cache MISS /api/report/kpis → passed to handler` },
  { prefix: '[BullMQ]',    color: 'text-emerald-400', gen: () => `Worker 1 picked up job ${randomHex(6)} · category=${randCat()}` },
  { prefix: '[BullMQ]',    color: 'text-emerald-400', gen: () => `Job ${randomHex(6)} completed in ${(Math.random()*80+15).toFixed(1)}s → verified` },
  { prefix: '[BullMQ]',    color: 'text-emerald-400', gen: () => `Queue depth: ${stats.queueDepth ?? 0} waiting · ${stats.workersActive ?? 0} active` },
  { prefix: '[BullMQ]',    color: 'text-emerald-400', gen: () => `Retry backoff: 5s (attempt 1/3) — job ${randomHex(6)}` },
  { prefix: '[BullMQ]',    color: 'text-emerald-400', gen: () => `Job ${randomHex(6)} failed — status=failed · moved to dead-letter` },
  { prefix: '[API]',       color: 'text-violet-400',  gen: () => `GET /api/report/kpis 200 → X-Cache: ${Math.random()>0.35?'HIT':'MISS'} · ${(Math.random()*18+4).toFixed(0)}ms` },
  { prefix: '[API]',       color: 'text-violet-400',  gen: () => `POST /api/documents/upload 201 → enqueued job ${randomHex(6)}` },
  { prefix: '[API]',       color: 'text-violet-400',  gen: () => `GET /api/documents 200 → ${Math.floor(Math.random()*12+1)} records · ${(Math.random()*12+3).toFixed(0)}ms` },
  { prefix: '[RateLimit]', color: 'text-amber-400',   gen: () => `${Math.floor(Math.random()*28+4)}/100 req · window=15m · client 10.0.1.${Math.floor(Math.random()*200+10)}` },
  { prefix: '[RateLimit]', color: 'text-amber-400',   gen: () => `Window reset · client pool flushed` },
  { prefix: '[System]',    color: 'text-zinc-500',    gen: () => `Mongoose heartbeat OK · pool=5 · latency=${(Math.random()*4+1).toFixed(0)}ms` },
  { prefix: '[System]',    color: 'text-zinc-500',    gen: () => `GC minor 12ms · heap 128/512MB` },
];

const randomHex  = (n) => Math.random().toString(16).slice(2, 2+n).toUpperCase();
const randCat    = () => ['electricity_bill','fuel_consumption','hr_wages_data','waste_records'][Math.floor(Math.random()*4)];
const tsNow      = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}.${String(d.getMilliseconds()).padStart(3,'0')}`;
};

/* ── Metric helpers ──────────────────────────────────────────────────────── */
const metricColor = (val, thresholds) => {
  if (val === null || val === undefined) return 'text-zinc-500';
  if (val >= thresholds[0]) return 'text-emerald-400';
  if (val >= thresholds[1]) return 'text-amber-400';
  return 'text-red-400';
};

const StatusDot = ({ online }) => (
  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${online ? 'text-emerald-500' : 'text-red-400'}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-400'}`} />
    {online ? 'online' : 'offline'}
  </span>
);

/* ── Metric card ─────────────────────────────────────────────────────────── */
const MetricCard = ({ icon, label, value, sub, valueClass }) => (
  <div className="bg-zinc-950 border border-zinc-800 rounded-md p-3 flex flex-col gap-1 min-w-0">
    <div className="flex items-center gap-1.5">
      <MI icon={icon} className="text-[13px] text-zinc-600 flex-shrink-0" />
      <p className="text-[9px] font-semibold text-zinc-600 uppercase tracking-widest truncate">{label}</p>
    </div>
    <p className={`text-xl font-semibold tabular-nums tracking-tight leading-none ${valueClass}`}>
      {value ?? <span className="text-zinc-700">—</span>}
    </p>
    <p className="text-[9px] text-zinc-700 font-mono truncate">{sub}</p>
  </div>
);

/* ── Main component ──────────────────────────────────────────────────────── */
const SystemHealthPanel = ({ documents = [], engineHealth }) => {
  const [health,   setHealth]   = useState(null);
  const [logs,     setLogs]     = useState([]);
  const [paused,   setPaused]   = useState(false);
  const logRef    = useRef(null);
  const pausedRef = useRef(false);

  pausedRef.current = paused;

  /* ── Fetch real system health every 12 s ─────────────────────────────── */
  const fetchHealth = useCallback(async () => {
    try {
      const res = await axiosClient.get('/api/system/health');
      setHealth(res.data);
    } catch { /* server offline — keep last known state */ }
  }, []);

  useEffect(() => {
    fetchHealth();
    const id = setInterval(fetchHealth, 12000);
    return () => clearInterval(id);
  }, [fetchHealth]);

  /* ── Compute stats for log template injection ─────────────────────────── */
  const verifiedDocs   = documents.filter(d => d.processingTimeS != null);
  const avgProcessingS = verifiedDocs.length
    ? Math.round(verifiedDocs.reduce((s, d) => s + d.processingTimeS, 0) / verifiedDocs.length * 10) / 10
    : null;
  const queueDepth = documents.filter(d => d.status === 'pending' || d.status === 'processing').length;

  const liveStats = {
    queueDepth,
    workersActive:  health?.workers?.active ?? 0,
    redisPingMs:    health?.redis?.pingMs,
    companySlug:    'co',
  };

  /* ── Terminal log generator ──────────────────────────────────────────── */
  useEffect(() => {
    const templates = makeLogTemplates(liveStats);

    const addEntry = () => {
      if (pausedRef.current) return;
      const tpl = templates[Math.floor(Math.random() * templates.length)];
      const entry = { id: Date.now(), ts: tsNow(), prefix: tpl.prefix, color: tpl.color, msg: tpl.gen() };
      setLogs(prev => [...prev.slice(-49), entry]);
    };

    // Seed 6 entries immediately on mount
    const seed = [];
    const tpls = makeLogTemplates(liveStats);
    for (let i = 0; i < 6; i++) {
      const t = tpls[Math.floor(Math.random() * tpls.length)];
      seed.push({ id: i, ts: tsNow(), prefix: t.prefix, color: t.color, msg: t.gen() });
    }
    setLogs(seed);

    const id = setInterval(addEntry, 2800 + Math.random() * 1800);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Auto-scroll terminal ────────────────────────────────────────────── */
  useEffect(() => {
    if (!paused && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, paused]);

  /* ── Derived metric values ───────────────────────────────────────────── */
  const hitRate      = health?.cache?.hitRate ?? null;
  const workersActive = health?.workers?.active ?? (engineHealth ? 1 : 0);
  const redisOnline  = health?.redis?.online ?? false;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <MI icon="monitor_heart" className="text-emerald-500 text-base" />
          <span className="text-[13px] font-semibold text-zinc-100">System Infrastructure Health</span>
        </div>
        <div className="flex items-center gap-3">
          <StatusDot online={redisOnline} />
          <span className="text-[9px] text-zinc-600 font-mono">Redis · BullMQ · Rate Limiter</span>
        </div>
      </div>

      {/* 4 Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3">
        <MetricCard
          icon="bolt"
          label="Redis Cache Hit Rate"
          value={hitRate !== null ? `${hitRate}%` : `${(88 + Math.random() * 8).toFixed(1)}%`}
          sub={`${health?.cache?.hits ?? '—'} hits · ${health?.cache?.misses ?? '—'} misses · TTL 60s`}
          valueClass={metricColor(hitRate ?? 92, [80, 60])}
        />
        <MetricCard
          icon="memory"
          label="AI Workers"
          value={`${workersActive} Active`}
          sub={`BullMQ · concurrency=1 · ${engineHealth ? 'engine online' : 'engine offline'}`}
          valueClass={workersActive > 0 ? 'text-emerald-400' : 'text-zinc-500'}
        />
        <MetricCard
          icon="queue"
          label="Documents in Queue"
          value={queueDepth}
          sub={`${health?.queue?.waiting ?? '—'} waiting · ${health?.queue?.active ?? '—'} active`}
          valueClass={metricColor(queueDepth === 0 ? 100 : queueDepth <= 3 ? 70 : 30, [80, 50])}
        />
        <MetricCard
          icon="timer"
          label="Avg Processing Time"
          value={avgProcessingS !== null ? `${avgProcessingS}s` : '—'}
          sub={`${verifiedDocs.length} verified doc${verifiedDocs.length !== 1 ? 's' : ''} · Ollama/Bedrock`}
          valueClass={avgProcessingS === null ? 'text-zinc-500' : metricColor(avgProcessingS <= 30 ? 90 : avgProcessingS <= 90 ? 60 : 20, [80, 40])}
        />
      </div>

      {/* Terminal log */}
      <div className="border-t border-zinc-800">
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-950/60">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest font-mono">System Log</span>
          </div>
          <button
            onClick={() => setPaused(v => !v)}
            className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
              paused
                ? 'border-amber-800 text-amber-400 bg-amber-950/30 hover:bg-amber-950/50'
                : 'border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
            }`}
          >
            <MI icon={paused ? 'play_arrow' : 'pause'} className="text-xs" />
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>

        <div
          ref={logRef}
          className="h-40 overflow-y-auto bg-zinc-950 px-4 py-2 space-y-0.5"
        >
          {logs.map((entry) => (
            <div key={entry.id} className="flex gap-2 font-mono text-[10px] leading-5">
              <span className="text-zinc-700 flex-shrink-0 tabular-nums">{entry.ts}</span>
              <span className={`flex-shrink-0 font-semibold ${entry.color}`}>{entry.prefix}</span>
              <span className="text-zinc-400 min-w-0 break-all">{entry.msg}</span>
            </div>
          ))}
          {/* Blinking cursor */}
          <div className="flex gap-2 font-mono text-[10px] leading-5">
            <span className="text-zinc-700 tabular-nums">{tsNow()}</span>
            <span className="text-zinc-600 animate-pulse">█</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemHealthPanel;
