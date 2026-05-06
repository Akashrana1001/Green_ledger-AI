import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import axiosClient from '../api/axiosClient';
import MI from './MI';

const BRSR_CATEGORIES = [
  { value: 'electricity_bill',      label: 'Electricity Bill (Scope 2 GHG)' },
  { value: 'fuel_consumption',      label: 'Fuel Consumption (Scope 1 GHG)' },
  { value: 'water_usage',           label: 'Water Usage Records' },
  { value: 'waste_records',         label: 'Waste Generation Records' },
  { value: 'hr_wages_data',         label: 'HR Wages Data (Social KPIs)' },
  { value: 'supplier_msme_cert',    label: 'Supplier / MSME Certificate' },
  { value: 'posh_records',          label: 'POSH Compliance Records' },
  { value: 'governance_report',     label: 'Governance / Board Report' },
  { value: 'accounts_payable',      label: 'Accounts Payable Ledger' },
  { value: 'cyber_security_log',    label: 'Cyber Security Log' },
  { value: 'safety_incidents_log',  label: 'Safety Incidents Log (LTIFR / Fatalities)' },
  { value: 'air_emissions_log',     label: 'Air Emissions Log (NOx / SOx / PM)' },
  { value: 'scope3_emissions_data', label: 'Scope 3 Emissions (Supply Chain / Travel)' },
  { value: 'workforce_records',     label: 'Workforce Records (Headcount / Gender / Board)' },
  { value: 'financial_statements',  label: 'Financial Statements (Revenue / Waste / Water)' },
  { value: 'employee_benefits',     label: 'Employee Benefits Data (Health / Insurance %)' },
  { value: 'consumer_complaints',   label: 'Consumer Complaints Register' },
];

const FILE_TYPE_CONFIG = {
  pdf:  { icon: 'picture_as_pdf', color: 'text-red-400',     bg: 'bg-red-950/30 border-red-800/30'      },
  png:  { icon: 'image',          color: 'text-sky-400',     bg: 'bg-sky-950/30 border-sky-800/30'      },
  jpg:  { icon: 'image',          color: 'text-sky-400',     bg: 'bg-sky-950/30 border-sky-800/30'      },
  jpeg: { icon: 'image',          color: 'text-sky-400',     bg: 'bg-sky-950/30 border-sky-800/30'      },
  xlsx: { icon: 'table_chart',    color: 'text-emerald-400', bg: 'bg-emerald-950/30 border-emerald-800/30' },
  xls:  { icon: 'table_chart',    color: 'text-emerald-400', bg: 'bg-emerald-950/30 border-emerald-800/30' },
  docx: { icon: 'article',        color: 'text-violet-400',  bg: 'bg-violet-950/30 border-violet-800/30' },
  doc:  { icon: 'article',        color: 'text-violet-400',  bg: 'bg-violet-950/30 border-violet-800/30' },
};

const getFileConfig = (name) => {
  const ext = name.split('.').pop().toLowerCase();
  return FILE_TYPE_CONFIG[ext] || { icon: 'description', color: 'text-zinc-400', bg: 'bg-zinc-900/40 border-zinc-800/30' };
};

const formatBytes = (b) => {
  if (b < 1024)    return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};

