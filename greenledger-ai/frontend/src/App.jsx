import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PageTransition from './components/PageTransition';

import Home               from './pages/Home';
import Auth               from './pages/Auth';
import TwoFactorVerify    from './pages/TwoFactorVerify';
import TermsAndConditions from './pages/TermsAndConditions';
import AdminDashboard     from './pages/AdminDashboard';
import AIWarRoom          from './pages/AIWarRoom';
import TeamPortal         from './pages/TeamPortal';
import SupplierPortal     from './pages/SupplierPortal';
import AdminQuestionnaire from './pages/AdminQuestionnaire';
import TeamQuestionnaire  from './pages/TeamQuestionnaire';
import Scope3Network      from './pages/Scope3Network';
import ActionablePlans    from './pages/ActionablePlans';
import AdminProfile       from './pages/AdminProfile';
import AdminSettings      from './pages/AdminSettings';

/* ── Shorthand wrapper ──────────────────────────────────────────────────── */
const T = ({ children }) => <PageTransition>{children}</PageTransition>;

/* ── Routes component — must live inside BrowserRouter for useLocation ─── */
const AppRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.key}>

        {/* ── Public ────────────────────────────────────────────────── */}
        <Route path="/"         element={<T><Home /></T>} />
        <Route path="/register" element={<T><Auth /></T>} />
        <Route path="/login"    element={<T><Auth /></T>} />

        {/* ── 2FA challenge screen — semi-public (needs tempToken in state) */}
        <Route path="/verify-2fa" element={<T><TwoFactorVerify /></T>} />

        {/* ── TOS wall — accessible to any authenticated Admin ────────── */}
        <Route path="/terms" element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <T><TermsAndConditions /></T>
          </ProtectedRoute>
        } />

        {/* ── Admin ─────────────────────────────────────────────────── */}
        <Route path="/admin/dashboard" element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <T><AdminDashboard /></T>
          </ProtectedRoute>
        } />
        <Route path="/admin/war-room" element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <T><AIWarRoom /></T>
          </ProtectedRoute>
        } />
        <Route path="/admin/questionnaire" element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <T><AdminQuestionnaire /></T>
          </ProtectedRoute>
        } />
        <Route path="/admin/scope3" element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <T><Scope3Network /></T>
          </ProtectedRoute>
        } />
        <Route path="/admin/war-room/actionable-plans" element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <T><ActionablePlans /></T>
          </ProtectedRoute>
        } />
        <Route path="/admin/profile" element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <T><AdminProfile /></T>
          </ProtectedRoute>
        } />
        <Route path="/admin/settings" element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <T><AdminSettings /></T>
          </ProtectedRoute>
        } />

        {/* ── Team Member ───────────────────────────────────────────── */}
        <Route path="/team/portal" element={
          <ProtectedRoute allowedRoles={['TeamMember']}>
            <T><TeamPortal /></T>
          </ProtectedRoute>
        } />
        <Route path="/team/questionnaire" element={
          <ProtectedRoute allowedRoles={['TeamMember']}>
            <T><TeamQuestionnaire /></T>
          </ProtectedRoute>
        } />

        {/* ── Supplier ──────────────────────────────────────────────── */}
        <Route path="/supplier/portal" element={
          <ProtectedRoute allowedRoles={['Supplier']}>
            <T><SupplierPortal /></T>
          </ProtectedRoute>
        } />

        {/* ── Fallback ──────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </AnimatePresence>
  );
};

/* ── App root ───────────────────────────────────────────────────────────── */
const App = () => {
  /* Only mount GoogleOAuthProvider when a real client ID is configured.
   * An empty-string clientId causes useGoogleOAuth() to throw during the
   * Login/Register render because the provider context is never properly
   * initialised — producing a blank screen.
   * GoogleLoginButton / GoogleRegisterButton only render when this is set,
   * so useGoogleLogin() is never called outside the provider.              */
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const core = (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1f2937', color: '#f9fafb', border: '1px solid #374151' },
          success: { iconTheme: { primary: '#10b981', secondary: '#f9fafb' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#f9fafb' } },
        }}
      />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );

  return googleClientId
    ? <GoogleOAuthProvider clientId={googleClientId}>{core}</GoogleOAuthProvider>
    : core;
};

export default App;
