import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { api } from '../lib/api';
import { DayEvent } from '../types';
import AufgussCard from '../components/AufgussCard';
import Avatar from '../components/Avatar';
import { formatTime, cn, secondsUntil, formatCountdown } from '../lib/utils';
import { useClock } from '../hooks/useClock';

const WARN_10_MIN = 10 * 60;
const WARN_5_MIN = 5 * 60;

/** 'urgent' = ≤ 5 Min, 'soon' = ≤ 10 Min, sonst null */
function warnLevel(secs: number): 'urgent' | 'soon' | null {
  if (secs <= 0) return null;
  if (secs <= WARN_5_MIN) return 'urgent';
  if (secs <= WARN_10_MIN) return 'soon';
  return null;
}

function useTodayEvent(dateStr: string) {
  return useQuery<DayEvent | null>({
    queryKey: ['event-staff', dateStr],
    queryFn: async () => {
      try { const { data } = await api.get(`/events/${dateStr}`); return data; }
      catch (e: any) { if (e.response?.status === 404) return null; throw e; }
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });
}

export default function StaffDisplay() {
  const now = useClock();
  const dateStr = format(now, 'yyyy-MM-dd');
  const { data: event, isLoading } = useTodayEvent(dateStr);

  const [showDone, setShowDone] = useState(true);

  const activeSchedule = event?.schedule.filter(e => e.status !== 'abgesagt' && e.status !== 'fertig') ?? [];
  // Abgeschlossene Aufgüsse – zuletzt beendete zuerst
  const doneSchedule = (event?.schedule.filter(e => e.status === 'fertig') ?? [])
    .slice()
    .sort((a, b) => b.start_time.localeCompare(a.start_time));

  const byStaff = activeSchedule.reduce<Record<string, typeof activeSchedule>>((acc, e) => {
    const key = e.assigned_user_id ?? '__unassigned__';
    acc[key] = [...(acc[key] ?? []), e];
    return acc;
  }, {}) ?? {};

  const staffInfo = activeSchedule.reduce<Record<string, { name: string; avatar?: string }>>((acc, e) => {
    if (e.assigned_user_id) {
      acc[e.assigned_user_id] = { name: e.staff_name!, avatar: e.staff_avatar };
    }
    return acc;
  }, {}) ?? {};

  // Anstehende Aufgüsse in den nächsten 10 Minuten
  const upcoming = activeSchedule
    .filter(e => e.status === 'geplant')
    .map(e => ({ entry: e, secs: secondsUntil(e.start_time, now) }))
    .filter(({ secs }) => warnLevel(secs) !== null)
    .sort((a, b) => a.secs - b.secs);

  // Welche Mitarbeiter machen gerade einen Aufguss?
  const activeStaffIds = new Set(
    activeSchedule
      .filter(e => e.status === 'läuft' && e.assigned_user_id)
      .map(e => e.assigned_user_id!)
  );

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-stone-950 flex flex-col">
      <header className="px-4 py-4 sm:px-8 sm:py-5 flex items-center justify-between gap-4 border-b border-gray-200 dark:border-stone-800">
        <div className="min-w-0">
          <p className="text-steam-400 text-xs uppercase tracking-widest">Personal-Ansicht</p>
          <h1 className="font-display text-lg sm:text-2xl font-bold truncate text-gray-900 dark:text-stone-100">
            {event?.title ?? format(now, 'EEEE, dd. MMMM', { locale: de })}
          </h1>
        </div>
        <div className="text-right shrink-0">
          <p className="text-gray-500 dark:text-stone-400 text-xs sm:text-sm">{format(now, 'dd.MM.yyyy')}</p>
          <p className="font-mono text-xl sm:text-2xl font-bold text-sauna-400 tabular-nums">
            {format(now, 'HH:mm:ss')}
          </p>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        {isLoading ? (
          <div className="text-gray-400 dark:text-stone-500 text-center py-20">Lade…</div>
        ) : !event || event.schedule.length === 0 ? (
          <div className="text-center py-20 text-gray-400 dark:text-stone-500">Kein Programm für heute.</div>
        ) : (
          <div className="flex flex-col gap-8">
            {/* Countdown-Hinweise 10 / 5 Minuten */}
            {upcoming.length > 0 && (
              <section className="flex flex-col gap-3">
                {upcoming.map(({ entry, secs }) => {
                  const urgent = warnLevel(secs) === 'urgent';
                  return (
                    <div
                      key={entry.id}
                      className={cn(
                        'rounded-2xl border-2 p-3 sm:px-5 sm:py-4 flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 shadow-sm',
                        urgent
                          ? 'bg-red-50 border-red-500 dark:bg-red-950/40 dark:border-red-500'
                          : 'bg-amber-50 border-amber-400 dark:bg-amber-950/30 dark:border-amber-500'
                      )}
                    >
                      <div className={cn(
                        'shrink-0 rounded-xl px-4 py-2 text-center text-white',
                        urgent ? 'bg-red-600 animate-pulse' : 'bg-amber-500'
                      )}>
                        <p className="text-[10px] uppercase tracking-widest opacity-90">Start in</p>
                        <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums leading-none">{formatCountdown(secs)}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-xs font-semibold uppercase tracking-widest',
                          urgent ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                        )}>
                          {urgent ? 'Achtung – Aufguss in weniger als 5 Minuten' : 'Hinweis – Aufguss in weniger als 10 Minuten'}
                        </p>
                        <p className="font-display text-xl font-semibold text-gray-900 dark:text-stone-100 truncate">
                          {entry.custom_name ?? entry.template_name ?? 'Aufguss'}
                        </p>
                        <p className="text-gray-500 dark:text-stone-400 text-sm">
                          {formatTime(entry.start_time)} Uhr · {entry.sauna_name}
                          {entry.scents.length > 0 && ` · ${entry.scents.map(s => s.scent_name).join(', ')}`}
                        </p>
                      </div>
                      {entry.staff_name ? (
                        <div className="shrink-0 flex items-center gap-2">
                          <Avatar name={entry.staff_name} url={entry.staff_avatar} size="lg" />
                          <p className="font-semibold text-gray-900 dark:text-stone-100 hidden sm:block">{entry.staff_name}</p>
                        </div>
                      ) : (
                        <p className="shrink-0 text-gray-500 dark:text-stone-400 italic text-sm">Nicht zugewiesen</p>
                      )}
                    </div>
                  );
                })}
              </section>
            )}

            {/* Timeline nach Mitarbeiter */}
            <section>
              <h2 className="text-steam-400 text-xs uppercase tracking-widest mb-4">Einteilung nach Mitarbeiter</h2>
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(280px, 100%), 1fr))` }}>
                {Object.entries(byStaff).map(([staffId, entries]) => {
                  const info = staffInfo[staffId];
                  const isActive = activeStaffIds.has(staffId);
                  return (
                    <div
                      key={staffId}
                      className={cn(
                        'card p-4 transition-all',
                        isActive && 'border-green-500 bg-green-50 dark:bg-green-950/30'
                      )}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        {info ? (
                          <>
                            <div className={cn('rounded-full p-0.5 transition-all', isActive && 'ring-2 ring-green-500 ring-offset-2 ring-offset-gray-50 dark:ring-offset-stone-900')}>
                              <Avatar name={info.name} url={info.avatar} size="lg" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-900 dark:text-stone-100 text-lg">{info.name}</p>
                                {isActive && (
                                  <span className="badge bg-green-600 text-white text-xs animate-pulse">
                                    Aktiv
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-400 dark:text-stone-500 text-sm">{entries.length} Aufguss{entries.length !== 1 ? 'e' : ''}</p>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-stone-700 flex items-center justify-center text-gray-500 dark:text-stone-400 text-xl">?</div>
                            <p className="text-gray-500 dark:text-stone-400 italic">Nicht zugewiesen</p>
                          </div>
                        )}
                      </div>

                      {/* Mini-Timeline */}
                      <div className="flex flex-col gap-2">
                        {entries.map(entry => {
                          const secs = secondsUntil(entry.start_time, now);
                          const level = entry.status === 'geplant' ? warnLevel(secs) : null;
                          return (
                          <div
                            key={entry.id}
                            className={cn(
                              'rounded-xl p-3 flex flex-col gap-2 transition-all',
                              entry.status === 'läuft'
                                ? 'bg-green-50 border border-green-400 dark:bg-green-900/50 dark:border-green-600'
                                : level === 'urgent'
                                ? 'bg-red-50 border-2 border-red-500 dark:bg-red-950/40'
                                : level === 'soon'
                                ? 'bg-amber-50 border-2 border-amber-400 dark:bg-amber-950/30'
                                : 'bg-gray-100 dark:bg-stone-800'
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={cn(
                                'font-mono font-bold text-base',
                                entry.status === 'läuft' ? 'text-green-600 dark:text-green-400' : 'text-sauna-400'
                              )}>
                                {formatTime(entry.start_time)}
                              </span>
                              {level && (
                                <span className={cn(
                                  'badge text-white text-xs font-mono tabular-nums',
                                  level === 'urgent' ? 'bg-red-600 animate-pulse' : 'bg-amber-500'
                                )}>
                                  in {formatCountdown(secs)}
                                </span>
                              )}
                              <span className="text-gray-500 dark:text-stone-400 text-xs ml-auto">{entry.sauna_name}</span>
                            </div>
                            <p className="font-display font-semibold text-gray-900 dark:text-stone-100 text-sm leading-tight">
                              {entry.custom_name ?? entry.template_name}
                            </p>
                            {entry.scents.length > 0 && (
                              <p className="text-gray-400 dark:text-stone-500 text-xs">
                                {entry.scents.map(s => s.scent_name).join(', ')}
                              </p>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Vollständiger Tagesplan */}
            <section>
              <h2 className="text-steam-400 text-xs uppercase tracking-widest mb-4">Vollständiger Tagesplan</h2>
              <div className="grid grid-cols-1 gap-3">
                {activeSchedule.length === 0 ? (
                  <p className="text-gray-400 dark:text-stone-500 text-sm">Alle Aufgüsse für heute sind abgeschlossen.</p>
                ) : activeSchedule.map(entry => (
                  <AufgussCard key={entry.id} entry={entry} showDetails compact />
                ))}
              </div>
            </section>

            {/* Abgeschlossene Aufgüsse */}
            {doneSchedule.length > 0 && (
              <section className="border-t border-gray-200 dark:border-stone-800 pt-6">
                <button
                  type="button"
                  onClick={() => setShowDone(v => !v)}
                  className="w-full flex items-center justify-between mb-4 text-left"
                >
                  <h2 className="text-steam-400 text-xs uppercase tracking-widest">
                    Abgeschlossene Aufgüsse ({doneSchedule.length})
                  </h2>
                  <span className="text-gray-400 dark:text-stone-500 text-sm">
                    {showDone ? 'Ausblenden ▲' : 'Anzeigen ▼'}
                  </span>
                </button>
                {showDone && (
                  <div className="grid grid-cols-1 gap-3">
                    {doneSchedule.map(entry => (
                      <AufgussCard key={entry.id} entry={entry} showDetails compact />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
