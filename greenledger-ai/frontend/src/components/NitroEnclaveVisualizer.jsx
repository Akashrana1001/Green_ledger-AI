import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MI from './MI';

const BOOT_SEQUENCE = [
  { id: 'vsock',  prefix: '[ENCLAVE]',     text: 'Booting isolated VSock environment...'              },
  { id: 'vcpu',   prefix: '[VCPU]',        text: 'Allocating 4 dedicated vCPUs & 16GB RAM...'         },
  { id: 'iam',    prefix: '[IAM]',         text: 'Assuming role: AWSReservedSSO_Bedrock-Limited...'   },
  { id: 'pcr0',   prefix: '[ATTESTATION]', text: 'Generating Nitro Enclave PCR0 Hash...'              },
];

const STEP_INTERVAL_MS = 1100;
const TYPE_SPEED_MS    = 20;
const HASH_DELAY_MS    = 500;
const SEAL_DELAY_MS    = 1500;

/** AWS Nitro Enclave PCRs are SHA-384 → 48 bytes → 96 hex chars. */
const generatePcr0Hash = () => {
  const bytes = new Uint8Array(48);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 48; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
};

/** Split 96-char hex into 3 lines of 32 chars for terminal display. */
const splitHashLines = (hex) => [
  hex.slice(0, 32),
  hex.slice(32, 64),
  hex.slice(64, 96),
];

const TypedLine = ({ prefix, text, onDone }) => {
  const [shown, setShown] = useState('');
  const doneRef = useRef(false);
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(t);
        if (!doneRef.current) {
          doneRef.current = true;
          onDone?.();
        }
      }
    }, TYPE_SPEED_MS);
    return () => clearInterval(t);
  }, [text, onDone]);

  const isTyping = shown.length < text.length;
  return (
    <div className="flex items-start gap-2 font-mono text-[11px] leading-relaxed">
      <span className="text-emerald-500/60 shrink-0 font-bold">{prefix}</span>
      <span className="text-emerald-300/95">
        {shown}
        {isTyping && <span className="text-emerald-400 animate-pulse">▍</span>}
        {!isTyping && <span className="ml-1 text-emerald-500/70">✓</span>}
      </span>
    </div>
  );
};

const NitroEnclaveVisualizer = ({ isProcessing }) => {
  const [stepCount, setStepCount] = useState(0);
  const [hash, setHash] = useState('');
  const [sealed, setSealed] = useState(false);

  useEffect(() => {
    if (!isProcessing) {
      setStepCount(0);
      setHash('');
      setSealed(false);
      return;
    }

    setStepCount(1);
    setHash('');
    setSealed(false);
    const timers = [];

    BOOT_SEQUENCE.slice(1).forEach((_, idx) => {
      timers.push(setTimeout(() => {
        setStepCount(c => Math.max(c, idx + 2));
      }, (idx + 1) * STEP_INTERVAL_MS));
    });

    timers.push(setTimeout(() => {
      setHash(generatePcr0Hash());
    }, BOOT_SEQUENCE.length * STEP_INTERVAL_MS + HASH_DELAY_MS));

    timers.push(setTimeout(() => {
      setSealed(true);
    }, BOOT_SEQUENCE.length * STEP_INTERVAL_MS + SEAL_DELAY_MS));

    return () => timers.forEach(clearTimeout);
  }, [isProcessing]);

  const visibleSteps = BOOT_SEQUENCE.slice(0, stepCount);
  const hashLines = hash ? splitHashLines(hash) : [];

  const dotClass = isProcessing
    ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)] animate-pulse'
    : 'bg-emerald-500/40';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="glass-panel rounded-xl overflow-hidden border border-emerald-700/30 shadow-[0_0_32px_-12px_rgba(16,185,129,0.45)] backdrop-blur-xl"
    >
      {/* Terminal chrome */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-black/70 border-b border-emerald-700/25">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <div className="flex items-center gap-2 ml-2">
            <span className={`w-2 h-2 rounded-full ${dotClass}`} />
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-emerald-300/95 font-bold">
              AWS Nitro Enclave: {isProcessing ? 'Active' : 'Idle'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-500/70">
          <MI icon="shield_lock" className="text-sm" fill />
          vsock://enclave-cid-16
        </div>
      </div>

      {/* Terminal body */}
      <div className="bg-black/85 px-5 py-4 min-h-[220px] font-mono">
        {!isProcessing && stepCount === 0 && (
          <div className="flex items-center gap-2 text-[11px] text-emerald-500/45">
            <MI icon="lock" className="text-sm" />
            Enclave standing by — awaiting document stream.
          </div>
        )}

        <div className="space-y-1.5">
          <AnimatePresence>
            {visibleSteps.map(step => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
              >
                <TypedLine prefix={step.prefix} text={step.text} />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* PCR0 hash output */}
          <AnimatePresence>
            {hash && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
                className="mt-4 pt-3 border-t border-emerald-700/20"
              >
                <div className="flex items-center gap-2 mb-2">
                  <MI icon="fingerprint" className="text-emerald-400 text-sm" fill />
                  <span className="text-[10px] uppercase tracking-[0.15em] text-emerald-400 font-bold">
                    PCR0 (Application Image Hash):
                  </span>
                  <span className="text-[9px] uppercase tracking-widest text-emerald-500/60 font-mono ml-auto">
                    SHA-384 · 384 bits
                  </span>
                </div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.15 }}
                  className="bg-emerald-950/40 border border-emerald-500/25 rounded-md px-3 py-2.5 shadow-[inset_0_0_18px_-6px_rgba(16,185,129,0.45)]"
                >
                  {hashLines.map((line, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.2 + i * 0.12 }}
                      className="flex gap-3 items-center"
                    >
                      <span className="text-emerald-600/60 text-[9px] font-bold w-6 text-right select-none">
                        {(i * 32).toString().padStart(3, '0')}
                      </span>
                      <span className="text-[11px] tracking-wider text-emerald-300 font-mono">
                        {line}
                      </span>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sealed connection badge */}
          <AnimatePresence>
            {sealed && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="mt-4 flex items-center gap-2.5 px-3.5 py-2 rounded-lg bg-emerald-900/35 border border-emerald-500/40 shadow-[0_0_28px_-6px_rgba(16,185,129,0.6)] w-fit"
              >
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400/50"
                >
                  <MI icon="lock" className="text-emerald-300 text-[13px]" fill />
                </motion.div>
                <span className="font-mono text-[11px] font-bold text-emerald-300 tracking-wide">
                  Connection to Claude 3.5 Sonnet:
                </span>
                <span className="font-mono text-[11px] font-black text-emerald-200 tracking-[0.15em] uppercase">
                  Secured
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default NitroEnclaveVisualizer;
