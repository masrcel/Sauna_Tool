import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';
import { pool } from '../db/client';
import { HttpError } from './errors';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * Vollständiges Backup als gzip-komprimiertes JSON:
 *  - alle Tabellen (außer revoked_tokens)
 *  - das Protokoll (wird beim Wiederherstellen NICHT überschrieben, nur archiviert)
 *  - hochgeladene Dateien (Profilbilder) als Base64
 *
 * Speicherort auf dem Server: backend/backups (Docker-Volume „backups“).
 */

export const BACKUP_DIR = path.join(__dirname, '../../backups');
const UPLOAD_DIR = path.join(__dirname, '../../uploads');

const FORMAT = 'sauna-aufguss-backup';
const FORMAT_VERSION = 1;

/** In Abhängigkeits-Reihenfolge (Eltern vor Kindern) – so wird auch eingefügt */
const TABLES = [
  'users',
  'saunas',
  'app_settings',
  'scents',
  'aufguss_templates',
  'template_scents',
  'events',
  'aufguss_schedule',
  'schedule_scents',
  'ideas',
  'idea_comments',
  'idea_scents',
  'day_templates',
  'day_template_entries',
  'day_template_entry_scents',
] as const;

/** Nur diese Dateien werden gesichert/wiederhergestellt (Unterordner/Endungen) */
const UPLOAD_SUBDIRS = ['avatars'];
const UPLOAD_FILE_RE = /^[\w.-]+\.(jpe?g|png)$/i;

export type BackupKind = 'auto' | 'manuell' | 'vor-wiederherstellung';
const NAME_RE = /^backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(?:-\d+)?-(auto|manuell|vor-wiederherstellung)\.json\.gz$/;

export interface BackupData {
  format: string;
  version: number;
  app_version?: string;
  created_at: string;
  tables: Record<string, any[]>;
  audit_log?: any[];
  files?: { path: string; data: string }[];
}

export interface BackupInfo {
  name: string;
  kind: BackupKind;
  size: number;
  created_at: string;
}

function appVersion(): string | undefined {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')).version;
  } catch { return undefined; }
}

/** Zeitstempel in lokaler Zeit (TZ) für Dateinamen */
function stamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

export function isValidBackupName(name: string) {
  return NAME_RE.test(name);
}

export function backupPath(name: string) {
  if (!isValidBackupName(name)) throw new HttpError(400, 'Ungültiger Backup-Name');
  const file = path.join(BACKUP_DIR, name);
  if (!fs.existsSync(file)) throw new HttpError(404, 'Backup nicht gefunden');
  return file;
}

// ---------- Erstellen ----------

async function collectFiles() {
  const files: { path: string; data: string }[] = [];
  for (const sub of UPLOAD_SUBDIRS) {
    const dir = path.join(UPLOAD_DIR, sub);
    if (!fs.existsSync(dir)) continue;
    for (const name of await fs.promises.readdir(dir)) {
      if (!UPLOAD_FILE_RE.test(name)) continue;
      const data = await fs.promises.readFile(path.join(dir, name));
      files.push({ path: `${sub}/${name}`, data: data.toString('base64') });
    }
  }
  return files;
}

export async function buildBackup(): Promise<BackupData> {
  // Konsistenter Stand aller Tabellen: alles in einer REPEATABLE-READ-Transaktion lesen
  const client = await pool.connect();
  const tables: Record<string, any[]> = {};
  let audit: any[] = [];
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    // row_to_json in Postgres statt Umwandlung durch node-pg: DATE bleibt "2026-11-12"
    // (node-pg macht daraus ein Date um Mitternacht lokal → Tag-Verschiebung beim Zurückspielen)
    const rows = async (sql: string) => (await client.query(sql)).rows.map(r => r.j);
    for (const t of TABLES) tables[t] = await rows(`SELECT row_to_json(x) AS j FROM ${t} x`);
    audit = await rows('SELECT row_to_json(x) AS j FROM audit_log x ORDER BY id');
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  return {
    format: FORMAT,
    version: FORMAT_VERSION,
    app_version: appVersion(),
    created_at: new Date().toISOString(),
    tables,
    audit_log: audit,
    files: await collectFiles(),
  };
}

export async function createBackup(kind: BackupKind): Promise<BackupInfo> {
  await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
  const data = await buildBackup();
  // gleiche Sekunde (z. B. zwei Wiederherstellungen kurz nacheinander): Zähler anhängen, nie überschreiben
  const base = `backup-${stamp()}`;
  let name = `${base}-${kind}.json.gz`;
  for (let n = 2; fs.existsSync(path.join(BACKUP_DIR, name)); n++) name = `${base}-${n}-${kind}.json.gz`;
  const buf = await gzip(Buffer.from(JSON.stringify(data)));
  // erst in temporäre Datei schreiben, dann umbenennen: nie ein halbes Backup in der Liste
  const tmp = path.join(BACKUP_DIR, `.${name}.tmp`);
  await fs.promises.writeFile(tmp, buf, { mode: 0o600 });
  await fs.promises.rename(tmp, path.join(BACKUP_DIR, name));
  return { name, kind, size: buf.length, created_at: data.created_at };
}

export async function listBackups(): Promise<BackupInfo[]> {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  const names = (await fs.promises.readdir(BACKUP_DIR)).filter(isValidBackupName);
  const list = await Promise.all(names.map(async name => {
    const st = await fs.promises.stat(path.join(BACKUP_DIR, name));
    return { name, kind: name.match(NAME_RE)![1] as BackupKind, size: st.size, created_at: st.mtime.toISOString() };
  }));
  return list.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.name.localeCompare(a.name));
}

