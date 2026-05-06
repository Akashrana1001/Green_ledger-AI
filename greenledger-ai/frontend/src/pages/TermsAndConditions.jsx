import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import MI from '../components/MI';

const SECTIONS = [
  {
    id: 'data-processing',
    icon: 'database',
    title: '1. Data Processing & AI Inference',
    body: `GreenLedger AI processes uploaded corporate documents (PDFs, images, Excel files) solely for the purpose of extracting Environmental, Social, and Governance (ESG) metrics required by SEBI's Business Responsibility and Sustainability Reporting (BRSR) Core framework. All AI inference is performed through AWS Bedrock using Anthropic's Claude models. Your documents are never used to train, fine-tune, or otherwise improve any public AI model. Extracted raw values are processed deterministically by our Python calculation engine; the LLM is never asked to perform arithmetic or generate numbers independently.`,
  },
  {
    id: 'data-storage',
    icon: 'lock',
    title: '2. Data Storage & Security',
    body: `All uploaded documents are stored in a private Amazon S3 bucket (greenledger-documents) with server-side encryption (AES-256) at rest and TLS 1.2+ in transit. Access is controlled via AWS IAM policies. Extracted KPI data and calculated metrics are stored in MongoDB Atlas with network-level access restrictions. Passwords are hashed using bcrypt with a cost factor of 12. Authentication tokens (JWT) are signed with HS256 and expire after the configured period. We implement role-based access control (RBAC) at every API endpoint — no cross-company data leakage is architecturally possible.`,
  },
  {
    id: 'rbac',
    icon: 'group',
    title: '3. Role-Based Access & User Responsibility',
    body: `As an Admin, you are solely responsible for creating and managing Team Member and Supplier accounts within your organization. Team Members and Suppliers may only access data they personally uploaded. You acknowledge that sharing login credentials is a violation of this agreement. GreenLedger AI provides an audit trail for all document uploads, AI processing events, and report generation actions. You agree to maintain the confidentiality of your credentials and notify us immediately of any suspected unauthorized access.`,
  },
  {
    id: 'sebi-compliance',
    icon: 'verified_user',
    title: '4. SEBI BRSR Accuracy & Liability',
    body: `GreenLedger AI applies SEBI-mandated formulas sourced from the official BRSR Core disclosure framework and CEA India grid emission factors. However, the accuracy of final BRSR outputs is contingent on the accuracy and completeness of the source documents you upload. GreenLedger AI does not constitute legal, financial, or regulatory advice. You are responsible for reviewing generated reports before submission to SEBI or any assurance provider. We provide no warranty, express or implied, regarding the regulatory compliance of reports generated through this platform.`,
  },
  {
    id: 'cryptographic',
    icon: 'token',
    title: '5. Cryptographic Report Sealing',
    body: `Generated BRSR Core reports may be sealed with a SHA-256 cryptographic hash via AWS Nitro Enclaves where configured. This seal is a tamper-evidence mechanism, not a digital signature or regulatory certification. The sealed hash proves that the report was not altered after generation. You acknowledge that the seal does not constitute third-party assurance as defined under SEBI Circular SEBI/HO/CFD/CFD-SEC-2/P/CIR/2023/122.`,
  },
  {
    id: 'termination',
    icon: 'cancel',
    title: '6. Termination & Data Deletion',
    body: `You may request deletion of your account and all associated data at any time by contacting support. Upon deletion, all documents stored in S3, extracted KPI data, and user records will be permanently purged within 30 days. Generated reports downloaded before deletion remain your responsibility. GreenLedger AI reserves the right to suspend accounts that violate these terms, including but not limited to uploading fraudulent ESG data for the purpose of producing misleading BRSR disclosures.`,
  },
];

