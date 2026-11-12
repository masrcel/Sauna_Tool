import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { ChevronDown, ChevronRight, Download, Search, X } from 'lucide-react';

interface AuditItem {
  id: number;
  created_at: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  summary: string;
  details: any;
  ip: string | null;
}

const PAGE_SIZE = 50;

const ACTIONS: Record<string, { label: string; style: string }> = {
  create:       { label: 'Angelegt',      style: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  update:       { label: 'Geändert',      style: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  delete:       { label: 'Gelöscht',      style: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  login:        { label: 'Anmeldung',     style: 'bg-gray-100 text-gray-600 dark:bg-stone-800 dark:text-stone-300' },
  logout:       { label: 'Abmeldung',     style: 'bg-gray-100 text-gray-600 dark:bg-stone-800 dark:text-stone-300' },
  login_failed: { label: 'Fehlversuch',   style: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  backup:       { label: 'Backup',        style: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  restore:      { label: 'Wiederhergestellt', style: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  download:     { label: 'Download',      style: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
};

/** Deutsche Namen für Datenbankfelder in den Details */
const FIELD_LABELS: Record<string, string> = {
  name: 'Name', title: 'Titel', email: 'E-Mail', role: 'Rolle', active: 'Aktiv', password: 'Passwort',
  description: 'Beschreibung', subtitle: 'Untertitel', category: 'Kategorie', color: 'Farbe',
  sort_order: 'Sortierung', break_minutes: 'Pause (Min.)', duration_minutes: 'Dauer (Min.)',
  default_dosage_ml: 'Standard-Dosierung', dosage_unit: 'Einheit', dosage_note: 'Dosierhinweis', dosage_ml: 'Dosierung',
  sauna_id: 'Sauna', template_id: 'Vorlage', assigned_user_id: 'Mitarbeiter', user_id: 'Mitarbeiter', scent_id: 'Duft',
  custom_name: 'Name', custom_subtitle: 'Untertitel', start_time: 'Beginn', end_time: 'Ende', status: 'Status',
  event_date: 'Datum', notes: 'Notizen', content: 'Inhalt', tags: 'Tags', scents: 'Düfte', entries: 'Aufgüsse',
  dates: 'Tage', mode: 'Modus', avatar_url: 'Profilbild',
  app_name: 'App-Name', primary_color: 'Primärfarbe', logo_url: 'Logo', theme_mode: 'Farbschema',
};
const fieldLabel = (k: string) => FIELD_LABELS[k] ?? k;

function fmtValue(v: any): string {
  if (v === null || v === undefined || v === '') return '–';
  if (v === true) return 'ja';
  if (v === false) return 'nein';
  if (Array.isArray(v)) {
    if (v.length === 0) return '–';
    // Düfte: „Birke (5 ml)“
    if (v.every(x => x && typeof x === 'object' && 'scent_id' in x)) {
      return v.map(x => `${x.scent_id}${x.dosage_ml != null ? ` (${x.dosage_ml})` : ''}`).join(', ');
    }
    if (v.every(x => typeof x !== 'object')) return v.join(', ');
    return `${v.length} Einträge`;
  }
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function KeyValueTable({ obj }: { obj: Record<string, any> }) {
  const entries = Object.entries(obj).filter(([k]) => k !== 'id');
  if (entries.length === 0) return <p className="text-gray-400 dark:text-stone-500">Keine Angaben</p>;
  return (
    <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-1">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-gray-500 dark:text-stone-500">{fieldLabel(k)}</dt>
          <dd className="text-gray-800 dark:text-stone-200 break-words">{fmtValue(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Details({ d }: { d: any }) {
  if (!d || typeof d !== 'object') return null;
  return (
    <div className="flex flex-col gap-3 text-sm">
      {d.changes && (
        Object.keys(d.changes).length === 0
          ? <p className="text-gray-400 dark:text-stone-500">Gespeichert ohne inhaltliche Änderung.</p>
          : (
            <table className="w-full text-left">
              <thead>
                <tr className="text-gray-400 dark:text-stone-500 text-xs uppercase tracking-wide">
                  <th className="py-1 pr-3 font-medium">Feld</th>
                  <th className="py-1 pr-3 font-medium">Vorher</th>
                  <th className="py-1 font-medium">Nachher</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries<any>(d.changes).map(([k, c]) => (
                  <tr key={k} className="border-t border-gray-100 dark:border-stone-800 align-top">
                    <td className="py-1 pr-3 text-gray-500 dark:text-stone-500 whitespace-nowrap">{fieldLabel(k)}</td>
                    {typeof c === 'object' && c !== null ? (
                      <>
                        <td className="py-1 pr-3 text-red-600 dark:text-red-400 break-words">{'from' in c ? fmtValue(c.from) : '–'}</td>
                        <td className="py-1 text-green-700 dark:text-green-400 break-words">{fmtValue(c.to)}</td>
                      </>
                    ) : (
                      <td colSpan={2} className="py-1 text-gray-800 dark:text-stone-200">{fmtValue(c)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )
      )}
      {d.data && <div><p className="font-semibold mb-1">Daten</p><KeyValueTable obj={d.data} /></div>}
      {d.deleted && <div><p className="font-semibold mb-1">Gelöschter Datensatz</p><KeyValueTable obj={d.deleted} /></div>}
      {d.backup && <div><p className="font-semibold mb-1">Inhalt des Backups</p><KeyValueTable obj={d.backup} /></div>}
      {d.sicherheitskopie && <p>Sicherheitskopie vorher: <span className="font-mono">{d.sicherheitskopie}</span></p>}
      {d.result && <div><p className="font-semibold mb-1">Ergebnis</p><pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify(d.result, null, 2)}</pre></div>}
      {d.hinweis && <p className="text-amber-600">{d.hinweis}</p>}
    </div>
  );
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
}

const EMPTY_FILTER = { user_id: '', entity: '', action: '', from: '', to: '', q: '' };

export default function AdminProtokoll() {
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const set = (k: keyof typeof EMPTY_FILTER, v: string) => { setFilter(f => ({ ...f, [k]: v })); setPage(0); };
  const params = { ...filter, limit: PAGE_SIZE, offset: page * PAGE_SIZE };

  const { data, isLoading, isFetching } = useQuery<{ items: AuditItem[]; total: number }>({
    queryKey: ['audit', params],
    queryFn: async () => (await api.get('/audit', { params })).data,
    placeholderData: keepPreviousData,
  });
  const { data: filters } = useQuery<{ users: { user_id: string; user_name: string }[]; entities: string[] }>({
    queryKey: ['audit-filters'],
    queryFn: async () => (await api.get('/audit/filters')).data,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilter = Object.values(filter).some(Boolean);

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await api.get('/audit/export', { params: filter, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `protokoll-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export fehlgeschlagen');
    } finally {
      setExporting(false);
    }
  }

  // Tagesüberschriften: Einträge nach Datum gruppieren
  let lastDate = '';

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-6 max-w-5xl">
      <div className="page-header">
        <div>
          <h2 className="font-display text-2xl font-bold">Protokoll</h2>
          <p className="text-gray-500 dark:text-stone-500 text-sm mt-1">Wer hat wann was im System geändert</p>
        </div>
        <button onClick={exportCsv} disabled={exporting} className="btn-secondary flex items-center gap-2">
          <Download className="w-4 h-4" /> {exporting ? 'Exportiere …' : 'CSV-Export'}
        </button>
      </div>

      {/* Filter */}
      <div className="card p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="label">Mitarbeiter</label>
          <select className="input" value={filter.user_id} onChange={e => set('user_id', e.target.value)}>
            <option value="">Alle</option>
            {filters?.users.map(u => <option key={u.user_id} value={u.user_id}>{u.user_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Bereich</label>
          <select className="input" value={filter.entity} onChange={e => set('entity', e.target.value)}>
            <option value="">Alle</option>
            {filters?.entities.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Aktion</label>
          <select className="input" value={filter.action} onChange={e => set('action', e.target.value)}>
            <option value="">Alle</option>
            {Object.entries(ACTIONS).map(([k, a]) => <option key={k} value={k}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Von</label>
          <input type="date" className="input" value={filter.from} onChange={e => set('from', e.target.value)} />
        </div>
        <div>
          <label className="label">Bis</label>
          <input type="date" className="input" value={filter.to} onChange={e => set('to', e.target.value)} />
        </div>
        <div>
          <label className="label">Suche</label>
          <form className="relative" onSubmit={e => { e.preventDefault(); set('q', search.trim()); }}>
            <input className="input pr-9" value={search} onChange={e => setSearch(e.target.value)} onBlur={() => set('q', search.trim())} placeholder="z. B. Birke, Finnische Sauna" />
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </form>
        </div>
        {hasFilter && (
          <div className="sm:col-span-2 lg:col-span-3">
            <button onClick={() => { setFilter(EMPTY_FILTER); setSearch(''); setPage(0); }} className="text-sm text-gray-500 hover:text-gray-900 dark:text-stone-400 dark:hover:text-stone-100 flex items-center gap-1">
              <X className="w-4 h-4" /> Filter zurücksetzen
            </button>
          </div>
        )}
      </div>

      <p className="text-sm text-gray-500 dark:text-stone-500">
        {isLoading ? 'Lade …' : `${total.toLocaleString('de-DE')} Einträge`}{isFetching && !isLoading ? ' · aktualisiere …' : ''}
      </p>

      {/* Einträge */}
      <div className="flex flex-col gap-2">
        {items.map(item => {
          const { date, time } = fmtDateTime(item.created_at);
          const showDate = date !== lastDate;
          lastDate = date;
          const action = ACTIONS[item.action] ?? { label: item.action, style: ACTIONS.login.style };
          const expandable = item.details && Object.keys(item.details).length > 0;
          const isOpen = open === item.id;
          return (
            <div key={item.id}>
              {showDate && <p className="text-xs uppercase tracking-widest text-gray-400 dark:text-stone-500 mt-3 mb-1 px-1">{date}</p>}
              <div className="card">
                <button
                  type="button"
                  onClick={() => expandable && setOpen(isOpen ? null : item.id)}
                  className={cn('w-full text-left p-3 flex items-start gap-3', expandable && 'cursor-pointer')}
                >
                  <span className="font-mono text-xs text-gray-400 dark:text-stone-500 pt-0.5 shrink-0 w-16">{time}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 dark:text-stone-100 text-sm break-words">{item.summary}</p>
                    <p className="text-gray-500 dark:text-stone-500 text-xs mt-0.5">
                      {item.user_name ?? 'Unbekannt'}{item.ip ? ` · ${item.ip}` : ''}
                    </p>
                  </div>
                  <span className={cn('badge shrink-0', action.style)}>{action.label}</span>
                  <span className="w-4 shrink-0 text-gray-400 pt-0.5">
                    {expandable && (isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 sm:pl-[5.75rem] border-t border-gray-100 dark:border-stone-800 pt-3 overflow-x-auto">
                    <Details d={item.details} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {!isLoading && items.length === 0 && (
          <p className="text-gray-400 dark:text-stone-500 text-center py-12">Keine Einträge gefunden.</p>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="btn-secondary disabled:opacity-40">Zurück</button>
          <span className="text-sm text-gray-500 dark:text-stone-400">Seite {page + 1} von {pages}</span>
          <button disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)} className="btn-secondary disabled:opacity-40">Weiter</button>
        </div>
      )}
    </div>
  );
}
