/**
 * Design preview page — NOT a production dashboard.
 * Wires AIAnalysisLoader + MetricCard + ComplianceBadge together with a
 * 5-second timer so design reviewers can see the loading→results transition.
 * Real dashboard data must come from the API (see AdminDashboard.jsx).
 */
import { useEffect, useState } from 'react';
import { Play, RefreshCw } from 'lucide-react';
import AIAnalysisLoader from '../components/AIAnalysisLoader';
import MetricCard from '../components/MetricCard';

const SAMPLE_RESULTS = [
  {
    label: 'MSME Procurement %',
    value: '42.7',
    suffix: '%',
    status: 'compliant',
    sublabel: 'FY25 spend on MSME vendors · target ≥ 25%',
  },
  {
    label: 'Female Wage Parity',
    value: '88.4',
    suffix: '%',
    status: 'compliant',
    sublabel: 'Female wages / total wages',
  },
  {
    label: 'Scope 2 Intensity',
    value: '14.2',
    suffix: 'tCO₂e/Cr',
    status: 'non-compliant',
    sublabel: 'Threshold: 10.0 tCO₂e per ₹ Crore PPP',
  },
  {
    label: 'Water Recycled %',
    value: '—',
    status: 'analyzing',
    sublabel: 'Awaiting Plant 3 utility ledger',
  },
];

export default function ComplianceAuditPreview() {
  const [phase, setPhase] = useState('analyzing');

  useEffect(() => {
    if (phase !== 'analyzing') return;
    const t = setTimeout(() => setPhase('results'), 5000);
    return () => clearTimeout(t);
  }, [phase]);

  const isAnalyzing = phase === 'analyzing';

  return (
    <main className="min-h-screen bg-slate-900 text-slate-50">
      <div className="mx-auto max-w-6xl px-8 py-10">
        <header className="mb-8 flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold leading-8 tracking-tight text-slate-50">
              Compliance Audit Preview
            </h1>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              SEBI BRSR Core · FY 2025-26 · Q1 cycle
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPhase('analyzing')}
            disabled={isAnalyzing}
            className="inline-flex h-11 items-center gap-2 rounded-md bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-600/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                Running…
              </>
            ) : (
              <>
                <Play className="h-4 w-4" aria-hidden="true" />
                Re-run analysis
              </>
            )}
          </button>
        </header>

        {isAnalyzing ? (
          <AIAnalysisLoader />
        ) : (
          <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SAMPLE_RESULTS.map(r => (
              <MetricCard key={r.label} {...r} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
