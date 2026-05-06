import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import MI from '../components/MI';
import ActionableInsights from '../components/ActionableInsights';
import EsgScoreGauge from '../components/EsgScoreGauge';
import AuditTrailModal from '../components/AuditTrailModal';
import EsgChatWidget from '../components/EsgChatWidget';
import SystemHealthPanel from '../components/SystemHealthPanel';
import NitroEnclaveVisualizer from '../components/NitroEnclaveVisualizer';
import OllamaConnectionError from '../components/OllamaConnectionError';
import KPIResultsPanel from '../components/KPIResultsPanel';
import BRSRPdfReport from '../components/BRSRPdfReport';
import { AdminSidebarLinks } from '../components/AdminSidebar';
import { pdf } from '@react-pdf/renderer';
import { AnimatePresence } from 'framer-motion';

const MANDATORY_CATEGORIES = [
  'electricity_bill', 'fuel_consumption', 'water_usage',
  'waste_records', 'hr_wages_data', 'accounts_payable',
];

const STATUS_CHIP = {
  pending:    'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  processing: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  verified:   'bg-green-900/20 text-green-400 border border-green-700/30',
  failed:     'bg-red-500/10 text-red-400 border border-red-500/20',
};

const STATUS_DOT = {
  pending: 'bg-orange-400 animate-pulse',
  processing: 'bg-blue-400 animate-pulse',
  verified: 'bg-green-500',
  failed: 'bg-red-400',
};

const KpiCard = ({ label, value, unit }) => (
  <div className="bg-zinc-900 border border-zinc-800 rounded-md p-3 hover:border-zinc-700 transition-colors">
    <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest mb-2">{label}</p>
    <p className="text-zinc-50 font-semibold text-2xl tracking-tight tabular-nums leading-none">{value ?? '—'}</p>
    {unit && <p className="text-zinc-600 text-[10px] mt-1 font-mono">{unit}</p>}
  </div>
);

