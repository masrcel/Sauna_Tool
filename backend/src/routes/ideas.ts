import { z } from 'zod';
import { query, queryOne } from '../db/client';
import { requireAuth, isAdmin, AuthRequest } from '../middleware/auth';
import { createRouter } from '../lib/errors';
import { parse, validateParams, text, list } from '../lib/validation';

const router = createRouter();
validateParams(router);

const CATEGORIES = ['duft', 'zeremonie', 'musik', 'sonstiges'] as const;

const ideaSchema = z.object({
  title: text(200),
  category: z.preprocess(v => (v === '' || v == null ? undefined : v), z.enum(CATEGORIES).default('duft')),
  content: text(10_000),
  tags: list(text(50), 30),
});

const commentSchema = z.object({ content: text(5_000) });

const listQuerySchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  search: z.string().max(200).optional(),
});

/** Bearbeiten/Löschen nur durch den Ersteller oder einen Admin. Antwortet selbst, wenn nicht erlaubt. */
async function canModifyIdea(req: AuthRequest, res: any): Promise<boolean> {
  const idea = await queryOne<{ created_by: string | null }>('SELECT created_by FROM ideas WHERE id=$1', [req.params.id]);
  if (!idea) { res.status(404).json({ error: 'Idee nicht gefunden' }); return false; }
  if (!isAdmin(req) && idea.created_by !== req.user!.id) {
    res.status(403).json({ error: 'Nur der Ersteller oder ein Admin darf diese Idee ändern' });
    return false;
  }
  return true;
}

router.get('/', requireAuth, async (req, res) => {
  const { category, search } = parse(listQuerySchema, req.query);
  let sql = `
    SELECT i.*, u.name as creator_name, u.avatar_url as creator_avatar,
      COALESCE(json_agg(json_build_object('id', ic.id, 'content', ic.content, 'created_at', ic.created_at, 'user_id', ic.user_id,
        'user_name', cu.name, 'user_avatar', cu.avatar_url)) FILTER (WHERE ic.id IS NOT NULL), '[]') as comments,
      (SELECT COUNT(*) FROM idea_comments WHERE idea_id = i.id)::int as comment_count
    FROM ideas i
    LEFT JOIN users u ON i.created_by = u.id
    LEFT JOIN idea_comments ic ON ic.idea_id = i.id
    LEFT JOIN users cu ON ic.user_id = cu.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (category) { params.push(category); sql += ` AND i.category=$${params.length}`; }
  if (search) { params.push(`%${search}%`); sql += ` AND (i.title ILIKE $${params.length} OR i.content ILIKE $${params.length} OR EXISTS (SELECT 1 FROM unnest(i.tags) tag WHERE tag ILIKE $${params.length}))`; }
  sql += ' GROUP BY i.id, u.name, u.avatar_url ORDER BY i.created_at DESC';
  const ideas = await query(sql, params);
  res.json(ideas);
});

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const { title, category, content, tags } = parse(ideaSchema, req.body);
  const idea = await queryOne(
    'INSERT INTO ideas (title, category, content, tags, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [title, category, content, tags, req.user!.id]
  );
  res.status(201).json(idea);
});

router.put('/:id', requireAuth, async (req: AuthRequest, res) => {
  const { title, category, content, tags } = parse(ideaSchema, req.body);
  if (!(await canModifyIdea(req, res))) return;
  const idea = await queryOne(
    'UPDATE ideas SET title=$1, category=$2, content=$3, tags=$4, updated_at=NOW() WHERE id=$5 RETURNING *',
    [title, category, content, tags, req.params.id]
  );
  res.json(idea);
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  if (!(await canModifyIdea(req, res))) return;
  await query('DELETE FROM ideas WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

router.post('/:id/comments', requireAuth, async (req: AuthRequest, res) => {
  const { content } = parse(commentSchema, req.body);
  const comment = await queryOne(
    'INSERT INTO idea_comments (idea_id, user_id, content) VALUES ($1,$2,$3) RETURNING *',
    [req.params.id, req.user!.id, content]
  );
  res.status(201).json(comment);
});

router.delete('/:id/comments/:commentId', requireAuth, async (req: AuthRequest, res) => {
  // Eigene Kommentare löschen; Admins dürfen alle löschen
  if (isAdmin(req)) {
    await query('DELETE FROM idea_comments WHERE id=$1 AND idea_id=$2', [req.params.commentId, req.params.id]);
  } else {
    await query('DELETE FROM idea_comments WHERE id=$1 AND idea_id=$2 AND user_id=$3', [req.params.commentId, req.params.id, req.user!.id]);
  }
  res.json({ ok: true });
});

export default router;
