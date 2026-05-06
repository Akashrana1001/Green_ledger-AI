import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import Lenis from 'lenis';
import {
  Rocket, Eye, FileSearch, Calculator, ShieldCheck, FileText,
  Network, Hash, Users, Globe, Check, ChevronDown, ChevronUp,
  Sparkles, ArrowRight, Zap, Lock, BarChart3, Layers
} from 'lucide-react';
import PixelSnow from '../components/PixelSnow';

/* ─── Design tokens ────────────────────────────────────────────────────────── */
const BG = '#0a0812';
const CARD = '#120F17';
const BORDER = 'rgba(255,255,255,0.07)';
const PURPLE = '#34d399';
const VIOLET = '#059669';
const GLOW = 'rgba(16,185,129,0.35)';
const MUTED = '#ffffff';

/* ─── Scroll reveal wrapper ─────────────────────────────────────────────────── */
const Reveal = ({ children, delay = 0, y = 40, className = '' }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px 0px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
};

/* ─── Hover card with glow ──────────────────────────────────────────────────── */
const GlowCard = ({ children, className = '', style = {} }) => {
  const cardRef = useRef(null);
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });
  const [hovered, setHovered] = useState(false);

  const handleMove = e => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setGlowPos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <motion.div
      ref={cardRef}
      className={`relative overflow-hidden ${className}`}
      style={{
        background: CARD,
        border: `1px solid ${hovered ? 'rgba(16,185,129,0.25)' : BORDER}`,
        borderRadius: '16px',
        transition: 'border-color 0.3s',
        ...style,
      }}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={handleMove}
    >
      {/* Radial glow that tracks the mouse */}
      {hovered && (
        <div
          className="absolute pointer-events-none"
          style={{
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
            transform: 'translate(-50%, -50%)',
            left: `${glowPos.x}%`,
            top: `${glowPos.y}%`,
            zIndex: 0,
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};

/* ─── Section heading ────────────────────────────────────────────────────────── */
const SectionHead = ({ eyebrow, title, sub, center = true }) => (
  <Reveal className={center ? 'text-center' : ''}>
    <p className="text-xs font-bold tracking-[0.25em] uppercase mb-3" style={{ color: PURPLE }}>{eyebrow}</p>
    <h2 className="text-3xl md:text-[2.6rem] font-black leading-tight tracking-tight mb-4"
      style={{ fontFamily: 'Figtree, Inter, sans-serif' }}>
      {title}
    </h2>
    {sub && <p className="text-base max-w-xl mx-auto leading-relaxed" style={{ color: MUTED, fontFamily: 'Figtree, Inter, sans-serif' }}>{sub}</p>}
  </Reveal>
);

/* ─── Divider ────────────────────────────────────────────────────────────────── */
const Div = () => <div className="w-full h-px" style={{ background: BORDER }} />;

/* ─── Static data ────────────────────────────────────────────────────────────── */

const SERVICES = [
  { icon: FileSearch, title: 'Document Ingestion', desc: 'Upload energy bills, sustainability reports, governance PDFs. AWS Bedrock extracts precise variables instantly — no sorting required.', tags: ['PDFs', 'Images', 'Invoices'] },
  { icon: Calculator, title: 'Deterministic SEBI Math', desc: 'AI strictly reads. Python strictly calculates. Get mathematically perfect Scope 1-3 GHG intensities, wage ratios, and resource indices.', tags: ['Scope 1-3', 'PPP Intensity', 'Water Use'] },
  { icon: Network, title: 'Value Chain Portals', desc: 'Each supplier gets their own gated portal to upload energy data — making Scope 3 collection effortless and tamper-proof at scale.', tags: ['Supplier Login', 'Scope 3', 'RBAC'] },
  { icon: Hash, title: 'Cryptographic Sealing', desc: 'Reports sealed with SHA-256 via AWS Nitro Enclaves. Mathematically impossible to alter data after generation — auditor-grade certainty.', tags: ['SHA-256', 'Nitro Enclave', 'Tamper-Proof'] },
];

const PROCESS = [
  { n: '01', icon: Lock, title: 'Secure Upload', desc: 'Documents upload to your encrypted AWS S3 vault. Nothing leaves your private cloud. Never sent to public model APIs.' },
  { n: '02', icon: FileSearch, title: 'AI Extraction', desc: 'Bedrock (Claude) reads each document with minimal, targeted prompts. Extracts raw numeric values only — never calculates.', code: true },
  { n: '03', icon: Calculator, title: 'Formula Calculation', desc: 'Deterministic Python applies every SEBI-mandated formula: GHG intensities, PPP adjustments, wage equity ratios.' },
  { n: '04', icon: ShieldCheck, title: 'Cryptographic Sealing', desc: 'BRSR Core JSON sealed with SHA-256 inside a Nitro Enclave. Report is tamper-proof before any auditor sees it.' },
];

const BENEFITS = [
  { icon: FileText, title: 'Audit-Ready Reports', desc: 'Full SEBI BRSR Core JSONs covering all 72+ KPIs generated in one click.' },
  { icon: ShieldCheck, title: 'Enterprise Security', desc: 'Runs exclusively on AWS Bedrock. No public models, no data leakage, ever.' },
  { icon: Globe, title: 'Scope 3 Simplified', desc: 'Dedicated supplier portals collect Value Chain data automatically.' },
  { icon: Hash, title: 'Cryptographic Anchoring', desc: 'SHA-256 seals make every report mathematically impossible to greenwash.' },
  { icon: Users, title: 'Role-Based Access', desc: 'Admin, Team, and Supplier — fully isolated data silos per role.' },
  { icon: Layers, title: 'Multi-Framework Ready', desc: 'Built for SEBI BRSR Core today, adaptable for GRI, TCFD, and CSRD.' },
];

const PRICING = [
  {
    tier: 'Starter', price: '₹29,999', period: '/mo', popular: false,
    desc: 'For mid-market companies starting their BRSR journey.',
    features: ['Basic ESG Workflow', '1 Admin Account', 'Up to 50 Documents/mo', 'Standard KPI Extraction', 'Email Support'],
    cta: 'Get Started',
  },
  {
    tier: 'Professional', price: '₹79,999', period: '/mo', popular: true,
    desc: 'Advanced BRSR Core reporting with full AI capabilities.',
    features: ['Value Chain Supplier Portal', '5 Admin Accounts', 'AI War Room Dashboard', '500 Documents/mo', 'Priority Support'],
    cta: 'Deploy Now',
  },
  {
    tier: 'Enterprise', price: 'Custom', period: '', popular: false,
    desc: 'Unlimited scale with cryptographic sealing and dedicated AWS deployment.',
    features: ['SHA-256 Cryptographic Sealing', 'Unlimited Suppliers', 'Dedicated AWS Deployment', 'Custom Integrations', 'White-Glove Onboarding'],
    cta: 'Contact Sales',
  },
];

const TESTIMONIALS = [
  { quote: 'GreenLedger cut our BRSR data consolidation from 3 weeks to under 5 minutes. Our auditors were genuinely impressed.', name: 'Aditya Verma', title: 'Head of ESG Compliance, Enterprise Corp', initials: 'AV' },
  { quote: 'The deterministic math engine is the killer feature. We can finally prove our Scope 2 calculations without spreadsheet arguments.', name: 'Sneha Patel', title: 'CFO, GreenPower Ltd', initials: 'SP' },
  { quote: 'Collecting Scope 3 data from 200+ suppliers used to take months. The supplier portal made it a two-week exercise.', name: 'Rahul Singh', title: 'VP Sustainability, Bharat Industries', initials: 'RS' },
  { quote: 'SHA-256 cryptographic sealing gives our board confidence that ESG numbers cannot be altered post-generation.', name: 'Kavita Nair', title: 'Chief Risk Officer, Finserv Capital', initials: 'KN' },
];

const FAQS = [
  { q: 'How do you ensure our ESG data is tamper-proof?', a: 'Every final report is processed inside an AWS Nitro Enclave — hardware-isolated compute — and sealed with a SHA-256 hash. Any modification to even a single digit produces a completely different hash, making falsification mathematically detectable.' },
  { q: 'How does the AI calculate SEBI metrics without hallucinating?', a: "It doesn't calculate — that's the key design decision. AWS Bedrock (Claude) acts strictly as a reader, extracting raw numbers from unstructured PDFs. Our deterministic Python engine performs every SEBI-mandated calculation. The LLM never touches a formula." },
  { q: 'Is our corporate data used to train public AI models?', a: 'Absolutely not. All inference routes through AWS Bedrock, which guarantees your data is never used for model training. Your sensitive utility bills, payroll data, and governance documents remain within your private enterprise cloud environment.' },
  { q: 'How do we collect Scope 3 data from our suppliers?', a: 'GreenLedger AI generates dedicated, role-gated Supplier Portals. Each supplier gets their own login to upload energy bills and declarations — without any access to your master admin dashboard.' },
];

const STATS = [
  { val: '100%', label: 'Deterministic Accuracy', sub: 'Math in Python, never in the LLM' },
  { val: '85%', label: 'Faster Compliance', sub: 'vs. manual BRSR preparation' },
  { val: '72+', label: 'KPIs Automated', sub: 'Full BRSR Core coverage' },
  { val: 'Zero', label: 'AI Hallucinations', sub: 'LLM reads only, Python calculates' },
];

const TICKER = [
  'SEBI BRSR Core', '72+ Automated KPIs', 'Zero Hallucinations', 'Deterministic Math',
  'AWS Bedrock Powered', 'Scope 1, 2 & 3', 'SHA-256 Sealed', 'AI War Room',
  'Supplier Portals', 'Role-Based Access', 'Cryptographic Audit Trail',
];

/* ─── FAQ Item ───────────────────────────────────────────────────────────────── */
const FaqItem = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${BORDER}` }} className="last:border-0">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between py-5 text-left gap-4 group cursor-pointer">
        <span className="text-sm font-medium text-white group-hover:text-[#a1a1aa] transition-colors duration-200"
          style={{ fontFamily: 'Figtree, Inter, sans-serif' }}>{q}</span>
        <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300"
          style={{ background: open ? 'rgba(16,185,129,0.20)' : 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}` }}>
          {open
            ? <ChevronUp size={14} style={{ color: VIOLET }} />
            : <ChevronDown size={14} style={{ color: MUTED }} />}
        </span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden"
      >
        <p className="text-sm leading-relaxed pb-5" style={{ color: MUTED, fontFamily: 'Figtree, Inter, sans-serif' }}>{a}</p>
      </motion.div>
    </div>
  );
};

