import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import Avatar from '../../components/Avatar';
import {
  CalendarDays, Lightbulb, Users, Thermometer, Droplets, BookMarked, LogOut, Monitor, Settings
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';

const nav = [
  { to: 'plan',        label: 'Tagesplan',   icon: CalendarDays },
  { to: 'vorlagen',    label: 'Vorlagen',    icon: BookMarked },
  { to: 'ideen',       label: 'Ideen',       icon: Lightbulb },
  { to: 'mitarbeiter', label: 'Mitarbeiter', icon: Users },
  { to: 'saunen',      label: 'Saunen',      icon: Thermometer },
  { to: 'duefte',      label: 'Düfte',       icon: Droplets },
  { to: 'einstellungen', label: 'Einstellungen', icon: Settings },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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

  return (
    <div className="min-h-screen flex bg-gray-100 dark:bg-stone-950">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 dark:bg-stone-900 dark:border-stone-800 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-gray-200 dark:border-stone-800 flex items-center gap-3">
          {logoUrl
            ? <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain rounded shrink-0" onError={e => (e.currentTarget.style.display = 'none')} />
            : <span className="text-xl shrink-0">🧖</span>
          }
          <div className="min-w-0">
            <h1 className="font-display text-base font-bold text-gray-900 dark:text-stone-100 truncate">{appName}</h1>
            <p className="text-gray-400 dark:text-stone-500 text-xs">Admin</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {nav.map(({ to, label, icon: Icon }) => (
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
        <div className="px-3 py-4 border-t border-gray-200 dark:border-stone-800 flex items-center gap-3">
          {user && <Avatar name={user.name} url={user.avatar_url} size="sm" />}
          <div className="flex-1 min-w-0">
            <p className="text-gray-800 dark:text-stone-200 text-sm font-medium truncate">{user?.name}</p>
            <p className="text-gray-400 dark:text-stone-500 text-xs truncate">{user?.role}</p>
          </div>
          <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 dark:text-stone-500 dark:hover:text-red-400 transition-colors" title="Abmelden">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
