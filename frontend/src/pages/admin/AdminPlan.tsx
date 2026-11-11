import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, subDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { api } from '../../lib/api';
import { DayEvent, AufgussTemplate, User, Sauna, ScheduleEntry, Scent } from '../../types';
import AufgussCard from '../../components/AufgussCard';
import Avatar from '../../components/Avatar';
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil } from 'lucide-react';
import { formatTime } from '../../lib/utils';

export default function AdminPlan() {
  const [date, setDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<ScheduleEntry | null>(null);
  const qc = useQueryClient();
  const dateStr = format(date, 'yyyy-MM-dd');

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['event-admin', dateStr] }); setShowForm(false); },
    onError: (err: any) => alert(`Fehler beim Speichern: ${err.response?.data?.error ?? err.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, selectedScents, ...scheduleData } = data;
      const res = await api.put(`/events/${dateStr}/schedule/${id}`, scheduleData);
      await saveScents(id, selectedScents ?? []);
      return res;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['event-admin', dateStr] }); setEditEntry(null); },
    onError: (err: any) => alert(`Fehler beim Speichern: ${err.response?.data?.error ?? err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/events/${dateStr}/schedule/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event-admin', dateStr] }),
    onError: (err: any) => alert(`Fehler beim Löschen: ${err.response?.data?.error ?? err.message}`),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, sauna_id, template_id, assigned_user_id, custom_name, custom_subtitle, start_time, end_time }: any) =>
      api.put(`/events/${dateStr}/schedule/${id}`, { sauna_id, template_id, assigned_user_id, custom_name, custom_subtitle, start_time, end_time, status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['event-admin', dateStr] }); qc.invalidateQueries({ queryKey: ['event', dateStr] }); },
    onError: (err: any) => alert(`Fehler: ${err.response?.data?.error ?? err.message}`),
  });

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-6">
      {/* Date Nav */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={() => setDate(d => subDays(d, 1))} className="btn-secondary p-2" aria-label="Vorheriger Tag"><ChevronLeft className="w-4 h-4" /></button>
          <div className="text-center flex-1 sm:flex-none min-w-0">
            <p className="text-gray-500 dark:text-stone-400 text-sm">{format(date, 'EEEE', { locale: de })}</p>
            <h2 className="font-display text-lg sm:text-xl font-bold text-gray-900 dark:text-stone-100">{format(date, 'dd. MMMM yyyy', { locale: de })}</h2>
          </div>
          <button onClick={() => setDate(d => addDays(d, 1))} className="btn-secondary p-2" aria-label="Nächster Tag"><ChevronRight className="w-4 h-4" /></button>
          <button onClick={() => setDate(new Date())} className="btn-secondary text-sm">Heute</button>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Aufguss hinzufügen
        </button>
      </div>

      {/* Plan */}
      {!event || event.schedule.length === 0 ? (
        <div className="card p-8 sm:p-12 text-center text-gray-400 dark:text-stone-500">
          <p className="text-lg mb-3">Noch kein Programm für diesen Tag.</p>
          <button onClick={() => setShowForm(true)} className="btn-primary">Ersten Aufguss anlegen</button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {event.schedule.map(entry => (
            <div key={entry.id} className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-start">
              <div className="flex-1 min-w-0">
                <AufgussCard entry={entry} showDetails compact />
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
          dateStr={dateStr}
          onSubmit={data => editEntry ? updateMutation.mutate({ ...data, id: editEntry.id }) : addMutation.mutate(data)}
          onClose={() => { setShowForm(false); setEditEntry(null); }}
        />
      )}
    </div>
  );
}

function ScheduleForm({ entry, templates, users, saunas, dateStr, onSubmit, onClose }: {
  entry: ScheduleEntry | null;
  templates: AufgussTemplate[];
  users: User[];
  saunas: Sauna[];
  dateStr: string;
  onSubmit: (data: any) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    sauna_id: entry?.sauna_id ?? saunas[0]?.id ?? '',
    template_id: entry?.template_id ?? '',
    assigned_user_id: entry?.assigned_user_id ?? '',
    custom_name: entry?.custom_name ?? '',
    custom_subtitle: entry?.custom_subtitle ?? '',
    start_time: entry?.start_time ?? '',
    end_time: entry?.end_time ?? '',
    status: entry?.status ?? 'geplant',
  });
  const [selectedScents, setSelectedScents] = useState<{ scent_id: string; dosage_ml: string; dosage_note: string }[]>([]);
  const [scentsLoaded, setScentsLoaded] = useState(!entry); // neue Einträge brauchen kein Laden

  const { data: scents = [] } = useQuery<Scent[]>({ queryKey: ['scents'], queryFn: async () => (await api.get('/scents')).data });

  // Beim Bearbeiten: aktuelle Düfte frisch aus der DB laden
  useEffect(() => {
    if (!entry) return;
    api.get(`/events/${dateStr}/schedule/${entry.id}/scents`)
      .then(res => {
        setSelectedScents(res.data.map((s: any) => ({
          scent_id: s.scent_id,
          dosage_ml: s.dosage_ml?.toString() ?? '',
          dosage_note: s.dosage_note ?? '',
        })));
      })
      .catch(() => {
        // Fallback auf Daten aus dem Entry-Objekt
        setSelectedScents(entry.scents.map(s => ({
          scent_id: s.scent_id ?? '',
          dosage_ml: s.dosage_ml?.toString() ?? '',
          dosage_note: s.dosage_note ?? '',
        })));
      })
      .finally(() => setScentsLoaded(true));
  }, [entry?.id]);

  const addMinutes = (time: string, mins: number) => {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + mins;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };

  const set = (k: string, v: string) => {
    if (k === 'template_id') {
      const tmpl = templates.find(t => t.id === v);
      setForm(f => ({
        ...f,
        template_id: v,
        custom_name: tmpl?.name ?? '',
        custom_subtitle: tmpl?.subtitle ?? '',
        end_time: tmpl && f.start_time ? addMinutes(f.start_time, tmpl.duration_minutes) : f.end_time,
      }));
      if (tmpl) {
        setSelectedScents(tmpl.scents.map(s => ({
          scent_id: s.scent_id,
          dosage_ml: s.dosage_ml?.toString() ?? '',
          dosage_note: s.dosage_note ?? '',
        })));
        setScentsLoaded(true);
      } else if (!v) {
        setSelectedScents([]);
      }
    } else if (k === 'start_time') {
      const tmpl = templates.find(t => t.id === form.template_id);
      setForm(f => ({
        ...f,
        start_time: v,
        end_time: tmpl && v ? addMinutes(v, tmpl.duration_minutes) : f.end_time,
      }));
    } else {
      setForm(f => ({ ...f, [k]: v }));
    }
  };
  const addScent = () => {
    const sc = scents[0];
    setSelectedScents(s => [...s, { scent_id: sc?.id ?? '', dosage_ml: sc?.default_dosage_ml?.toString() ?? '', dosage_note: sc?.dosage_note ?? '' }]);
  };
  const removeScent = (i: number) => setSelectedScents(s => s.filter((_, idx) => idx !== i));
  const updateScent = (i: number, k: string, v: string) => {
    if (k === 'scent_id') {
      const sc = scents.find(x => x.id === v);
      setSelectedScents(s => s.map((item, idx) => idx === i ? { scent_id: v, dosage_ml: sc?.default_dosage_ml?.toString() ?? '', dosage_note: sc?.dosage_note ?? '' } : item));
    } else {
      setSelectedScents(s => s.map((item, idx) => idx === i ? { ...item, [k]: v } : item));
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-w-2xl">
        <h3 className="font-display text-xl font-bold">{entry ? 'Aufguss bearbeiten' : 'Aufguss hinzufügen'}</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:max-h-96 sm:overflow-y-auto sm:pr-2">
          <div>
            <label className="label">Sauna *</label>
            <select className="input" value={form.sauna_id} onChange={e => set('sauna_id', e.target.value)}>
              {saunas.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Vorlage</label>
            <select className="input" value={form.template_id} onChange={e => set('template_id', e.target.value)}>
              <option value="">— Keine Vorlage —</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Startzeit *</label>
            <input type="time" className="input" value={form.start_time} onChange={e => set('start_time', e.target.value)} />
          </div>
          <div>
            <label className="label">Endzeit</label>
            <input type="time" className="input" value={form.end_time} onChange={e => set('end_time', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Name <span className="text-gray-400 dark:text-stone-500 font-normal">(aus Vorlage, anpassbar)</span></label>
            <input className="input" value={form.custom_name} onChange={e => set('custom_name', e.target.value)} placeholder="z.B. Sommerliche Erfrischung" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Untertitel</label>
            <input className="input" value={form.custom_subtitle} onChange={e => set('custom_subtitle', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Mitarbeiter</label>
            <select className="input" value={form.assigned_user_id} onChange={e => set('assigned_user_id', e.target.value)}>
              <option value="">— Noch nicht zugewiesen —</option>
              {users.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          {/* Düfte-Sektion */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Düfte (für diesen Aufguss)</label>
              <button type="button" onClick={addScent} className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"><Plus className="w-3 h-3" /> Duft hinzufügen</button>
            </div>
            <div className="flex flex-col gap-2 bg-gray-100/70 dark:bg-stone-800/50 p-3 rounded-xl">
              {!scentsLoaded && <p className="text-gray-400 dark:text-stone-500 text-sm italic">Lade Düfte…</p>}
              {scentsLoaded && selectedScents.length === 0 && <p className="text-gray-400 dark:text-stone-500 text-sm italic">Keine Düfte gewählt</p>}
              {selectedScents.map((s, i) => {
                const sc = scents.find(x => x.id === s.scent_id);
                return (
                  <div key={i} className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
                    <select className="input w-full sm:w-auto sm:flex-1 text-sm" value={s.scent_id} onChange={e => updateScent(i, 'scent_id', e.target.value)}>
                      <option value="">— Duft wählen —</option>
                      {scents.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                    </select>
                    <div className="flex items-center gap-1 shrink-0">
                      <input className="input w-20 text-sm" type="number" step="0.5" min="0" placeholder="Menge" value={s.dosage_ml} onChange={e => updateScent(i, 'dosage_ml', e.target.value)} />
                      <span className="text-gray-500 dark:text-stone-400 text-xs w-8">{sc?.dosage_unit ?? 'ml'}</span>
                    </div>
                    <input className="input flex-1 min-w-0 sm:flex-none sm:w-28 text-sm" placeholder="Hinweis" value={s.dosage_note} onChange={e => updateScent(i, 'dosage_note', e.target.value)} />
                    <button onClick={() => removeScent(i)} className="p-2 -m-1 text-gray-400 hover:text-red-500 dark:text-stone-500 dark:hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end [&>button]:flex-1 sm:[&>button]:flex-none">
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button
            disabled={!scentsLoaded}
            onClick={() => {
              if (!form.sauna_id) { alert('Bitte eine Sauna wählen.'); return; }
              if (!form.start_time) { alert('Bitte eine Startzeit eingeben.'); return; }
              onSubmit({ ...form, selectedScents });
            }}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
