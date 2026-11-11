import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, eachDayOfInterval, format, getDay, isValid, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { api } from '../lib/api';
import { ApplyDayResult, DayTemplate } from '../types';
import { cn } from '../lib/utils';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

const MAX_DAYS = 92;
// Anzeige-Reihenfolge Mo–So, Werte wie Date.getDay() (0 = Sonntag)
const WEEKDAYS = [
  { value: 1, label: 'Mo' }, { value: 2, label: 'Di' }, { value: 3, label: 'Mi' }, { value: 4, label: 'Do' },
  { value: 5, label: 'Fr' }, { value: 6, label: 'Sa' }, { value: 0, label: 'So' },
];

const errMsg = (err: any) => err.response?.data?.error ?? err.message;

/** Kurze Übersicht der Aufgüsse einer Tagesvorlage */
export function DayTemplateEntryList({ template, max }: { template: DayTemplate; max?: number }) {
  const entries = max ? template.entries.slice(0, max) : template.entries;
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {entries.map((e, i) => (
        <li key={e.id ?? i} className="flex gap-2 items-baseline min-w-0">
          <span className="font-mono tabular-nums text-sauna-600 dark:text-sauna-400 shrink-0">
            {e.start_time}{e.end_time ? `–${e.end_time}` : ''}
          </span>
          <span className="truncate text-gray-800 dark:text-stone-200">{e.custom_name || e.template_name || 'Aufguss'}</span>
          <span className={cn('truncate text-xs ml-auto shrink-0', e.sauna_active === false ? 'text-red-500' : 'text-gray-400 dark:text-stone-500')}>
            {e.sauna_name}{e.sauna_active === false ? ' (inaktiv)' : ''}{e.staff_name ? ` · ${e.staff_name}` : ''}
          </span>
        </li>
      ))}
      {max && template.entries.length > max && (
        <li className="text-xs text-gray-400 dark:text-stone-500">… und {template.entries.length - max} weitere</li>
      )}
      {template.entries.length === 0 && <li className="text-gray-400 dark:text-stone-500 italic">Keine Aufgüsse</li>}
    </ul>
  );
}

