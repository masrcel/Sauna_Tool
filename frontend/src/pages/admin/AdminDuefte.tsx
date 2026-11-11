import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Scent } from '../../types';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const CATEGORIES = ['fruchtig', 'holzig', 'blumig', 'medizinisch', 'würzig', 'frisch', 'orientalisch', 'sonstiges'];
const UNITS = ['ml', 'g', 'Tropfen'];

export default function AdminDuefte() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editScent, setEditScent] = useState<Scent | null>(null);
  const [filterCat, setFilterCat] = useState('');

  const { data: scents = [] } = useQuery<Scent[]>({ queryKey: ['scents'], queryFn: async () => (await api.get('/scents')).data });
  const addMutation = useMutation({ mutationFn: (d: any) => api.post('/scents', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['scents'] }); setShowForm(false); } });
  const updateMutation = useMutation({ mutationFn: ({ id, ...d }: any) => api.put(`/scents/${id}`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['scents'] }); setEditScent(null); } });
  const deleteMutation = useMutation({ mutationFn: (id: string) => api.delete(`/scents/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['scents'] }) });

  const filtered = filterCat ? scents.filter(s => s.category === filterCat) : scents;
  const grouped = filtered.reduce<Record<string, Scent[]>>((acc, s) => {
    const k = s.category ?? 'sonstiges';
    acc[k] = [...(acc[k] ?? []), s];
    return acc;
  }, {});

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Duft-Datenbank</h2>
          <p className="text-gray-400 dark:text-stone-500 text-sm mt-0.5">Standardmengen werden beim Hinzufügen zu Vorlagen automatisch vorausgefüllt</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Duft anlegen</button>
      </div>

      {/* Kategorie-Filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterCat('')} className={`badge px-3 py-1.5 text-sm ${!filterCat ? 'bg-sauna-700 text-white' : 'bg-gray-100 text-gray-600 dark:bg-stone-800 dark:text-stone-300'}`}>
          Alle ({scents.length})
        </button>
        {CATEGORIES.map(c => {
          const count = scents.filter(s => s.category === c).length;
          if (!count) return null;
          return (
            <button key={c} onClick={() => setFilterCat(filterCat === c ? '' : c)}
              className={`badge px-3 py-1.5 text-sm capitalize ${filterCat === c ? 'bg-sauna-700 text-white' : 'bg-gray-100 text-gray-600 dark:bg-stone-800 dark:text-stone-300'}`}>
              {c} ({count})
            </button>
          );
        })}
      </div>

      {/* Liste */}
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <h3 className="text-steam-400 text-xs uppercase tracking-widest mb-3 capitalize">{cat}</h3>
          <div className="flex flex-col gap-2">
            {items.map(s => (
              <div key={s.id} className="card p-4 flex items-center gap-4">
                <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: s.color ?? '#d97d1d' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 dark:text-stone-100 font-medium">{s.name}</p>
                  {s.description && <p className="text-gray-400 dark:text-stone-500 text-sm truncate">{s.description}</p>}
                </div>
                {/* Dosierung */}
                <div className="shrink-0 text-right">
                  {s.default_dosage_ml ? (
                    <p className="text-sauna-400 font-mono font-semibold text-sm">
                      {Math.round(s.default_dosage_ml)} {s.dosage_unit}
                    </p>
                  ) : (
                    <p className="text-gray-400 dark:text-stone-600 text-xs">keine Standardmenge</p>
                  )}
                  {s.dosage_note && (
                    <div className="flex gap-1 flex-wrap justify-end mt-1">
                      {s.dosage_note.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                        <span key={tag} className="badge bg-gray-200 text-gray-600 dark:bg-stone-700 dark:text-stone-300 text-xs px-2 py-0.5">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setEditScent(s)} className="btn-secondary p-2"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => { if (confirm('Duft löschen?')) deleteMutation.mutate(s.id); }} className="btn-danger p-2"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && <p className="text-gray-400 dark:text-stone-500 text-center py-12">Noch keine Düfte angelegt.</p>}

      {(showForm || editScent) && (
        <ScentForm
          scent={editScent}
          onSubmit={d => editScent ? updateMutation.mutate({ ...d, id: editScent.id }) : addMutation.mutate(d)}
          onClose={() => { setShowForm(false); setEditScent(null); }}
        />
      )}
    </div>
  );
}

function ScentForm({ scent, onSubmit, onClose }: { scent: Scent | null; onSubmit: (d: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    name: scent?.name ?? '',
    description: scent?.description ?? '',
    category: scent?.category ?? 'frisch',
    color: scent?.color ?? '#d97d1d',
    default_dosage_ml: scent?.default_dosage_ml?.toString() ?? '',
    dosage_unit: scent?.dosage_unit ?? 'ml',
    dosage_note: scent?.dosage_note ?? '',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-lg flex flex-col gap-4">
        <h3 className="font-display text-xl font-bold">{scent ? 'Duft bearbeiten' : 'Neuer Duft'}</h3>

        <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="z.B. Eukalyptus" /></div>
        <div><label className="label">Beschreibung</label><textarea className="input" rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Kategorie</label>
            <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Farbe</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={form.color} onChange={e => set('color', e.target.value)} className="w-10 h-10 rounded-lg border border-gray-300 dark:border-stone-700 bg-transparent cursor-pointer" />
              <input className="input" value={form.color} onChange={e => set('color', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Dosierung */}
        <div className="bg-gray-100/70 dark:bg-stone-800/50 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-gray-700 dark:text-stone-300 text-sm font-medium">Standarddosierung</p>
          <p className="text-gray-400 dark:text-stone-500 text-xs -mt-1">Wird beim Hinzufügen zu Vorlagen automatisch eingetragen</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Menge</label>
              <input
                type="number"
                step="1"
                min="0"
                className="input"
                value={form.default_dosage_ml}
                onChange={e => set('default_dosage_ml', e.target.value)}
                placeholder="z.B. 10"
              />
            </div>
            <div>
              <label className="label">Einheit</label>
              <select className="input" value={form.dosage_unit} onChange={e => set('dosage_unit', e.target.value)}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Anmerkungen <span className="text-gray-400 dark:text-stone-500 font-normal">(kommagetrennt)</span></label>
            <input
              className="input"
              value={form.dosage_note}
              onChange={e => set('dosage_note', e.target.value)}
              placeholder="z.B. stark, nur auf Eis, verdünnen"
            />
            {form.dosage_note && (
              <div className="flex gap-1.5 flex-wrap mt-2">
                {form.dosage_note.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                  <span key={tag} className="badge border border-gray-300 text-gray-500 dark:border-stone-600 dark:text-stone-400 text-xs px-2 py-0.5">{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button onClick={() => onSubmit({ ...form, default_dosage_ml: form.default_dosage_ml ? Math.round(parseFloat(form.default_dosage_ml)) : null })} className="btn-primary">Speichern</button>
        </div>
      </div>
    </div>
  );
}
