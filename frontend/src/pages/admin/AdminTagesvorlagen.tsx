import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { AufgussTemplate, DayTemplate, DayTemplateEntry, Sauna, User } from '../../types';
import ScheduleForm from '../../components/ScheduleForm';
import ScentBadge from '../../components/ScentBadge';
import { ApplyDayTemplateModal, DayTemplateEntryList } from '../../components/DayTemplateModals';
import { Plus, Pencil, Trash2, Copy, CalendarPlus, Clock } from 'lucide-react';

const errMsg = (err: any) => err.response?.data?.error ?? err.message;

/** Eintrag fürs Speichern aufbereiten (nur die Felder, die das Backend braucht) */
const toPayload = (e: DayTemplateEntry) => ({
  sauna_id: e.sauna_id,
  template_id: e.template_id || null,
  assigned_user_id: e.assigned_user_id || null,
  custom_name: e.custom_name || null,
  custom_subtitle: e.custom_subtitle || null,
  start_time: e.start_time,
  end_time: e.end_time || null,
  scents: e.scents.filter(s => s.scent_id).map(s => ({ scent_id: s.scent_id, dosage_ml: s.dosage_ml ?? null, dosage_note: s.dosage_note || null })),
});

export default function AdminTagesvorlagen() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<DayTemplate | 'new' | null>(null);
  const [applyId, setApplyId] = useState<string | null>(null);

  const { data: dayTemplates = [], isLoading } = useQuery<DayTemplate[]>({
    queryKey: ['day-templates'],
    queryFn: async () => (await api.get('/day-templates')).data,
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, ...d }: any) => id ? api.put(`/day-templates/${id}`, d) : api.post('/day-templates', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['day-templates'] }); setEditing(null); },
    onError: (err: any) => alert(`Fehler: ${errMsg(err)}`),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/day-templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['day-templates'] }),
    onError: (err: any) => alert(`Fehler: ${errMsg(err)}`),
  });
  const duplicate = (t: DayTemplate) => saveMutation.mutate({
    name: `${t.name} (Kopie)`, description: t.description, entries: t.entries.map(toPayload),
  });

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-6">
      <div className="page-header">
        <div>
          <h2 className="font-display text-2xl font-bold">Tagesvorlagen</h2>
          <p className="text-sm text-gray-500 dark:text-stone-400">Kompletter Tagesablauf zum Übernehmen auf einen oder viele Tage.</p>
        </div>
        <button onClick={() => setEditing('new')} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Tagesvorlage erstellen</button>
      </div>

      <div className="card p-4 text-sm text-gray-600 dark:text-stone-400">
        <strong className="text-gray-800 dark:text-stone-200">Tipp:</strong> Einen fertig geplanten Tag kannst du im <strong>Tagesplan</strong> mit
        „Als Tagesvorlage speichern“ übernehmen. Dort wendest du Vorlagen mit „Tagesvorlage anwenden“ auf einen Tag oder einen
        ganzen Zeitraum (z. B. alle Samstage im Monat) an.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {dayTemplates.map(t => {
          const first = t.entries[0]?.start_time;
          const last = t.entries[t.entries.length - 1];
          return (
            <div key={t.id} className="card p-4 sm:p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-semibold text-gray-900 dark:text-stone-100">{t.name}</h3>
                  <p className="text-gray-500 dark:text-stone-400 text-sm flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {t.entries.length} Aufgüsse{first ? ` · ${first}–${last.end_time ?? last.start_time} Uhr` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2 shrink-0">
                  <button onClick={() => setEditing(t)} className="btn-secondary p-2" title="Bearbeiten"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => duplicate(t)} className="btn-secondary p-2" title="Duplizieren"><Copy className="w-4 h-4" /></button>
                  <button onClick={() => { if (confirm(`Tagesvorlage „${t.name}“ löschen? Bereits geplante Tage bleiben erhalten.`)) deleteMutation.mutate(t.id); }} className="btn-danger p-2" title="Löschen"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {t.description && <p className="text-gray-500 dark:text-stone-400 text-sm">{t.description}</p>}
              <DayTemplateEntryList template={t} max={8} />
              <div className="flex items-center justify-between gap-2 mt-auto pt-1">
                {t.creator_name ? <p className="text-gray-400 dark:text-stone-600 text-xs">Erstellt von {t.creator_name}</p> : <span />}
                <button onClick={() => setApplyId(t.id)} disabled={t.entries.length === 0} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50">
                  <CalendarPlus className="w-4 h-4" /> Anwenden
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {!isLoading && dayTemplates.length === 0 && <p className="text-gray-400 dark:text-stone-500 text-center py-12">Noch keine Tagesvorlagen erstellt.</p>}

      {editing && (
        <DayTemplateEditor
          template={editing === 'new' ? null : editing}
          saving={saveMutation.isPending}
          onSubmit={d => saveMutation.mutate({ ...d, id: editing === 'new' ? undefined : editing.id })}
          onClose={() => setEditing(null)}
        />
      )}

      {applyId && (
        <ApplyDayTemplateModal
          date={new Date()}
          presetTemplateId={applyId}
          onClose={() => setApplyId(null)}
          onApplied={() => {
            qc.invalidateQueries({ queryKey: ['event-admin'] });
            qc.invalidateQueries({ queryKey: ['event'] });
            qc.invalidateQueries({ queryKey: ['event-summary'] });
          }}
        />
      )}
    </div>
  );
}

function DayTemplateEditor({ template, saving, onSubmit, onClose }: {
  template: DayTemplate | null;
  saving: boolean;
  onSubmit: (d: { name: string; description: string; entries: ReturnType<typeof toPayload>[] }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [entries, setEntries] = useState<DayTemplateEntry[]>(template?.entries ?? []);
  // null = Formular zu, -1 = neuer Aufguss, sonst Index des bearbeiteten Aufgusses
  const [formIndex, setFormIndex] = useState<number | null>(null);

  const { data: templates = [] } = useQuery<AufgussTemplate[]>({ queryKey: ['templates'], queryFn: async () => (await api.get('/templates')).data });
  const { data: users = [] } = useQuery<User[]>({ queryKey: ['users'], queryFn: async () => (await api.get('/users')).data });
  const { data: saunas = [] } = useQuery<Sauna[]>({ queryKey: ['saunas'], queryFn: async () => (await api.get('/saunas')).data });
  const { data: allScents = [] } = useQuery<any[]>({ queryKey: ['scents'], queryFn: async () => (await api.get('/scents')).data });

  const sorted = entries.map((e, i) => ({ e, i })).sort((a, b) => a.e.start_time.localeCompare(b.e.start_time));

  const handleEntrySubmit = (data: any) => {
    const { selectedScents, status: _status, ...f } = data;
    const tmpl = templates.find(t => t.id === f.template_id);
    const entry: DayTemplateEntry = {
      ...f,
      start_time: f.start_time.substring(0, 5),
      end_time: f.end_time ? f.end_time.substring(0, 5) : null,
      sauna_name: saunas.find(s => s.id === f.sauna_id)?.name,
      sauna_active: true,
      template_name: tmpl?.name ?? null,
      staff_name: users.find(u => u.id === f.assigned_user_id)?.name ?? null,
      scents: (selectedScents ?? []).filter((s: any) => s.scent_id).map((s: any) => {
        const sc = allScents.find(x => x.id === s.scent_id);
        return { scent_id: s.scent_id, scent_name: sc?.name, color: sc?.color, dosage_ml: s.dosage_ml ? parseFloat(s.dosage_ml) : null, dosage_note: s.dosage_note || null };
      }),
    };
    setEntries(list => formIndex === -1 ? [...list, entry] : list.map((x, i) => i === formIndex ? entry : x));
    setFormIndex(null);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-w-2xl">
        <h3 className="font-display text-xl font-bold">{template ? 'Tagesvorlage bearbeiten' : 'Neue Tagesvorlage'}</h3>
        <div className="grid grid-cols-1 gap-3">
          <div><label className="label">Name *</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Normaler Samstag" /></div>
          <div><label className="label">Beschreibung</label><textarea className="input min-h-16 resize-y" value={description} onChange={e => setDescription(e.target.value)} /></div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Aufgüsse ({entries.length})</label>
            <button type="button" onClick={() => setFormIndex(-1)} className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"><Plus className="w-3 h-3" /> Aufguss hinzufügen</button>
          </div>
          <div className="flex flex-col gap-2 bg-gray-100/70 dark:bg-stone-800/50 p-3 rounded-xl">
            {entries.length === 0 && <p className="text-gray-400 dark:text-stone-500 text-sm italic">Noch keine Aufgüsse.</p>}
            {sorted.map(({ e, i }) => (
              <div key={i} className="flex items-start gap-3 bg-white dark:bg-stone-900 rounded-xl p-2.5 border border-gray-200 dark:border-stone-700">
                <div className="font-mono tabular-nums text-sauna-600 dark:text-sauna-400 text-sm shrink-0 pt-0.5">
                  {e.start_time}{e.end_time ? <span className="text-gray-400 dark:text-stone-500"><br />{e.end_time}</span> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{e.custom_name || e.template_name || 'Aufguss'}</p>
                  <p className={`text-xs truncate ${e.sauna_active === false ? 'text-red-500' : 'text-gray-500 dark:text-stone-400'}`}>
                    {e.sauna_name}{e.sauna_active === false ? ' (inaktiv)' : ''}{e.staff_name ? ` · ${e.staff_name}` : ' · ohne Mitarbeiter'}
                  </p>
                  {e.scents.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {e.scents.map((s, j) => <ScentBadge key={j} name={s.scent_name ?? ''} color={s.color} dosage={s.dosage_ml ?? undefined} note={s.dosage_note ?? undefined} />)}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setFormIndex(i)} className="p-2 -m-1 text-gray-400 hover:text-sauna-600 dark:text-stone-500 dark:hover:text-sauna-400" title="Bearbeiten"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => setEntries(list => list.filter((_, idx) => idx !== i))} className="p-2 -m-1 text-gray-400 hover:text-red-500 dark:text-stone-500 dark:hover:text-red-400" title="Entfernen"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 justify-end [&>button]:flex-1 sm:[&>button]:flex-none">
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button
            disabled={saving}
            onClick={() => {
              if (!name.trim()) { alert('Bitte einen Namen eingeben.'); return; }
              onSubmit({ name, description, entries: entries.map(toPayload) });
            }}
            className="btn-primary disabled:opacity-50"
          >
            Speichern
          </button>
        </div>
      </div>

      {formIndex !== null && (
        <ScheduleForm
          entry={formIndex === -1 ? null : entries[formIndex]}
          title={formIndex === -1 ? 'Aufguss zur Vorlage hinzufügen' : 'Aufguss in Vorlage bearbeiten'}
          templates={templates}
          users={users}
          saunas={saunas}
          onSubmit={handleEntrySubmit}
          onClose={() => setFormIndex(null)}
        />
      )}
    </div>
  );
}
