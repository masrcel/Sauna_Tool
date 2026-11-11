import { PoolClient } from 'pg';
import { z } from 'zod';
import { pool, query, queryOne } from '../db/client';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { createRouter, HttpError } from '../lib/errors';
import { parse, validateParams, uuid, optUuid, text, optText, time, optTime, date, list, scentList } from '../lib/validation';
import { checkConflicts } from './events';

const router = createRouter();
validateParams(router);

const MAX_APPLY_DAYS = 92;

const entrySchema = z.object({
  sauna_id: uuid,
  template_id: optUuid,
  assigned_user_id: optUuid,
  custom_name: optText(200),
  custom_subtitle: optText(200),
  start_time: time,
  end_time: optTime,
  scents: scentList,
});
type EntryInput = z.infer<typeof entrySchema>;

const dayTemplateSchema = z.object({
  name: text(200),
  description: optText(),
  entries: list(entrySchema, 200),
});

const fromDateSchema = z.object({
  name: text(200),
  description: optText(),
});

const applySchema = z.object({
  dates: z.array(date).min(1, 'Keine Tage ausgewählt'),
  mode: z.preprocess(v => (v === '' || v == null ? undefined : v), z.enum(['append', 'replace']).default('append')),
});

const LIST_SQL = `
  SELECT d.*, u.name as creator_name,
    COALESCE((
      SELECT json_agg(x ORDER BY x.start_time, x.sort_order) FROM (
        SELECT e.id, e.sauna_id, e.template_id, e.assigned_user_id,
          e.custom_name, e.custom_subtitle, e.sort_order,
          TO_CHAR(e.start_time, 'HH24:MI') as start_time,
          TO_CHAR(e.end_time, 'HH24:MI') as end_time,
          sa.name as sauna_name, sa.active as sauna_active,
          t.name as template_name, t.subtitle as template_subtitle,
          us.name as staff_name, us.avatar_url as staff_avatar,
          COALESCE((
            SELECT json_agg(json_build_object(
              'scent_id', sc.id, 'scent_name', sc.name, 'dosage_ml', es.dosage_ml,
              'dosage_note', es.dosage_note, 'color', sc.color
            ) ORDER BY es.sort_order)
            FROM day_template_entry_scents es JOIN scents sc ON sc.id = es.scent_id
            WHERE es.entry_id = e.id
          ), '[]') as scents
        FROM day_template_entries e
        JOIN saunas sa ON sa.id = e.sauna_id
        LEFT JOIN aufguss_templates t ON t.id = e.template_id
        LEFT JOIN users us ON us.id = e.assigned_user_id
        WHERE e.day_template_id = d.id
      ) x
    ), '[]') as entries
  FROM day_templates d
  LEFT JOIN users u ON u.id = d.created_by
`;

