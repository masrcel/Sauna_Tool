import { Router } from 'express';
import { query, queryOne } from '../db/client';
import { requireAdmin, requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', async (_, res) => {
  const scents = await query('SELECT * FROM scents ORDER BY category, name');
  res.json(scents);
});

router.post('/', requireAuth, async (req, res) => {
  const { name, description, category, color, default_dosage_ml, dosage_unit, dosage_note } = req.body;
  const scent = await queryOne(
    `INSERT INTO scents (name, description, category, color, default_dosage_ml, dosage_unit, dosage_note)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [name, description, category, color, default_dosage_ml || null, dosage_unit || 'ml', dosage_note || null]
  );
  res.status(201).json(scent);
});

router.put('/:id', requireAuth, async (req, res) => {
  const { name, description, category, color, default_dosage_ml, dosage_unit, dosage_note } = req.body;
  const scent = await queryOne(
    `UPDATE scents SET name=$1, description=$2, category=$3, color=$4,
     default_dosage_ml=$5, dosage_unit=$6, dosage_note=$7 WHERE id=$8 RETURNING *`,
    [name, description, category, color, default_dosage_ml || null, dosage_unit || 'ml', dosage_note || null, req.params.id]
  );
  res.json(scent);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  await query('DELETE FROM scents WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
