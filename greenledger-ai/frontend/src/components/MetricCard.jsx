import ComplianceBadge from './ComplianceBadge';

export default function MetricCard({ label, value, suffix, status = 'analyzing', sublabel }) {
  return (
    <article className="flex flex-col rounded-lg border border-slate-700 bg-slate-800 p-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </h3>
        <ComplianceBadge status={status} />
      </header>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold tracking-tight tabular-nums text-slate-50">
            {value}
          </span>
          {suffix && (
            <span className="text-sm font-medium text-slate-400">{suffix}</span>
          )}
        </div>
        {sublabel && (
          <p className="text-xs leading-5 text-slate-400">{sublabel}</p>
        )}
      </div>
    </article>
  );
}
