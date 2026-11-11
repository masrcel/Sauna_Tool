import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { api } from '../../lib/api';
import { Idea } from '../../types';
import Avatar from '../../components/Avatar';
import { categoryLabel, categoryColor } from '../../lib/utils';
import { cn } from '../../lib/utils';
import { Plus, MessageCircle, Trash2, Pencil, Search } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const CATEGORIES = ['duft', 'zeremonie', 'musik', 'sonstiges'] as const;

export default function AdminIdeen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editIdea, setEditIdea] = useState<Idea | null>(null);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const getComment = (id: string) => commentTexts[id] ?? '';
  const setComment = (id: string, v: string) => setCommentTexts(t => ({ ...t, [id]: v }));

  const { data: ideas = [] } = useQuery<Idea[]>({
    queryKey: ['ideas', category, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (search) params.set('search', search);
      return (await api.get(`/ideas?${params}`)).data;
    },
  });

  const addMutation = useMutation({ mutationFn: (d: any) => api.post('/ideas', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['ideas'] }); setShowForm(false); } });
  const updateMutation = useMutation({ mutationFn: ({ id, ...d }: any) => api.put(`/ideas/${id}`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['ideas'] }); setEditIdea(null); } });
  const deleteMutation = useMutation({ mutationFn: (id: string) => api.delete(`/ideas/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['ideas'] }) });
  const commentMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => api.post(`/ideas/${id}/comments`, { content }),
    onSuccess: (_data, vars) => { qc.invalidateQueries({ queryKey: ['ideas'] }); setComment(vars.id, ''); },
  });

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-6">
      <div className="page-header">
        <h2 className="font-display text-2xl font-bold">Ideen-Datenbank</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Neue Idee</button>
      </div>

      {/* Filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 dark:text-stone-500" />
          <input className="input pl-9" placeholder="Suchen…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setCategory('')} className={cn('badge px-3 py-1.5 text-sm', !category ? 'bg-sauna-700 text-white' : 'bg-gray-100 text-gray-600 dark:bg-stone-800 dark:text-stone-300')}>Alle</button>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(category === c ? '' : c)} className={cn('badge px-3 py-1.5 text-sm', category === c ? 'bg-sauna-700 text-white' : 'bg-gray-100 text-gray-600 dark:bg-stone-800 dark:text-stone-300')}>
              {categoryLabel(c)}
            </button>
          ))}
        </div>
      </div>

      {/* Ideen-Grid */}
      <div className="grid grid-cols-1 gap-4">
        {ideas.length === 0 && <p className="text-gray-400 dark:text-stone-500 text-center py-12">Keine Ideen gefunden.</p>}
        {ideas.map(idea => (
          <div key={idea.id} className="card p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={cn('badge text-xs', categoryColor(idea.category))}>{categoryLabel(idea.category)}</span>
                  {idea.tags?.map(tag => (
                    <span key={tag} className="badge bg-gray-100 text-gray-500 dark:bg-stone-800 dark:text-stone-400 text-xs">#{tag}</span>
                  ))}
                </div>
                <h3 className="font-display text-lg font-semibold text-gray-900 dark:text-stone-100">{idea.title}</h3>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setEditIdea(idea)} className="p-1 text-gray-400 hover:text-gray-700 dark:text-stone-500 dark:hover:text-stone-200"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => { if (confirm('Idee löschen?')) deleteMutation.mutate(idea.id); }} className="p-1 text-gray-400 hover:text-red-500 dark:text-stone-500 dark:hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>

            <p className="text-gray-700 dark:text-stone-300 text-sm whitespace-pre-wrap leading-relaxed">{idea.content}</p>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <Avatar name={idea.creator_name ?? '?'} url={idea.creator_avatar} size="sm" />
                <div>
                  <p className="text-gray-700 dark:text-stone-300 text-xs font-medium">{idea.creator_name}</p>
                  <p className="text-gray-400 dark:text-stone-600 text-xs">{format(new Date(idea.created_at), 'dd.MM.yyyy', { locale: de })}</p>
                </div>
              </div>
              <button
                onClick={() => setOpenComments(openComments === idea.id ? null : idea.id)}
                className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 dark:text-stone-500 dark:hover:text-stone-200 text-sm transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                {idea.comment_count > 0 ? idea.comment_count : 'Kommentieren'}
              </button>
            </div>

            {/* Kommentare */}
            {openComments === idea.id && (
              <div className="bg-gray-100/70 dark:bg-stone-800/50 rounded-xl p-4 flex flex-col gap-3">
                {idea.comments.map(c => (
                  <div key={c.id} className="flex gap-2">
                    <Avatar name={c.user_name ?? '?'} url={c.user_avatar} size="sm" />
                    <div className="flex-1">
                      <p className="text-gray-700 dark:text-stone-300 text-xs font-medium mb-0.5">{c.user_name}</p>
                      <p className="text-gray-500 dark:text-stone-400 text-sm">{c.content}</p>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 mt-1">
                  <input
                    className="input flex-1 text-sm py-1.5"
                    placeholder="Kommentar schreiben…"
                    value={getComment(idea.id)}
                    onChange={e => setComment(idea.id, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && getComment(idea.id).trim()) commentMutation.mutate({ id: idea.id, content: getComment(idea.id).trim() }); }}
                  />
                  <button
                    className="btn-primary text-sm py-1.5 px-3"
                    onClick={() => { if (getComment(idea.id).trim()) commentMutation.mutate({ id: idea.id, content: getComment(idea.id).trim() }); }}
                  >Senden</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {(showForm || editIdea) && (
        <IdeaForm
          idea={editIdea}
          onSubmit={d => editIdea ? updateMutation.mutate({ ...d, id: editIdea.id }) : addMutation.mutate(d)}
          onClose={() => { setShowForm(false); setEditIdea(null); }}
        />
      )}
    </div>
  );
}

function IdeaForm({ idea, onSubmit, onClose }: { idea: Idea | null; onSubmit: (d: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    title: idea?.title ?? '',
    category: idea?.category ?? 'duft',
    content: idea?.content ?? '',
    tags: idea?.tags?.join(', ') ?? '',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-w-lg">
        <h3 className="font-display text-xl font-bold">{idea ? 'Idee bearbeiten' : 'Neue Idee'}</h3>
        <div>
          <label className="label">Titel *</label>
          <input className="input" value={form.title} onChange={e => set('title', e.target.value)} />
        </div>
        <div>
          <label className="label">Kategorie</label>
          <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Inhalt *</label>
          <textarea className="input min-h-32 resize-y" value={form.content} onChange={e => set('content', e.target.value)} placeholder="Beschreibung, Rezept, Idee…" />
        </div>
        <div>
          <label className="label">Tags (kommagetrennt)</label>
          <input className="input" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="z.B. sommer, frisch, zitrus" />
        </div>
        <div className="flex gap-3 justify-end [&>button]:flex-1 sm:[&>button]:flex-none">
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button onClick={() => onSubmit({ ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) })} className="btn-primary">Speichern</button>
        </div>
      </div>
    </div>
  );
}
