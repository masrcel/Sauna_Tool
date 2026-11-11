import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import Avatar from '../../components/Avatar';
import {
  CalendarDays, CalendarRange, Lightbulb, Users, Thermometer, Droplets, BookMarked, LogOut, Monitor, Settings, History, Menu, X
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import { APP_VERSION } from '../../lib/changelog';

// adminOnly: nur für Rolle „admin“ sichtbar (Rechte werden zusätzlich im Backend geprüft)
const nav = [
  { to: 'plan',        label: 'Tagesplan',   icon: CalendarDays },
  { to: 'tagesvorlagen', label: 'Tagesvorlagen', icon: CalendarRange },
  { to: 'vorlagen',    label: 'Aufguss-Vorlagen', icon: BookMarked },
  { to: 'ideen',       label: 'Ideen',       icon: Lightbulb },
  { to: 'mitarbeiter', label: 'Mitarbeiter', icon: Users },
  { to: 'saunen',      label: 'Saunen',      icon: Thermometer, adminOnly: true },
  { to: 'duefte',      label: 'Düfte',       icon: Droplets },
  { to: 'einstellungen', label: 'Einstellungen', icon: Settings, adminOnly: true },
  { to: 'versionen',   label: 'Versionen',   icon: History },
];

export default function AdminLayout() {
  const { user, isAdmin, logout, refresh } = useAuth();
  const visibleNav = nav.filter(n => isAdmin || !n.adminOnly);

  // Rolle/Name beim Öffnen frisch vom Server holen (z. B. nach Rollenänderung durch einen Admin)
  useEffect(() => { refresh().catch(() => {}); }, [refresh]);
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Mobil: Menü nach Navigation schließen
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Mobil: Hintergrund nicht scrollen, solange das Menü offen ist
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/settings')).data,
  });

  function handleLogout() {
    logout();
    navigate('/admin/login');
  }

  const appName = settings?.app_name ?? 'Aufguss Manager';
  const logoUrl = settings?.logo_url ?? '';
  const currentLabel = nav.find(n => location.pathname.includes(`/admin/${n.to}`))?.label ?? 'Admin';

  return (
    <div className="min-h-screen md:flex bg-gray-100 dark:bg-stone-950">
      {/* Mobile Kopfzeile */}
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-white/95 backdrop-blur border-b border-gray-200 dark:bg-stone-900/95 dark:border-stone-800" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <button onClick={() => setMenuOpen(true)} className="p-2 -ml-2 rounded-xl text-gray-600 hover:bg-gray-100 dark:text-stone-300 dark:hover:bg-stone-800" aria-label="Menü öffnen">
          <Menu className="w-5 h-5" />
        </button>
        {logoUrl
          ? <img src={logoUrl} alt="Logo" className="h-7 w-7 object-contain rounded shrink-0" onError={e => (e.currentTarget.style.display = 'none')} />
          : <span className="text-lg shrink-0">🧖</span>
        }
        <div className="min-w-0 flex-1">
          <p className="text-gray-400 dark:text-stone-500 text-[11px] leading-none truncate">{appName}</p>
          <h1 className="font-display text-base font-bold text-gray-900 dark:text-stone-100 truncate">{currentLabel}</h1>
        </div>
        {user && <Avatar name={user.name} url={user.avatar_url} size="sm" />}
      </header>

      {/* Mobile Overlay */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMenuOpen(false)} aria-hidden />
      )}

      {/* Sidebar (Desktop fest, Mobil als Schublade) */}
      <aside className={cn(
        'w-72 max-w-[85vw] md:w-64 bg-white border-r border-gray-200 dark:bg-stone-900 dark:border-stone-800 flex flex-col shrink-0',
        'fixed inset-y-0 left-0 z-50 overflow-y-auto transition-transform duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0',
        menuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      )}>
        <div className="px-5 py-5 border-b border-gray-200 dark:border-stone-800 flex items-center gap-3">
          {logoUrl
            ? <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain rounded shrink-0" onError={e => (e.currentTarget.style.display = 'none')} />
            : <span className="text-xl shrink-0">🧖</span>
          }
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-base font-bold text-gray-900 dark:text-stone-100 truncate">{appName}</h1>
            <p className="text-gray-400 dark:text-stone-500 text-xs">
              {isAdmin ? 'Admin' : 'Personal'} ·{' '}
              <NavLink to="versionen" className="font-mono hover:text-sauna-600 dark:hover:text-sauna-400 transition-colors" title="Versionshistorie">
                v{APP_VERSION}
              </NavLink>
            </p>
          </div>
          <button onClick={() => setMenuOpen(false)} className="md:hidden ml-auto p-2 -mr-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-stone-400 dark:hover:bg-stone-800" aria-label="Menü schließen">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {visibleNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sauna-700 text-white'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Display-Links */}
        <div className="px-3 py-3 border-t border-gray-200 dark:border-stone-800">
          <p className="text-gray-400 dark:text-stone-600 text-xs uppercase tracking-widest px-3 mb-2">Displays öffnen</p>
          <a href="/" target="_blank" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100 transition-colors">
            <Monitor className="w-4 h-4" /> Gäste-Display
          </a>
          <a href="/personal" target="_blank" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100 transition-colors">
            <Monitor className="w-4 h-4" /> Personal-Display
          </a>
        </div>

        {/* User + Logout */}
        <div className="px-3 py-4 border-t border-gray-200 dark:border-stone-800 flex items-center gap-3" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {user && <Avatar name={user.name} url={user.avatar_url} size="sm" />}
          <div className="flex-1 min-w-0">
            <p className="text-gray-800 dark:text-stone-200 text-sm font-medium truncate">{user?.name}</p>
            <p className="text-gray-400 dark:text-stone-500 text-xs truncate">{isAdmin ? 'Admin' : 'Personal'}</p>
          </div>
          <button onClick={handleLogout} className="p-2 -m-2 text-gray-400 hover:text-red-500 dark:text-stone-500 dark:hover:text-red-400 transition-colors" title="Abmelden">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
