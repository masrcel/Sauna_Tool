import fs from 'fs';
import express from 'express';
import { requireAdmin, AuthRequest } from '../middleware/auth';
import { createRouter, HttpError } from '../lib/errors';
import { writeAudit } from '../lib/audit';
import {
  createBackup, listBackups, deleteBackup, backupPath, parseBackup, restoreBackup, summarize,
} from '../lib/backup';

/** Backups – nur Admins. Jede Aktion wird protokolliert. */
const router = createRouter();

/** Maximale Größe einer hochgeladenen Backup-Datei (nginx: client_max_body_size passend setzen) */
const MAX_UPLOAD = '200mb';

const audit = (req: AuthRequest, action: 'backup' | 'restore' | 'download' | 'delete', summary: string, details?: unknown) =>
  writeAudit({ userId: req.user!.id, userName: req.user!.name, action, entity: 'Backup', summary, details, ip: req.ip });

// Nur ein Backup/Restore gleichzeitig
let busy = false;
async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  if (busy) throw new HttpError(409, 'Es läuft bereits ein Backup oder eine Wiederherstellung');
  busy = true;
  try { return await fn(); } finally { busy = false; }
}

router.get('/', requireAdmin, async (_req, res) => {
  res.json({
    backups: await listBackups(),
    keep_days: Number(process.env.BACKUP_KEEP_DAYS ?? 14),
    hour: Number(process.env.BACKUP_HOUR ?? 3),
  });
});

router.post('/', requireAdmin, async (req: AuthRequest, res) => {
  const info = await exclusive(() => createBackup('manuell'));
  await audit(req, 'backup', `Backup erstellt (${info.name})`);
  res.status(201).json(info);
});

router.get('/:name/download', requireAdmin, async (req: AuthRequest, res) => {
  const file = backupPath(req.params.name);
  await audit(req, 'download', `Backup heruntergeladen (${req.params.name})`);
  res.setHeader('Content-Type', 'application/gzip');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.name}"`);
  fs.createReadStream(file).pipe(res);
});

router.delete('/:name', requireAdmin, async (req: AuthRequest, res) => {
  await deleteBackup(req.params.name);
  await audit(req, 'delete', `Backup gelöscht (${req.params.name})`);
  res.json({ ok: true });
});

/** Gemeinsamer Ablauf: Sicherheitskopie des aktuellen Stands → Wiederherstellen → protokollieren */
async function doRestore(req: AuthRequest, buf: Buffer, source: string) {
  const data = await parseBackup(buf);
  return exclusive(async () => {
    const safety = await createBackup('vor-wiederherstellung');
    const result = await restoreBackup(data);
    await audit(req, 'restore', `Daten wiederhergestellt aus ${source}`, {
      backup: summarize(data),
      sicherheitskopie: safety.name,
      dateien: result.files,
    });
    return { ok: true, safety_backup: safety.name, ...summarize(data) };
  });
}

// Wiederherstellen aus einem Backup auf dem Server
router.post('/:name/restore', requireAdmin, async (req: AuthRequest, res) => {
  const buf = await fs.promises.readFile(backupPath(req.params.name));
  res.json(await doRestore(req, buf, `Server-Backup ${req.params.name}`));
});

// Wiederherstellen aus einer hochgeladenen Datei (.json.gz oder .json, als Rohdaten im Body)
router.post(
  '/restore',
  requireAdmin,
  express.raw({ type: () => true, limit: MAX_UPLOAD }),
  async (req: AuthRequest, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(400, 'Keine Datei hochgeladen');
    let fileName = String(req.headers['x-file-name'] ?? 'Datei');
    try { fileName = decodeURIComponent(fileName); } catch { /* Rohwert behalten */ }
    fileName = fileName.slice(0, 200);
    res.json(await doRestore(req, req.body, `hochgeladener Datei ${fileName}`));
  }
);

/** Vorschau: Was steckt in der Datei? (ohne etwas zu ändern) */
router.post(
  '/inspect',
  requireAdmin,
  express.raw({ type: () => true, limit: MAX_UPLOAD }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(400, 'Keine Datei hochgeladen');
    res.json(summarize(await parseBackup(req.body)));
  }
);

export default router;