/* ─── Home ───────────────────────────────────────────────────────────────────── */
const Home = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const heroRef = useRef(null);
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const heroY = useTransform(scrollY, [0, 400], [0, -60]);

  /* Lenis smooth scroll */
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.08, smoothWheel: true });
    const raf = time => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  return (
    <div style={{ background: BG, fontFamily: 'Figtree, Inter, sans-serif' }} className="text-white overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl"
        style={{ background: 'rgba(10,8,18,0.80)', borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${PURPLE}, ${VIOLET})`, boxShadow: `0 0 20px ${GLOW}` }}>
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-bold text-[15px] tracking-tight">GreenLedger AI</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {['About', 'Services', 'Process', 'Pricing', 'FAQ'].map(l => (
              <a key={l} href={`#${l.toLowerCase()}`}
                className="text-sm font-medium transition-colors duration-200 hover:text-white"
                style={{ color: MUTED }}>{l}</a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium px-4 py-2 transition-colors hover:text-white"
              style={{ color: MUTED }}>Sign In</Link>
            <Link to="/register"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white px-5 py-2.5 rounded-lg transition-all duration-200 hover:opacity-90"
              style={{ background: `linear-gradient(135deg, ${PURPLE}, ${VIOLET})`, boxShadow: `0 0 20px ${GLOW}` }}>
              Get Started <ArrowRight size={13} />
            </Link>
          </div>

          <button className="md:hidden" onClick={() => setMobileOpen(v => !v)} style={{ color: MUTED }}>
            <div className="w-5 space-y-1.5">
              <span className="block h-px bg-current" />
              <span className="block h-px bg-current" />
              <span className="block h-px bg-current" />
            </div>
          </button>
        </div>

        {mobileOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="md:hidden px-6 pb-6 space-y-4"
            style={{ background: 'rgba(10,8,18,0.98)', borderTop: `1px solid ${BORDER}` }}>
            {['About', 'Services', 'Process', 'Pricing', 'FAQ'].map(l => (
              <a key={l} href={`#${l.toLowerCase()}`} onClick={() => setMobileOpen(false)}
                className="block text-sm font-medium py-1.5" style={{ color: MUTED }}>{l}</a>
            ))}
            <div className="flex gap-3 pt-2">
              <Link to="/login" onClick={() => setMobileOpen(false)} className="flex-1 text-center text-sm py-2.5 rounded-lg"
                style={{ border: `1px solid ${BORDER}`, color: MUTED }}>Sign In</Link>
              <Link to="/register" onClick={() => setMobileOpen(false)} className="flex-1 text-center text-sm font-semibold py-2.5 rounded-lg text-white"
                style={{ background: `linear-gradient(135deg, ${PURPLE}, ${VIOLET})` }}>Get Started</Link>
            </div>
          </motion.div>
        )}
      </nav>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── HERO  (left text | right beam + mockup)  ─────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section
        ref={heroRef}
        className="relative overflow-hidden"
        style={{ minHeight: '100vh', background: '#0a0a0a' }}
      >
        {/* ── PixelSnow Background ───────────────────────────────────────── */}
        <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }}>
          <PixelSnow
            color="#10b981"
            flakeSize={0.01}
            minFlakeSize={1.25}
            pixelResolution={200}
            speed={1.25}
            density={0.3}
            direction={125}
            brightness={1}
            depthFade={8}
            farPlane={20}
            gamma={0.4545}
            variant="square"
          />
        </div>

        {/* Left dark curtain — keeps text readable, lets beam shine right */}
        <div className="absolute inset-0 pointer-events-none" style={{
          zIndex: 1,
          background: 'linear-gradient(to right, #0a0a0a 0%, #0a0a0a 30%, rgba(10,10,10,0.88) 50%, rgba(10,10,10,0.30) 70%, transparent 100%)'
        }} />
        {/* Bottom fade to page bg */}
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
          zIndex: 2, height: '180px',
          background: 'linear-gradient(to top, #0a0812 0%, transparent 100%)'
        }} />

        {/* ── Two-column content ───────────────────────────────────────── */}
        <motion.div
          className="relative flex items-center"
          style={{ zIndex: 10, minHeight: '100vh', opacity: heroOpacity, y: heroY }}
        >
          <div className="w-full max-w-7xl mx-auto px-8 lg:px-12 py-28 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* ── LEFT: Text ─────────────────────────────────────────────── */}
            <div>
              {/* Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
                className="font-black leading-[1.04] tracking-tight mb-6 text-white"
                style={{ fontSize: 'clamp(2rem, 4vw, 3.8rem)', fontFamily: 'Figtree, Inter, sans-serif' }}
              >
                Automate BRSR<br />
                Compliance <span className="text-white">with</span><br />
                Mathematical<br />
                <span style={{
                  background: 'linear-gradient(90deg, #ffffff 0%, #bae6fd 60%, #7dd3fc 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
                }}>Certainty.</span>
              </motion.h1>

              {/* Sub */}
              <motion.p
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
                className="text-base leading-relaxed mb-9 max-w-[420px]"
                style={{ color: '#ffffff', fontFamily: 'Figtree, Inter, sans-serif' }}
              >
                GreenLedger AI ingests your raw ESG documents, extracts metrics
                with AWS Bedrock, calculates SEBI-mandated formulas in deterministic
                Python, and delivers audit-ready BRSR Core reports — sealed cryptographically.
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-wrap gap-3 mb-10"
              >
                <Link to="/register"
                  className="inline-flex items-center gap-2 text-sm font-bold px-6 py-3 rounded-xl transition-all duration-200 hover:scale-[1.02]"
                  style={{ background: '#fff', color: '#0a0a0a', boxShadow: '0 0 32px rgba(255,255,255,0.25)' }}
                >
                  <Rocket size={14} /> BOOK A DEMO
                </Link>
                <Link to="/login"
                  className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl transition-all duration-200 hover:bg-white/[0.06]"
                  style={{ color: '#ffffff', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.04)' }}
                >
                  <ShieldCheck size={14} /> SEBI BRSR Core Compliant
                </Link>
              </motion.div>

              {/* Trust row */}
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.34 }}
                className="flex items-center gap-3"
              >
                <div className="flex -space-x-2">
                  {['AV', 'SP', 'RS', 'KN', '+'].map((init, i) => (
                    <div key={i}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2"
                      style={{
                        background: i === 4 ? 'rgba(255,255,255,0.15)' : `hsl(${210 + i * 25},55%,48%)`,
                        borderColor: '#0a0a0a',
                      }}
                    >{init}</div>
                  ))}
                </div>
                <p className="text-xs" style={{ color: '#ffffff', fontFamily: 'Figtree, Inter, sans-serif' }}>
                  <span className="text-white font-semibold">50+ compliance teams</span> trust GreenLedger AI
                </p>
              </motion.div>
            </div>

            {/* ── RIGHT: Dashboard mockup ──────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 32, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="relative hidden lg:block"
            >
              {/* Glow behind the mockup */}
              <div className="absolute inset-0 pointer-events-none" style={{
                background: 'radial-gradient(ellipse 80% 60% at 60% 50%, rgba(255,255,255,0.06) 0%, transparent 70%)',
                filter: 'blur(20px)', zIndex: 0,
              }} />

              {/* ── Main workspace card ─────────────────────────────────── */}
              <div className="relative rounded-2xl overflow-hidden" style={{
                background: 'rgba(15,12,22,0.92)',
                border: '1px solid rgba(255,255,255,0.10)',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 32px 80px rgba(0,0,0,0.70), 0 0 0 1px rgba(255,255,255,0.04)',
                zIndex: 1,
              }}>
                {/* Window chrome */}
                <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex gap-1.5">
                    {['#ef4444', '#eab308', '#22c55e'].map(c => (
                      <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                    ))}
                  </div>
                  <div className="flex-1 text-center text-[11px] font-medium" style={{ color: '#ffffff' }}>
                    GreenLedger AI Workspace — FY24 BRSR Filing
                  </div>
                </div>
                {/* Tab bar */}
                <div className="flex items-center gap-1 px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-[11px] font-medium px-2 py-1 rounded" style={{ color: '#ffffff' }}>Tracker</span>
                  {['Kanban', 'List', 'Timeline'].map(v => (
                    <span key={v} className="text-[11px] px-2.5 py-1 rounded-md font-medium"
                      style={v === 'Kanban' ? { background: 'rgba(82,82,91,0.22)', color: '#d4d4d8' } : { color: '#ffffff' }}>
                      {v}
                    </span>
                  ))}
                  <span className="ml-auto text-[10px] px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: '#ffffff' }}>
                    + Filter
                  </span>
                </div>
                {/* Kanban columns */}
                <div className="grid grid-cols-3 gap-3 p-4" style={{ minHeight: '300px' }}>
                  {[
                    {
                      title: 'BACKLOG', count: 10, color: '#6b7280', tasks: [
                        { title: 'Ingest Tata Steel ESO Report', tags: ['Scope 1', 'Bengas'], colors: ['#f59e0b', '#10b981'] },
                        { title: 'Validate scope data metrics', tags: ['Water KPI', 'Heelyck'], colors: ['#3b82f6', '#52525b'] },
                      ]
                    },
                    {
                      title: 'TO DO', count: 24, color: '#71717a', tasks: [
                        { title: 'Analyze metric and calculate emissions', tags: ['GHG', 'Donzer'], colors: ['#ef4444', '#f97316'] },
                        { title: 'Conduct Compliance Interview w/ management', tags: ['Social', 'Heelyck'], colors: ['#22c55e', '#06b6d4'] },
                      ]
                    },
                    {
                      title: 'IN PROGRESS', count: 8, color: '#06b6d4', tasks: [
                        { title: 'Generate BRSR Core Report Seal', tags: ['SHA-256', 'Report'], colors: ['#10b981', '#6366f1'] },
                        { title: 'Collect supplier Scope 3 data', tags: ['Value Chain', 'Portal'], colors: ['#f59e0b', '#ec4899'] },
                      ]
                    },
                  ].map(col => (
                    <div key={col.title}>
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="text-[9px] font-bold tracking-[0.18em]" style={{ color: '#ffffff' }}>{col.title}</span>
                        <span className="text-[9px] rounded-full px-1.5 font-bold" style={{ background: 'rgba(255,255,255,0.08)', color: '#ffffff' }}>{col.count}</span>
                      </div>
                      <div className="space-y-2">
                        {col.tasks.map((task, ti) => (
                          <div key={ti} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <p className="text-[11px] leading-snug mb-2.5 font-medium" style={{ color: '#ffffff' }}>{task.title}</p>
                            <div className="flex gap-1 flex-wrap">
                              {task.tags.map((t, j) => (
                                <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                                  style={{ background: `${task.colors[j]}22`, color: task.colors[j], border: `1px solid ${task.colors[j]}44` }}>
                                  {t}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Floating Inbox card (top-right) ────────────────────── */}
              <div className="absolute -right-5 top-6 w-52 rounded-2xl overflow-hidden" style={{
                background: 'rgba(15,12,22,0.96)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.60)',
                zIndex: 2,
              }}>
                <div className="flex items-center justify-between px-3.5 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <span className="text-xs font-semibold text-white">Inbox</span>
                  <div className="flex gap-2">
                    {['text_fields', 'chat_bubble_outline', 'more_horiz'].map(ic => (
                      <span key={ic} className="material-symbols-outlined text-sm" style={{ color: '#ffffff', fontSize: '14px' }}>{ic}</span>
                    ))}
                  </div>
                </div>
                <div className="p-2 space-y-1">
                  {[
                    { init: 'PS', name: 'Priya Singh', msg: 'mentioned you in Page 75, Water data needs checking', hue: 210 },
                    { init: 'AS', name: 'Aarav Sharma', msg: 'joined the 8828 BRSR filing project', hue: 250 },
                    { init: 'BW', name: 'Billy Williams', msg: 'added new tag to Carbon Data report', hue: 180 },
                    { init: 'WF', name: 'Warren Thompson', msg: 'GreenLedger Support: Report for FY24 ready', hue: 300 },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-2 px-1.5 py-2 rounded-xl" style={{ background: i === 0 ? 'rgba(255,255,255,0.06)' : 'transparent' }}>
                      <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white"
                        style={{ background: `hsl(${item.hue},55%,48%)` }}>
                        {item.init}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold truncate" style={{ color: '#ffffff' }}>{item.name}</p>
                        <p className="text-[9px] leading-tight" style={{ color: '#ffffff', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.msg}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Floating mini-card (stakeholder) ───────────────────── */}
              <div className="absolute -left-4 -bottom-4 rounded-xl px-4 py-3" style={{
                background: 'rgba(15,12,22,0.94)',
                border: '1px solid rgba(255,255,255,0.10)',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.50)',
                zIndex: 2,
              }}>
                <p className="text-[10px] font-semibold text-white mb-1">Stakeholder communication</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-[9px]" style={{ color: '#ffffff' }}>55% Complete · BRSR E3.4</span>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* ── Bottom feature ticker strip ──────────────────────────────── */}
        <div className="absolute bottom-0 left-0 right-0 py-4 text-center" style={{ zIndex: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[11px] mb-2" style={{ color: '#ffffff', fontFamily: 'Figtree, Inter, sans-serif' }}>
            Everything you need for productive compliance work:
          </p>
          <p className="text-[11px] font-medium" style={{ color: '#ffffff', fontFamily: 'Figtree, Inter, sans-serif' }}>
            ESG Planner &nbsp;·&nbsp; BRSR Management &nbsp;·&nbsp; Document Workspace &nbsp;·&nbsp; Auditor Chat &nbsp;·&nbsp; Secure Repository &nbsp;·&nbsp; Compliance Inbox
          </p>
        </div>
      </section>

      {/* ── Ticker ───────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden py-4" style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, background: 'rgba(16,185,129,0.03)' }}>
        <div className="purple-marquee-track">
          {[0, 1].map(copy => (
            <span key={copy} className="flex items-center gap-10 px-10">
              {TICKER.map(item => (
                <span key={item} className="flex items-center gap-2.5 text-[11px] font-bold tracking-[0.22em] uppercase whitespace-nowrap"
                  style={{ color: '#ffffff' }}>
                  <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'rgba(16,185,129,0.55)' }} />
                  {item}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ── About / Stats ────────────────────────────────────────────────────── */}
      <section id="about" className="max-w-6xl mx-auto px-6 py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <SectionHead center={false}
              eyebrow="About GreenLedger AI"
              title={<>AI-First ESG Compliance<br /><span style={{ background: `linear-gradient(90deg, ${PURPLE}, ${VIOLET})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Built for Auditors.</span></>}
            />
            <Reveal delay={0.1}>
              <p className="mt-4 mb-8 text-base leading-relaxed" style={{ color: MUTED }}>
                Most ESG tools ask the AI to compute formulas — and hope it gets the math right.
                GreenLedger AI is architected differently: the LLM is a <em style={{ color: VIOLET, fontStyle: 'normal', fontWeight: 600 }}>reader</em>,
                Python is the <em style={{ color: VIOLET, fontStyle: 'normal', fontWeight: 600 }}>calculator</em>. Your Scope 1-3 emissions,
                wage equity ratios, and resource intensities are calculated deterministically, to the
                exact decimal SEBI expects.
              </p>
              <div className="flex flex-wrap gap-2">
                {['AWS Bedrock', 'Python Math Engine', 'SEBI BRSR Core', 'Cryptographic Sealing'].map(t => (
                  <span key={t} className="text-xs font-semibold px-3 py-1.5 rounded-full"
                    style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.22)', color: VIOLET }}>
                    {t}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {STATS.map(({ val, label, sub }, i) => (
              <Reveal key={label} delay={i * 0.08}>
                <GlowCard className="p-6">
                  <p className="text-2xl font-black mb-1" style={{ color: VIOLET, textShadow: `0 0 20px rgba(16,185,129,0.45)` }}>{val}</p>
                  <p className="text-white text-xs font-bold uppercase tracking-widest mb-1">{label}</p>
                  <p className="text-[11px] leading-tight" style={{ color: '#ffffff' }}>{sub}</p>
                </GlowCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6"><Div /></div>

      {/* ── Services ─────────────────────────────────────────────────────────── */}
      <section id="services" className="max-w-6xl mx-auto px-6 py-28">
        <SectionHead
          eyebrow="Core Services"
          title={<>Four Modules. Every Layer of<br /><span style={{ background: `linear-gradient(90deg, ${PURPLE}, ${VIOLET})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>BRSR Compliance Covered.</span></>}
          sub="Purpose-built modules that cover the full ESG lifecycle — from raw document to sealed report."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-14">
          {SERVICES.map(({ icon: Icon, title, desc, tags }, i) => (
            <Reveal key={title} delay={i * 0.07}>
              <GlowCard className="p-8 h-full">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.25)' }}>
                  <Icon size={20} style={{ color: VIOLET }} />
                </div>
                <h3 className="text-white font-bold text-lg mb-3">{title}</h3>
                <p className="text-sm leading-relaxed mb-5" style={{ color: MUTED }}>{desc}</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map(t => (
                    <span key={t} className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.22)', color: VIOLET }}>
                      {t}
                    </span>
                  ))}
                </div>
              </GlowCard>
            </Reveal>
          ))}
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6"><Div /></div>

      {/* ── Process ──────────────────────────────────────────────────────────── */}
      <section id="process" className="max-w-6xl mx-auto px-6 py-28">
        <SectionHead
          eyebrow="Methodology"
          title={<>From Raw Document to<br /><span style={{ background: `linear-gradient(90deg, ${PURPLE}, ${VIOLET})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Cryptographic BRSR Report.</span></>}
          sub="A four-step pipeline designed for auditability, security, and mathematical correctness."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-14">
          {PROCESS.map(({ n, icon: Icon, title, desc, code }, i) => (
            <Reveal key={n} delay={i * 0.07}>
              <GlowCard className="p-8 h-full">
                <div className="flex items-start gap-5">
                  <div className="flex-shrink-0">
                    <p className="text-[10px] font-mono font-bold mb-2" style={{ color: '#ffffff' }}>{n}</p>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.22)' }}>
                      <Icon size={19} style={{ color: VIOLET }} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-bold text-base mb-2">{title}</h4>
                    <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{desc}</p>
                    {code && (
                      <div className="mt-4 rounded-xl p-3.5 text-xs overflow-x-auto"
                        style={{ background: 'rgba(0,0,0,0.50)', border: `1px solid ${BORDER}`, fontFamily: 'Fragment Mono, ui-monospace, monospace' }}>
                        <span style={{ color: '#ffffff' }}>bedrock</span>
                        <span className="text-white">.extract(</span>
                        <span style={{ color: '#86efac' }}>document</span>
                        <span className="text-white">)</span>
                        <span style={{ color: '#ffffff' }}> &nbsp;# raw numerics only</span>
                        <br />
                        <span style={{ color: '#ffffff' }}># → kpi_calculator.py handles all math</span>
                      </div>
                    )}
                  </div>
                </div>
              </GlowCard>
            </Reveal>
          ))}
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6"><Div /></div>

      {/* ── Benefits ─────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-28">
        <SectionHead
          eyebrow="Why GreenLedger AI"
          title={<>Six Capabilities.<br /><span style={{ background: `linear-gradient(90deg, ${PURPLE}, ${VIOLET})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>One Unified Platform.</span></>}
          sub="Enterprise-grade capabilities engineered with auditability, security, and mathematical correctness as first principles."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-14">
          {BENEFITS.map(({ icon: Icon, title, desc }, i) => (
            <Reveal key={title} delay={i * 0.06}>
              <GlowCard className="p-6 h-full">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.22)' }}>
                  <Icon size={18} style={{ color: VIOLET }} />
                </div>
                <h3 className="text-white font-bold text-[15px] mb-2">{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{desc}</p>
              </GlowCard>
            </Reveal>
          ))}
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6"><Div /></div>

      {/* ── Pricing ──────────────────────────────────────────────────────────── */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-28">
        <SectionHead
          eyebrow="Pricing"
          title={<>Simple, Transparent.<br /><span style={{ background: `linear-gradient(90deg, ${PURPLE}, ${VIOLET})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>No Compliance Surprises.</span></>}
          sub="Choose the plan that matches your compliance workload and scale."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-14 items-start">
          {PRICING.map(({ tier, price, period, popular, desc, features, cta }, i) => (
            <Reveal key={tier} delay={i * 0.08}>
              <motion.div
                className="relative rounded-2xl flex flex-col h-full"
                whileHover={{ scale: 1.01, y: -2 }}
                transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                style={{
                  background: popular ? 'rgba(22,16,34,0.95)' : CARD,
                  border: popular ? '1px solid rgba(16,185,129,0.38)' : `1px solid ${BORDER}`,
                  boxShadow: popular ? '0 0 60px rgba(16,185,129,0.15)' : undefined,
                }}>
                {popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="text-[10px] font-bold text-white px-3.5 py-1.5 rounded-full whitespace-nowrap"
                      style={{ background: `linear-gradient(135deg, ${PURPLE}, ${VIOLET})`, boxShadow: `0 0 16px ${GLOW}` }}>
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="p-7 pb-0">
                  <p className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3"
                    style={{ color: '#ffffff' }}>{tier}</p>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-4xl font-black text-white">{price}</span>
                    <span className="text-sm" style={{ color: '#ffffff' }}>{period}</span>
                  </div>
                  <p className="text-sm mb-6" style={{ color: MUTED }}>{desc}</p>
                </div>

                <div className="flex-1 px-7 pb-7">
                  <ul className="space-y-3 mb-7">
                    {features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: '#ffffff' }}>
                        <div className="w-4 h-4 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0"
                          style={{ background: popular ? 'rgba(16,185,129,0.20)' : 'rgba(255,255,255,0.07)' }}>
                          <Check size={9} style={{ color: '#ffffff' }} />
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/register"
                    className="block text-center text-sm font-semibold py-3 rounded-xl transition-all duration-200 hover:opacity-90"
                    style={popular
                      ? { background: `linear-gradient(135deg, ${PURPLE}, ${VIOLET})`, color: '#fff', boxShadow: `0 0 24px ${GLOW}` }
                      : { background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, color: '#ffffff' }}>
                    {cta}
                  </Link>
                </div>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6"><Div /></div>

      {/* ── Testimonials ─────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-28">
        <SectionHead
          eyebrow="Case Studies"
          title={<>Results That Speak<br /><span style={{ background: `linear-gradient(90deg, ${PURPLE}, ${VIOLET})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>for Themselves.</span></>}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-14">
          {TESTIMONIALS.map(({ quote, name, title, initials }, i) => (
            <Reveal key={name} delay={i * 0.07}>
              <GlowCard className="p-8 h-full">
                <div className="text-3xl font-black mb-4 leading-none" style={{ color: '#ffffff' }}>"</div>
                <p className="text-sm text-white leading-relaxed mb-6 italic">"{quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${PURPLE}, ${VIOLET})` }}>
                    {initials}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{name}</p>
                    <p className="text-[11px]" style={{ color: '#ffffff' }}>{title}</p>
                  </div>
                </div>
              </GlowCard>
            </Reveal>
          ))}
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6"><Div /></div>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section id="faq" className="max-w-3xl mx-auto px-6 py-28">
        <SectionHead
          eyebrow="FAQ"
          title={<>Frequently Asked<br /><span style={{ background: `linear-gradient(90deg, ${PURPLE}, ${VIOLET})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Questions.</span></>}
        />

        <Reveal delay={0.1} className="mt-12">
          <div className="rounded-2xl px-8 py-2" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {FAQS.map(({ q, a }) => <FaqItem key={q} q={q} a={a} />)}
          </div>
        </Reveal>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-28">
        <Reveal>
          <div className="relative rounded-3xl overflow-hidden p-14 text-center"
            style={{ background: CARD, border: '1px solid rgba(16,185,129,0.22)', boxShadow: '0 0 80px rgba(16,185,129,0.07)' }}>
            {/* Ambient orbs */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full"
                style={{ background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.12) 0%, transparent 70%)', filter: 'blur(60px)' }} />
            </div>

            <div className="relative">
              <p className="text-xs font-bold tracking-[0.25em] uppercase mb-4" style={{ color: PURPLE }}>Get Started Today</p>
              <h2 className="font-black tracking-tight leading-tight mb-5"
                style={{ fontSize: 'clamp(1.8rem, 4vw, 3.2rem)', fontFamily: 'Figtree, Inter, sans-serif' }}>
                Ready to make your ESG reporting<br />
                <span style={{ background: `linear-gradient(90deg, ${PURPLE}, ${VIOLET})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  mathematically perfect?
                </span>
              </h2>
              <p className="text-base mb-10 mx-auto max-w-md" style={{ color: MUTED }}>
                Join compliance teams that trust GreenLedger AI for zero-hallucination BRSR reports — sealed cryptographically and ready for any auditor.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/register"
                  className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-white px-8 py-4 rounded-xl transition-all duration-200 hover:opacity-90 hover:scale-[1.02]"
                  style={{ background: `linear-gradient(135deg, ${PURPLE}, ${VIOLET})`, boxShadow: `0 0 40px ${GLOW}` }}>
                  <Rocket size={15} /> Book a Call Today
                </Link>
                <Link to="/login"
                  className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-8 py-4 rounded-xl transition-all duration-200"
                  style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, color: '#ffffff' }}>
                  <BarChart3 size={15} /> Sign In
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="px-6 pt-14 pb-10" style={{ borderTop: `1px solid ${BORDER}` }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${PURPLE}, ${VIOLET})`, boxShadow: `0 0 16px ${GLOW}` }}>
                  <Zap size={13} className="text-white" />
                </div>
                <span className="font-bold text-[15px] text-white">GreenLedger AI</span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: '#ffffff' }}>
                Automate Smarter.<br />Calculate Precisely.<br />Comply Faster.
              </p>
            </div>

            {[
              { title: 'Platform', links: [['About', '#about'], ['Services', '#services'], ['Process', '#process'], ['Pricing', '#pricing']] },
              { title: 'Account', links: [['Sign In', '/login'], ['Register', '/register'], ['AI War Room', '/login'], ['Questionnaire', '/login']] },
              { title: 'Compliance', links: [['SEBI BRSR Core', '#'], ['Scope 1, 2 & 3', '#'], ['Value Chain', '#'], ['Audit Trails', '#']] },
            ].map(({ title, links }) => (
              <div key={title}>
                <p className="text-xs font-bold uppercase tracking-widest mb-5 text-white">{title}</p>
                <ul className="space-y-3.5">
                  {links.map(([label, href]) => (
                    <li key={label}>
                      {href.startsWith('/') ? (
                        <Link to={href} className="text-sm hover:text-white transition-colors duration-200" style={{ color: '#ffffff' }}>{label}</Link>
                      ) : (
                        <a href={href} className="text-sm hover:text-white transition-colors duration-200" style={{ color: '#ffffff' }}>{label}</a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8" style={{ borderTop: `1px solid ${BORDER}` }}>
            <p className="text-xs" style={{ color: '#ffffff' }}>
              © 2025 GreenLedger AI &nbsp;·&nbsp; Cognizant GenAI Hackathon &nbsp;·&nbsp; AWS Bedrock &nbsp;·&nbsp; Deterministic Compliance
            </p>
            <div className="flex gap-6 text-xs" style={{ color: '#ffffff' }}>
              {['About', 'Blog', 'Privacy', 'Terms', 'Contact', '404'].map(l => (
                <a key={l} href="#" className="hover:text-white transition-colors duration-200">{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
