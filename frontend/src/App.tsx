import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import GuestDisplay from './pages/GuestDisplay';
import StaffDisplay from './pages/StaffDisplay';
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import AdminPlan from './pages/admin/AdminPlan';
import AdminIdeen from './pages/admin/AdminIdeen';
import AdminMitarbeiter from './pages/admin/AdminMitarbeiter';
import AdminSaunen from './pages/admin/AdminSaunen';
import AdminDuefte from './pages/admin/AdminDuefte';
import AdminVorlagen from './pages/admin/AdminVorlagen';
import AdminTagesvorlagen from './pages/admin/AdminTagesvorlagen';
import AdminEinstellungen from './pages/admin/AdminEinstellungen';
import AdminVersionen from './pages/admin/AdminVersionen';
import { useAuth } from './hooks/useAuth';
import { applyTheme, applyThemeMode, DEFAULT_PRIMARY } from './lib/theme';
import { api } from './lib/api';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/admin/plan" replace />;
  return <>{children}</>;
}

export default function App() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    api.get('/settings').then(res => {
      applyTheme(res.data.primary_color ?? DEFAULT_PRIMARY);
      const mode: string = res.data.theme_mode ?? 'dark';
      applyThemeMode(mode);
      if (res.data.app_name) document.title = res.data.app_name;
      if (mode === 'system') {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => applyThemeMode('system');
        mq.addEventListener('change', handler);
        cleanup = () => mq.removeEventListener('change', handler);
      }
    }).catch(() => applyTheme(DEFAULT_PRIMARY));
    return () => cleanup?.();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Öffentliche Displays */}
        <Route path="/" element={<GuestDisplay />} />
        <Route path="/personal" element={<StaffDisplay />} />

        {/* Admin */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="plan" replace />} />
          <Route path="plan" element={<AdminPlan />} />
          <Route path="ideen" element={<AdminIdeen />} />
          <Route path="mitarbeiter" element={<AdminMitarbeiter />} />
          <Route path="saunen" element={<AdminOnlyRoute><AdminSaunen /></AdminOnlyRoute>} />
          <Route path="duefte" element={<AdminDuefte />} />
          <Route path="vorlagen" element={<AdminVorlagen />} />
          <Route path="tagesvorlagen" element={<AdminTagesvorlagen />} />
          <Route path="einstellungen" element={<AdminOnlyRoute><AdminEinstellungen /></AdminOnlyRoute>} />
          <Route path="versionen" element={<AdminVersionen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
