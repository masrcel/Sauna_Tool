import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { AufgussTemplate, Scent } from '../../types';
import ScentBadge from '../../components/ScentBadge';
import { Plus, Pencil, Trash2, Clock } from 'lucide-react';

export default function AdminVorlagen() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editTemplate, setEditTemplate] = useState<AufgussTemplate | null>(null);

  const { data: templates = [] } = useQuery<AufgussTemplate[]>({ queryKey: ['templates'], queryFn: async () => (await api.get('/templates')).data });
  const { data: scents = [] } = useQuery<Scent[]>({ queryKey: ['scents'], queryFn: async () => (await api.get('/scents')).data });

  const addMutation = useMutation({ mutationFn: (d: any) => api.post('/templates', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); setShowForm(false); }, onError: (err: any) => alert(`Fehler: ${err.response?.data?.error ?? err.message}`) });
  const updateMutation = useMutation({ mutationFn: ({ id, ...d }: any) => api.put(`/templates/${id}`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); setEditTemplate(null); }, onError: (err: any) => alert(`Fehler: ${err.response?.data?.error ?? err.message}`) });
  const deleteMutation = useMutation({ mutationFn: (id: string) => api.delete(`/templates/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }), onError: (err: any) => alert(`Fehler: ${err.response?.data?.error ?? err.message}`) });

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-6">
      <div className="page-header">
        <h2 className="font-display text-2xl font-bold">Aufguss-Vorlagen</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Vorlage erstellen</button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {templates.map(t => (
          <div key={t.id} className="card p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-lg font-semibold text-gray-900 dark:text-stone-100">{t.name}</h3>
                {t.subtitle && <p className="text-gray-500 dark:text-stone-400 text-sm">{t.subtitle}</p>}
              </div>
              <div className="flex flex-wrap justify-end items-center gap-2 shrink-0">
                <span className="flex items-center gap-1 text-gray-400 dark:text-stone-500 text-sm"><Clock className="w-3.5 h-3.5" />{t.duration_minutes} Min.</span>
                <button onClick={() => setEditTemplate(t)} className="btn-secondary p-2"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => { if (confirm('Vorlage löschen?')) deleteMutation.mutate(t.id); }} className="btn-danger p-2"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            {t.description && <p className="text-gray-500 dark:text-stone-400 text-sm">{t.description}</p>}
            {t.scents.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {t.scents.map(s => (
                  <ScentBadge key={s.id} name={s.scent_name} color={s.color} dosage={s.dosage_ml} note={s.dosage_note} />
                ))}
              </div>
            )}
            {t.creator_name && <p className="text-gray-400 dark:text-stone-600 text-xs">Erstellt von {t.creator_name}</p>}
          </div>
        ))}
        {templates.length === 0 && <p className="text-gray-400 dark:text-stone-500 text-center py-12">Noch keine Vorlagen erstellt.</p>}
      </div>

      {(showForm || editTemplate) && (
        <TemplateForm
          template={editTemplate}
          scents={scents}
          onSubmit={d => editTemplate ? updateMutation.mutate({ ...d, id: editTemplate.id }) : addMutation.mutate(d)}
          onClose={() => { setShowForm(false); setEditTemplate(null); }}
        />
      )}
    </div>
  );
}

function TemplateForm({ template, scents, onSubmit, onClose }: {
  template: AufgussTemplate | null;
  scents: Scent[];
  onSubmit: (d: any) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: template?.name ?? '',
    subtitle: template?.subtitle ?? '',
    description: template?.description ?? '',
    duration_minutes: template?.duration_minutes ?? 15,
  });
  const [selectedScents, setSelectedScents] = useState<{ scent_id: string; dosage_ml: string; dosage_note: string }[]>(
    template?.scents.map(s => ({ scent_id: s.scent_id, dosage_ml: s.dosage_ml?.toString() ?? '', dosage_note: s.dosage_note ?? '' })) ?? []
  );

  function addScent() {
    const sc = scents[0];
    setSelectedScents(s => [...s, { scent_id: sc?.id ?? '', dosage_ml: sc?.default_dosage_ml?.toString() ?? '', dosage_note: sc?.dosage_note ?? '' }]);
  }
  function removeScent(i: number) { setSelectedScents(s => s.filter((_, idx) => idx !== i)); }
  function updateScent(i: number, k: string, v: string) {
    if (k === 'scent_id') {
      const sc = scents.find(x => x.id === v);
      setSelectedScents(s => s.map((item, idx) => idx === i ? { scent_id: v, dosage_ml: sc?.default_dosage_ml?.toString() ?? '', dosage_note: sc?.dosage_note ?? '' } : item));
    } else {
      setSelectedScents(s => s.map((item, idx) => idx === i ? { ...item, [k]: v } : item));
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-w-xl">
        <h3 className="font-display text-xl font-bold">{template ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Waldspaziergang" /></div>
          <div className="sm:col-span-2"><label className="label">Untertitel</label><input className="input" value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} /></div>
          <div className="sm:col-span-2"><label className="label">Beschreibung / Zeremonie-Ablauf</label><textarea className="input min-h-24 resize-y" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div><label className="label">Dauer (Minuten)</label><input type="number" className="input" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) }))} /></div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Düfte</label>
            <button type="button" onClick={addScent} className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"><Plus className="w-3 h-3" /> Duft hinzufügen</button>
          </div>
          <div className="flex flex-col gap-2">
            {selectedScents.map((s, i) => {
              const sc = scents.find(x => x.id === s.scent_id);
              return (
                <div key={i} className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
                  <select className="input w-full sm:w-auto sm:flex-1" value={s.scent_id} onChange={e => updateScent(i, 'scent_id', e.target.value)}>
                    {scents.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                  </select>
                  <div className="flex items-center gap-1 shrink-0">
                    <input className="input w-20" type="number" step="0.5" min="0" placeholder="Menge" value={s.dosage_ml} onChange={e => updateScent(i, 'dosage_ml', e.target.value)} />
                    <span className="text-gray-500 dark:text-stone-400 text-xs w-8">{sc?.dosage_unit ?? 'ml'}</span>
                  </div>
                  <input className="input flex-1 min-w-0 sm:flex-none sm:w-28" placeholder="Hinweis" value={s.dosage_note} onChange={e => updateScent(i, 'dosage_note', e.target.value)} />
                  <button onClick={() => removeScent(i)} className="p-2 -m-1 text-gray-400 hover:text-red-500 dark:text-stone-500 dark:hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3 justify-end [&>button]:flex-1 sm:[&>button]:flex-none">
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button onClick={() => {
            if (!form.name.trim()) { alert('Bitte einen Namen eingeben.'); return; }
            onSubmit({
              ...form,
              scents: selectedScents
                .filter(s => s.scent_id)
                .map(s => ({ ...s, dosage_ml: s.dosage_ml ? parseFloat(s.dosage_ml) : null }))
            });
          }} className="btn-primary">Speichern</button>
        </div>
      </div>
    </div>
  );
}
