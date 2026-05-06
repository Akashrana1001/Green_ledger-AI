import { useState, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import UploadWidget from '../components/UploadWidget';
import MI from '../components/MI';

const STATUS_CHIP = {
  pending:    'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  processing: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  verified:   'bg-emerald-900/20 text-emerald-400 border border-emerald-700/30',
  failed:     'bg-red-500/10 text-red-400 border border-red-500/20',
};

const SIDEBAR_NAV = [
  { icon: 'inventory_2', label: 'Vault',      section: 'upload'    },
  { icon: 'menu_book',   label: 'Ledger',     section: 'docs'      },
  { icon: 'fact_check',  label: 'Audit Logs', section: 'audit'     },
  { icon: 'settings',    label: 'Settings',   section: 'settings'  },
];

const SUPPLIER_DOCS = [
  'Energy / electricity bills',
  'MSME registration certificates',
  'Labour / wage declarations',
  'Waste disposal records',
  'Scope 3 emissions data',
];

const SupplierPortal = () => {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const uploadRef        = useRef(null);
  const docsRef          = useRef(null);
  const [documents,     setDocuments]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [activeSection, setActiveSection] = useState('upload');

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await axiosClient.get('/api/documents');
      setDocuments(res.data.documents);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useState(() => { fetchDocuments(); }, [fetchDocuments]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const scrollTo = (ref) => ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const handleSidebarNav = (section) => {
    setActiveSection(section);
    if (section === 'upload')   scrollTo(uploadRef);
    if (section === 'docs')     scrollTo(docsRef);
    if (section === 'audit')    toast('Audit log coming soon.', { icon: '📋' });
    if (section === 'settings') toast('Settings coming soon.', { icon: '⚙️' });
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="fixed top-0 right-0 w-[500px] h-[500px] green-orb -z-0 opacity-18 translate-x-1/4 -translate-y-1/4" />
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] green-orb -z-0 opacity-12 -translate-x-1/4 translate-y-1/4" />

      {/* Fixed Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#050505]/85 backdrop-blur-md border-b border-white/10 flex items-center px-6 gap-6">
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-700 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <MI icon="eco" className="text-white text-base" fill />
          </div>
          <span className="font-bold text-base tracking-tight hidden md:block">GreenLedger AI</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-500 flex-1">
          <button onClick={() => handleSidebarNav('upload')} className="text-emerald-400 font-medium hover:text-emerald-300 transition-colors">Vault</button>
          <button onClick={() => handleSidebarNav('docs')}   className="hover:text-zinc-300 transition-colors">Ledger</button>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <button onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 border border-white/10 rounded-lg text-sm text-zinc-400 hover:text-white hover:border-white/20 transition-all">
            <MI icon="logout" className="text-base" />
            <span className="hidden sm:block">Logout</span>
          </button>
          <div className="w-9 h-9 bg-emerald-500/15 border border-emerald-700/30 rounded-full flex items-center justify-center text-emerald-400 font-bold text-sm flex-shrink-0">
            {(user?.fullName?.[0] || 'S').toUpperCase()}
          </div>
        </div>
      </header>

      {/* Fixed Left Sidebar */}
      <aside className="fixed top-16 left-0 bottom-0 w-64 bg-zinc-950 border-r border-white/10 z-40 hidden md:flex flex-col">
        <div className="p-5 border-b border-white/10">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Supplier Portal</p>
          <p className="text-xs text-zinc-600">Welcome, {user?.fullName || 'Supplier'}</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {SIDEBAR_NAV.map(({ icon, label, section }) => (
            <button
              key={label}
              onClick={() => handleSidebarNav(section)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all text-left ${
                activeSection === section
                  ? 'text-emerald-400 bg-emerald-950/20 border-r-2 border-emerald-600 font-medium'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
            >
              <MI icon={icon} className="text-xl" />
              {label}
            </button>
          ))}
        </nav>

        {/* Required docs hint */}
        <div className="p-4 border-t border-white/10">
          <p className="text-xs font-bold text-zinc-500 mb-3 uppercase tracking-wide">Documents to Submit</p>
          <ul className="text-xs text-zinc-600 space-y-2">
            {SUPPLIER_DOCS.map(item => (
              <li key={item} className="flex items-start gap-2">
                <MI icon="chevron_right" className="text-emerald-700 text-sm flex-shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 pt-24 px-4 md:px-6 pb-24 relative z-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Supplier Portal</h1>
          <p className="text-zinc-500 text-sm">
            Welcome, {user?.fullName || 'Supplier'} · Submit ESG supply chain documents for BRSR Core analysis
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Upload panel */}
          <div className="lg:col-span-5" ref={uploadRef} id="supplier-upload">
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-green-700 rounded-lg flex items-center justify-center shadow-md shadow-emerald-500/25">
                  <MI icon="cloud_upload" className="text-white text-lg" />
                </div>
                <div>
                  <h2 className="font-bold text-white text-sm">Secure Vault Ingestion</h2>
                  <p className="text-zinc-500 text-xs">AWS S3 encrypted · AI extraction starts immediately</p>
                </div>
              </div>
              <UploadWidget onSuccess={fetchDocuments} />
            </div>
          </div>

          {/* Documents table */}
          <div className="lg:col-span-7" ref={docsRef} id="supplier-docs">
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-white text-sm">My Submitted Documents</h2>
                  <p className="text-zinc-600 text-xs mt-0.5">
                    {documents.length} document{documents.length !== 1 ? 's' : ''} total
                  </p>
                </div>
                <button onClick={fetchDocuments} title="Refresh">
                  <MI icon="refresh" className="text-zinc-500 hover:text-zinc-300 transition-colors text-xl" />
                </button>
              </div>

              {loading && <LoadingSpinner message="Loading your documents..." />}
              {!loading && error && (
                <div className="p-6 text-red-400 text-sm flex items-center gap-2">
                  <MI icon="error" className="text-base" /> {error}
                </div>
              )}
              {!loading && !error && documents.length === 0 && (
                <div className="py-16 text-center">
                  <MI icon="cloud_off" className="text-4xl text-zinc-700 mb-3" />
                  <p className="text-zinc-500 font-medium text-sm">No documents submitted yet</p>
                  <p className="text-zinc-700 text-xs mt-1">Use the upload panel to submit energy bills, certificates, and declarations</p>
                </div>
              )}
              {!loading && !error && documents.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#09090b]">
                      <tr className="border-b border-white/10 text-zinc-500 text-xs uppercase tracking-wider">
                        <th className="px-6 py-3 text-left">File</th>
                        <th className="px-6 py-3 text-left">Category</th>
                        <th className="px-6 py-3 text-left">Status</th>
                        <th className="px-6 py-3 text-left">Uploaded</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {documents.map((doc) => (
                        <tr key={doc._id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 text-zinc-300 max-w-[160px]">
                            <div className="flex items-center gap-2">
                              <MI icon="description" className="text-zinc-600 text-base flex-shrink-0" />
                              <span className="truncate">{doc.originalFileName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-zinc-500 capitalize text-xs">{doc.brsrCategory.replace(/_/g, ' ')}</td>
                          <td className="px-6 py-4">
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_CHIP[doc.status] || STATUS_CHIP.pending}`}>
                              {doc.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-zinc-600 text-xs">{new Date(doc.createdAt).toLocaleDateString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-6 py-3 border-t border-white/10 text-zinc-700 text-xs">
                    Showing {documents.length} submission{documents.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-[#09090b] border-t border-white/10 flex items-center justify-around md:hidden z-50">
        <button onClick={() => handleSidebarNav('upload')} className="flex flex-col items-center gap-1 text-emerald-400">
          <MI icon="inventory_2" className="text-xl" />
          <span className="text-xs">Vault</span>
        </button>
        <button onClick={() => handleSidebarNav('docs')} className="flex flex-col items-center gap-1 text-zinc-500">
          <MI icon="menu_book" className="text-xl" />
          <span className="text-xs">Ledger</span>
        </button>
        <button onClick={handleLogout} className="flex flex-col items-center gap-1 text-zinc-500">
          <MI icon="logout" className="text-xl" />
          <span className="text-xs">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default SupplierPortal;
