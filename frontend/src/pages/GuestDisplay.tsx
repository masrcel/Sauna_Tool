import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { api } from '../lib/api';
import { DayEvent } from '../types';
import AufgussCard from '../components/AufgussCard';
import Avatar from '../components/Avatar';
import ScentBadge from '../components/ScentBadge';
import { useClock } from '../hooks/useClock';

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

  const saunaNames = visibleSchedule.reduce<Record<string, string>>((acc, e) => {
    acc[e.sauna_id] = e.sauna_name;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-stone-950 flex flex-col">
      {/* Header */}
      <header className="px-8 py-6 flex items-center justify-between border-b border-gray-200 dark:border-stone-800">
        <div className="flex flex-col">
          <p className="text-steam-400 text-sm uppercase tracking-widest mb-1">
            {format(now, 'EEEE, dd. MMMM yyyy', { locale: de })}
          </p>
          <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-stone-100">
            {event?.title ?? 'Aufguss-Programm'}
          </h1>
          {event?.notes && (
            <p className="text-gray-500 dark:text-stone-400 text-sm mt-1 max-w-xl">{event.notes}</p>
          )}
        </div>
        {/* Aktuelle Uhrzeit */}
        <div className="text-right shrink-0">
          <p className="font-mono text-5xl font-bold text-sauna-400 tabular-nums leading-none">
            {format(now, 'HH:mm')}
          </p>
        </div>
      </header>

      {/* Inhalt */}
      <main className="flex-1 p-6 pb-24">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-gray-400 dark:text-stone-500">Lade Programm…</div>
        ) : visibleSchedule.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400 dark:text-stone-500">
            <span className="text-5xl">🌿</span>
            <p className="text-lg">Kein Programm für heute eingetragen.</p>
          </div>
        ) : (
          <div className="grid gap-8" style={{ gridTemplateColumns: `repeat(${Object.keys(grouped).length}, 1fr)` }}>
            {Object.entries(grouped).map(([saunaId, entries]) => (
              <div key={saunaId} className="flex flex-col gap-4">
                <h2 className="text-steam-400 font-semibold uppercase tracking-widest text-sm text-center border-b border-gray-200 dark:border-stone-800 pb-3">
                  {saunaNames[saunaId]}
                </h2>
                {entries.map(entry => (
                  <AufgussCard key={entry.id} entry={entry} showDetails={false} />
                ))}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Nächster Aufguss – Fußzeile */}
      {event?.schedule && (() => {
        const next = event.schedule.find(e => e.status === 'geplant');
        if (!next) return null;
        return (
          <div className="fixed bottom-0 left-0 right-0 bg-sauna-900/90 backdrop-blur border-t border-sauna-700 px-8 py-4 flex items-center justify-between">
            <div>
              <span className="text-sauna-300 text-xs uppercase tracking-widest">Nächster Aufguss</span>
              <p className="text-white font-display text-lg font-semibold">
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
            <div className="text-right">
              <span className="text-gray-300 text-sm">{next.sauna_name}</span>
              {next.staff_name && (
                <div className="flex items-center gap-2 justify-end mt-1">
                  <Avatar name={next.staff_name} url={next.staff_avatar} size="sm" />
                  <span className="text-gray-200 text-sm">{next.staff_name}</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