export async function deleteBackup(name: string) {
  await fs.promises.unlink(backupPath(name));
}

/** Automatische Backups älter als BACKUP_KEEP_DAYS (Standard 14) löschen. Manuelle bleiben. */
export async function pruneBackups() {
  const days = Number(process.env.BACKUP_KEEP_DAYS ?? 14);
  if (!Number.isFinite(days) || days <= 0) return;
  const limit = Date.now() - days * 24 * 60 * 60 * 1000;
  for (const b of await listBackups()) {
    if (b.kind === 'manuell') continue;
    if (new Date(b.created_at).getTime() < limit) await fs.promises.unlink(path.join(BACKUP_DIR, b.name)).catch(() => {});
  }
}

// ---------- Wiederherstellen ----------

/** Datei (gzip oder reines JSON) lesen und prüfen */
export async function parseBackup(buf: Buffer): Promise<BackupData> {
  let raw = buf;
  if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    try { raw = await gunzip(buf); } catch { throw new HttpError(400, 'Backup-Datei ist beschädigt (gzip)'); }
  }
  let data: any;
  try { data = JSON.parse(raw.toString('utf-8')); } catch { throw new HttpError(400, 'Keine gültige Backup-Datei'); }
  if (data?.format !== FORMAT || typeof data.tables !== 'object' || !data.tables) {
    throw new HttpError(400, 'Keine Backup-Datei des Sauna Aufguss Managers');
  }
  if (typeof data.version !== 'number' || data.version > FORMAT_VERSION) {
    throw new HttpError(400, 'Backup stammt aus einer neueren Programmversion – bitte zuerst updaten');
  }
  if (!Array.isArray(data.tables.users) || !data.tables.users.some((u: any) => u.role === 'admin' && u.active)) {
    throw new HttpError(400, 'Backup enthält keinen aktiven Admin – Wiederherstellung abgebrochen');
  }
  return data as BackupData;
}

/**
 * Ersetzt ALLE Daten durch den Stand aus dem Backup (in einer Transaktion: entweder ganz oder gar nicht).
 * Das Protokoll bleibt erhalten. Alle Mitarbeiter müssen sich danach neu anmelden.
 */
export async function restoreBackup(data: BackupData) {
  const client = await pool.connect();
  const counts: Record<string, number> = {};
  try {
    await client.query('BEGIN');
    await client.query(`TRUNCATE ${TABLES.join(', ')}, revoked_tokens`);

    for (const t of TABLES) {
      const rows = data.tables[t];
      if (!Array.isArray(rows) || rows.length === 0) { counts[t] = 0; continue; }
      // Nur Spalten, die es heute noch gibt UND die im Backup stehen – fehlende bekommen den Standardwert
      const cols = (await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [t]
      )).rows.map(r => r.column_name as string);
      const inBackup = new Set(rows.flatMap(r => Object.keys(r)));
      const use = cols.filter(c => inBackup.has(c)).map(c => `"${c}"`).join(', ');
      // in Paketen einfügen, damit einzelne Abfragen nicht zu groß werden
      for (let i = 0; i < rows.length; i += 1000) {
        await client.query(
          `INSERT INTO ${t} (${use}) SELECT ${use} FROM json_populate_recordset(NULL::${t}, $1::json)`,
          [JSON.stringify(rows.slice(i, i + 1000))]
        );
      }
      counts[t] = rows.length;
    }

    // Alle bestehenden Anmeldungen ungültig machen (Rollen/Passwörter können sich geändert haben)
    await client.query('UPDATE users SET token_version = token_version + 1');
    await client.query('COMMIT');
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Wiederherstellung fehlgeschlagen:', err);
    throw new HttpError(400, `Wiederherstellung fehlgeschlagen, es wurde nichts geändert (${err?.message ?? 'unbekannter Fehler'})`);
  } finally {
    client.release();
  }

  // Dateien zurückschreiben (vorhandene bleiben, gleichnamige werden überschrieben)
  let files = 0;
  for (const f of data.files ?? []) {
    const [sub, name, ...rest] = String(f?.path ?? '').split('/');
    if (rest.length || !UPLOAD_SUBDIRS.includes(sub) || !UPLOAD_FILE_RE.test(name ?? '') || typeof f.data !== 'string') continue;
    const dir = path.join(UPLOAD_DIR, sub);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(path.join(dir, name), Buffer.from(f.data, 'base64'));
    files++;
  }
  return { counts, files };
}

/** Kurze Zusammenfassung für Protokoll/Anzeige */
export function summarize(data: BackupData) {
  const t = data.tables;
  const n = (k: string) => (Array.isArray(t[k]) ? t[k].length : 0);
  return {
    created_at: data.created_at,
    app_version: data.app_version,
    mitarbeiter: n('users'),
    saunen: n('saunas'),
    duefte: n('scents'),
    vorlagen: n('aufguss_templates'),
    tage: n('events'),
    aufguesse: n('aufguss_schedule'),
    ideen: n('ideas'),
    tagesvorlagen: n('day_templates'),
    dateien: data.files?.length ?? 0,
  };
}

/** Wird für den Server-Job gebraucht: Gibt es heute schon ein automatisches Backup? */
export async function hasAutoBackupToday() {
  const today = stamp().slice(0, 10);
  return (await listBackups()).some(b => b.kind === 'auto' && b.name.startsWith(`backup-${today}`));
}

