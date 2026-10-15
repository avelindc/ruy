import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';


// Layouts
import PublicLayout from '@layouts/PublicLayout';
import AuthLayout from '@layouts/AuthLayout';
import AdminLayout from '@layouts/AdminLayout';
import MusicLayout from '@layouts/MusicLayout';

// Public Pages
import HomePage from '@pages/public/HomePage';
import PrivacyPage from '@pages/public/PrivacyPage';
import TermsPage from '@pages/public/TermsPage';
import NotFoundPage from '@pages/public/NotFoundPage';

// Auth Pages
import LoginPage from '@pages/auth/LoginPage';
import RegisterPage from '@pages/auth/RegisterPage';
import ForgotPasswordPage from '@pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@pages/auth/ResetPasswordPage';

// Music Pages (New Dark Theme)
import MusicHomePage from '@pages/music/MusicHomePage';

// User Pages
import MyArtistsPage from '@pages/user/MyArtistsPage';
import ReleasesPage from '@pages/user/ReleasesPage';
import CatalogPage from '@pages/user/CatalogPage';
import AnalyticsPage from '@pages/user/AnalyticsPage';
import RoyaltiesPage from '@pages/user/RoyaltiesPage';
import WithdrawalsPage from '@pages/user/WithdrawalsPage';
import TransactionsPage from '@pages/user/TransactionsPage';
import NotificationsPage from '@pages/user/NotificationsPage';
import SettingsPage from '@pages/user/SettingsPage';

// Admin Pages
import AdminOverview from '@pages/admin/AdminOverview';
import UsersManagement from '@pages/admin/UsersManagement';
import ArtistsManagement from '@pages/admin/ArtistsManagement';
import ReleasesReview from '@pages/admin/ReleasesReview';
import CatalogManagement from '@pages/admin/CatalogManagement';
import CSVImportPage from '@pages/admin/CSVImportPage';
import StreamingReportsPage from '@pages/admin/StreamingReportsPage';
import RoyaltiesManagement from '@pages/admin/RoyaltiesManagement';
import WithdrawalsManagement from '@pages/admin/WithdrawalsManagement';
import TransactionsManagement from '@pages/admin/TransactionsManagement';
import AuditLogsPage from '@pages/admin/AuditLogsPage';
import WebsiteCMSPage from '@pages/admin/WebsiteCMSPage';
import { AuthProvider, useAuth } from '@contexts/AuthContext';
import { isAdminRole } from '@lib/auth/authService';
import ErrorBoundary from '@components/ErrorBoundary';

import './App.css';

function AppRoutes() {
  const { isAuthenticated, userRole, isLoading, isAdmin, user, sessionVerificationError, refreshAuth, logout } = useAuth();
  const effectiveRole = userRole || user?.role || '';
  const isUserAdmin = Boolean(isAdmin || isAdminRole(effectiveRole));
  const defaultDashboard = isUserAdmin ? '/admin' : '/dashboard';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0B0E] text-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xs text-gray-400 font-medium">Memuat Breakout Music...</p>
        </div>
      </div>
    );
  }

  if (sessionVerificationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0B0E] px-4 text-white">
        <div className="max-w-md rounded-2xl border border-white/[0.08] bg-[#12141C] p-7 text-center">
          <h1 className="text-lg font-bold">Sesi belum dapat diverifikasi</h1>
          <p className="mt-2 text-sm text-gray-400">{sessionVerificationError}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => void refreshAuth()}
              className="rounded-xl bg-[#4F67FF] px-4 py-2 text-sm font-semibold text-white"
            >
              Coba lagi
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-gray-300"
            >
              Keluar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
      </Route>

      {/* Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to={defaultDashboard} replace /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={isAuthenticated ? <Navigate to={defaultDashboard} replace /> : <RegisterPage />}
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* User Dashboard Routes - New Dark Music Theme */}
      <Route element={isAuthenticated ? <MusicLayout /> : <Navigate to="/login" replace />}>
        <Route path="/dashboard" element={<MusicHomePage />} />
        <Route path="/dashboard/artists" element={<MyArtistsPage />} />
        <Route path="/dashboard/releases" element={<ReleasesPage />} />
        <Route path="/dashboard/catalog" element={<CatalogPage />} />
        <Route path="/dashboard/analytics" element={<AnalyticsPage />} />
        <Route path="/dashboard/royalties" element={<RoyaltiesPage />} />
        <Route path="/dashboard/withdrawals" element={<WithdrawalsPage />} />
        <Route path="/dashboard/transactions" element={<TransactionsPage />} />
        <Route path="/dashboard/notifications" element={<NotificationsPage />} />
        <Route path="/dashboard/settings" element={<SettingsPage />} />
      </Route>

      {/* Admin Routes */}
      <Route
        element={
          !isAuthenticated ? (
            <Navigate to="/login" replace />
          ) : isUserAdmin ? (
            <AdminLayout />
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      >
        <Route path="/admin" element={<AdminOverview />} />
        <Route path="/admin/cms" element={<WebsiteCMSPage />} />
        <Route path="/admin/users" element={<UsersManagement />} />
        <Route path="/admin/artists" element={<ArtistsManagement />} />
        <Route path="/admin/releases" element={<ReleasesReview />} />
        <Route path="/admin/catalog" element={<CatalogManagement />} />
        <Route path="/admin/csv-import" element={<CSVImportPage />} />
        <Route path="/admin/streaming-reports" element={<StreamingReportsPage />} />
        <Route path="/admin/royalties" element={<RoyaltiesManagement />} />
        <Route path="/admin/withdrawals" element={<WithdrawalsManagement />} />
        <Route path="/admin/transactions" element={<TransactionsManagement />} />
        <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
      </Route>

      {/* Catch All */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
