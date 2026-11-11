import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, subDays, addWeeks, subWeeks, startOfWeek, parseISO, isValid, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { api } from '../../lib/api';
import { DayEvent, AufgussTemplate, User, Sauna, ScheduleEntry } from '../../types';
import AufgussCard from '../../components/AufgussCard';
import ScheduleForm from '../../components/ScheduleForm';
import { ApplyDayTemplateModal, SaveDayTemplateModal } from '../../components/DayTemplateModals';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, Trash2, Pencil, CalendarPlus, Save, UserPlus } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function AdminPlan() {
  // Datum steht in der URL (?datum=YYYY-MM-DD) – bleibt beim Neuladen erhalten und ist verlinkbar
  const [searchParams, setSearchParams] = useSearchParams();
  const parsed = parseISO(searchParams.get('datum') ?? '');
  const date = isValid(parsed) ? parsed : new Date();
  const setDate = (next: Date | ((d: Date) => Date)) => {
    const d = typeof next === 'function' ? next(date) : next;
    setSearchParams(isSameDay(d, new Date()) ? {} : { datum: format(d, 'yyyy-MM-dd') }, { replace: true });
  };

  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<ScheduleEntry | null>(null);
  const [showApply, setShowApply] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const qc = useQueryClient();
  const { user } = useAuth();
  const dateStr = format(date, 'yyyy-MM-dd');

  // Wochenleiste: Montag bis Sonntag der gewählten Woche, mit Anzahl geplanter Aufgüsse
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekFrom = format(weekDays[0], 'yyyy-MM-dd');
  const weekTo = format(weekDays[6], 'yyyy-MM-dd');
  const { data: weekCounts = [] } = useQuery<{ date: string; count: number }[]>({
    queryKey: ['event-summary', weekFrom, weekTo],
    queryFn: async () => (await api.get('/events', { params: { from: weekFrom, to: weekTo } })).data,
  });
  const countFor = (d: Date) => weekCounts.find(c => c.date === format(d, 'yyyy-MM-dd'))?.count ?? 0;
  const invalidateDay = () => {
    qc.invalidateQueries({ queryKey: ['event-admin', dateStr] });
    qc.invalidateQueries({ queryKey: ['event-summary'] });
  };

  const { data: event } = useQuery<DayEvent | null>({
    queryKey: ['event-admin', dateStr],
    queryFn: async () => {
      try { const { data } = await api.get(`/events/${dateStr}`); return data; }
      catch (e: any) { if (e.response?.status === 404) return null; throw e; }
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });
  const { data: templates = [] } = useQuery<AufgussTemplate[]>({ queryKey: ['templates'], queryFn: async () => (await api.get('/templates')).data });
  const { data: users = [] } = useQuery<User[]>({ queryKey: ['users'], queryFn: async () => (await api.get('/users')).data });
  const { data: saunas = [] } = useQuery<Sauna[]>({ queryKey: ['saunas'], queryFn: async () => (await api.get('/saunas')).data });

  const saveScents = async (scheduleId: string, selectedScents: any[]) => {
    const validScents = (selectedScents ?? []).filter((s: any) => s.scent_id);
    await api.post(`/events/${dateStr}/schedule/${scheduleId}/scents`, {
      scents: validScents.map((s: any) => ({
        scent_id: s.scent_id,
        dosage_ml: s.dosage_ml ? parseFloat(s.dosage_ml) : null,
        dosage_note: s.dosage_note || null,
      })),
    });
  };

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      const { selectedScents, ...scheduleData } = data;
      const res = await api.post(`/events/${dateStr}/schedule`, scheduleData);
      await saveScents(res.data.id, selectedScents ?? []);
      return res;
    },
    onSuccess: () => { invalidateDay(); setShowForm(false); },
    onError: (err: any) => alert(`Fehler beim Speichern: ${err.response?.data?.error ?? err.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, selectedScents, ...scheduleData } = data;
      const res = await api.put(`/events/${dateStr}/schedule/${id}`, scheduleData);
      await saveScents(id, selectedScents ?? []);
      return res;
    },
    onSuccess: () => { invalidateDay(); setEditEntry(null); },
    onError: (err: any) => alert(`Fehler beim Speichern: ${err.response?.data?.error ?? err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/events/${dateStr}/schedule/${id}`),
    onSuccess: invalidateDay,
    onError: (err: any) => alert(`Fehler beim Löschen: ${err.response?.data?.error ?? err.message}`),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, sauna_id, template_id, assigned_user_id, custom_name, custom_subtitle, start_time, end_time }: any) =>
      api.put(`/events/${dateStr}/schedule/${id}`, { sauna_id, template_id, assigned_user_id, custom_name, custom_subtitle, start_time, end_time, status }),
    onSuccess: () => { invalidateDay(); qc.invalidateQueries({ queryKey: ['event', dateStr] }); },
    onError: (err: any) => alert(`Fehler: ${err.response?.data?.error ?? err.message}`),
  });

  // „Mir zuweisen“: freien Aufguss selbst übernehmen
  const claimMutation = useMutation({
    mutationFn: (id: string) => api.post(`/events/${dateStr}/schedule/${id}/claim`),
    onSuccess: () => { invalidateDay(); qc.invalidateQueries({ queryKey: ['event', dateStr] }); },
    onError: (err: any) => {
      alert(err.response?.data?.error ?? err.message);
      invalidateDay(); // z. B. wenn jemand anderes schneller war: Ansicht aktualisieren
    },
  });

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-6">
      {/* Datums-Navigation */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={() => setDate(d => subDays(d, 1))} className="btn-secondary p-2" aria-label="Vorheriger Tag"><ChevronLeft className="w-4 h-4" /></button>
            <div className="text-center flex-1 sm:flex-none min-w-0">
              <p className="text-gray-500 dark:text-stone-400 text-sm">{format(date, 'EEEE', { locale: de })}</p>
              <h2 className="font-display text-lg sm:text-xl font-bold text-gray-900 dark:text-stone-100">{format(date, 'dd. MMMM yyyy', { locale: de })}</h2>
            </div>
            <button onClick={() => setDate(d => addDays(d, 1))} className="btn-secondary p-2" aria-label="Nächster Tag"><ChevronRight className="w-4 h-4" /></button>
            <button onClick={() => setDate(new Date())} className="btn-secondary text-sm">Heute</button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-stone-400 whitespace-nowrap">Gehe zu</span>
              <input
                type="date"
                className="input py-1.5"
                value={dateStr}
                onChange={e => { const d = parseISO(e.target.value); if (isValid(d)) setDate(d); }}
                aria-label="Datum auswählen"
              />
            </label>
          </div>
        </div>

        {/* Wochenleiste */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button onClick={() => setDate(d => subWeeks(d, 1))} className="btn-secondary p-2 shrink-0" aria-label="Vorherige Woche" title="Eine Woche zurück"><ChevronsLeft className="w-4 h-4" /></button>
          <div className="grid grid-cols-7 gap-1 sm:gap-2 flex-1 min-w-0">
            {weekDays.map(d => {
              const selected = isSameDay(d, date);
              const today = isSameDay(d, new Date());
              const count = countFor(d);
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setDate(d)}
                  className={cn(
                    'flex flex-col items-center rounded-xl py-1.5 sm:py-2 text-xs sm:text-sm transition-colors border',
                    selected
                      ? 'bg-sauna-600 border-sauna-600 text-white'
                      : 'bg-white border-gray-200 hover:bg-gray-100 text-gray-700 dark:bg-stone-900 dark:border-stone-800 dark:hover:bg-stone-800 dark:text-stone-300',
                    today && !selected && 'border-sauna-500'
                  )}
                >
                  <span className="uppercase text-[10px] sm:text-xs opacity-70">{format(d, 'EEEEEE', { locale: de })}</span>
                  <span className="font-semibold tabular-nums">{format(d, 'd.')}</span>
                  <span className={cn('text-[10px] leading-none mt-0.5 tabular-nums', count ? '' : 'opacity-0')}>
                    {count} <span className="hidden sm:inline">Aufg.</span>
                  </span>
                </button>
              );
            })}
          </div>
          <button onClick={() => setDate(d => addWeeks(d, 1))} className="btn-secondary p-2 shrink-0" aria-label="Nächste Woche" title="Eine Woche vor"><ChevronsRight className="w-4 h-4" /></button>
        </div>

        {/* Aktionen */}
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
          {event && event.schedule.length > 0 && (
            <button onClick={() => setShowSaveTemplate(true)} className="btn-secondary flex items-center justify-center gap-2 text-sm">
              <Save className="w-4 h-4" /> Als Tagesvorlage speichern
            </button>
          )}
          <button onClick={() => setShowApply(true)} className="btn-secondary flex items-center justify-center gap-2 text-sm">
            <CalendarPlus className="w-4 h-4" /> Tagesvorlage anwenden
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Aufguss hinzufügen
          </button>
        </div>
      </div>

      {/* Plan */}
      {!event || event.schedule.length === 0 ? (
        <div className="card p-8 sm:p-12 text-center text-gray-400 dark:text-stone-500">
          <p className="text-lg mb-3">Noch kein Programm für diesen Tag.</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button onClick={() => setShowApply(true)} className="btn-primary flex items-center justify-center gap-2"><CalendarPlus className="w-4 h-4" /> Tagesvorlage anwenden</button>
            <button onClick={() => setShowForm(true)} className="btn-secondary">Einzelnen Aufguss anlegen</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {event.schedule.map(entry => (
            <div key={entry.id} className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-start">
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <AufgussCard entry={entry} showDetails compact />
                {!entry.assigned_user_id && user && entry.status !== 'fertig' && entry.status !== 'abgesagt' && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-sauna-500/60 bg-sauna-500/5 px-3 py-2">
                    <span className="text-sm text-gray-600 dark:text-stone-400">Noch niemandem zugewiesen</span>
                    <button
                      onClick={() => claimMutation.mutate(entry.id)}
                      disabled={claimMutation.isPending}
                      className="btn-primary py-1.5 px-3 text-sm flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                    >
                      <UserPlus className="w-4 h-4" /> Mir zuweisen
                    </button>
                  </div>
                )}
              </div>
              <div className="flex sm:flex-col gap-2 sm:pt-1 shrink-0">
                {/* Status-Buttons */}
                <select
                  value={entry.status}
                  onChange={e => statusMutation.mutate({ ...entry, id: entry.id, status: e.target.value })}
                  className="input text-xs py-2 sm:py-1 px-2 flex-1 sm:flex-none sm:w-32"
                >
                  <option value="geplant">Geplant</option>
                  <option value="läuft">Läuft</option>
                  <option value="fertig">Fertig</option>
                  <option value="abgesagt">Abgesagt</option>
                </select>
                <button onClick={() => setEditEntry(entry)} className="btn-secondary py-2 sm:py-1 px-3 sm:px-2 text-xs flex items-center justify-center gap-1"><Pencil className="w-3 h-3" /> Bearbeiten</button>
                <button onClick={() => { if (confirm('Aufguss löschen?')) deleteMutation.mutate(entry.id); }} className="btn-danger py-2 sm:py-1 px-3 sm:px-2 text-xs flex items-center justify-center gap-1"><Trash2 className="w-3 h-3" /> Löschen</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formular */}
      {(showForm || editEntry) && (
        <ScheduleForm
          entry={editEntry}
          templates={templates}
          users={users}
          saunas={saunas}
          loadScents={editEntry ? async () => (await api.get(`/events/${dateStr}/schedule/${editEntry.id}/scents`)).data : undefined}
          onSubmit={data => editEntry ? updateMutation.mutate({ ...data, id: editEntry.id }) : addMutation.mutate(data)}
          onClose={() => { setShowForm(false); setEditEntry(null); }}
        />
      )}

      {showApply && (
        <ApplyDayTemplateModal
          date={date}
          onClose={() => setShowApply(false)}
          onApplied={() => {
            qc.invalidateQueries({ queryKey: ['event-admin'] });
            qc.invalidateQueries({ queryKey: ['event'] });
            qc.invalidateQueries({ queryKey: ['event-summary'] });
          }}
        />
      )}

      {showSaveTemplate && (
        <SaveDayTemplateModal date={date} onClose={() => setShowSaveTemplate(false)} />
      )}
    </div>
  );
}
