import { z } from 'zod';
import { query, queryOne } from '../db/client';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { createRouter } from '../lib/errors';
import { parse, validateParams, uuid, optUuid, optText, time, optTime, date, scentList } from '../lib/validation';

const router = createRouter();
validateParams(router);

const STATUSES = ['geplant', 'läuft', 'fertig', 'abgesagt'] as const;

const scheduleSchema = z.object({
  sauna_id: uuid,
  template_id: optUuid,
  assigned_user_id: optUuid,
  custom_name: optText(200),
  custom_subtitle: optText(200),
  start_time: time,
  end_time: optTime,
  status: z.preprocess(v => (v === '' || v == null ? undefined : v), z.enum(STATUSES).default('geplant')),
});

const eventSchema = z.object({
  event_date: date,
  title: optText(200),
  notes: optText(),
});

const rangeQuerySchema = z.object({ from: date, to: date });

/** Führt eine SQL-Abfrage aus – entweder über den Pool oder innerhalb einer Transaktion */
export type Querier = (text: string, params?: any[]) => Promise<any[]>;

export async function checkConflicts(
  date: string,
  saunaId: string,
  userId: string | null,
  startTime: string,
  endTime: string | null,
  excludeId = '00000000-0000-0000-0000-000000000000',
  db: Querier = query
): Promise<string | null> {
  const saunaHits = await db(`
    SELECT TO_CHAR(s.start_time, 'HH24:MI') as start_time,
           TO_CHAR(COALESCE(s.end_time, s.start_time + interval '15 minutes'), 'HH24:MI') as end_time,
           TO_CHAR(COALESCE(s.end_time, s.start_time + interval '15 minutes') + (sa.break_minutes || ' minutes')::interval, 'HH24:MI') as free_at,
           sa.break_minutes,
           COALESCE(s.custom_name, t.name, 'Aufguss') as name
    FROM aufguss_schedule s
    JOIN events e ON s.event_id = e.id
    JOIN saunas sa ON s.sauna_id = sa.id
    LEFT JOIN aufguss_templates t ON s.template_id = t.id
    WHERE e.event_date = $1
      AND s.id != $2
      AND s.sauna_id = $3
      AND s.status != 'abgesagt'
      AND $4::time < COALESCE(s.end_time, s.start_time + interval '15 minutes') + (sa.break_minutes || ' minutes')::interval
      AND s.start_time < COALESCE($5::time, $4::time + interval '15 minutes') + (sa.break_minutes || ' minutes')::interval
  `, [date, excludeId, saunaId, startTime, endTime]);
  if (saunaHits.length > 0) {
    const c = saunaHits[0] as any;
    const breakHint = c.break_minutes > 0 ? ` + ${c.break_minutes} Min. Pause – frei ab ${c.free_at} Uhr` : '';
    return `Zeitkonflikt Sauna: "${c.name}" läuft von ${c.start_time} bis ${c.end_time} Uhr${breakHint}.`;
  }

  if (userId) {
    const staffHits = await db(`
      SELECT TO_CHAR(s.start_time, 'HH24:MI') as start_time,
             TO_CHAR(COALESCE(s.end_time, s.start_time + interval '15 minutes'), 'HH24:MI') as end_time,
             sa.name as sauna_name,
             COALESCE(s.custom_name, t.name, 'Aufguss') as name
      FROM aufguss_schedule s
      JOIN events e ON s.event_id = e.id
      JOIN saunas sa ON s.sauna_id = sa.id
      LEFT JOIN aufguss_templates t ON s.template_id = t.id
      WHERE e.event_date = $1
        AND s.id != $2
        AND s.assigned_user_id = $3
        AND s.status != 'abgesagt'
        AND $4::time < COALESCE(s.end_time, s.start_time + interval '15 minutes')
        AND s.start_time < COALESCE($5::time, $4::time + interval '15 minutes')
    `, [date, excludeId, userId, startTime, endTime]);
    if (staffHits.length > 0) {
      const c = staffHits[0] as any;
      return `Mitarbeiter-Konflikt: Diese Person leitet "${c.name}" in ${c.sauna_name} von ${c.start_time} bis ${c.end_time} Uhr.`;
    }
  }

  return null;
}

// Übersicht: Anzahl Aufgüsse je Tag in einem Zeitraum (für Wochenleiste / Vorlagen-Anwendung)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { from, to } = parse(rangeQuerySchema, req.query);
    const rows = await query(`
      SELECT TO_CHAR(e.event_date, 'YYYY-MM-DD') as date, COUNT(s.id)::int as count
      FROM events e
      JOIN aufguss_schedule s ON s.event_id = e.id AND s.status != 'abgesagt'
      WHERE e.event_date BETWEEN $1 AND $2
      GROUP BY e.event_date
      ORDER BY e.event_date
    `, [from, to]);
    res.json(rows);
  } catch (err) { next(err); }
});

