import { createBackup, hasAutoBackupToday, pruneBackups } from '../lib/backup';
import { writeAudit, cleanupAuditLog } from '../lib/audit';

/**
 * Automatisches tägliches Backup ab BACKUP_HOUR Uhr (Standard 3, Server-Zeitzone TZ).
 * Läuft alle 10 Minuten: Fehlt das heutige Backup und ist die Uhrzeit erreicht, wird es erstellt –
 * so wird ein verpasster Termin (Server war aus) automatisch nachgeholt.
 * BACKUP_HOUR=-1 schaltet die automatischen Backups ab.
 */
let running = false;

export async function runBackupJob() {
  if (running) return;
  running = true;
  try {
    const hour = Number(process.env.BACKUP_HOUR ?? 3);
    if (Number.isFinite(hour) && hour >= 0 && new Date().getHours() >= hour && !(await hasAutoBackupToday())) {
      try {
        const info = await createBackup('auto');
        await writeAudit({ userName: 'System', action: 'backup', entity: 'Backup', summary: `Automatisches Backup erstellt (${info.name})` });
      } catch (err: any) {
        console.error('Automatisches Backup fehlgeschlagen:', err);
        await writeAudit({ userName: 'System', action: 'backup', entity: 'Backup', summary: `Automatisches Backup FEHLGESCHLAGEN: ${err?.message ?? err}` });
      }
    }
    await pruneBackups();
    await cleanupAuditLog();
  } finally {
    running = false;
  }
}
