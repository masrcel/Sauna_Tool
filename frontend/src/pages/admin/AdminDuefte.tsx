import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Scent } from '../../types';
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react';

const CATEGORIES = ['fruchtig', 'holzig', 'blumig', 'medizinisch', 'würzig', 'frisch', 'orientalisch', 'sonstiges'];
const UNITS = ['ml', 'g', 'Tropfen'];

export default function AdminDuefte() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editScent, setEditScent] = useState<Scent | null>(null);
  const [filterCat, setFilterCat] = useState('');
  const [search, setSearch] = useState('');

  const { data: scents = [] } = useQuery<Scent[]>({ queryKey: ['scents'], queryFn: async () => (await api.get('/scents')).data });
  const addMutation = useMutation({ mutationFn: (d: any) => api.post('/scents', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['scents'] }); setShowForm(false); } });
  const updateMutation = useMutation({ mutationFn: ({ id, ...d }: any) => api.put(`/scents/${id}`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['scents'] }); setEditScent(null); } });
  const deleteMutation = useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => api.delete(`/scents/${id}`, { params: force ? { force: true } : undefined }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scents'] }),
    onError: (err: any, vars) => {
      const status = err.response?.status;
      if (status === 409) {
        const u = err.response.data?.usage ?? {};
        const parts = [
          u.templates ? `${u.templates} Vorlage(n)` : null,
          u.schedules ? `${u.schedules} geplanten Aufguss/Aufgüssen` : null,
          u.ideas ? `${u.ideas} Idee(n)` : null,
        ].filter(Boolean).join(', ');
        if (confirm(`Dieser Duft wird noch in ${parts} verwendet.\n\nTrotzdem löschen? Der Duft wird dort ebenfalls entfernt.`)) {
          deleteMutation.mutate({ id: vars.id, force: true });
        }
      } else if (status === 403) {
        alert('Nur Admins dürfen Düfte löschen.');
      } else {
        alert(`Löschen fehlgeschlagen: ${err.response?.data?.error ?? err.message}`);
      }
    },
  });

  const searchTerm = search.trim().toLowerCase();
  const filtered = scents.filter(s =>
    (!filterCat || s.category === filterCat) &&
    (!searchTerm ||
      s.name.toLowerCase().includes(searchTerm) ||
      (s.description ?? '').toLowerCase().includes(searchTerm) ||
      (s.dosage_note ?? '').toLowerCase().includes(searchTerm))
  );
  const grouped = filtered.reduce<Record<string, Scent[]>>((acc, s) => {
    const k = s.category ?? 'sonstiges';
    acc[k] = [...(acc[k] ?? []), s];
    return acc;
  }, {});

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-6">
      <div className="page-header">
        <div>
          <h2 className="font-display text-2xl font-bold">Duft-Datenbank</h2>
          <p className="text-gray-400 dark:text-stone-500 text-sm mt-0.5">Standardmengen werden beim Hinzufügen zu Vorlagen automatisch vorausgefüllt</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Duft anlegen</button>
      </div>

      {/* Suche */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-stone-500 pointer-events-none" />
        <input
          className="input pl-9 pr-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Düfte durchsuchen (Name, Beschreibung, Anmerkungen) …"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-stone-500 dark:hover:text-stone-300" aria-label="Suche leeren">
            <X className="w-4 h-4" />
          </button>
        )}
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
              <div key={s.id} className="card p-3 sm:p-4 flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4">
                <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: s.color ?? '#d97d1d' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 dark:text-stone-100 font-medium">{s.name}</p>
                  {s.description && <p className="text-gray-400 dark:text-stone-500 text-sm truncate">{s.description}</p>}
                </div>
                {/* Dosierung */}
                <div className="order-last sm:order-none w-full sm:w-auto shrink-0 sm:text-right pl-7 sm:pl-0">
                  {s.default_dosage_ml ? (
                    <p className="text-sauna-400 font-mono font-semibold text-sm">
                      {Math.round(s.default_dosage_ml)} {s.dosage_unit}
                    </p>
                  ) : (
                    <p className="text-gray-400 dark:text-stone-600 text-xs">keine Standardmenge</p>
                  )}
                  {s.dosage_note && (
                    <div className="flex gap-1 flex-wrap sm:justify-end mt-1">
                      {s.dosage_note.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                        <span key={tag} className="badge bg-gray-200 text-gray-600 dark:bg-stone-700 dark:text-stone-300 text-xs px-2 py-0.5">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setEditScent(s)} className="btn-secondary p-2"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => { if (confirm(`Duft „${s.name}" löschen?`)) deleteMutation.mutate({ id: s.id }); }} className="btn-danger p-2"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <p className="text-gray-400 dark:text-stone-500 text-center py-12">
          {scents.length === 0 ? 'Noch keine Düfte angelegt.' : 'Keine Düfte gefunden.'}
        </p>
      )}

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
    <div className="modal-backdrop">
      <div className="modal-panel max-w-lg">
        <h3 className="font-display text-xl font-bold">{scent ? 'Duft bearbeiten' : 'Neuer Duft'}</h3>

        <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="z.B. Eukalyptus" /></div>
        <div><label className="label">Beschreibung</label><textarea className="input" rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        <div className="flex gap-3 justify-end [&>button]:flex-1 sm:[&>button]:flex-none">
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button onClick={() => onSubmit({ ...form, default_dosage_ml: form.default_dosage_ml ? Math.round(parseFloat(form.default_dosage_ml)) : null })} className="btn-primary">Speichern</button>
        </div>
      </div>
    </div>
  );
}
