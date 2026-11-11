import { z } from 'zod';
import { query, queryOne } from '../db/client';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { createRouter, HttpError } from '../lib/errors';
import { parse, validateParams, text, optText, intWithDefault, scentList } from '../lib/validation';

const router = createRouter();
validateParams(router);

const templateSchema = z.object({
  name: text(200),
  subtitle: optText(200),
  description: optText(),
  duration_minutes: intWithDefault(15, 1, 600),
  scents: scentList,
});

router.get('/', requireAuth, async (_, res) => {
  const templates = await query(`
    SELECT t.*, u.name as creator_name,
      COALESCE(json_agg(
        json_build_object('id', ts.id, 'scent_id', ts.scent_id, 'scent_name', s.name,
          'dosage_ml', ts.dosage_ml, 'dosage_note', ts.dosage_note, 'sort_order', ts.sort_order, 'color', s.color)
        ORDER BY ts.sort_order
      ) FILTER (WHERE ts.id IS NOT NULL), '[]') as scents
    FROM aufguss_templates t
    LEFT JOIN users u ON t.created_by = u.id
    LEFT JOIN template_scents ts ON ts.template_id = t.id
    LEFT JOIN scents s ON ts.scent_id = s.id
    GROUP BY t.id, u.name
    ORDER BY t.name
  `);
  res.json(templates);
});

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const { name, subtitle, description, duration_minutes, scents } = parse(templateSchema, req.body);
  const template = await queryOne(
    'INSERT INTO aufguss_templates (name, subtitle, description, duration_minutes, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [name, subtitle, description, duration_minutes, req.user!.id]
  );
  const validScents = scents.filter(s => s.scent_id);
  for (let i = 0; i < validScents.length; i++) {
    const s = validScents[i];
    await query(
      'INSERT INTO template_scents (template_id, scent_id, dosage_ml, dosage_note, sort_order) VALUES ($1,$2,$3,$4,$5)',
      [template!.id, s.scent_id, s.dosage_ml, s.dosage_note, i]
    );
  }
  res.status(201).json(template);
});

router.put('/:id', requireAuth, async (req: AuthRequest, res) => {
  const { name, subtitle, description, duration_minutes, scents } = parse(templateSchema, req.body);
  const template = await queryOne(
    'UPDATE aufguss_templates SET name=$1, subtitle=$2, description=$3, duration_minutes=$4, updated_at=NOW() WHERE id=$5 RETURNING *',
    [name, subtitle, description, duration_minutes, req.params.id]
  );
  if (!template) throw new HttpError(404, 'Vorlage nicht gefunden');
  await query('DELETE FROM template_scents WHERE template_id=$1', [req.params.id]);
  const validScents = scents.filter(s => s.scent_id);
  for (let i = 0; i < validScents.length; i++) {
    const s = validScents[i];
    await query(
      'INSERT INTO template_scents (template_id, scent_id, dosage_ml, dosage_note, sort_order) VALUES ($1,$2,$3,$4,$5)',
      [req.params.id, s.scent_id, s.dosage_ml, s.dosage_note, i]
    );
  }
  res.json(template);
});

router.delete('/:id', requireAuth, async (req, res) => {
  await query('DELETE FROM aufguss_templates WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
