import { z } from 'zod';
import { query, queryOne } from '../db/client';
import { requireAdmin, AuthRequest } from '../middleware/auth';
import { createRouter } from '../lib/errors';
import { parse } from '../lib/validation';
import { writeAudit } from '../lib/audit';

/** Protokoll ansehen und exportieren – nur Admins */
const router = createRouter();

const blank = (v: unknown) => (v === '' || v == null ? undefined : v);
const filterSchema = z.object({
  user_id: z.preprocess(blank, z.string().uuid().optional()),
  action: z.preprocess(blank, z.string().max(30).optional()),
  entity: z.preprocess(blank, z.string().max(50).optional()),
  from: z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  to: z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  q: z.preprocess(blank, z.string().max(200).optional()),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

function buildWhere(f: z.infer<typeof filterSchema>) {
  const where: string[] = [];
  const params: any[] = [];
  const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
  if (f.user_id) add('user_id = ?', f.user_id);
  if (f.action) add('action = ?', f.action);
  if (f.entity) add('entity = ?', f.entity);
  // Datum in der Server-Zeitzone (TZ), einschließlich des Bis-Tages
  if (f.from) add('created_at >= ?::date', f.from);
  if (f.to) add(`created_at < ?::date + interval '1 day'`, f.to);
  if (f.q) add(`(summary ILIKE ? OR user_name ILIKE $${params.length + 1} OR details::text ILIKE $${params.length + 1})`, `%${f.q.replace(/[\\%_]/g, '\\$&')}%`);
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

router.get('/', requireAdmin, async (req, res) => {
  const f = parse(filterSchema, req.query);
  const { sql, params } = buildWhere(f);
  const total = await queryOne<{ n: number }>(`SELECT COUNT(*)::int AS n FROM audit_log ${sql}`, params);
  const items = await query(
    `SELECT id, created_at, user_id, user_name, action, entity, entity_id, summary, details, ip
     FROM audit_log ${sql} ORDER BY created_at DESC, id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, f.limit, f.offset]
  );
  res.json({ items, total: total?.n ?? 0 });
});

/** Auswahllisten für die Filter (auch Namen inzwischen deaktivierter Mitarbeiter) */
router.get('/filters', requireAdmin, async (_req, res) => {
  const users = await query(
    `SELECT DISTINCT ON (user_id) user_id, user_name FROM audit_log
     WHERE user_id IS NOT NULL ORDER BY user_id, created_at DESC`
  );
  const entities = await query<{ entity: string }>(`SELECT DISTINCT entity FROM audit_log WHERE entity IS NOT NULL ORDER BY entity`);
  res.json({
    users: users.sort((a: any, b: any) => String(a.user_name).localeCompare(String(b.user_name), 'de')),
    entities: entities.map(e => e.entity),
  });
});

const csvCell = (v: unknown) => {
  let s = v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v);
  // Schutz vor Formel-Injection in Excel
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

/** CSV-Export (Excel-kompatibel: Semikolon, UTF-8 mit BOM) */
router.get('/export', requireAdmin, async (req: AuthRequest, res) => {
  const f = parse(filterSchema, { ...req.query, limit: 1, offset: 0 });
  const { sql, params } = buildWhere(f);
  const rows = await query(
    `SELECT TO_CHAR(created_at, 'DD.MM.YYYY HH24:MI:SS') AS zeit, user_name, action, entity, summary, details, ip
     FROM audit_log ${sql} ORDER BY created_at DESC, id DESC LIMIT 100000`,
    params
  );
  const header = ['Zeitpunkt', 'Mitarbeiter', 'Aktion', 'Bereich', 'Beschreibung', 'Details', 'IP'];
  const lines = [header.map(csvCell).join(';')];
  for (const r of rows) lines.push([r.zeit, r.user_name, r.action, r.entity, r.summary, r.details, r.ip].map(csvCell).join(';'));

  await writeAudit({
    userId: req.user!.id, userName: req.user!.name, action: 'download', entity: 'Protokoll',
    summary: `Protokoll exportiert (${rows.length} Einträge)`, details: { filter: { ...f, limit: undefined, offset: undefined } }, ip: req.ip,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="protokoll-${stamp}.csv"`);
  res.send('﻿' + lines.join('\r\n'));
});

export default router;