const AIWarRoom = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login'); };

  const [documents, setDocuments] = useState([]);
  const [kpiData, setKpiData] = useState(null);
  const [engineHealth, setEngineHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [retrying, setRetrying] = useState(null);
  const [report, setReport] = useState(null);
  const [genError, setGenError] = useState('');
  const [recalculating, setRecalculating] = useState(false);
  const [reprocessing, setReprocessing] = useState(null);  // docId | null
  const [auditDocId,   setAuditDocId]   = useState(null);  // docId | null — Audit Trail modal
  const pollingRef = useRef(null);
  const documentsRef = useRef([]);

  const fetchData = useCallback(async () => {
    try {
      const [docsRes, kpisRes] = await Promise.all([
        axiosClient.get('/api/documents'),
        axiosClient.get('/api/report/kpis'),
      ]);
      documentsRef.current = docsRes.data.documents;
      setDocuments(docsRes.data.documents);
      setKpiData(kpisRes.data);
    } catch (err) {
      console.error('War room fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEngineHealth = useCallback(async () => {
    try {
      const res = await axiosClient.get('/api/health/engine');
      setEngineHealth(res.data);
    } catch {
      setEngineHealth(null);
    }
  }, []);

  const scheduleNextPoll = useCallback(() => {
    clearInterval(pollingRef.current);
    const hasProcessing = documentsRef.current.some(d => d.status === 'processing');
    const interval = hasProcessing ? 6000 : 20000;
    pollingRef.current = setInterval(async () => {
      await fetchData();
      scheduleNextPoll();
    }, interval);
  }, [fetchData]);

  useEffect(() => {
    const init = async () => {
      await fetchData();
      await fetchEngineHealth();
      scheduleNextPoll();
    };
    init();
    const healthInterval = setInterval(fetchEngineHealth, 15000);
    return () => {
      clearInterval(pollingRef.current);
      clearInterval(healthInterval);
    };
  }, [fetchData, fetchEngineHealth, scheduleNextPoll]);

  const handleReprocess = async (docId, filename) => {
    setReprocessing(docId);
    try {
      await axiosClient.post(`/api/documents/${docId}/reprocess`);
      toast.success(`Re-processing started: ${filename}`);
      await fetchData();
      scheduleNextPoll();
      // Wait for the document to finish processing then show final success
      const poll = setInterval(async () => {
        const res = await axiosClient.get('/api/documents').catch(() => null);
        if (!res) return clearInterval(poll);
        const updated = res.data.documents?.find(d => d._id === docId);
        if (updated?.status === 'verified') {
          clearInterval(poll);
          toast.success('Extraction Re-verified: Dashboard Updated');
          await fetchData();
        } else if (updated?.status === 'failed') {
          clearInterval(poll);
          toast.error(`Re-check failed: ${filename}`);
          await fetchData();
        }
      }, 5000);
      // Safety timeout — stop polling after 3 minutes
      setTimeout(() => clearInterval(poll), 180000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start re-check');
    } finally {
      setReprocessing(null);
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await axiosClient.post('/api/report/recalculate');
      toast.success(`KPI summary refreshed — ${res.data.updated} field(s) updated from ${(res.data.categories || []).length} categor${(res.data.categories || []).length === 1 ? 'y' : 'ies'}`);
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to recalculate KPIs');
    } finally {
      setRecalculating(false);
    }
  };

  /* Silent auto-recalculate — runs every 5s in the background to keep the
   * KPI summary cards in lockstep with newly verified documents. Skips when
   * a manual recalculate is already in flight, and never shows toast spam. */
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled || recalculating) return;
      try {
        await axiosClient.post('/api/report/recalculate');
        if (!cancelled) await fetchData();
      } catch {
        /* swallow — manual button surfaces errors; auto-poll stays quiet */
      }
    };
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [fetchData, recalculating]);

  const handleGenerate = async () => {
    setGenerating(true); setGenError(''); setReport(null);
    try {
      const res = await axiosClient.get('/api/report/generate');
      setReport(res.data.report);
      toast.success('BRSR Core Report generated!');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to generate report';
      setGenError(msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleRetry = async (docId, filename) => {
    setRetrying(docId);
    try {
      await axiosClient.post(`/api/documents/${docId}/retry`);
      toast.success(`Re-triggered: ${filename}`);
      await fetchData();
      scheduleNextPoll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Retry failed');
    } finally {
      setRetrying(null);
    }
  };

  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const downloadReportPdf = async () => {
    if (!report) return;
    setDownloadingPdf(true);
    try {
      /* Build the PDF payload from the SAME live state objects that drive the
       * on-screen <KpiCard> values, captured at click-time. This guarantees
       * the PDF prints whatever number is currently visible on the dashboard,
       * not a stale snapshot from /api/report/generate. */
      const liveEnv  = kpiData?.kpiResult?.environmentalKpis || {};
      const liveSoc  = kpiData?.kpiResult?.socialKpis        || {};
      const liveGov  = kpiData?.kpiResult?.governanceKpis    || {};
      const meta     = report?.reportMetadata                || {};

      // Section A arrays — populated by the backend from extractedRawValues
      const secA = report?.sectionA || {};

      const dashboardState = {
        general: {
          cin:                meta.company?.CIN     || '',
          entityName:         meta.company?.name    || '',
          financialYear:      meta.financialYear    || '',
          reportingBoundary:  meta.reportingBoundary || 'Standalone',
          yearOfIncorporation: secA.companyDetails?.yearOfIncorporation || '',
          registeredOffice:   secA.companyDetails?.registeredAddress    || '',
          website:            secA.companyDetails?.website              || '',
          exchanges:          secA.companyDetails?.stockExchange        || '',
          paidUp:             secA.companyDetails?.paidUpCapital        || '',
          contactPerson: [
            secA.companyDetails?.brContact?.name,
            secA.companyDetails?.brContact?.email,
            secA.companyDetails?.brContact?.phone,
          ].filter(Boolean).join(' · '),
        },
        environmental: {
          scope_1_tco2e:          liveEnv.scope1_tco2e,
          scope_2_tco2e:          liveEnv.scope2_tco2e,
          scope_3_tco2e:          liveEnv.scope3_tco2e,
          total_energy_kwh:       liveEnv.total_energy_kwh,
          total_water_kl:         liveEnv.total_water_kl,
          renewable_pct:          liveEnv.renewable_energy_pct,
          total_waste_mt:         liveEnv.total_waste_mt,
          ghg_intensity_tco2e_cr: liveEnv.ghg_intensity_per_rupee,
        },
        social: {
          female_wage_pct:       liveSoc.female_wage_pct,
          well_being_spend_pct:  liveSoc.wellbeing_spend_pct_revenue,
          msme_procurement_pct:  liveSoc.msme_procurement_pct,
          ltifr_employees:       liveSoc.ltifr_employees,
          ltifr_workers:         liveSoc.ltifr_workers,
        },
        governance: {
          payable_days:          liveGov.accounts_payable_days,
          data_breach_pct:       liveGov.data_breach_pct_incidents,
          related_party_buy_pct: liveGov.related_party_purchase_pct,
          regulatory_fines:      liveGov.regulatory_fines_count,
        },
        // Section A array tables — sourced from backend report (extracted from verified docs)
        businessActivities: secA.businessActivities || [],
        products:           secA.products           || [],
        subsidiaries:       secA.subsidiaries       || [],
        materialIssues:     secA.materialIssues     || [],
        operations:         secA.operations         || { national: {}, international: {} },
        // Q18/Q19 — employees & women representation (derived from KpiResult social KPIs)
        employees: secA.employees || {},
        women:     secA.women     || {},
      };

      // Proof of injection — visible in DevTools when user clicks Download.
      console.log('[BRSR-PDF] live payload at click-time:', dashboardState);

      const blob = await pdf(
        <BRSRPdfReport dashboardState={dashboardState} />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = (dashboardState.general.entityName || 'company')
        .replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
      const fy = (dashboardState.general.financialYear || '').replace(/[^0-9-]/g, '') || 'FY';
      a.href = url;
      a.download = `BRSR_Annexure_I_${safeName}_${fy}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('BRSR PDF downloaded');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const downloadReportJson = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BRSR_Core_Report_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const mandatoryComplete = kpiData?.mandatoryComplete || false;
  const env      = kpiData?.kpiResult?.environmentalKpis;
  const social   = kpiData?.kpiResult?.socialKpis;
  const gov      = kpiData?.kpiResult?.governanceKpis;
  const insights = kpiData?.kpiResult?.ai_insights || [];
  const engineUp = engineHealth !== null;
  const ollamaOk = engineHealth?.ollama_connected;
  const localMode = engineHealth?.local_mode;
  const isProcessing = documents.some(d => d.status === 'processing');
  const latestVerified = documents
    .filter(d =>
      d.status === 'verified' &&
      d.calculatedKpis &&
      Object.keys(d.calculatedKpis).length > 0
    )
    .sort((a, b) =>
      new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    )[0];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="hidden" />

      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#050505]/85 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 ai-gradient-bg rounded-md flex items-center justify-center">
              <MI icon="eco" className="text-white text-sm" fill />
            </div>
            <span className="font-semibold text-sm text-zinc-100">GreenLedger AI</span>
          </Link>
          <nav className="hidden md:flex gap-5 text-sm">
            <Link to="/admin/dashboard" className="text-zinc-500 hover:text-zinc-200 transition-colors text-[13px]">Dashboard</Link>
            <span className="text-zinc-100 font-medium text-[13px] border-b border-emerald-600 pb-px">AI War Room</span>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={!mandatoryComplete || generating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed rounded-md text-white text-xs font-semibold transition-colors">
            <MI icon="download" className="text-sm" />
            {generating ? 'Generating…' : 'Generate BRSR'}
          </button>
          <button onClick={handleLogout} className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
            <MI icon="logout" className="text-base" />
          </button>
        </div>
      </header>

      {/* Left Sidebar */}
      <aside className="fixed left-0 top-16 w-64 h-[calc(100vh-64px)] z-40 flex flex-col bg-[#050505] border-r border-white/10">
        <div className="p-3 pt-4">
          <nav className="space-y-1">
            <AdminSidebarLinks />
          </nav>
          <div className="mt-5 pt-4 border-t border-zinc-800">
            <button
              onClick={handleGenerate}
              disabled={!mandatoryComplete || generating}
              className="w-full py-2 rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5">
              <MI icon="play_circle" className="text-sm" />
              {generating ? 'Generating…' : 'Generate Report'}
            </button>
          </div>
        </div>
        <div className="mt-auto p-4 border-t border-zinc-800">
          <button onClick={handleLogout} className="flex items-center gap-2.5 px-2.5 py-2 text-zinc-500 hover:text-zinc-200 w-full text-[13px] rounded-md hover:bg-zinc-900 transition-colors">
            <MI icon="logout" className="text-base" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 pt-20 px-8 pb-12 space-y-5 max-w-[calc(100vw-256px)]">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">AI War Room</h1>
            <p className="text-zinc-500 text-xs mt-0.5">
              Live processing queue · refreshes {documentsRef.current.some(d => d.status === 'processing') ? 'every 6s' : 'every 20s'}
            </p>
          </div>
        </div>

        {/* Service status bar */}
        <div className="flex flex-wrap gap-2">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
            engineUp ? 'bg-emerald-950/40 text-emerald-500 border-emerald-900' : 'bg-red-950/40 text-red-400 border-red-900'
          }`}>
            <MI icon={engineUp ? 'cloud_done' : 'cloud_off'} className="text-sm" fill={engineUp} />
            AI Engine {engineUp ? 'online' : 'offline'}
          </div>
          {localMode && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
              ollamaOk ? 'bg-emerald-950/40 text-emerald-500 border-emerald-900' : 'bg-red-950/40 text-red-400 border-red-900'
            }`}>
              <MI icon={ollamaOk ? 'memory' : 'memory'} className="text-sm" fill={!!ollamaOk} />
              Ollama ({engineHealth?.ollama_model}) {ollamaOk ? 'connected' : 'offline'}
            </div>
          )}
          {!engineUp && (
            <p className="text-amber-400 text-[11px] flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/30 border border-amber-900 rounded-md">
              <MI icon="terminal" className="text-sm" />
              Run: <code className="font-mono">venv\Scripts\uvicorn main:app --port 8000</code>
            </p>
          )}
        </div>

        {/* Ollama CORS / connection error guide — shown only in local mode when Ollama is unreachable */}
        <AnimatePresence>
          {localMode && engineUp && !ollamaOk && (
            <OllamaConnectionError onRetry={fetchEngineHealth} />
          )}
        </AnimatePresence>

        {/* ESG Health Score Gauge */}
        <EsgScoreGauge kpiResult={kpiData?.kpiResult} />

        {/* Nitro Enclave secure terminal visualizer */}
        <NitroEnclaveVisualizer isProcessing={isProcessing} />

        {/* Verified extraction — extracted vs calculated grid */}
        <AnimatePresence mode="wait">
          {latestVerified && (
            <KPIResultsPanel
              key={latestVerified._id}
              documentName={latestVerified.originalFileName}
              category={latestVerified.brsrCategory}
              extractedRawValues={latestVerified.extractedRawValues}
              calculatedKpis={latestVerified.calculatedKpis}
            />
          )}
        </AnimatePresence>

        {/* Mandatory checklist */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <h2 className="font-semibold text-zinc-100 text-[13px] mb-3 flex items-center gap-2">
            <MI icon="checklist" className="text-emerald-500 text-base" />
            Mandatory Category Checklist
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {MANDATORY_CATEGORIES.map(cat => {
              const verified = kpiData?.verifiedCategories?.includes(cat);
              return (
                <div key={cat} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium ${
                  verified
                    ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900'
                    : 'bg-zinc-800/50 text-zinc-500 border border-zinc-800'
                }`}>
                  <MI icon={verified ? 'check_circle' : 'radio_button_unchecked'} className="text-sm flex-shrink-0" fill={verified} />
                  <span className="capitalize">{cat.replace(/_/g, ' ')}</span>
                </div>
              );
            })}
          </div>
          {!mandatoryComplete && (
            <p className="text-amber-500 text-[11px] mt-3 flex items-center gap-1.5">
              <MI icon="lock" className="text-sm" />
              Report generation locked until all mandatory categories are verified.
            </p>
          )}
        </div>

        {/* Report output */}
        {genError && (
          <div className="glass-panel rounded-xl p-4 border border-red-500/20 flex items-center gap-3 text-red-400 text-sm">
            <MI icon="error" className="text-xl flex-shrink-0" fill />
            {genError}
          </div>
        )}
        {report && (
          <div className="bg-zinc-900 border border-emerald-900 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
              <div>
                <h2 className="font-semibold text-emerald-400 text-sm flex items-center gap-1.5">
                  <MI icon="verified" className="text-base" fill /> BRSR Annexure I Generated
                </h2>
                <p className="text-zinc-500 text-[11px] mt-0.5">
                  SEBI format · {report.reportMetadata?.company?.name || '—'} · FY {report.reportMetadata?.financialYear || '—'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadReportPdf}
                  disabled={downloadingPdf}
                  className="flex items-center gap-1.5 text-[11px] bg-emerald-700 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-wait px-3 py-1.5 rounded-md text-white font-semibold transition-colors">
                  <MI icon={downloadingPdf ? 'sync' : 'picture_as_pdf'} className={`text-sm ${downloadingPdf ? 'animate-spin' : ''}`} fill />
                  {downloadingPdf ? 'Rendering…' : 'Download PDF'}
                </button>
                <button
                  onClick={downloadReportJson}
                  className="flex items-center gap-1.5 text-[11px] border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 px-3 py-1.5 rounded-md text-zinc-400 font-semibold transition-colors">
                  <MI icon="data_object" className="text-sm" /> JSON
                </button>
              </div>
            </div>
            <details className="mt-2">
              <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300 select-none">
                View raw JSON payload
              </summary>
              <pre className="text-xs text-zinc-300 overflow-auto max-h-64 bg-black/40 rounded-xl p-4 border border-white/5 mt-2">
                {JSON.stringify(report, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* KPI Summary */}
        {kpiData?.kpiResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-zinc-100 text-[13px]">Verified KPI Summary</h2>
              <button
                onClick={handleRecalculate}
                disabled={recalculating}
                title="Re-aggregate all verified document KPIs into the summary (fixes stale 0 values)"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-md border border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40 disabled:cursor-wait transition-colors"
              >
                <MI icon={recalculating ? 'sync' : 'refresh'} className={`text-sm ${recalculating ? 'animate-spin' : ''}`} />
                {recalculating ? 'Refreshing…' : 'Refresh KPIs'}
              </button>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Environmental
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <KpiCard label="Scope 1 GHG" value={env?.scope1_tco2e} unit="tCO₂e" />
                <KpiCard label="Scope 2 GHG" value={env?.scope2_tco2e} unit="tCO₂e" />
                <KpiCard label="Scope 3 GHG" value={env?.scope3_tco2e} unit="tCO₂e" />
                <KpiCard label="Total Energy" value={env?.total_energy_kwh} unit="kWh" />
                <KpiCard label="Total Water" value={env?.total_water_kl} unit="KL" />
                <KpiCard label="Renewable %" value={env?.renewable_energy_pct} unit="%" />
                <KpiCard label="Total Waste" value={env?.total_waste_mt} unit="MT" />
                <KpiCard label="GHG Intensity" value={env?.ghg_intensity_per_rupee} unit="tCO₂e/Cr" />
              </div>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" />Social
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <KpiCard label="Female Wage %" value={social?.female_wage_pct} unit="%" />
                <KpiCard label="Well-being Spend" value={social?.wellbeing_spend_pct_revenue} unit="% revenue" />
                <KpiCard label="MSME Procurement" value={social?.msme_procurement_pct} unit="%" />
                <KpiCard label="LTIFR Employees" value={social?.ltifr_employees} unit="per M hrs" />
              </div>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block" />Governance
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <KpiCard label="Payable Days" value={gov?.accounts_payable_days} unit="days" />
                <KpiCard label="Data Breach %" value={gov?.data_breach_pct_incidents} unit="% events" />
                <KpiCard label="Related Party Buy" value={gov?.related_party_purchase_pct} unit="%" />
                <KpiCard label="Reg. Fines" value={gov?.regulatory_fines_count} unit="incidents" />
              </div>
            </div>
          </div>
        )}

        {/* ── AI Actionable Insights (preview — top 3 only) ────────── */}
        <ActionableInsights insights={insights.slice(0, 3)} />
        {insights.length > 3 && (
          <div className="flex justify-start">
            <Link
              to="/admin/war-room/actionable-plans"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-[11px] font-semibold rounded-md transition-colors"
            >
              <MI icon="lightbulb" className="text-sm" fill />
              View all {insights.length} Actionable Plans
              <MI icon="arrow_forward" className="text-xs" />
            </Link>
          </div>
        )}

        {/* System Infrastructure Health */}
        <SystemHealthPanel documents={documents} engineHealth={engineHealth} />

        {/* Processing Queue */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-100 text-[13px] flex items-center gap-2">
              <MI icon="dynamic_feed" className="text-emerald-500 text-base" />
              Document Processing Queue
            </h2>
            <span className="text-[10px] text-zinc-600 font-mono tabular-nums">{documents.length} document{documents.length !== 1 ? 's' : ''}</span>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12 gap-2">
              <div className="w-4 h-4 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
              <p className="text-zinc-600 text-xs">Loading…</p>
            </div>
          )}

          {!loading && documents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <MI icon="inbox" className="text-zinc-700 text-4xl mb-3" />
              <h4 className="text-zinc-400 font-medium text-sm mb-1">Queue empty</h4>
              <p className="text-zinc-600 text-xs max-w-xs">
                No documents uploaded yet. Ask team members to upload compliance documents.
              </p>
            </div>
          )}

          {!loading && documents.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-zinc-800 bg-zinc-900/80">
                    <tr>
                      {['Document', 'Uploader', 'Category', 'Uploaded', 'Status', 'Latency', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {documents.map(doc => {
                      const canRetry = doc.status === 'failed' || doc.status === 'processing';
                      const hasLatency = doc.processingTimeS != null;
                      const completedTime = doc.completedAt
                        ? new Date(doc.completedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
                        : null;
                      return (
                        <tr key={doc._id} className="hover:bg-zinc-800/40 transition-colors group">
                          {/* Document name */}
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <MI icon={doc.status === 'verified' ? 'check_circle' : 'description'}
                                className={`text-sm flex-shrink-0 ${doc.status === 'verified' ? 'text-emerald-500' : 'text-zinc-600'}`}
                                fill={doc.status === 'verified'} />
                              <span className="text-zinc-100 text-[12px] font-medium max-w-[140px] truncate">{doc.originalFileName}</span>
                            </div>
                          </td>
                          {/* Uploader */}
                          <td className="px-4 py-2.5 text-zinc-500 text-[12px]">{doc.uploadedBy?.fullName || '—'}</td>
                          {/* Category */}
                          <td className="px-4 py-2.5 text-zinc-500 text-[11px] capitalize">{doc.brsrCategory.replace(/_/g, ' ')}</td>
                          {/* Uploaded date + completed time */}
                          <td className="px-4 py-2.5">
                            <span className="text-zinc-500 text-[11px] font-mono block tabular-nums">
                              {new Date(doc.createdAt).toLocaleDateString('en-IN')}
                            </span>
                            {completedTime && (
                              <span className="text-zinc-700 text-[10px] font-mono block mt-0.5 tabular-nums">
                                ✓ {completedTime}
                              </span>
                            )}
                          </td>
                          {/* Status badge */}
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${STATUS_CHIP[doc.status] || STATUS_CHIP.pending} text-[10px] font-semibold`}>
                              <span className={`w-1 h-1 rounded-full flex-shrink-0 ${STATUS_DOT[doc.status] || STATUS_DOT.pending}`} />
                              {doc.status}
                            </span>
                          </td>
                          {/* Latency */}
                          <td className="px-4 py-2.5">
                            {hasLatency ? (
                              <span className={`font-mono text-[11px] tabular-nums ${
                                doc.processingTimeS < 5  ? 'text-emerald-500' :
                                doc.processingTimeS < 20 ? 'text-amber-400' :
                                                           'text-red-400'
                              }`}>
                                {doc.processingTimeS.toFixed(1)}s
                              </span>
                            ) : (
                              <span className="text-zinc-700 text-[11px] font-mono">
                                {doc.status === 'processing' ? (
                                  <span className="flex items-center gap-1 text-blue-400">
                                    <MI icon="sync" className="text-xs animate-spin" />
                                    live
                                  </span>
                                ) : '—'}
                              </span>
                            )}
                          </td>
                          {/* Actions */}
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-3">
                              {canRetry && (
                                <button
                                  onClick={() => handleRetry(doc._id, doc.originalFileName)}
                                  disabled={retrying === doc._id}
                                  className="text-[11px] text-zinc-400 hover:text-zinc-100 disabled:opacity-40 transition-colors flex items-center gap-0.5">
                                  <MI icon="refresh" className={`text-sm ${retrying === doc._id ? 'animate-spin' : ''}`} />
                                  {retrying === doc._id ? '…' : 'Retry'}
                                </button>
                              )}
                              {doc.status === 'verified' && (
                                <button
                                  onClick={() => handleReprocess(doc._id, doc.originalFileName)}
                                  disabled={reprocessing === doc._id}
                                  title="Re-run AI extraction + KPI calculation"
                                  className="text-[11px] text-amber-500 hover:text-amber-300 disabled:opacity-40 transition-colors flex items-center gap-0.5">
                                  <MI icon={reprocessing === doc._id ? 'sync' : 'bolt'} className={`text-sm ${reprocessing === doc._id ? 'animate-spin' : ''}`} fill />
                                  {reprocessing === doc._id ? '…' : 'Re-check'}
                                </button>
                              )}
                              {(doc.status === 'verified' || doc.extractedRawValues) && (
                                <button
                                  onClick={() => setAuditDocId(doc._id)}
                                  title="View AI extraction audit trail"
                                  className="text-[11px] text-sky-500 hover:text-sky-300 transition-colors flex items-center gap-0.5">
                                  <MI icon="account_tree" className="text-sm" />
                                  Audit
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-[10px] text-zinc-600 font-mono">{documents.length} row{documents.length !== 1 ? 's' : ''}</span>
                {documents[0]?.processingLog?.length > 0 && (
                  <span className="text-[10px] text-zinc-600 max-w-sm truncate">
                    {documents[0].processingLog.slice(-1)[0]?.message || ''}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Audit Trail Modal — portal-rendered outside main layout */}
      {auditDocId && (
        <AuditTrailModal
          documentId={auditDocId}
          onClose={() => setAuditDocId(null)}
        />
      )}

      {/* ESG Chat Widget — fixed floating button + panel */}
      <EsgChatWidget />
    </div>
  );
};

export default AIWarRoom;
