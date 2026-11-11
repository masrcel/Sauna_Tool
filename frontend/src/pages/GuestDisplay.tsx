import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { api } from '../lib/api';
import { DayEvent } from '../types';
import AufgussCard from '../components/AufgussCard';
import Avatar from '../components/Avatar';
import ScentBadge from '../components/ScentBadge';
import { useClock } from '../hooks/useClock';
import { cn, formatTime, secondsUntil, formatCountdown } from '../lib/utils';

const COUNTDOWN_SECS = 5 * 60;

function useTodayEvent(dateStr: string) {
  return useQuery<DayEvent | null>({
    queryKey: ['event', dateStr],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/events/${dateStr}`);
        return data;
      } catch (e: any) {
        if (e.response?.status === 404) return null;
        throw e;
      }
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });
}

export default function GuestDisplay() {
  const now = useClock();
  const dateStr = format(now, 'yyyy-MM-dd');
  const { data: event, isLoading } = useTodayEvent(dateStr);

  const visibleSchedule = event?.schedule.filter(e => e.status !== 'fertig') ?? [];

  const grouped = visibleSchedule.reduce<Record<string, typeof visibleSchedule>>((acc, entry) => {
    acc[entry.sauna_id] = [...(acc[entry.sauna_id] ?? []), entry];
    return acc;
  }, {});

  // Aufgüsse, die in den nächsten 5 Minuten starten (Sekunden je Eintrag)
  const countdowns = new Map<string, number>();
  for (const e of visibleSchedule) {
    if (e.status !== 'geplant') continue;
    const secs = secondsUntil(e.start_time, now);
    if (secs > 0 && secs <= COUNTDOWN_SECS) countdowns.set(e.id, secs);
  }
  const startingSoon = visibleSchedule
    .filter(e => countdowns.has(e.id))
    .sort((a, b) => countdowns.get(a.id)! - countdowns.get(b.id)!);

  const saunaNames = visibleSchedule.reduce<Record<string, string>>((acc, e) => {
    acc[e.sauna_id] = e.sauna_name;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-stone-950 flex flex-col">
      {/* Header */}
      <header className="px-4 py-4 sm:px-8 sm:py-6 flex items-center justify-between gap-4 border-b border-gray-200 dark:border-stone-800">
        <div className="flex flex-col min-w-0">
          <p className="text-steam-400 text-xs sm:text-sm uppercase tracking-widest mb-1">
            {format(now, 'EEEE, dd. MMMM yyyy', { locale: de })}
          </p>
          <h1 className="font-display text-xl sm:text-3xl font-bold text-gray-900 dark:text-stone-100">
            {event?.title ?? 'Aufguss-Programm'}
          </h1>
          {event?.notes && (
            <p className="text-gray-500 dark:text-stone-400 text-sm mt-1 max-w-xl">{event.notes}</p>
          )}
        </div>
        {/* Aktuelle Uhrzeit */}
        <div className="text-right shrink-0">
          <p className="font-mono text-3xl sm:text-5xl font-bold text-sauna-400 tabular-nums leading-none">
            {format(now, 'HH:mm')}
          </p>
        </div>
      </header>

      {/* Inhalt */}
      <main className="flex-1 p-4 sm:p-6 pb-40 sm:pb-28">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-gray-400 dark:text-stone-500">Lade Programm…</div>
        ) : visibleSchedule.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400 dark:text-stone-500">
            <span className="text-5xl">🌿</span>
            <p className="text-lg">Kein Programm für heute eingetragen.</p>
          </div>
        ) : (
          <>
          {/* Countdown – Aufguss startet in weniger als 5 Minuten */}
          {startingSoon.length > 0 && (
            <section className="flex flex-col gap-4 mb-8">
              {startingSoon.map(entry => (
                <div
                  key={entry.id}
                  className="rounded-3xl border-2 border-sauna-500 bg-sauna-50 dark:bg-sauna-900/40 p-4 sm:px-8 sm:py-5 flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-6 shadow-lg"
                >
                  <div className="shrink-0 rounded-2xl bg-sauna-600 text-white px-4 py-2 sm:px-6 sm:py-3 text-center">
                    <p className="text-xs uppercase tracking-widest opacity-90">Beginnt in</p>
                    <p className="font-mono text-4xl sm:text-6xl font-bold tabular-nums leading-none mt-1">
                      {formatCountdown(countdowns.get(entry.id)!)}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sauna-600 dark:text-sauna-400 text-xs sm:text-sm font-semibold uppercase tracking-widest">
                      Gleich geht's los – {entry.sauna_name}
                    </p>
                    <p className="font-display text-xl sm:text-3xl font-bold text-gray-900 dark:text-stone-100 truncate">
                      {entry.custom_name ?? entry.template_name ?? 'Aufguss'}
                    </p>
                    <p className="text-gray-500 dark:text-stone-400 mt-1">
                      Start um {formatTime(entry.start_time)} Uhr
                    </p>
                    {entry.scents.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {entry.scents.map((s, i) => (
                          <ScentBadge key={i} name={s.scent_name} color={s.color} size="sm" />
                        ))}
                      </div>
                    )}
                  </div>
                  {entry.staff_name && (
                    <div className="shrink-0 flex sm:flex-col items-center gap-2 w-full sm:w-auto">
                      <Avatar name={entry.staff_name} url={entry.staff_avatar} size="lg" />
                      <p className="font-semibold text-gray-900 dark:text-stone-100">{entry.staff_name}</p>
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          <div className="guest-grid grid gap-6 sm:gap-8" style={{ ['--cols' as any]: Object.keys(grouped).length }}>
            {Object.entries(grouped).map(([saunaId, entries]) => (
              <div key={saunaId} className="flex flex-col gap-4">
                <h2 className="text-steam-400 font-semibold uppercase tracking-widest text-sm text-center border-b border-gray-200 dark:border-stone-800 pb-3">
                  {saunaNames[saunaId]}
                </h2>
                {entries.map(entry => {
                  const secs = countdowns.get(entry.id);
                  return (
                    <div
                      key={entry.id}
                      className={cn('relative', secs !== undefined && 'rounded-2xl ring-2 ring-sauna-500 ring-offset-2 ring-offset-gray-100 dark:ring-offset-stone-950')}
                    >
                      {secs !== undefined && (
                        <span className="absolute -top-3 right-3 z-10 badge bg-sauna-600 text-white font-mono tabular-nums shadow">
                          in {formatCountdown(secs)}
                        </span>
                      )}
                      <AufgussCard entry={entry} showDetails={false} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          </>
        )}
      </main>

      {/* Nächster Aufguss – Fußzeile */}
      {event?.schedule && (() => {
        const next = event.schedule.find(e => e.status === 'geplant');
        if (!next) return null;
        const nextSecs = countdowns.get(next.id);
        return (
          <div className="fixed bottom-0 left-0 right-0 bg-sauna-900/90 backdrop-blur border-t border-sauna-700 px-4 py-3 sm:px-8 sm:py-4 flex items-center justify-between gap-4" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <div className="min-w-0">
              <span className="text-sauna-300 text-xs uppercase tracking-widest">
                Nächster Aufguss
                {nextSecs !== undefined && (
                  <span className="ml-2 font-mono font-bold text-white tabular-nums">· in {formatCountdown(nextSecs)}</span>
                )}
              </span>
              <p className="text-white font-display text-base sm:text-lg font-semibold truncate">
                {next.custom_name ?? next.template_name} — {next.start_time?.substring(0, 5)} Uhr
              </p>
              {next.scents.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {next.scents.map((s, i) => (
                    <ScentBadge key={i} name={s.scent_name} color={s.color} size="sm" />
                  ))}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-gray-300 text-sm">{next.sauna_name}</span>
              {next.staff_name && (
                <div className="flex items-center gap-2 justify-end mt-1">
                  <Avatar name={next.staff_name} url={next.staff_avatar} size="sm" />
                  <span className="text-gray-200 text-sm hidden sm:inline">{next.staff_name}</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
