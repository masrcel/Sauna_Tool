import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { applyTheme, applyThemeMode, DEFAULT_PRIMARY } from '../../lib/theme';
import { cn } from '../../lib/utils';
import { Palette, Save, Sun, Moon, Monitor } from 'lucide-react';

const PRESET_COLORS = [
  { label: 'Sauna Orange', value: '#d97d1d' },
  { label: 'Waldgrün',     value: '#2d7a3a' },
  { label: 'Tiefblau',     value: '#1d4ed8' },
  { label: 'Purpur',       value: '#7c3aed' },
  { label: 'Rubin',        value: '#be123c' },
  { label: 'Teal',         value: '#0f766e' },
  { label: 'Schiefer',     value: '#475569' },
  { label: 'Anthrazit',    value: '#374151' },
];

const THEME_MODES = [
  { value: 'light',  label: 'Hell',    icon: Sun },
  { value: 'dark',   label: 'Dunkel',  icon: Moon },
  { value: 'system', label: 'System',  icon: Monitor },
] as const;

export default function AdminEinstellungen() {
  const qc = useQueryClient();

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/settings')).data,
  });

  const [form, setForm] = useState({
    app_name: '',
    primary_color: DEFAULT_PRIMARY,
    logo_url: '',
    theme_mode: 'dark',
  });

  useEffect(() => {
    if (settings) setForm({
      app_name: settings.app_name ?? '',
      primary_color: settings.primary_color ?? DEFAULT_PRIMARY,
      logo_url: settings.logo_url ?? '',
      theme_mode: settings.theme_mode ?? 'dark',
    });
  }, [settings]);

  useEffect(() => { applyTheme(form.primary_color); }, [form.primary_color]);
  useEffect(() => { applyThemeMode(form.theme_mode); }, [form.theme_mode]);

  const saveMutation = useMutation({
    mutationFn: (d: any) => api.put('/settings', d),
    onSuccess: (res) => {
      qc.setQueryData(['settings'], res.data);
      applyTheme(res.data.primary_color);
      applyThemeMode(res.data.theme_mode ?? 'dark');
    },
    onError: (err: any) => alert(`Fehler: ${err.response?.data?.error ?? err.message}`),
  });

  const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

  return (
    <div className="p-6 flex flex-col gap-8 max-w-2xl">
      <div>
        <h2 className="font-display text-2xl font-bold">Einstellungen</h2>
        <p className="text-gray-500 dark:text-stone-500 text-sm mt-1">Corporate Design & App-Konfiguration</p>
      </div>

      {/* App-Name & Logo */}
      <section className="card p-5 flex flex-col gap-4">
        <h3 className="font-semibold text-gray-800 dark:text-stone-200">Allgemein</h3>
        <div>
          <label className="label">App-Name / Saunaname</label>
          <input className="input" value={form.app_name} onChange={e => setForm(f => ({ ...f, app_name: e.target.value }))} placeholder="z.B. Therme Musterstadt" />
          <p className="text-gray-400 dark:text-stone-600 text-xs mt-1">Wird in der Sidebar und im Browser-Tab angezeigt</p>
        </div>
        <div>
          <label className="label">Logo-URL <span className="text-gray-400 dark:text-stone-500 font-normal">(optional)</span></label>
          <input className="input" value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} placeholder="https://…/logo.png" />
          {form.logo_url && (
            <img src={form.logo_url} alt="Logo-Vorschau" className="mt-2 h-10 object-contain rounded" onError={e => (e.currentTarget.style.display = 'none')} />
          )}
        </div>
      </section>

      {/* Erscheinungsbild */}
      <section className="card p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Sun className="w-4 h-4 text-sauna-400" />
          <h3 className="font-semibold text-gray-800 dark:text-stone-200">Erscheinungsbild</h3>
        </div>
        <p className="text-gray-500 dark:text-stone-500 text-sm -mt-2">Wähle zwischen hellem und dunklem Design.</p>
        <div className="flex gap-3">
          {THEME_MODES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setForm(f => ({ ...f, theme_mode: value }))}
              className={cn(
                'flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border transition-all text-sm font-medium',
                form.theme_mode === value
                  ? 'border-sauna-500 bg-sauna-600/10 text-sauna-600 dark:text-sauna-400'
                  : 'border-gray-200 dark:border-stone-700 text-gray-500 dark:text-stone-400 hover:border-gray-300 dark:hover:border-stone-500'
              )}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Primärfarbe */}
      <section className="card p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-sauna-400" />
          <h3 className="font-semibold text-gray-800 dark:text-stone-200">Primärfarbe</h3>
        </div>
        <p className="text-gray-500 dark:text-stone-500 text-sm -mt-2">Bestimmt die Akzentfarbe von Buttons, Navigation und Badges.</p>

        {/* Preset-Farben */}
        <div>
          <label className="label">Schnellauswahl</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map(p => (
              <button
                key={p.value}
                onClick={() => setForm(f => ({ ...f, primary_color: p.value }))}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm border transition-all',
                  form.primary_color === p.value
                    ? 'border-gray-400/60 bg-black/5 dark:border-white/40 dark:bg-white/10'
                    : 'border-gray-200 dark:border-stone-700 hover:border-gray-300 dark:hover:border-stone-500'
                )}
              >
                <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: p.value }} />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Eigene Farbe */}
        <div>
          <label className="label">Eigene Farbe</label>
          <div className="flex gap-3 items-center">
            <input
              type="color"
              value={form.primary_color}
              onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
              className="w-12 h-10 rounded-lg border border-gray-300 dark:border-stone-700 bg-transparent cursor-pointer"
            />
            <input
              className="input w-36"
              value={form.primary_color}
              onChange={e => {
                const v = e.target.value;
                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setForm(f => ({ ...f, primary_color: v }));
              }}
              placeholder="#d97d1d"
            />
          </div>
        </div>

        {/* Farbpaletten-Vorschau */}
        <div>
          <label className="label">Generierte Palette</label>
          <div className="flex rounded-xl overflow-hidden">
            {shades.map(shade => (
              <div
                key={shade}
                className="flex-1 h-8 relative group"
                style={{ backgroundColor: `rgb(var(--brand-${shade}))` }}
              >
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: shade <= 300 ? '#000' : '#fff' }}>
                  {shade}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* UI-Vorschau */}
        <div>
          <label className="label">Vorschau</label>
          <div className="flex items-center gap-3 flex-wrap p-4 bg-gray-100/70 dark:bg-stone-800/50 rounded-xl">
            <button className="btn-primary text-sm">Primär-Button</button>
            <button className="btn-secondary text-sm">Sekundär</button>
            <span className="badge bg-sauna-700 text-white text-xs px-3 py-1.5">Aktiv</span>
            <span className="text-sauna-400 text-sm font-medium">Akzent-Text</span>
            <input className="input w-32 text-sm" readOnly value="Fokus-Ring" onFocus={e => e.target.blur()} />
          </div>
        </div>
      </section>

      <button
        onClick={() => saveMutation.mutate(form)}
        disabled={saveMutation.isPending}
        className="btn-primary flex items-center gap-2 self-start disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {saveMutation.isPending ? 'Wird gespeichert…' : 'Einstellungen speichern'}
      </button>
    </div>
  );
}
