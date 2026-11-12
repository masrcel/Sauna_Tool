import { query } from '../db/client';

export type AuditAction =
  | 'create' | 'update' | 'delete'
  | 'login' | 'login_failed' | 'logout'
  | 'backup' | 'restore' | 'download';

export interface AuditEntry {
  userId?: string | null;
  userName?: string | null;
  action: AuditAction;
  entity?: string | null;
  entityId?: string | null;
  summary: string;
  details?: unknown;
  ip?: string | null;
}

/** Obergrenze für die Details eines Eintrags (Zeichen JSON) */
const MAX_DETAILS_LENGTH = 100_000;

/** Felder, die nie im Protokoll landen dürfen */
const SECRET_KEYS = new Set(['password', 'password_hash', 'token', 'token_version']);

/** Entfernt Geheimnisse (Passwörter, Tokens) rekursiv aus einem Objekt. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEYS.has(k)) {
        if (k === 'password' && v) out[k] = '(geändert)';
        continue;
      }
      out[k] = redact(v);
    }
    return out;
  }
  return value;
}

/**
 * Schreibt einen Protokolleintrag. Fehler werden nur geloggt – ein Problem mit dem
 * Protokoll darf die eigentliche Aktion des Mitarbeiters nicht scheitern lassen.
 */
export async function writeAudit(e: AuditEntry): Promise<void> {
  try {
    let details = e.details === undefined ? null : JSON.stringify(redact(e.details));
    if (details && details.length > MAX_DETAILS_LENGTH) {
      details = JSON.stringify({ hinweis: 'Details zu umfangreich, nicht gespeichert' });
    }
    await query(
      `INSERT INTO audit_log (user_id, user_name, action, entity, entity_id, summary, details, ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        e.userId ?? null,
        e.userName ?? null,
        e.action,
        e.entity ?? null,
        e.entityId ?? null,
        e.summary.slice(0, 1000),
        details,
        e.ip ?? null,
      ]
    );
  } catch (err) {
    console.error('Protokolleintrag fehlgeschlagen:', err);
  }
}

/** Protokolleinträge älter als AUDIT_LOG_DAYS (Standard 365) löschen. 0 = nie löschen. */
export async function cleanupAuditLog() {
  const days = Number(process.env.AUDIT_LOG_DAYS ?? 365);
  if (!Number.isFinite(days) || days <= 0) return;
  await query(`DELETE FROM audit_log WHERE created_at < NOW() - ($1 || ' days')::interval`, [String(Math.floor(days))]);
}