async function insertEntries(client: PoolClient, dayTemplateId: string, entries: EntryInput[]) {
  const sorted = [...entries].sort((a, b) => a.start_time.localeCompare(b.start_time));
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    const { rows } = await client.query(
      `INSERT INTO day_template_entries
         (day_template_id, sauna_id, template_id, assigned_user_id, custom_name, custom_subtitle, start_time, end_time, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [dayTemplateId, e.sauna_id, e.template_id || null, e.assigned_user_id || null,
       e.custom_name ?? null, e.custom_subtitle ?? null, e.start_time, e.end_time ?? null, i]
    );
    const scents = (e.scents ?? []).filter(s => s.scent_id);
    for (let j = 0; j < scents.length; j++) {
      const s = scents[j];
      await client.query(
        'INSERT INTO day_template_entry_scents (entry_id, scent_id, dosage_ml, dosage_note, sort_order) VALUES ($1,$2,$3,$4,$5)',
        [rows[0].id, s.scent_id, s.dosage_ml ?? null, s.dosage_note ?? null, j]
      );
    }
  }
}

async function inTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Alle Tagesvorlagen inkl. Aufgüsse
router.get('/', requireAuth, async (_req, res, next) => {
  try {
    res.json(await query(`${LIST_SQL} ORDER BY d.name`));
  } catch (err) { next(err); }
});

// Neue Tagesvorlage anlegen
router.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { name, description, entries } = parse(dayTemplateSchema, req.body);
    const created = await inTransaction(async client => {
      const { rows } = await client.query(
        'INSERT INTO day_templates (name, description, created_by) VALUES ($1,$2,$3) RETURNING *',
        [name, description, req.user!.id]
      );
      await insertEntries(client, rows[0].id, entries);
      return rows[0];
    });
    res.status(201).json(created);
  } catch (err) { next(err); }
});

// Bestehenden Tag als Tagesvorlage speichern
router.post('/from-date/:date', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { date } = req.params;
    const { name, description } = parse(fromDateSchema, req.body);

    const schedule = await query(`
      SELECT s.id, s.sauna_id, s.template_id, s.assigned_user_id, s.custom_name, s.custom_subtitle,
        TO_CHAR(s.start_time, 'HH24:MI') as start_time, TO_CHAR(s.end_time, 'HH24:MI') as end_time,
        COALESCE(
          (SELECT json_agg(json_build_object('scent_id', ss.scent_id, 'dosage_ml', ss.dosage_ml, 'dosage_note', ss.dosage_note) ORDER BY ss.sort_order)
           FROM schedule_scents ss WHERE ss.schedule_id = s.id),
          '[]'
        ) as scents
      FROM aufguss_schedule s
      JOIN events e ON e.id = s.event_id
      WHERE e.event_date = $1 AND s.status != 'abgesagt'
      ORDER BY s.start_time, s.sort_order
    `, [date]);
    if (schedule.length === 0) { res.status(400).json({ error: 'An diesem Tag sind keine Aufgüsse geplant' }); return; }

    const created = await inTransaction(async client => {
      const { rows } = await client.query(
        'INSERT INTO day_templates (name, description, created_by) VALUES ($1,$2,$3) RETURNING *',
        [name, description, req.user!.id]
      );
      await insertEntries(client, rows[0].id, schedule as EntryInput[]);
      return rows[0];
    });
    res.status(201).json(created);
  } catch (err) { next(err); }
});

// Tagesvorlage ändern (Aufgüsse werden komplett ersetzt)
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, description, entries } = parse(dayTemplateSchema, req.body);
    const updated = await inTransaction(async client => {
      const { rows } = await client.query(
        'UPDATE day_templates SET name=$1, description=$2, updated_at=NOW() WHERE id=$3 RETURNING *',
        [name, description, req.params.id]
      );
      if (!rows[0]) return null;
      await client.query('DELETE FROM day_template_entries WHERE day_template_id=$1', [req.params.id]);
      await insertEntries(client, req.params.id, entries);
      return rows[0];
    });
    if (!updated) { res.status(404).json({ error: 'Tagesvorlage nicht gefunden' }); return; }
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await query('DELETE FROM day_templates WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/**
 * Tagesvorlage auf einen oder mehrere Tage anwenden.
 * mode = 'append'  → Aufgüsse zum bestehenden Plan hinzufügen
 * mode = 'replace' → bestehende Aufgüsse des Tages vorher löschen
 * Aufgüsse mit Zeitkonflikt oder deaktivierter Sauna werden übersprungen und gemeldet.
 */
router.post('/:id/apply', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { dates, mode } = parse(applySchema, req.body);
    const uniqueDates = [...new Set(dates)].sort();
    if (uniqueDates.length > MAX_APPLY_DAYS) throw new HttpError(400, `Maximal ${MAX_APPLY_DAYS} Tage auf einmal`);

    const dayTemplate = await queryOne<any>(`${LIST_SQL} WHERE d.id = $1`, [req.params.id]);
    if (!dayTemplate) { res.status(404).json({ error: 'Tagesvorlage nicht gefunden' }); return; }

    const inactiveUsers = new Set(
      (await query<{ id: string }>('SELECT id FROM users WHERE active = false')).map(u => u.id)
    );

    const results = [];
    for (const date of uniqueDates) {
      const result = await inTransaction(async client => {
        const db = async (text: string, params?: any[]) => (await client.query(text, params)).rows;

        let event = (await db('SELECT id FROM events WHERE event_date=$1 FOR UPDATE', [date]))[0];
        if (!event) {
          event = (await db(
            'INSERT INTO events (event_date, created_by) VALUES ($1,$2) ON CONFLICT (event_date) DO UPDATE SET event_date=EXCLUDED.event_date RETURNING id',
            [date, req.user!.id]
          ))[0];
        }

        let removed = 0;
        if (mode === 'replace') {
          removed = (await db('DELETE FROM aufguss_schedule WHERE event_id=$1 RETURNING id', [event.id])).length;
        }

        let created = 0;
        const skipped: { name: string; start_time: string; reason: string }[] = [];
        for (const e of dayTemplate.entries) {
          const name = e.custom_name || e.template_name || 'Aufguss';
          if (!e.sauna_active) {
            skipped.push({ name, start_time: e.start_time, reason: `Sauna „${e.sauna_name}“ ist nicht mehr aktiv.` });
            continue;
          }
          const userId = e.assigned_user_id && !inactiveUsers.has(e.assigned_user_id) ? e.assigned_user_id : null;
          const conflict = await checkConflicts(date, e.sauna_id, userId, e.start_time, e.end_time || null, undefined, db);
          if (conflict) {
            skipped.push({ name, start_time: e.start_time, reason: conflict });
            continue;
          }
          const inserted = (await db(
            `INSERT INTO aufguss_schedule (event_id, sauna_id, template_id, assigned_user_id, custom_name, custom_subtitle, start_time, end_time, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
            [event.id, e.sauna_id, e.template_id, userId, e.custom_name, e.custom_subtitle, e.start_time, e.end_time, e.sort_order]
          ))[0];
          for (let j = 0; j < e.scents.length; j++) {
            const s = e.scents[j];
            await db(
              'INSERT INTO schedule_scents (schedule_id, scent_id, dosage_ml, dosage_note, sort_order) VALUES ($1,$2,$3,$4,$5)',
              [inserted.id, s.scent_id, s.dosage_ml, s.dosage_note, j]
            );
          }
          created++;
        }
        return { date, created, removed, skipped };
      });
      results.push(result);
    }

    res.json({ results });
  } catch (err) { next(err); }
});

export default router;