// Tages-Event abrufen oder anlegen
router.get('/:date', async (req, res, next) => {
  try {
  const event = await queryOne<any>('SELECT * FROM events WHERE event_date=$1', [req.params.date]);
  if (!event) { res.status(404).json(null); return; }

  const schedule = await query(`
    SELECT
      s.id, s.sauna_id, s.template_id, s.assigned_user_id,
      s.custom_name, s.custom_subtitle, s.start_time, s.end_time,
      s.status, s.sort_order,
      sa.name as sauna_name,
      t.name as template_name, t.subtitle as template_subtitle,
      t.duration_minutes,
      u.name as staff_name, u.avatar_url as staff_avatar,
      (SELECT COALESCE(json_agg(
        json_build_object('scent_id', sc.id, 'scent_name', sc.name, 'dosage_ml', ts.dosage_ml, 'dosage_note', ts.dosage_note, 'color', sc.color)
        ORDER BY ts.sort_order
      ), '[]')
      FROM template_scents ts
      JOIN scents sc ON ts.scent_id = sc.id
      WHERE ts.template_id = s.template_id) as template_scents,
      (SELECT COALESCE(json_agg(
        json_build_object('scent_id', sc.id, 'scent_name', sc.name, 'dosage_ml', ss.dosage_ml, 'dosage_note', ss.dosage_note, 'color', sc.color)
        ORDER BY ss.sort_order
      ), '[]')
      FROM schedule_scents ss
      JOIN scents sc ON ss.scent_id = sc.id
      WHERE ss.schedule_id = s.id) as schedule_scents
    FROM aufguss_schedule s
    JOIN saunas sa ON s.sauna_id = sa.id
    LEFT JOIN aufguss_templates t ON s.template_id = t.id
    LEFT JOIN users u ON s.assigned_user_id = u.id
    WHERE s.event_id = $1
    ORDER BY s.start_time, s.sort_order
  `, [event.id]);

  // Merge template_scents und schedule_scents (schedule_scents überschreiben template_scents wenn vorhanden)
  const mergedSchedule = schedule.map((entry: any) => ({
    ...entry,
    scents: entry.schedule_scents.length > 0 ? entry.schedule_scents : entry.template_scents,
  }));

  res.json({ ...event, schedule: mergedSchedule });
  } catch (err) { next(err); }
});

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const { event_date, title, notes } = parse(eventSchema, req.body);
  const event = await queryOne(
    'INSERT INTO events (event_date, title, notes, created_by) VALUES ($1,$2,$3,$4) ON CONFLICT (event_date) DO UPDATE SET title=EXCLUDED.title, notes=EXCLUDED.notes RETURNING *',
    [event_date, title, notes, req.user!.id]
  );
  res.status(201).json(event);
});

