import { z } from 'zod';
import { query } from '../db/client';
import { requireAdmin } from '../middleware/auth';
import { createRouter } from '../lib/errors';
import { parse, color } from '../lib/validation';

const router = createRouter();

const DEFAULTS: Record<string, string> = {
  app_name: 'Sauna Aufguss Manager',
  primary_color: '#d97d1d',
  logo_url: '',
  theme_mode: 'dark',
};

/** Alle Felder optional – nur übergebene Einstellungen werden gespeichert */
const settingsSchema = z.object({
  app_name: z.preprocess(v => (typeof v === 'string' ? v.trim() : v), z.string().min(1).max(100)),
  primary_color: color,
  logo_url: z.string().trim().max(2000).refine(
    v => v === '' || /^(https?:\/\/|\/)/i.test(v),
    'muss mit http://, https:// oder / beginnen'
  ),
  theme_mode: z.enum(['light', 'dark', 'system']),
}).partial();

async function getSettings(): Promise<Record<string, string>> {
  const rows = await query<{ key: string; value: string }>('SELECT key, value FROM app_settings');
  const settings = { ...DEFAULTS };
  for (const row of rows) settings[row.key] = row.value;
  return settings;
}

router.get('/', async (_, res) => {
  res.json(await getSettings());
});

router.put('/', requireAdmin, async (req, res) => {
  const updates = parse(settingsSchema, req.body);
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    await query(
      'INSERT INTO app_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value',
      [key, value]
    );
  }
  res.json(await getSettings());
});

export default router;