/* ── UploadWidget ────────────────────────────────────────────────────────── */
const UploadWidget = ({ onSuccess }) => {
  const fileInputRef = useRef(null);
  const [files,       setFiles]       = useState([]);   // File[]
  const [category,    setCategory]    = useState('');
  const [isDragging,  setIsDragging]  = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [progressMap, setProgressMap] = useState({});   // { index: 0-100 }
  const [statusMap,   setStatusMap]   = useState({});   // { index: 'uploading'|'done'|'error' }

  const mergeFiles = (incoming) => {
    setFiles(prev => {
      const combined = [...prev, ...Array.from(incoming)];
      if (combined.length > 3) {
        toast.error('Maximum 3 files per batch');
        return combined.slice(0, 3);
      }
      return combined;
    });
  };

  const removeFile = (i) => {
    setFiles(prev => prev.filter((_, idx) => idx !== i));
    setProgressMap(prev => { const n = { ...prev }; delete n[i]; return n; });
    setStatusMap(prev =>   { const n = { ...prev }; delete n[i]; return n; });
  };

  /* ── Drag handlers ────────────────────────────────────────────────────── */
  const handleDragOver  = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop      = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    if (files.length >= 3) { toast.error('Maximum 3 files allowed'); return; }
    mergeFiles(e.dataTransfer.files);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.length]);

  /* ── Single file upload (called in parallel) ──────────────────────────────
   * CRITICAL: Do NOT set 'Content-Type': 'multipart/form-data' manually.
   * Doing so strips the boundary string, multer's busboy parser cannot find
   * the field delimiters, and req.file ends up undefined → "No file uploaded".
   * Setting Content-Type to undefined forces axios to override the JSON
   * default from axiosClient.js and auto-generate the proper multipart
   * Content-Type with the WebKit boundary.                                 */
  const uploadOne = (file, idx) => {
    const fd = new FormData();
    fd.append('document', file);
    fd.append('brsrCategory', category);

    setStatusMap(prev => ({ ...prev, [idx]: 'uploading' }));

    return axiosClient.post('/api/documents/upload', fd, {
      headers: { 'Content-Type': undefined },
      onUploadProgress: (e) => {
        if (e.total) setProgressMap(prev => ({ ...prev, [idx]: Math.round((e.loaded / e.total) * 100) }));
      },
      timeout: 120000, // 2-min ceiling so a hung backend doesn't lock the UI forever
    })
      .then(() => setStatusMap(prev => ({ ...prev, [idx]: 'done' })))
      .catch((err) => {
        /* Log the EXACT failure point so we stop guessing which vector blew up */
        const status = err.response?.status;
        const body   = err.response?.data;
        const code   = err.code;                      // ECONNABORTED / ERR_NETWORK / etc.
        console.error(`[UploadWidget] '${file.name}' failed`, {
          httpStatus : status   ?? '(no response — network/timeout/CORS)',
          axiosCode  : code     ?? '(none)',
          serverMsg  : body?.message ?? body ?? '(no body)',
          rawError   : err.message,
        });
        setStatusMap(prev => ({ ...prev, [idx]: 'error' }));
        const reason = body?.message || code || err.message || 'unknown';
        throw new Error(`${file.name} (${reason})`);
      });
  };

  /* ── Batch submit ─────────────────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();

    /* Explicit, user-visible validation. Silent `return`s here previously
     * caused a "nothing happens" UX when the user clicked an enabled-looking
     * button without satisfying both prerequisites. Each missing input now
     * surfaces its own toast so the blocker is obvious.                    */
    if (!category) {
      toast.error('Please select a BRSR Category before uploading.');
      return;
    }
    if (!files.length) {
      toast.error('Please add at least one file to upload.');
      return;
    }

    setUploading(true);
    setProgressMap({});
    setStatusMap({});

    const tid = toast.loading(`Uploading ${files.length} file${files.length > 1 ? 's' : ''}…`);
    const errors = [];

    await Promise.allSettled(
      files.map((f, i) => uploadOne(f, i).catch(err => errors.push(err.message)))
    );

    if (errors.length === 0) {
      toast.success(`${files.length} document${files.length > 1 ? 's' : ''} uploaded — AI processing started.`, { id: tid });
      setFiles([]);
      setCategory('');
      setProgressMap({});
      setStatusMap({});
      onSuccess?.();
    } else {
      toast.error(`${errors.length} upload${errors.length > 1 ? 's' : ''} failed: ${errors.join(', ')}`, { id: tid });
    }
    setUploading(false);
  };

  const allDone  = files.length > 0 && files.every((_, i) => statusMap[i] === 'done');
  /* canUpload now ONLY blocks the in-flight state. Missing-file or missing-
   * category cases keep the button enabled so the click can reach
   * handleSubmit and surface a toast — otherwise the disabled button looks
   * inert and the user has no clue what's wrong.                          */
  const canUpload = !uploading;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Category selector */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-2">BRSR Category</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          required
          disabled={uploading}
          className="w-full bg-[#09090b] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors appearance-none disabled:opacity-50"
        >
          <option value="">Select a category…</option>
          {BRSR_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {/* Drop zone — uses <label htmlFor> so the browser reliably opens the
       * file picker on click without depending on programmatic .click() calls. */}
      <label
        htmlFor="upload-file-input"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          'relative block border-2 border-dashed rounded-xl py-8 px-4 text-center transition-all duration-200',
          uploading || files.length >= 3 ? 'cursor-not-allowed pointer-events-none' : 'cursor-pointer',
          isDragging
            ? 'border-emerald-500/70 bg-emerald-950/25 scale-[1.01]'
            : files.length >= 3
              ? 'border-white/8 bg-zinc-900/20'
              : 'border-white/12 hover:border-emerald-700/45 hover:bg-emerald-950/10',
        ].join(' ')}
      >
        <input
          id="upload-file-input"
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx,.txt,.md,.csv,.log,.tsv"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              mergeFiles(e.target.files);
            }
            e.target.value = '';
          }}
          disabled={uploading}
        />
        <MI
          icon={isDragging ? 'download' : 'cloud_upload'}
          className={`text-4xl mb-2 block mx-auto transition-colors ${isDragging ? 'text-emerald-400' : 'text-zinc-600'}`}
        />
        {files.length >= 3 ? (
          <p className="text-sm text-zinc-500 font-medium">3 files selected — batch is full</p>
        ) : (
          <>
            <p className="text-sm font-medium text-zinc-400">
              {isDragging ? 'Release to add files' : 'Drag & drop files here'}
            </p>
            <p className="text-xs text-zinc-600 mt-1">PDF · PNG · JPG · TXT · CSV · MD · XLSX · DOCX · max 3 files per batch</p>

            {/* Explicit click target — guaranteed to open the file picker even
             * when click events on the parent dropzone are intercepted. */}
            <button
              type="button"
              disabled={uploading}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <MI icon="folder_open" className="text-base" />
              Browse Files
            </button>
          </>
        )}
      </label>

      {/* Animated file cards */}
      <AnimatePresence mode="popLayout">
        {files.map((file, i) => {
          const cfg      = getFileConfig(file.name);
          const progress = progressMap[i] ?? 0;
          const status   = statusMap[i];

          return (
            <motion.div
              key={`${file.name}-${i}`}
              layout
              initial={{ opacity: 0, scale: 0.88, y: 16 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{    opacity: 0, scale: 0.85, x: -24 }}
              /* stiffness:260 / damping:20 — matches ActionableInsights card spring.
                 delay removed: per-index delays compound at 3 files causing
                 the last card to appear noticeably late (~180ms lag).         */
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className={[
                'p-3.5 rounded-xl border transition-colors',
                status === 'done'  ? 'border-sky-700/35 bg-sky-950/15' :
                status === 'error' ? 'border-red-700/35 bg-red-950/20'  :
                'border-white/10 bg-zinc-900/40',
              ].join(' ')}
            >
              {/* File info row */}
              <div className="flex items-center gap-3 mb-2.5">
                <div className={`w-9 h-9 ${cfg.bg} border rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <MI icon={cfg.icon} className={`${cfg.color} text-lg`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">{file.name}</p>
                  <p className="text-zinc-600 text-[10px]">{formatBytes(file.size)}</p>
                </div>
                {status === 'done' ? (
                  <span title="Uploaded — AI verification in progress" className="flex-shrink-0 flex items-center gap-1 text-sky-400">
                    <MI icon="hourglass_top" className="text-lg animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Verifying</span>
                  </span>
                ) : status === 'error' ? (
                  <MI icon="error" className="text-red-400 text-xl flex-shrink-0" />
                ) : uploading ? (
                  <span className="text-xs font-bold text-zinc-400 flex-shrink-0 w-8 text-right">{progress}%</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0 p-0.5"
                  >
                    <MI icon="close" className="text-xl" />
                  </button>
                )}
              </div>

              {/* Progress bar — animated via Framer Motion width */}
              <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                  className={`h-1 rounded-full ${
                    status === 'error' ? 'bg-red-500' :
                    status === 'done'  ? 'bg-sky-500' : 'bg-emerald-500'
                  }`}
                  initial={{ width: '0%' }}
                  animate={{ width: status === 'done' ? '100%' : `${progress}%` }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                />
              </div>
              {status === 'done' && (
                <p className="text-[10px] text-sky-400/80 mt-1.5 italic">
                  File uploaded. AI is extracting and verifying KPIs — this typically takes 15-30 seconds.
                </p>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Upload button */}
      <motion.button
        type="submit"
        disabled={!canUpload}
        whileTap={canUpload ? { scale: 0.97 } : {}}
        className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl py-3 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_18px_rgba(16,185,129,0.2)] hover:shadow-[0_0_28px_rgba(16,185,129,0.35)]"
      >
        {uploading ? (
          <>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
            </svg>
            Uploading {files.length} file{files.length !== 1 ? 's' : ''}…
          </>
        ) : allDone ? (
          <><MI icon="hourglass_top" className="text-base animate-pulse" /> Uploaded — AI Verification In Progress</>
        ) : (
          <>
            <MI icon="cloud_upload" className="text-base" />
            {!category && files.length === 0
              ? 'Select category & files'
              : !category
                ? 'Select a BRSR category'
                : files.length === 0
                  ? 'Add files to upload'
                  : `Upload ${files.length} Document${files.length !== 1 ? 's' : ''}`}
          </>
        )}
      </motion.button>
    </form>
  );
};

export default UploadWidget;