export function ApplyDayTemplateModal({ date, presetTemplateId, onClose, onApplied }: {
  date: Date;
  presetTemplateId?: string;
  onClose: () => void;
  onApplied?: () => void;
}) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const { data: templates = [], isLoading } = useQuery<DayTemplate[]>({
    queryKey: ['day-templates'],
    queryFn: async () => (await api.get('/day-templates')).data,
  });

  const [templateId, setTemplateId] = useState(presetTemplateId ?? '');
  const [mode, setMode] = useState<'append' | 'replace'>('append');
  const [target, setTarget] = useState<'single' | 'range'>('single');
  const [from, setFrom] = useState(dateStr);
  const [to, setTo] = useState(format(addDays(date, 27), 'yyyy-MM-dd'));
  const [weekdays, setWeekdays] = useState<number[]>([getDay(date)]);
  const [results, setResults] = useState<ApplyDayResult[] | null>(null);

  const selected = templates.find(t => t.id === (templateId || templates[0]?.id));

  const { dates, rangeError } = useMemo(() => {
    if (target === 'single') return { dates: [dateStr], rangeError: null };
    const f = parseISO(from), t = parseISO(to);
    if (!isValid(f) || !isValid(t)) return { dates: [], rangeError: 'Bitte gültige Daten eingeben.' };
    if (t < f) return { dates: [], rangeError: '„Bis“ liegt vor „Von“.' };
    const list = eachDayOfInterval({ start: f, end: t })
      .filter(d => weekdays.includes(getDay(d)))
      .map(d => format(d, 'yyyy-MM-dd'));
    if (list.length > MAX_DAYS) return { dates: list, rangeError: `Maximal ${MAX_DAYS} Tage auf einmal.` };
    if (list.length === 0) return { dates: list, rangeError: 'Keine Tage ausgewählt – mindestens einen Wochentag anhaken.' };
    return { dates: list, rangeError: null };
  }, [target, dateStr, from, to, weekdays]);

  // Welche der gewählten Tage haben schon Aufgüsse?
  const summaryFrom = target === 'single' ? dateStr : from;
  const summaryTo = target === 'single' ? dateStr : to;
  const { data: summary = [] } = useQuery<{ date: string; count: number }[]>({
    queryKey: ['event-summary', summaryFrom, summaryTo],
    queryFn: async () => (await api.get('/events', { params: { from: summaryFrom, to: summaryTo } })).data,
    enabled: !rangeError || dates.length > 0,
  });
  const occupied = summary.filter(s => dates.includes(s.date));

  const applyMutation = useMutation({
    mutationFn: async () => (await api.post(`/day-templates/${selected!.id}/apply`, { dates, mode })).data,
    onSuccess: (data: { results: ApplyDayResult[] }) => { setResults(data.results); onApplied?.(); },
    onError: (err: any) => alert(`Fehler: ${errMsg(err)}`),
  });

  const toggleWeekday = (v: number) => setWeekdays(w => w.includes(v) ? w.filter(x => x !== v) : [...w, v]);

  if (results) {
    const created = results.reduce((n, r) => n + r.created, 0);
    const skipped = results.filter(r => r.skipped.length > 0);
    return (
      <div className="modal-backdrop">
        <div className="modal-panel max-w-xl">
          <h3 className="font-display text-xl font-bold">Tagesvorlage angewendet</h3>
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p>{created} Aufgüsse an {results.length} {results.length === 1 ? 'Tag' : 'Tagen'} angelegt.</p>
          </div>
          {skipped.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p>Einige Aufgüsse wurden übersprungen:</p>
              </div>
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto bg-gray-100/70 dark:bg-stone-800/50 p-3 rounded-xl text-sm">
                {skipped.map(r => (
                  <div key={r.date}>
                    <p className="font-semibold">{format(parseISO(r.date), 'EEEE, dd.MM.yyyy', { locale: de })}</p>
                    <ul className="list-disc pl-5 text-gray-600 dark:text-stone-400">
                      {r.skipped.map((s, i) => <li key={i}><span className="font-mono">{s.start_time}</span> {s.name}: {s.reason}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end [&>button]:flex-1 sm:[&>button]:flex-none">
            <button onClick={onClose} className="btn-primary">Fertig</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-w-xl">
        <h3 className="font-display text-xl font-bold">Tagesvorlage anwenden</h3>

        {isLoading ? (
          <p className="text-gray-400 dark:text-stone-500">Lade Tagesvorlagen…</p>
        ) : templates.length === 0 ? (
          <p className="text-gray-500 dark:text-stone-400">
            Noch keine Tagesvorlagen vorhanden. Lege unter <strong>Tagesvorlagen</strong> eine an oder speichere einen
            fertig geplanten Tag mit <strong>„Als Tagesvorlage speichern“</strong>.
          </p>
        ) : (
          <>
            <div>
              <label className="label">Vorlage</label>
              <select className="input" value={selected?.id ?? ''} onChange={e => setTemplateId(e.target.value)}>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.entries.length} Aufgüsse)</option>)}
              </select>
              {selected && (
                <div className="mt-2 bg-gray-100/70 dark:bg-stone-800/50 p-3 rounded-xl max-h-48 overflow-y-auto">
                  <DayTemplateEntryList template={selected} />
                </div>
              )}
            </div>

            <div>
              <label className="label">Für welche Tage?</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setTarget('single')} className={cn('btn-secondary text-sm', target === 'single' && 'ring-2 ring-sauna-500')}>
                  Nur {format(date, 'dd.MM.', { locale: de })}
                </button>
                <button type="button" onClick={() => setTarget('range')} className={cn('btn-secondary text-sm', target === 'range' && 'ring-2 ring-sauna-500')}>
                  Mehrere Tage
                </button>
              </div>
              {target === 'range' && (
                <div className="mt-3 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="label">Von</label><input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} /></div>
                    <div><label className="label">Bis</label><input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} /></div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="label mb-0">Wochentage</span>
                      <div className="flex gap-2 text-xs">
                        <button type="button" className="text-sauna-600 dark:text-sauna-400 hover:underline" onClick={() => setWeekdays([0, 1, 2, 3, 4, 5, 6])}>Alle</button>
                        <button type="button" className="text-sauna-600 dark:text-sauna-400 hover:underline" onClick={() => setWeekdays([1, 2, 3, 4, 5])}>Mo–Fr</button>
                        <button type="button" className="text-sauna-600 dark:text-sauna-400 hover:underline" onClick={() => setWeekdays([6, 0])}>Wochenende</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {WEEKDAYS.map(w => (
                        <button
                          key={w.value}
                          type="button"
                          onClick={() => toggleWeekday(w.value)}
                          className={cn(
                            'rounded-xl py-2 text-sm font-medium border transition-colors',
                            weekdays.includes(w.value)
                              ? 'bg-sauna-600 border-sauna-600 text-white'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-stone-900 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800'
                          )}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className={cn('text-sm', rangeError ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-stone-400')}>
                    {rangeError ?? `${dates.length} ${dates.length === 1 ? 'Tag' : 'Tage'} ausgewählt.`}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="label">Bereits geplante Aufgüsse</label>
              <div className="flex flex-col gap-2">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input type="radio" className="mt-1" checked={mode === 'append'} onChange={() => setMode('append')} />
                  <span><strong>Behalten</strong> – Vorlage ergänzen. Aufgüsse mit Zeitkonflikt werden übersprungen.</span>
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input type="radio" className="mt-1" checked={mode === 'replace'} onChange={() => setMode('replace')} />
                  <span><strong>Ersetzen</strong> – bestehende Aufgüsse der gewählten Tage werden gelöscht.</span>
                </label>
              </div>
              {occupied.length > 0 && (
                <p className={cn('mt-2 text-sm flex gap-2', mode === 'replace' ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-400')}>
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    {occupied.length === 1 && target === 'single'
                      ? `An diesem Tag sind bereits ${occupied[0].count} Aufgüsse geplant.`
                      : `${occupied.length} der gewählten Tage haben bereits Aufgüsse.`}
                    {mode === 'replace' && ' Diese werden gelöscht!'}
                  </span>
                </p>
              )}
            </div>
          </>
        )}

        <div className="flex gap-3 justify-end [&>button]:flex-1 sm:[&>button]:flex-none">
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
          {templates.length > 0 && (
            <button
              disabled={!selected || !!rangeError || applyMutation.isPending}
              onClick={() => {
                if (mode === 'replace' && occupied.length > 0
                  && !confirm(`Bestehende Aufgüsse an ${occupied.length} ${occupied.length === 1 ? 'Tag' : 'Tagen'} wirklich löschen und durch die Vorlage ersetzen?`)) return;
                applyMutation.mutate();
              }}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {applyMutation.isPending ? 'Wird angewendet…' : `Anwenden${dates.length > 1 ? ` (${dates.length} Tage)` : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function SaveDayTemplateModal({ date, onClose }: { date: Date; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(`Tagesplan ${format(date, 'EEEE', { locale: de })}`);
  const [description, setDescription] = useState('');

  const saveMutation = useMutation({
    mutationFn: () => api.post(`/day-templates/from-date/${format(date, 'yyyy-MM-dd')}`, { name, description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day-templates'] });
      alert(`Tagesvorlage „${name.trim()}“ gespeichert.`);
      onClose();
    },
    onError: (err: any) => alert(`Fehler: ${errMsg(err)}`),
  });

  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-w-lg">
        <h3 className="font-display text-xl font-bold">Als Tagesvorlage speichern</h3>
        <p className="text-sm text-gray-500 dark:text-stone-400">
          Alle Aufgüsse vom {format(date, 'EEEE, dd.MM.yyyy', { locale: de })} (außer abgesagte) werden mit Sauna, Zeiten,
          Mitarbeiter und Düften als Vorlage gespeichert.
        </p>
        <div><label className="label">Name *</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Normaler Samstag" /></div>
        <div><label className="label">Beschreibung</label><textarea className="input min-h-20 resize-y" value={description} onChange={e => setDescription(e.target.value)} /></div>
        <div className="flex gap-3 justify-end [&>button]:flex-1 sm:[&>button]:flex-none">
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button
            disabled={saveMutation.isPending}
            onClick={() => { if (!name.trim()) { alert('Bitte einen Namen eingeben.'); return; } saveMutation.mutate(); }}
            className="btn-primary disabled:opacity-50"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
