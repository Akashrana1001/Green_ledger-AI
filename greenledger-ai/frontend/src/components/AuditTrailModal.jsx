/**
 * AuditTrailModal — "Show Your Work" panel.
 *
 * Fetches GET /api/documents/:id/audit and displays a 3-column pipeline trace:
 *   [Document metadata] → [AI Extracted values] → [Calculated KPIs]
 *
 * Plus a scrollable processing log timeline at the bottom.
 * Answers the #1 judge question: "Did the AI hallucinate?"
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../api/axiosClient';
import MI from './MI';

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const fmt = (v) => {
  if (v === null || v === undefined) return '—';
  if (v === 'DATA_NOT_FOUND') return null; // skip these
  if (typeof v === 'number') return v.toLocaleString('en-IN', { maximumFractionDigits: 4 });
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return `[${v.length} items]`;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const CATEGORY_LABELS = {
  electricity_bill: 'Electricity Bill',     fuel_consumption: 'Fuel Consumption',
  water_usage:      'Water Usage',          waste_records:    'Waste Records',
  hr_wages_data:    'HR / Wages Data',      supplier_msme_cert: 'Supplier MSME Cert',
  posh_records:     'POSH Records',         governance_report: 'Governance Report',
  accounts_payable: 'Accounts Payable',     cyber_security_log: 'Cyber Security Log',
  safety_incidents_log: 'Safety Incidents', air_emissions_log: 'Air Emissions Log',
  scope3_emissions_data: 'Scope 3 Emissions', workforce_records: 'Workforce Records',
  financial_statements: 'Financial Statements', employee_benefits: 'Employee Benefits',
  consumer_complaints: 'Consumer Complaints',
};

const KPI_LABELS = {
  scope1_tco2e: 'Scope 1 GHG (tCO₂e)',   scope2_tco2e: 'Scope 2 GHG (tCO₂e)',
  scope3_tco2e: 'Scope 3 GHG (tCO₂e)',   total_energy_kwh: 'Total Energy (kWh)',
  total_water_kl: 'Total Water (KL)',      total_waste_mt: 'Total Waste (MT)',
  renewable_energy_pct: 'Renewable Energy %', waste_recovered_pct: 'Waste Recovered %',
  water_recycled_pct: 'Water Recycled %', female_wage_pct: 'Female Wage Parity %',
  wellbeing_spend_pct_revenue: 'Wellbeing Spend %', msme_procurement_pct: 'MSME Procurement %',
  ltifr_employees: 'LTIFR (Employees)',   ltifr_workers: 'LTIFR (Workers)',
  accounts_payable_days: 'Payable Days',   data_breach_pct_incidents: 'Data Breach %',
  related_party_purchase_pct: 'Related Party Purchase %',
  regulatory_fines_count: 'Regulatory Fines (Count)',
  ghg_intensity_per_rupee: 'GHG Intensity (tCO₂/Cr)',
  posh_complaints_count: 'POSH Complaints',
};

/* ── KV row ──────────────────────────────────────────────────────────────── */
const KVRow = ({ label, value, highlight }) => (
  <div className={`flex items-start justify-between gap-3 py-1.5 border-b border-white/5 ${highlight ? 'bg-emerald-950/10 -mx-3 px-3 rounded' : ''}`}>
    <span className="text-[10px] text-zinc-500 leading-snug flex-1">{label}</span>
    <span className="text-[10px] font-mono text-zinc-200 text-right max-w-[45%] break-words">{value}</span>
  </div>
);

/* ── Timeline entry ──────────────────────────────────────────────────────── */
const LogEntry = ({ message, createdAt, isLast }) => (
  <div className="flex gap-3">
    <div className="flex flex-col items-center flex-shrink-0">
      <div className="w-2 h-2 rounded-full bg-emerald-600 mt-1 flex-shrink-0" />
      {!isLast && <div className="w-px flex-1 bg-white/5 mt-1" />}
    </div>
    <div className="pb-3 min-w-0">
      <p className="text-[10px] text-zinc-300 leading-snug">{message}</p>
      {createdAt && (
        <p className="text-[9px] text-zinc-700 mt-0.5 font-mono">
          {new Date(createdAt).toLocaleString('en-IN', { hour12: false })}
        </p>
      )}
    </div>
  </div>
);

