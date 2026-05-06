import { useEffect, useRef, useState } from 'react';
import { Cpu } from 'lucide-react';

const DEFAULT_LOGS = [
  'Loading qwen3:4b into VRAM…',
  'Parsing unstructured MSME ledger…',
  'Extracting Scope 2 emission factors (CEA grid)…',
  'Cross-referencing GSTIN with MSME registry…',
  'Calculating Principle 8 metrics…',
  'Validating wage parity (Principle 5)…',
  'Reconciling related-party disclosures…',
  'Sealing audit hash inside enclave…',
];

const SKELETON_WIDTHS = ['w-full', 'w-11/12', 'w-9/12', 'w-10/12', 'w-7/12'];

export default function AIAnalysisLoader({
  logs = DEFAULT_LOGS,
  title = 'AI Analysis in Progress',
  subtitle = 'Local model running inside attested enclave · do not refresh',
  intervalMs = 1500,
  historyLength = 5,
}) {
  const [history, setHistory] = useState(() => [logs[0]]);
  const cursor = useRef(1);

  useEffect(() => {
    setHistory([logs[0]]);
    cursor.current = 1;
    const tick = setInterval(() => {
      setHistory(prev => {
        const next = logs[cursor.current % logs.length];
        cursor.current += 1;
        return [...prev.slice(-(historyLength - 1)), next];
      });
    }, intervalMs);
    return () => clearInterval(tick);
  }, [logs, intervalMs, historyLength]);

  return (
    <section
      className="rounded-lg border border-slate-700 bg-slate-800 p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <header className="mb-6 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-slate-900 ring-1 ring-slate-700">
          <Cpu className="h-4 w-4 text-emerald-400 animate-pulse" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-6 text-slate-50">{title}</h2>
          <p className="text-xs leading-5 text-slate-400">{subtitle}</p>
        </div>
      </header>

      <div className="space-y-3" aria-hidden="true">
        {SKELETON_WIDTHS.map((w, i) => (
          <div key={i} className={`h-3 rounded bg-slate-700/70 animate-pulse ${w}`} />
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-md border border-slate-700 bg-slate-950">
        <div className="flex items-center gap-1.5 border-b border-slate-800 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            enclave://stdout
          </span>
        </div>
        <pre className="px-4 py-3 font-mono text-xs leading-5 text-emerald-400">
          {history.map((line, i) => {
            const isLast = i === history.length - 1;
            return (
              <div key={`${i}-${line}`} className={isLast ? '' : 'opacity-60'}>
                <span className="text-slate-600">$ </span>
                {line}
                {isLast && (
                  <span
                    className="ml-1 inline-block h-3 w-1.5 align-middle bg-emerald-400 animate-pulse"
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </pre>
      </div>
    </section>
  );
}
