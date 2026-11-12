import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { addDays, format, isSameDay, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { DayEvent } from '../types';
import AufgussCard from '../components/AufgussCard';
import { cn } from '../lib/utils';

/** Wie viele Tage (inkl. heute) Gäste im Voraus sehen können */
const DAYS_AHEAD = 14;

interface DayOverview { date: string; title: string | null; count: number }

/**
 * Öffentliches Gäste-Programm (/programm): Gäste können die kommenden Tage durchblättern,
 * z. B. per QR-Code oder Link auf der Website. Das Gäste-Display (/) zeigt dagegen immer nur heute.
 */
export default function GuestProgram() {
  const [params, setParams] = useSearchParams();
  const today = useMemo(() => new Date(), []);
  const days = useMemo(() => Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i)), [today]);
  const from = format(days[0], 'yyyy-MM-dd');
  const to = format(days[days.length - 1], 'yyyy-MM-dd');

  // Ausgewählter Tag aus der URL (?tag=JJJJ-MM-TT), nur innerhalb des erlaubten Zeitraums
  const requested = params.get('tag');
  const selected = requested && requested >= from && requested <= to ? requested : from;
  const selectedIdx = days.findIndex(d => format(d, 'yyyy-MM-dd') === selected);
  const selectedDate = parseISO(selected);

  const select = (dateStr: string) => {
    setParams(dateStr === from ? {} : { tag: dateStr }, { replace: true });
  };

  const { data: settings } = useQuery<{ app_name?: string }>({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/settings')).data,
    staleTime: 5 * 60_000,
  });

  const { data: overview = [] } = useQuery<DayOverview[]>({
    queryKey: ['public-overview', from, to],
    queryFn: async () => (await api.get('/events/public/overview', { params: { from, to } })).data,
    refetchInterval: 5 * 60_000,
  });
  const countByDate = new Map(overview.map(o => [o.date, o.count]));

  const { data: event, isLoading } = useQuery<DayEvent | null>({
    queryKey: ['event', selected],
    queryFn: async () => {
      try {
        return (await api.get(`/events/${selected}`)).data;
      } catch (e: any) {
        if (e.response?.status === 404) return null;
        throw e;
      }
    },
    refetchInterval: 60_000,
  });

  const schedule = event?.schedule ?? [];
  const grouped = schedule.reduce<Record<string, typeof schedule>>((acc, entry) => {
    (acc[entry.sauna_id] ??= []).push(entry);
    return acc;
  }, {});

  // Ausgewählten Tag in der Leiste sichtbar halten
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    stripRef.current
      ?.querySelector<HTMLElement>(`[data-date="${selected}"]`)
      ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selected]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-stone-950 flex flex-col">
      {/* Header */}
      <header className="px-4 pt-5 pb-3 sm:px-8 sm:pt-6 border-b border-gray-200 dark:border-stone-800">
        <p className="text-steam-400 text-xs sm:text-sm uppercase tracking-widest mb-1">
          {settings?.app_name ?? 'Sauna'}
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 dark:text-stone-100">
          Aufguss-Programm
        </h1>

        {/* Tagesauswahl */}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            aria-label="Vorheriger Tag"
            disabled={selectedIdx <= 0}
            onClick={() => select(format(days[selectedIdx - 1], 'yyyy-MM-dd'))}
            className="hidden sm:flex shrink-0 p-2 rounded-xl text-gray-500 hover:bg-gray-200 dark:text-stone-400 dark:hover:bg-stone-800 disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div ref={stripRef} className="flex gap-2 overflow-x-auto pb-2 -mb-2 snap-x scrollbar-none flex-1">
            {days.map(d => {
              const dateStr = format(d, 'yyyy-MM-dd');
              const active = dateStr === selected;
              const hasProgram = (countByDate.get(dateStr) ?? 0) > 0;
              return (
                <button
                  key={dateStr}
                  type="button"
                  data-date={dateStr}
                  onClick={() => select(dateStr)}
                  aria-pressed={active}
                  className={cn(
                    'snap-start shrink-0 w-14 sm:w-16 rounded-2xl py-2 flex flex-col items-center gap-0.5 border transition-colors',
                    active
                      ? 'bg-sauna-600 border-sauna-600 text-white'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-sauna-400 dark:bg-stone-900 dark:border-stone-800 dark:text-stone-300',
                    !active && !hasProgram && 'opacity-50'
                  )}
                >
                  <span className="text-[11px] uppercase tracking-wider">
                    {isSameDay(d, today) ? 'Heute' : format(d, 'EEE', { locale: de })}
                  </span>
                  <span className="text-lg font-bold tabular-nums leading-none">{format(d, 'd')}</span>
                  <span className={cn('w-1.5 h-1.5 rounded-full mt-0.5', hasProgram ? (active ? 'bg-white' : 'bg-sauna-500') : 'bg-transparent')} />
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-label="Nächster Tag"
            disabled={selectedIdx >= days.length - 1}
            onClick={() => select(format(days[selectedIdx + 1], 'yyyy-MM-dd'))}
            className="hidden sm:flex shrink-0 p-2 rounded-xl text-gray-500 hover:bg-gray-200 dark:text-stone-400 dark:hover:bg-stone-800 disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Inhalt */}
      <main className="flex-1 p-4 sm:p-6">
        <div className="mb-5">
          <p className="text-gray-500 dark:text-stone-400 text-sm">
            {format(selectedDate, 'EEEE, dd. MMMM yyyy', { locale: de })}
          </p>
          {event?.title && (
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-gray-900 dark:text-stone-100">{event.title}</h2>
          )}
          {event?.notes && (
            <p className="text-gray-500 dark:text-stone-400 text-sm mt-1 max-w-xl">{event.notes}</p>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 dark:text-stone-500">Lade Programm…</div>
        ) : schedule.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center text-gray-400 dark:text-stone-500">
            <span className="text-5xl">🌿</span>
            <p className="text-lg">Für diesen Tag ist noch kein Programm eingetragen.</p>
          </div>
        ) : (
          <div className="guest-grid grid gap-6 sm:gap-8" style={{ ['--cols' as any]: Object.keys(grouped).length }}>
            {Object.entries(grouped).map(([saunaId, entries]) => (
              <section key={saunaId} className="flex flex-col gap-4">
                <h3 className="text-steam-400 font-semibold uppercase tracking-widest text-sm text-center border-b border-gray-200 dark:border-stone-800 pb-3">
                  {entries[0].sauna_name}
                </h3>
                {entries.map(entry => (
                  <AufgussCard key={entry.id} entry={entry} showDetails={false} />
                ))}
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
