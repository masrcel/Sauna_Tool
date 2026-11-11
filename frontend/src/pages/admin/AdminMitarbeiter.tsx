import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { User } from '../../types';
import Avatar from '../../components/Avatar';
import { Plus, Upload, Pencil, UserX } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function AdminMitarbeiter() {
  const qc = useQueryClient();
  const { user: me, isAdmin, refresh } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/users')).data,
  });

  const addMutation = useMutation({ mutationFn: (d: any) => api.post('/users', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowForm(false); } });
  const updateMutation = useMutation({ mutationFn: ({ id, ...d }: any) => api.put(`/users/${id}`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setEditUser(null); } });
  const deactivateMutation = useMutation({ mutationFn: (id: string) => api.delete(`/users/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-6">
      <div className="page-header">
        <h2 className="font-display text-2xl font-bold">Mitarbeiter</h2>
        {isAdmin && <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Mitarbeiter anlegen</button>}
      </div>

      <div className="grid grid-cols-1 gap-3">
        {users.map(u => (
          <div key={u.id} className="card p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
            {isAdmin || u.id === me?.id
              ? <AvatarUpload user={u} onUploaded={() => { qc.invalidateQueries({ queryKey: ['users'] }); if (u.id === me?.id) refresh().catch(() => {}); }} />
              : <Avatar name={u.name} url={u.avatar_url} size="lg" />}
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 dark:text-stone-100 font-semibold truncate">{u.name}</p>
              <p className="text-gray-400 dark:text-stone-500 text-sm truncate">{u.email}</p>
              <span className={`badge text-xs mt-1 ${u.role === 'admin' ? 'bg-sauna-100 text-sauna-700 dark:bg-sauna-900 dark:text-sauna-300' : 'bg-gray-100 text-gray-500 dark:bg-stone-800 dark:text-stone-400'}`}>
                {u.role === 'admin' ? 'Admin' : 'Personal'}
              </span>
            </div>
            {!u.active && <span className="badge bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-xs">Inaktiv</span>}
            {isAdmin && (
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <button onClick={() => setEditUser(u)} className="btn-secondary p-2"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => { if (confirm(`${u.name} deaktivieren?`)) deactivateMutation.mutate(u.id); }} className="btn-danger p-2"><UserX className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        ))}
      </div>

      {isAdmin && (showForm || editUser) && (
        <UserForm
          user={editUser}
          onSubmit={d => editUser ? updateMutation.mutate({ ...d, id: editUser.id }) : addMutation.mutate(d)}
          onClose={() => { setShowForm(false); setEditUser(null); }}
        />
      )}
    </div>
  );
}

function AvatarUpload({ user, onUploaded }: { user: User; onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      alert('Nur Bilder im Format JPG oder PNG sind erlaubt.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Das Bild darf maximal 5 MB groß sein.');
      return;
    }
    const fd = new FormData();
    fd.append('avatar', file);
    try {
      await api.post(`/users/${user.id}/avatar`, fd);
      onUploaded();
    } catch (err: any) {
      alert(`Fehler beim Hochladen: ${err.response?.data?.error ?? err.message}`);
    }
  }
  return (
    <div className="relative group cursor-pointer" onClick={() => inputRef.current?.click()}>
      <Avatar name={user.name} url={user.avatar_url} size="lg" />
      <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Upload className="w-4 h-4 text-white" />
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" className="hidden" onChange={handleFile} />
    </div>
  );
}

function UserForm({ user, onSubmit, onClose }: { user: User | null; onSubmit: (d: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({ name: user?.name ?? '', email: user?.email ?? '', password: '', role: user?.role ?? 'staff', active: user?.active ?? true });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-w-md">
        <h3 className="font-display text-xl font-bold">{user ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}</h3>
        <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => set('name', e.target.value)} /></div>
        <div><label className="label">E-Mail *</label><input type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} /></div>
        <div><label className="label">{user ? 'Neues Passwort (leer = unverändert)' : 'Passwort *'}</label><input type="password" className="input" value={form.password} onChange={e => set('password', e.target.value)} /></div>
        <div><label className="label">Rolle</label>
          <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
            <option value="staff">Personal</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="flex gap-3 justify-end [&>button]:flex-1 sm:[&>button]:flex-none">
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button onClick={() => onSubmit(form)} className="btn-primary">Speichern</button>
        </div>
      </div>
    </div>
  );
}
