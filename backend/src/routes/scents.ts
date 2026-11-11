import { z } from 'zod';
import { pool, query, queryOne } from '../db/client';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { createRouter, HttpError } from '../lib/errors';
import { parse, validateParams, text, optText, optColor, optAmount } from '../lib/validation';

const router = createRouter();
validateParams(router);

const scentSchema = z.object({
  name: text(100),
  description: optText(),
  category: optText(50),
  color: optColor,
  default_dosage_ml: optAmount,
  dosage_unit: z.preprocess(v => (v === '' || v == null ? undefined : v), z.enum(['ml', 'g', 'Tropfen']).default('ml')),
  dosage_note: optText(500),
});

router.get('/', async (_, res) => {
  const scents = await query('SELECT * FROM scents ORDER BY category, name');
  res.json(scents);
});

router.post('/', requireAuth, async (req, res) => {
  const { name, description, category, color, default_dosage_ml, dosage_unit, dosage_note } = parse(scentSchema, req.body);
  const scent = await queryOne(
    `INSERT INTO scents (name, description, category, color, default_dosage_ml, dosage_unit, dosage_note)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [name, description, category, color, default_dosage_ml, dosage_unit, dosage_note]
  );
  res.status(201).json(scent);
});

router.put('/:id', requireAuth, async (req, res) => {
  const { name, description, category, color, default_dosage_ml, dosage_unit, dosage_note } = parse(scentSchema, req.body);
  const scent = await queryOne(
    `UPDATE scents SET name=$1, description=$2, category=$3, color=$4,
     default_dosage_ml=$5, dosage_unit=$6, dosage_note=$7 WHERE id=$8 RETURNING *`,
    [name, description, category, color, default_dosage_ml, dosage_unit, dosage_note, req.params.id]
  );
  if (!scent) throw new HttpError(404, 'Duft nicht gefunden');
  res.json(scent);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const force = req.query.force === 'true';
  const client = await pool.connect();
  try {
    const usage = await client.query(
      `SELECT
         (SELECT COUNT(*) FROM template_scents WHERE scent_id=$1)::int AS templates,
         (SELECT COUNT(*) FROM schedule_scents WHERE scent_id=$1)::int AS schedules,
         (SELECT COUNT(*) FROM idea_scents WHERE scent_id=$1)::int AS ideas`,
      [id]
    );
    const { templates, schedules, ideas } = usage.rows[0];
    if (!force && templates + schedules + ideas > 0) {
      res.status(409).json({ error: 'Duft wird noch verwendet', usage: { templates, schedules, ideas } });
      return;
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM template_scents WHERE scent_id=$1', [id]);
    await client.query('DELETE FROM schedule_scents WHERE scent_id=$1', [id]);
    await client.query('DELETE FROM idea_scents WHERE scent_id=$1', [id]);
    await client.query('DELETE FROM day_template_entry_scents WHERE scent_id=$1', [id]);
    await client.query('DELETE FROM scents WHERE id=$1', [id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

export default router;
