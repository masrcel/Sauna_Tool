import { Router } from 'express';
import { query, queryOne } from '../db/client';
import { requireAdmin, requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', async (_, res) => {
  const saunas = await query('SELECT * FROM saunas WHERE active=true ORDER BY sort_order, name');
  res.json(saunas);
});

router.post('/', requireAdmin, async (req, res) => {
  const { name, description, sort_order, break_minutes } = req.body;
  const sauna = await queryOne(
    'INSERT INTO saunas (name, description, sort_order, break_minutes) VALUES ($1,$2,$3,$4) RETURNING *',
    [name, description, sort_order ?? 0, break_minutes ?? 0]
  );
  res.status(201).json(sauna);
});

router.put('/:id', requireAdmin, async (req, res) => {
  const { name, description, sort_order, active, break_minutes } = req.body;
  const sauna = await queryOne(
    'UPDATE saunas SET name=$1, description=$2, sort_order=$3, active=$4, break_minutes=$5 WHERE id=$6 RETURNING *',
    [name, description, sort_order ?? 0, active ?? true, break_minutes ?? 0, req.params.id]
  );
  res.json(sauna);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  await query('UPDATE saunas SET active=false WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