/* ── Main modal ──────────────────────────────────────────────────────────── */
const AuditTrailModal = ({ documentId, onClose }) => {
  const [doc, setDoc]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  const load = useCallback(async () => {
    try {
      const res = await axiosClient.get(`/api/documents/${documentId}/audit`);
      setDoc(res.data.document);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    load();
    // Close on Escape
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [load, onClose]);

  // Filtered extracted values (skip DATA_NOT_FOUND)
  const extractedEntries = doc?.extractedRawValues
    ? Object.entries(doc.extractedRawValues).filter(([, v]) => v !== 'DATA_NOT_FOUND' && v !== null)
    : [];

  const calculatedEntries = doc?.calculatedKpis
    ? Object.entries(doc.calculatedKpis)
    : [];

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Panel */}
        <motion.div
          key="panel"
          initial={{ opacity: 0, scale: 0.97, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 16 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="w-full max-w-5xl max-h-[88vh] bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 flex-shrink-0">
            <div className="flex items-center gap-3">
              <MI icon="account_tree" className="text-emerald-500 text-base flex-shrink-0" />
              <div>
                <h2 className="font-semibold text-zinc-100 text-sm">AI Extraction Audit Trail</h2>
                <p className="text-[10px] text-zinc-500">
                  {doc ? `${doc.originalFileName} · ${CATEGORY_LABELS[doc.brsrCategory] || doc.brsrCategory}` : 'Loading…'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {doc?.processingTimeS && (
                <span className="text-[10px] font-mono text-zinc-600 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md">
                  {doc.processingTimeS.toFixed(1)}s
                </span>
              )}
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                <MI icon="close" className="text-sm" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20 gap-3 text-zinc-500">
                <MI icon="sync" className="text-xl animate-spin" />
                <span className="text-sm">Loading audit data…</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-20 gap-3 text-red-400">
                <MI icon="error" className="text-xl" fill />
                <span className="text-sm">{error}</span>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Pipeline banner */}
                <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  <span className="px-2 py-1 rounded bg-zinc-900 border border-white/8">1. Source Document</span>
                  <MI icon="arrow_forward" className="text-sm text-zinc-700" />
                  <span className="px-2 py-1 rounded bg-zinc-900 border border-white/8">2. LLM Extraction</span>
                  <MI icon="arrow_forward" className="text-sm text-zinc-700" />
                  <span className="px-2 py-1 rounded bg-emerald-950/30 border border-emerald-700/20 text-emerald-600">3. Python Calculator</span>
                </div>

                {/* 3-column grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                  {/* Col 1: Document metadata */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-md p-4 space-y-0">
                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <MI icon="description" className="text-sm" /> Document
                    </p>
                    <KVRow label="Filename"   value={doc.originalFileName} />
                    <KVRow label="Category"   value={CATEGORY_LABELS[doc.brsrCategory] || doc.brsrCategory} />
                    <KVRow label="File Type"  value={doc.fileType || '—'} />
                    <KVRow label="Status"     value={doc.status} highlight={doc.status === 'verified'} />
                    <KVRow label="Uploaded"   value={doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('en-IN') : '—'} />
                    <KVRow label="Completed"  value={doc.completedAt ? new Date(doc.completedAt).toLocaleString('en-IN', { hour12: false }) : '—'} />
                    {doc.processingTimeS != null && (
                      <KVRow label="Processing" value={`${doc.processingTimeS.toFixed(1)}s`} />
                    )}
                  </div>

                  {/* Col 2: LLM extracted */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-md p-4 space-y-0">
                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <MI icon="smart_toy" className="text-sm" /> LLM Extracted
                      <span className="ml-auto text-zinc-700 font-normal normal-case tracking-normal">
                        {extractedEntries.length} fields
                      </span>
                    </p>
                    {extractedEntries.length === 0 ? (
                      <p className="text-[10px] text-zinc-700 italic mt-2">No extracted values on record.</p>
                    ) : (
                      extractedEntries.map(([k, v]) => {
                        const fv = fmt(v);
                        if (fv === null) return null;
                        return <KVRow key={k} label={k.replace(/_/g, ' ')} value={fv} />;
                      })
                    )}
                  </div>

                  {/* Col 3: Calculated KPIs */}
                  <div className="bg-zinc-900 border border-emerald-900 rounded-md p-4 space-y-0">
                    <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <MI icon="calculate" className="text-sm" /> Python Calculated
                      <span className="ml-auto text-zinc-700 font-normal normal-case tracking-normal text-zinc-600">
                        {calculatedEntries.length} KPIs
                      </span>
                    </p>
                    {calculatedEntries.length === 0 ? (
                      <p className="text-[10px] text-zinc-700 italic mt-2">
                        {doc.status !== 'verified' ? 'Document not yet verified.' : 'No calculated KPIs on record.'}
                      </p>
                    ) : (
                      calculatedEntries.map(([k, v]) => {
                        const fv = fmt(v);
                        if (fv === null) return null;
                        return (
                          <KVRow
                            key={k}
                            label={KPI_LABELS[k] || k.replace(/_/g, ' ')}
                            value={fv}
                            highlight
                          />
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Processing log */}
                {doc.processingLog?.length > 0 && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-md p-4">
                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <MI icon="timeline" className="text-sm" /> Processing Log
                    </p>
                    <div className="space-y-0 max-h-40 overflow-y-auto pr-1">
                      {doc.processingLog.map((entry, i) => (
                        <LogEntry
                          key={i}
                          message={entry.message}
                          createdAt={entry.createdAt}
                          isLast={i === doc.processingLog.length - 1}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AuditTrailModal;