const TermsAndConditions = () => {
  const navigate    = useNavigate();
  const { login, user, logout } = useAuth();
  const [loading,  setLoading]  = useState(false);
  const [expanded, setExpanded] = useState('data-processing');
  const [scrolled, setScrolled] = useState(false);

  const handleScroll = (e) => {
    const el = e.currentTarget;
    const near = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
    if (near) setScrolled(true);
  };

  const handleAccept = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.put('/api/auth/accept-tos');
      /* Backend re-issues the JWT with tosAccepted: true */
      login(res.data.token);
      toast.success('Terms accepted. Welcome to GreenLedger AI!');
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept terms');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = () => {
    logout();
    navigate('/', { replace: true });
    toast('Account setup cancelled. You can register again anytime.', { icon: 'ℹ️' });
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white star-bg">
      <div className="fixed top-0 right-0 w-[500px] h-[500px] green-orb -z-0 opacity-20 translate-x-1/3 -translate-y-1/3" />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-emerald-900/25 bg-[#050505]/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-700 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <MI icon="eco" className="text-white text-base" fill />
            </div>
            <span className="font-bold text-lg tracking-tight">GreenLedger AI</span>
          </Link>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <MI icon="shield" className="text-emerald-700 text-base" />
            <span>Legal Agreement — Step 1 of 1</span>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 pt-28 pb-16 relative z-10">

        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-emerald-950/40 border border-emerald-700/35 text-emerald-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
            <MI icon="verified" className="text-sm" fill /> One-time agreement required before access
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">
            Terms of Service &amp; Data Processing Agreement
          </h1>
          <p className="text-zinc-500 text-sm max-w-xl mx-auto">
            Please review the terms governing your use of GreenLedger AI, including how we process your
            ESG documents, store your data, and generate SEBI BRSR reports.
          </p>
          {user?.fullName && (
            <p className="text-zinc-600 text-xs mt-3">
              Accepting as <span className="text-zinc-400 font-medium">{user.fullName}</span>
              {user.email && <> · {user.email}</>}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Scrollable ToS text */}
          <div className="lg:col-span-2">
            <div
              onScroll={handleScroll}
              className="glass-card rounded-2xl overflow-y-auto max-h-[560px] p-0 divide-y divide-emerald-900/20"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(16,185,129,0.2) transparent' }}
            >
              {SECTIONS.map(({ id, icon, title, body }) => (
                <div key={id} className="overflow-hidden">
                  <button
                    onClick={() => setExpanded(expanded === id ? null : id)}
                    className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-white/3 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-950/40 border border-emerald-700/30 rounded-lg flex items-center justify-center flex-shrink-0">
                        <MI icon={icon} className="text-emerald-400 text-base" />
                      </div>
                      <span className="text-white text-sm font-semibold">{title}</span>
                    </div>
                    <MI icon={expanded === id ? 'expand_less' : 'expand_more'} className="text-zinc-600 text-xl flex-shrink-0" />
                  </button>
                  {expanded === id && (
                    <div className="px-6 pb-6">
                      <p className="text-zinc-400 text-sm leading-7 pl-11">{body}</p>
                    </div>
                  )}
                </div>
              ))}

              {/* Scroll-to-bottom indicator */}
              <div className="px-6 py-5 flex items-center gap-2 text-zinc-700 text-xs">
                <MI icon="info" className="text-base" />
                Scroll through all sections or expand them individually to review the full agreement.
              </div>
            </div>
          </div>

          {/* Acceptance card — sticky */}
          <div className="lg:col-span-1">
            <div className="glass-card rounded-2xl p-6 sticky top-24">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-9 h-9 bg-emerald-500/15 border border-emerald-500/25 rounded-xl flex items-center justify-center">
                  <MI icon="gavel" className="text-emerald-400 text-xl" />
                </div>
                <div>
                  <p className="text-white text-sm font-bold">Ready to proceed?</p>
                  <p className="text-zinc-600 text-xs">v1.0 · Effective 1 Jan 2025</p>
                </div>
              </div>

              <div className="space-y-3 mb-6 text-xs text-zinc-500">
                {[
                  'AI inference via AWS Bedrock only',
                  'Your data never trains public models',
                  'Deterministic SEBI math — no LLM arithmetic',
                  'Role-based access control enforced',
                  'Audit trail on all actions',
                ].map(item => (
                  <div key={item} className="flex items-start gap-2">
                    <MI icon="check_circle" className="text-emerald-600 text-base flex-shrink-0 mt-0.5" fill />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleAccept}
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 disabled:opacity-50 disabled:cursor-not-allowed py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_24px_rgba(16,185,129,0.28)] hover:shadow-[0_0_36px_rgba(16,185,129,0.45)] mb-3"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
                    </svg>
                    Saving…
                  </>
                ) : (
                  <><MI icon="check_circle" className="text-base" /> Accept &amp; Enter Dashboard</>
                )}
              </button>

              <button
                onClick={handleDecline}
                className="w-full py-3 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 border border-white/8 hover:border-white/15 transition-all"
              >
                Decline &amp; Cancel Account
              </button>

              <p className="text-zinc-700 text-[10px] text-center mt-4 leading-relaxed">
                By clicking Accept you agree to these terms.<br />
                Declining will log you out.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;
