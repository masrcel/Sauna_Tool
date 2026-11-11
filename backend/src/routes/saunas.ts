import { z } from 'zod';
import { query, queryOne } from '../db/client';
import { requireAdmin } from '../middleware/auth';
import { createRouter, HttpError } from '../lib/errors';
import { parse, validateParams, text, optText, intWithDefault, boolWithDefault } from '../lib/validation';

const router = createRouter();
validateParams(router);

const saunaSchema = z.object({
  name: text(100),
  description: optText(),
  sort_order: intWithDefault(0, -10_000, 10_000),
  break_minutes: intWithDefault(0, 0, 240),
  active: boolWithDefault(true),
});

router.get('/', async (_, res) => {
  const saunas = await query('SELECT * FROM saunas WHERE active=true ORDER BY sort_order, name');
  res.json(saunas);
});

router.post('/', requireAdmin, async (req, res) => {
  const { name, description, sort_order, break_minutes } = parse(saunaSchema, req.body);
  const sauna = await queryOne(
    'INSERT INTO saunas (name, description, sort_order, break_minutes) VALUES ($1,$2,$3,$4) RETURNING *',
    [name, description, sort_order, break_minutes]
  );
  res.status(201).json(sauna);
});

router.put('/:id', requireAdmin, async (req, res) => {
  const { name, description, sort_order, active, break_minutes } = parse(saunaSchema, req.body);
  const sauna = await queryOne(
    'UPDATE saunas SET name=$1, description=$2, sort_order=$3, active=$4, break_minutes=$5 WHERE id=$6 RETURNING *',
    [name, description, sort_order, active, break_minutes, req.params.id]
  );
  if (!sauna) throw new HttpError(404, 'Sauna nicht gefunden');
  res.json(sauna);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  await query('UPDATE saunas SET active=false WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