// Aufguss zum Plan hinzufügen
router.post('/:date/schedule', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { sauna_id, template_id, assigned_user_id, custom_name, custom_subtitle, start_time, end_time } = parse(scheduleSchema, req.body);
    const conflict = await checkConflicts(req.params.date, sauna_id, assigned_user_id, start_time, end_time);
    if (conflict) { res.status(409).json({ error: conflict }); return; }
    let event = await queryOne<any>('SELECT id FROM events WHERE event_date=$1', [req.params.date]);
    if (!event) {
      event = await queryOne('INSERT INTO events (event_date, created_by) VALUES ($1,$2) RETURNING id', [req.params.date, req.user!.id]);
    }
    const entry = await queryOne(
      `INSERT INTO aufguss_schedule (event_id, sauna_id, template_id, assigned_user_id, custom_name, custom_subtitle, start_time, end_time)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [event!.id, sauna_id, template_id, assigned_user_id, custom_name, custom_subtitle, start_time, end_time]
    );
    res.status(201).json(entry);
  } catch (err) { next(err); }
});

// Aufguss im Plan aktualisieren
router.put('/:date/schedule/:scheduleId', requireAuth, async (req, res, next) => {
  try {
    const { sauna_id, template_id, assigned_user_id, custom_name, custom_subtitle, start_time, end_time, status } = parse(scheduleSchema, req.body);
    const conflict = await checkConflicts(req.params.date, sauna_id, assigned_user_id, start_time, end_time, req.params.scheduleId);
    if (conflict) { res.status(409).json({ error: conflict }); return; }
    const entry = await queryOne(
      `UPDATE aufguss_schedule SET sauna_id=$1, template_id=$2, assigned_user_id=$3, custom_name=$4,
       custom_subtitle=$5, start_time=$6, end_time=$7, status=$8 WHERE id=$9 RETURNING *`,
      [sauna_id, template_id, assigned_user_id, custom_name, custom_subtitle, start_time, end_time, status, req.params.scheduleId]
    );
    if (!entry) { res.status(404).json({ error: 'Aufguss nicht gefunden' }); return; }
    res.json(entry);
  } catch (err) { next(err); }
});

// Freien Aufguss selbst übernehmen („Mir zuweisen“) – nur wenn noch niemand zugewiesen ist
router.post('/:date/schedule/:scheduleId/claim', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const entry = await queryOne<any>(`
      SELECT s.id, s.sauna_id, s.assigned_user_id, s.status,
             TO_CHAR(s.start_time, 'HH24:MI') as start_time, TO_CHAR(s.end_time, 'HH24:MI') as end_time
      FROM aufguss_schedule s JOIN events e ON e.id = s.event_id
      WHERE s.id = $1 AND e.event_date = $2
    `, [req.params.scheduleId, req.params.date]);
    if (!entry) { res.status(404).json({ error: 'Aufguss nicht gefunden' }); return; }
    if (entry.assigned_user_id) { res.status(409).json({ error: 'Dieser Aufguss ist bereits jemandem zugewiesen.' }); return; }
    if (entry.status === 'fertig' || entry.status === 'abgesagt') {
      res.status(409).json({ error: 'Fertige oder abgesagte Aufgüsse können nicht übernommen werden.' });
      return;
    }
    const conflict = await checkConflicts(req.params.date, entry.sauna_id, req.user!.id, entry.start_time, entry.end_time, entry.id);
    if (conflict) { res.status(409).json({ error: conflict }); return; }

    // Atomar: falls jemand gleichzeitig klickt, gewinnt nur einer
    const updated = await queryOne(
      'UPDATE aufguss_schedule SET assigned_user_id=$1 WHERE id=$2 AND assigned_user_id IS NULL RETURNING *',
      [req.user!.id, entry.id]
    );
    if (!updated) { res.status(409).json({ error: 'Dieser Aufguss wurde gerade von jemand anderem übernommen.' }); return; }
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete('/:date/schedule/:scheduleId', requireAuth, async (req, res) => {
  await query('DELETE FROM aufguss_schedule WHERE id=$1', [req.params.scheduleId]);
  res.json({ ok: true });
});

// Aktuelle Düfte eines Aufgusses abrufen (schedule_scents > template_scents)
router.get('/:date/schedule/:scheduleId/scents', requireAuth, async (req, res, next) => {
  try {
    const scheduleScents = await query(`
      SELECT ss.id, ss.scent_id, sc.name as scent_name, ss.dosage_ml, ss.dosage_note, sc.color, ss.sort_order
      FROM schedule_scents ss
      JOIN scents sc ON ss.scent_id = sc.id
      WHERE ss.schedule_id = $1
      ORDER BY ss.sort_order
    `, [req.params.scheduleId]);

    if (scheduleScents.length > 0) {
      res.json(scheduleScents);
      return;
    }

    // Fallback: Düfte aus der verknüpften Vorlage
    const templateScents = await query(`
      SELECT ts.id, ts.scent_id, sc.name as scent_name, ts.dosage_ml, ts.dosage_note, sc.color, ts.sort_order
      FROM aufguss_schedule s
      JOIN template_scents ts ON ts.template_id = s.template_id
      JOIN scents sc ON ts.scent_id = sc.id
      WHERE s.id = $1
      ORDER BY ts.sort_order
    `, [req.params.scheduleId]);

    res.json(templateScents);
  } catch (err) { next(err); }
});

// Düfte zu einem geplanten Aufguss hinzufügen
router.post('/:date/schedule/:scheduleId/scents', requireAuth, async (req: AuthRequest, res) => {
  const scents = parse(z.object({ scents: scentList }), req.body).scents.filter(s => s.scent_id);
  await query('DELETE FROM schedule_scents WHERE schedule_id=$1', [req.params.scheduleId]);
  if (scents.length) {
    for (let i = 0; i < scents.length; i++) {
      const s = scents[i];
      await query(
        'INSERT INTO schedule_scents (schedule_id, scent_id, dosage_ml, dosage_note, sort_order) VALUES ($1,$2,$3,$4,$5)',
        [req.params.scheduleId, s.scent_id, s.dosage_ml, s.dosage_note, i]
      );
    }
  }
  res.json({ ok: true });
});

export default router;
