import { Router } from 'express';
import { query } from '../db/client';
import { requireAdmin } from '../middleware/auth';

const router = Router();

const ALLOWED_KEYS = ['app_name', 'primary_color', 'logo_url', 'theme_mode'];
const DEFAULTS: Record<string, string> = {
  app_name: 'Sauna Aufguss Manager',
  primary_color: '#d97d1d',
  logo_url: '',
  theme_mode: 'dark',
};

async function getSettings(): Promise<Record<string, string>> {
  const rows = await query<{ key: string; value: string }>('SELECT key, value FROM app_settings');
  const settings = { ...DEFAULTS };
  for (const row of rows) settings[row.key] = row.value;
  return settings;
}

router.get('/', async (_, res, next) => {
  try {
    res.json(await getSettings());
  } catch (err) { next(err); }
});

router.put('/', requireAdmin, async (req, res, next) => {
  try {
    for (const key of ALLOWED_KEYS) {
      if (key in req.body) {
        await query(
          'INSERT INTO app_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value',
          [key, req.body[key]]
        );
      }
    }
    res.json(await getSettings());
  } catch (err) { next(err); }
});

export default router;
