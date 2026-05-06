/**
 * EsgChatWidget — "Chat with your ESG Report"
 *
 * Floating chat bubble (fixed bottom-right). Click to open a sliding panel.
 * Sends questions to POST /api/chat/ask which injects the company's live
 * KpiResult as context → routes to Ollama or Bedrock depending on settings.
 *
 * No RAG needed — the full KpiResult JSON fits in one context window.
 */
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../api/axiosClient';
import MI from './MI';

const STARTERS = [
  'How can we reduce our Scope 2 emissions?',
  'What is our biggest ESG risk right now?',
  'How does our female wage parity compare to the target?',
  'What steps improve our governance score?',
  'How can we increase our renewable energy %?',
];

const TypingDots = () => (
  <div className="flex items-center gap-1 px-3 py-2">
    {[0, 1, 2].map(i => (
      <span
        key={i}
        className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"
        style={{ animationDelay: `${i * 0.15}s` }}
      />
    ))}
  </div>
);

const EsgChatWidget = () => {
  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState([]);   // [{ role: 'user'|'ai', text }]
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Auto-scroll on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const send = async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;

    setMessages(m => [...m, { role: 'user', text: q }]);
    setInput('');
    setLoading(true);

    try {
      const res = await axiosClient.post('/api/chat/ask', { question: q });
      setMessages(m => [...m, { role: 'ai', text: res.data.answer }]);
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong. Is the AI engine running?';
      setMessages(m => [...m, { role: 'ai', text: `⚠️ ${msg}`, error: true }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const isEmpty = messages.length === 0;

  return (
    <>
      {/* ── Chat panel ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed bottom-24 right-6 z-50 w-[360px] max-h-[580px] bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-900 flex-shrink-0">
              <div className="w-7 h-7 rounded-lg ai-gradient-bg flex items-center justify-center flex-shrink-0">
                <MI icon="chat" className="text-white text-sm" fill />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white">ESG Advisor</p>
                <p className="text-[9px] text-zinc-500">Powered by your verified KPI data</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-white transition-colors rounded-lg hover:bg-white/5"
              >
                <MI icon="close" className="text-sm" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {isEmpty && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full ai-gradient-bg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MI icon="eco" className="text-white text-xs" fill />
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg rounded-tl-sm px-3 py-2.5 text-xs text-zinc-300 leading-relaxed max-w-[85%]">
                      Hi! I'm your ESG advisor. Ask me anything about your SEBI BRSR compliance data.
                    </div>
                  </div>
                  {/* Starter chips */}
                  <div className="flex flex-col gap-1.5 pl-8">
                    {STARTERS.map(s => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        disabled={loading}
                        className="text-left text-[10px] text-emerald-400 border border-emerald-700/30 bg-emerald-950/20 hover:bg-emerald-950/40 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {m.role === 'ai' && (
                    <div className="w-6 h-6 rounded-full ai-gradient-bg flex items-center justify-center flex-shrink-0 mb-0.5">
                      <MI icon="eco" className="text-white text-xs" fill />
                    </div>
                  )}
                  <div
                    className={`max-w-[82%] px-3 py-2 rounded-md text-xs leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-emerald-900/40 border border-emerald-800 text-zinc-100 rounded-br-none'
                        : m.error
                          ? 'bg-red-950/30 border border-red-900 text-red-300 rounded-bl-none'
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-none'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-end gap-2">
                  <div className="w-6 h-6 rounded-full ai-gradient-bg flex items-center justify-center flex-shrink-0 mb-0.5">
                    <MI icon="eco" className="text-white text-xs" fill />
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-md rounded-bl-none">
                    <TypingDots />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div className="flex items-end gap-2 px-3 py-3 border-t border-zinc-800 flex-shrink-0">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                disabled={loading}
                placeholder="Ask about your ESG data…"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 resize-none leading-snug max-h-24 disabled:opacity-50 transition-colors"
                style={{ fieldSizing: 'content' }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="w-8 h-8 flex-shrink-0 bg-emerald-700 hover:bg-emerald-600 rounded-md flex items-center justify-center text-white disabled:opacity-40 disabled:bg-zinc-700 disabled:cursor-not-allowed transition-colors"
              >
                <MI icon={loading ? 'sync' : 'send'} className={`text-sm ${loading ? 'animate-spin' : ''}`} fill />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating trigger button ──────────────────────────────────────── */}
      <motion.button
        onClick={() => setOpen(v => !v)}
        whileHover={{ scale: 1.05 }}
        whileTap={{   scale: 0.96 }}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-emerald-700 hover:bg-emerald-600 rounded-lg flex items-center justify-center shadow-lg transition-colors"
        title="Chat with your ESG Report"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <MI icon="close" className="text-white text-xl" />
            </motion.span>
          ) : (
            <motion.span key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <MI icon="chat" className="text-white text-xl" fill />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
};

export default EsgChatWidget;
