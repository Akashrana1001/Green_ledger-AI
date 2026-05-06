import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MI from './MI';

const STEPS = [
  {
    icon: 'power_settings_new',
    label: 'Quit the background app',
    detail: 'Look at your Windows taskbar near the clock (bottom-right). Right-click the white Ollama alpaca icon and select',
    highlight: '"Quit Ollama"',
    code: null,
  },
  {
    icon: 'terminal',
    label: 'Open a fresh terminal',
    detail: 'Press',
    highlight: 'Win + R',
    detail2: ', type',
    highlight2: 'cmd',
    detail3: ', and press Enter. A brand-new Command Prompt window must open — do not reuse an existing one.',
    code: null,
  },
  {
    icon: 'lock_open',
    label: 'Disable CORS in that window',
    detail: 'Copy and run this command exactly — it tells Ollama to accept requests from any origin:',
    code: 'set OLLAMA_ORIGINS=*',
  },
  {
    icon: 'play_circle',
    label: 'Start the server (keep this window open!)',
    detail: 'In the same Command Prompt window, run:',
    code: 'ollama serve',
    codeNote: 'Leave this window open. Closing it stops the server.',
  },
];

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-400/70 hover:text-amber-300 transition-colors"
    >
      <MI icon={copied ? 'check' : 'content_copy'} className="text-[13px]" />
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
};

const OllamaConnectionError = ({ onRetry }) => {
  const [retrying, setRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState(null); // 'success' | 'fail' | null

  const handleRetry = async () => {
    setRetrying(true);
    setRetryResult(null);
    try {
      await onRetry();
      setRetryResult('success');
    } catch {
      setRetryResult('fail');
    } finally {
      setRetrying(false);
      setTimeout(() => setRetryResult(null), 3000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="glass-panel rounded-xl border border-amber-500/30 overflow-hidden shadow-[0_0_40px_-16px_rgba(245,158,11,0.5)]"
    >
      {/* Header band */}
      <div className="flex items-start gap-4 px-5 py-4 bg-amber-950/25 border-b border-amber-500/20">
        <motion.div
          animate={{ rotate: [0, -8, 8, -8, 0] }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/35 shrink-0 mt-0.5"
        >
          <MI icon="cable_off" className="text-amber-400 text-xl" fill />
        </motion.div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/80">
              Local Mode · Ollama
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/15 border border-amber-500/30 text-amber-300">
              Not Connected
            </span>
          </div>
          <h3 className="font-bold text-white text-sm">
            Ollama is not reachable on <code className="font-mono text-amber-300 text-[12px]">localhost:11434</code>
          </h3>
          <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
            The most common cause on Windows is that Ollama is running without CORS headers enabled.
            Browsers block these requests unless Ollama is started with the correct environment variable.
            Follow the 4-step fix below.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="px-5 py-4 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-400/80 mb-4">
          4-Step Fix
        </p>

        {STEPS.map((step, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.15 + idx * 0.08 }}
            className="flex gap-3.5"
          >
            {/* Step badge */}
            <div className="flex flex-col items-center shrink-0 pt-0.5">
              <div className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/35 flex items-center justify-center">
                <span className="text-[10px] font-black text-amber-400">{idx + 1}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className="w-px flex-1 mt-1.5 bg-amber-500/15 min-h-[12px]" />
              )}
            </div>

            {/* Step content */}
            <div className="pb-3 flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <MI icon={step.icon} className="text-amber-400/80 text-[15px]" fill />
                <span className="font-bold text-white text-[12px]">{step.label}</span>
              </div>
              <p className="text-zinc-400 text-xs leading-relaxed mb-1.5">
                {step.detail}
                {step.highlight && (
                  <span className="text-white font-semibold mx-1">{step.highlight}</span>
                )}
                {step.detail2}
                {step.highlight2 && (
                  <code className="text-amber-300 font-mono mx-1 text-[11px]">{step.highlight2}</code>
                )}
                {step.detail3}
              </p>
              {step.code && (
                <div className="mt-1.5 rounded-lg overflow-hidden border border-amber-500/20 bg-black/60">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-amber-950/40 border-b border-amber-500/15">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500/60" />
                      <span className="w-2 h-2 rounded-full bg-yellow-500/60" />
                      <span className="w-2 h-2 rounded-full bg-green-500/60" />
                      <span className="ml-2 text-[9px] text-zinc-500 font-mono uppercase tracking-widest">
                        Command Prompt
                      </span>
                    </div>
                    <CopyButton text={step.code} />
                  </div>
                  <div className="px-3.5 py-2.5 flex items-center gap-2">
                    <span className="text-amber-500/60 font-mono text-xs select-none">C:\&gt;</span>
                    <code className="text-amber-200 font-mono text-[12px] tracking-wide">
                      {step.code}
                    </code>
                  </div>
                  {step.codeNote && (
                    <div className="px-3.5 pb-2 flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                      <MI icon="info" className="text-[11px]" />
                      {step.codeNote}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Retry footer */}
      <div className="px-5 py-3.5 border-t border-amber-500/15 bg-black/30 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-[11px] text-zinc-500">
          After running <code className="font-mono text-amber-300/80 text-[10.5px]">ollama serve</code>, click retry below to verify the connection.
        </p>
        <div className="flex items-center gap-3">
          <AnimatePresence mode="wait">
            {retryResult === 'success' && (
              <motion.span
                key="ok"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-[11px] font-bold text-green-400"
              >
                <MI icon="check_circle" className="text-sm" fill />
                Connected!
              </motion.span>
            )}
            {retryResult === 'fail' && (
              <motion.span
                key="fail"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-[11px] font-bold text-red-400"
              >
                <MI icon="cancel" className="text-sm" fill />
                Still offline
              </motion.span>
            )}
          </AnimatePresence>

          <motion.button
            onClick={handleRetry}
            disabled={retrying}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/15 border border-amber-500/35 hover:bg-amber-500/25 text-amber-300 font-bold text-xs uppercase tracking-wider disabled:opacity-60 disabled:cursor-wait transition-all shadow-[0_0_18px_-6px_rgba(245,158,11,0.5)]"
          >
            <MI
              icon="refresh"
              className={`text-base ${retrying ? 'animate-spin' : ''}`}
            />
            {retrying ? 'Pinging…' : 'Retry Connection'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default OllamaConnectionError;
