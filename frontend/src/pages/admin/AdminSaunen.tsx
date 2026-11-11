import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Sauna } from '../../types';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';

export default function AdminSaunen() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editSauna, setEditSauna] = useState<Sauna | null>(null);

  const { data: saunas = [] } = useQuery<Sauna[]>({ queryKey: ['saunas'], queryFn: async () => (await api.get('/saunas')).data });
  const addMutation = useMutation({ mutationFn: (d: any) => api.post('/saunas', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['saunas'] }); setShowForm(false); } });
  const updateMutation = useMutation({ mutationFn: ({ id, ...d }: any) => api.put(`/saunas/${id}`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['saunas'] }); setEditSauna(null); } });
  const deleteMutation = useMutation({ mutationFn: (id: string) => api.delete(`/saunas/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['saunas'] }) });

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-6">
      <div className="page-header">
        <h2 className="font-display text-2xl font-bold">Saunen</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Sauna anlegen</button>
      </div>
      <div className="flex flex-col gap-3">
        {saunas.map(s => (
          <div key={s.id} className="card p-3 sm:p-4 flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4">
            <GripVertical className="hidden sm:block w-4 h-4 text-gray-400 dark:text-stone-600 cursor-grab" />
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 dark:text-stone-100 font-semibold">{s.name}</p>
              {s.description && <p className="text-gray-400 dark:text-stone-500 text-sm">{s.description}</p>}
            </div>
            <span className="order-last sm:order-none w-full sm:w-auto text-gray-400 dark:text-stone-500 text-sm shrink-0">
              {s.break_minutes > 0 ? `${s.break_minutes} Min. Pause` : 'keine Pause'}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setEditSauna(s)} className="btn-secondary p-2"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => { if (confirm('Sauna deaktivieren?')) deleteMutation.mutate(s.id); }} className="btn-danger p-2"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {saunas.length === 0 && <p className="text-gray-400 dark:text-stone-500 text-center py-12">Noch keine Saunen angelegt.</p>}
      </div>
      {(showForm || editSauna) && (
        <SaunaForm
          sauna={editSauna}
          onSubmit={d => editSauna ? updateMutation.mutate({ ...d, id: editSauna.id }) : addMutation.mutate(d)}
          onClose={() => { setShowForm(false); setEditSauna(null); }}
        />
      )}
    </div>
  );
}

function SaunaForm({ sauna, onSubmit, onClose }: { sauna: Sauna | null; onSubmit: (d: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    name: sauna?.name ?? '',
    description: sauna?.description ?? '',
    sort_order: sauna?.sort_order ?? 0,
    break_minutes: sauna?.break_minutes ?? 0,
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-w-md">
        <h3 className="font-display text-xl font-bold">{sauna ? 'Sauna bearbeiten' : 'Neue Sauna'}</h3>
        <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="z.B. Finnische Sauna" /></div>
        <div><label className="label">Beschreibung</label><input className="input" value={form.description} onChange={e => set('description', e.target.value)} /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Pause nach Aufguss <span className="text-gray-400 dark:text-stone-500 font-normal">(Minuten)</span></label>
            <input type="number" min="0" step="5" className="input" value={form.break_minutes} onChange={e => set('break_minutes', parseInt(e.target.value) || 0)} />
            <p className="text-gray-400 dark:text-stone-600 text-xs mt-1">Mindestabstand zwischen zwei Aufgüssen</p>
          </div>
          <div>
            <label className="label">Sortierung</label>
            <input type="number" className="input" value={form.sort_order} onChange={e => set('sort_order', parseInt(e.target.value))} />
          </div>
        </div>
        <div className="flex gap-3 justify-end [&>button]:flex-1 sm:[&>button]:flex-none">
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button onClick={() => onSubmit(form)} className="btn-primary">Speichern</button>
        </div>
      </div>
    </div>
  );
}
