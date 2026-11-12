import { Response, NextFunction } from 'express';
import { query, queryOne } from '../db/client';
import { AuthRequest } from './auth';
import { writeAudit, AuditAction } from '../lib/audit';

/**
 * Protokoll-Middleware: Jede erfolgreiche Änderung (POST/PUT/DELETE) eines angemeldeten
 * Mitarbeiters landet automatisch in der Tabelle audit_log – mit Wer, Wann, Was.
 *
 *  - Bearbeiten: Werte vorher → nachher (nur geänderte Felder)
 *  - Löschen:    der gelöschte Datensatz
 *  - Anlegen:    die übergebenen Daten
 *
 * IDs (Sauna, Mitarbeiter, Vorlage, Duft) werden in Namen übersetzt, damit das Protokoll
 * auch dann lesbar bleibt, wenn der Datensatz später gelöscht wird.
 *
 * Neue Routen: unten in RULES eintragen. Nicht erfasste Änderungen werden trotzdem
 * protokolliert (allgemeiner Eintrag mit Methode + Pfad).
 * Anmeldung (/auth) und Backup (/backup) protokollieren selbst.
 */

interface Ctx {
  /** Regex-Treffer des Pfads (Gruppen = IDs/Datum) */
  m: RegExpMatchArray;
  body: any;
  resBody: any;
  before: any;
}

interface Rule {
  method: 'POST' | 'PUT' | 'DELETE';
  path: RegExp;
  entity: string;
  action: AuditAction;
  /** Verb im Satz, z. B. „geändert“ */
  verb: string;
  /** Datensatz vor der Änderung laden (für vorher/nachher bzw. gelöschte Daten). $1 = ID */
  snapshot?: string;
  /** Name des Datensatzes für den Satz. $1 = ID (aus dem Pfad oder der Antwort) */
  labelSql?: string;
  /** Gruppe im Pfad-Regex mit der ID (Standard 1) */
  idGroup?: number;
  /** Text-Zusatz am Satzende */
  suffix?: (c: Ctx) => string | undefined;
}

const UUID = '([0-9a-fA-F-]{36})';
const DATE = '(\\d{4}-\\d{2}-\\d{2})';
const re = (s: string) => new RegExp(`^${s}/?$`);

const SCHEDULE_LABEL = `
  SELECT COALESCE(s.custom_name, t.name, 'Aufguss') || ' ' || TO_CHAR(s.start_time, 'HH24:MI') AS label
  FROM aufguss_schedule s LEFT JOIN aufguss_templates t ON t.id = s.template_id WHERE s.id = $1`;
const SCHEDULE_SNAPSHOT = `
  SELECT s.*, COALESCE(
    (SELECT json_agg(json_build_object('scent_id', ss.scent_id, 'dosage_ml', ss.dosage_ml, 'dosage_note', ss.dosage_note) ORDER BY ss.sort_order)
     FROM schedule_scents ss WHERE ss.schedule_id = s.id), '[]') AS scents
  FROM aufguss_schedule s WHERE s.id = $1`;
const TEMPLATE_SNAPSHOT = `
  SELECT t.*, COALESCE(
    (SELECT json_agg(json_build_object('scent_id', ts.scent_id, 'dosage_ml', ts.dosage_ml, 'dosage_note', ts.dosage_note) ORDER BY ts.sort_order)
     FROM template_scents ts WHERE ts.template_id = t.id), '[]') AS scents
  FROM aufguss_templates t WHERE t.id = $1`;

const fmtDate = (d?: string) => (d ? d.split('-').reverse().join('.') : '');
const onDate = (c: Ctx) => (c.m[1] ? `am ${fmtDate(c.m[1])}` : undefined);

const RULES: Rule[] = [
  // Mitarbeiter
  { method: 'POST',   path: re('/users'), entity: 'Mitarbeiter', action: 'create', verb: 'angelegt', labelSql: 'SELECT name AS label FROM users WHERE id=$1' },
  { method: 'PUT',    path: re(`/users/${UUID}`), entity: 'Mitarbeiter', action: 'update', verb: 'geändert', snapshot: 'SELECT * FROM users WHERE id=$1', labelSql: 'SELECT name AS label FROM users WHERE id=$1' },
  { method: 'POST',   path: re(`/users/${UUID}/avatar`), entity: 'Mitarbeiter', action: 'update', verb: 'Profilbild geändert', labelSql: 'SELECT name AS label FROM users WHERE id=$1' },
  { method: 'DELETE', path: re(`/users/${UUID}`), entity: 'Mitarbeiter', action: 'delete', verb: 'deaktiviert', snapshot: 'SELECT * FROM users WHERE id=$1', labelSql: 'SELECT name AS label FROM users WHERE id=$1' },

  // Saunen
  { method: 'POST',   path: re('/saunas'), entity: 'Sauna', action: 'create', verb: 'angelegt', labelSql: 'SELECT name AS label FROM saunas WHERE id=$1' },
  { method: 'PUT',    path: re(`/saunas/${UUID}`), entity: 'Sauna', action: 'update', verb: 'geändert', snapshot: 'SELECT * FROM saunas WHERE id=$1', labelSql: 'SELECT name AS label FROM saunas WHERE id=$1' },
  { method: 'DELETE', path: re(`/saunas/${UUID}`), entity: 'Sauna', action: 'delete', verb: 'deaktiviert', snapshot: 'SELECT * FROM saunas WHERE id=$1', labelSql: 'SELECT name AS label FROM saunas WHERE id=$1' },

  // Düfte
  { method: 'POST',   path: re('/scents'), entity: 'Duft', action: 'create', verb: 'angelegt', labelSql: 'SELECT name AS label FROM scents WHERE id=$1' },
  { method: 'PUT',    path: re(`/scents/${UUID}`), entity: 'Duft', action: 'update', verb: 'geändert', snapshot: 'SELECT * FROM scents WHERE id=$1', labelSql: 'SELECT name AS label FROM scents WHERE id=$1' },
  { method: 'DELETE', path: re(`/scents/${UUID}`), entity: 'Duft', action: 'delete', verb: 'gelöscht', snapshot: 'SELECT * FROM scents WHERE id=$1', labelSql: 'SELECT name AS label FROM scents WHERE id=$1' },

  // Aufguss-Vorlagen
  { method: 'POST',   path: re('/templates'), entity: 'Aufguss-Vorlage', action: 'create', verb: 'angelegt', labelSql: 'SELECT name AS label FROM aufguss_templates WHERE id=$1' },
  { method: 'PUT',    path: re(`/templates/${UUID}`), entity: 'Aufguss-Vorlage', action: 'update', verb: 'geändert', snapshot: TEMPLATE_SNAPSHOT, labelSql: 'SELECT name AS label FROM aufguss_templates WHERE id=$1' },
  { method: 'DELETE', path: re(`/templates/${UUID}`), entity: 'Aufguss-Vorlage', action: 'delete', verb: 'gelöscht', snapshot: TEMPLATE_SNAPSHOT, labelSql: 'SELECT name AS label FROM aufguss_templates WHERE id=$1' },

  // Tagesplan
  { method: 'POST',   path: re('/events'), entity: 'Tagesplan', action: 'update', verb: 'gespeichert', suffix: c => c.body?.event_date ? `für ${fmtDate(c.body.event_date)}` : undefined },
  { method: 'POST',   path: re(`/events/${DATE}/schedule`), entity: 'Aufguss', action: 'create', verb: 'angelegt', labelSql: SCHEDULE_LABEL, idGroup: 99, suffix: onDate },
  { method: 'PUT',    path: re(`/events/${DATE}/schedule/${UUID}`), entity: 'Aufguss', action: 'update', verb: 'geändert', idGroup: 2, snapshot: SCHEDULE_SNAPSHOT, labelSql: SCHEDULE_LABEL, suffix: onDate },
  { method: 'POST',   path: re(`/events/${DATE}/schedule/${UUID}/claim`), entity: 'Aufguss', action: 'update', verb: 'selbst übernommen', idGroup: 2, labelSql: SCHEDULE_LABEL, suffix: onDate },
  { method: 'POST',   path: re(`/events/${DATE}/schedule/${UUID}/scents`), entity: 'Aufguss', action: 'update', verb: 'Düfte geändert', idGroup: 2, snapshot: SCHEDULE_SNAPSHOT, labelSql: SCHEDULE_LABEL, suffix: onDate },
  { method: 'DELETE', path: re(`/events/${DATE}/schedule/${UUID}`), entity: 'Aufguss', action: 'delete', verb: 'gelöscht', idGroup: 2, snapshot: SCHEDULE_SNAPSHOT, labelSql: SCHEDULE_LABEL, suffix: onDate },

  // Tagesvorlagen
  { method: 'POST',   path: re('/day-templates'), entity: 'Tagesvorlage', action: 'create', verb: 'angelegt', labelSql: 'SELECT name AS label FROM day_templates WHERE id=$1' },
  { method: 'POST',   path: re(`/day-templates/from-date/${DATE}`), entity: 'Tagesvorlage', action: 'create', verb: 'angelegt', idGroup: 99, labelSql: 'SELECT name AS label FROM day_templates WHERE id=$1', suffix: c => `aus dem Plan vom ${fmtDate(c.m[1])}` },
  { method: 'PUT',    path: re(`/day-templates/${UUID}`), entity: 'Tagesvorlage', action: 'update', verb: 'geändert', snapshot: 'SELECT * FROM day_templates WHERE id=$1', labelSql: 'SELECT name AS label FROM day_templates WHERE id=$1' },
  { method: 'DELETE', path: re(`/day-templates/${UUID}`), entity: 'Tagesvorlage', action: 'delete', verb: 'gelöscht', snapshot: 'SELECT * FROM day_templates WHERE id=$1', labelSql: 'SELECT name AS label FROM day_templates WHERE id=$1' },
  {
    method: 'POST', path: re(`/day-templates/${UUID}/apply`), entity: 'Tagesvorlage', action: 'update', verb: 'angewendet',
    labelSql: 'SELECT name AS label FROM day_templates WHERE id=$1',
    suffix: c => {
      const n = Array.isArray(c.body?.dates) ? c.body.dates.length : 0;
      return `auf ${n} Tag${n === 1 ? '' : 'e'}${c.body?.mode === 'replace' ? ' (bestehende Aufgüsse ersetzt)' : ''}`;
    },
  },

  // Ideen
  { method: 'POST',   path: re('/ideas'), entity: 'Idee', action: 'create', verb: 'angelegt', labelSql: 'SELECT title AS label FROM ideas WHERE id=$1' },
  { method: 'PUT',    path: re(`/ideas/${UUID}`), entity: 'Idee', action: 'update', verb: 'geändert', snapshot: 'SELECT * FROM ideas WHERE id=$1', labelSql: 'SELECT title AS label FROM ideas WHERE id=$1' },
  { method: 'DELETE', path: re(`/ideas/${UUID}`), entity: 'Idee', action: 'delete', verb: 'gelöscht', snapshot: 'SELECT * FROM ideas WHERE id=$1', labelSql: 'SELECT title AS label FROM ideas WHERE id=$1' },
  { method: 'POST',   path: re(`/ideas/${UUID}/comments`), entity: 'Idee', action: 'create', verb: 'kommentiert', labelSql: 'SELECT title AS label FROM ideas WHERE id=$1' },
  { method: 'DELETE', path: re(`/ideas/${UUID}/comments/${UUID}`), entity: 'Kommentar', action: 'delete', verb: 'gelöscht', idGroup: 2, snapshot: 'SELECT * FROM idea_comments WHERE id=$1', labelSql: 'SELECT LEFT(content, 60) AS label FROM idea_comments WHERE id=$1' },

  // Einstellungen
  { method: 'PUT',    path: re('/settings'), entity: 'Einstellungen', action: 'update', verb: 'geändert', snapshot: `SELECT json_object_agg(key, value) AS s FROM app_settings` },
];

/** Diese Bereiche protokollieren selbst bzw. ändern nichts */
const SKIP_PREFIXES = ['/auth', '/backup', '/audit'];

// ---------- Hilfsfunktionen ----------

/** Felder, die beim Vergleich vorher/nachher keine Rolle spielen */
const IGNORE_KEYS = new Set(['id', 'created_at', 'updated_at', 'created_by', 'event_id', 'sort_order', 'token_version', 'password_hash']);

/** Werte vergleichbar machen: "5.00" == 5, "14:00:00" == "14:00", '' == null */
function norm(v: any, key?: string): any {
  if (v === undefined || v === '' ) return null;
  if (Array.isArray(v)) {
    if (key === 'scents') {
      return v.filter(s => s?.scent_id).map(s => ({
        scent_id: s.scent_id, dosage_ml: norm(s.dosage_ml), dosage_note: norm(s.dosage_note),
      }));
    }
    return v.map(x => norm(x));
  }
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') {
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    if (/^\d{2}:\d{2}:00$/.test(v)) return v.slice(0, 5);
    return v;
  }
  if (v && typeof v === 'object') {
    const o: Record<string, any> = {};
    for (const [k, x] of Object.entries(v)) o[k] = norm(x, k);
    return o;
  }
  return v;
}

/** Nur die Felder, die sich wirklich geändert haben: { feld: { from, to } } */
function diff(before: any, body: any) {
  const changes: Record<string, any> = {};
  if (!body || typeof body !== 'object') return changes;
  for (const key of Object.keys(body)) {
    if (IGNORE_KEYS.has(key)) continue;
    if (key === 'password') {
      if (body.password) changes.password = '(neu gesetzt)';
      continue;
    }
    // Felder, die es vorher nicht gab (z. B. Aufgüsse einer Tagesvorlage): nur neuen Wert zeigen
    const from = before && key in before ? norm(before[key], key) : undefined;
    const to = norm(body[key], key);
    if (from === undefined) {
      changes[key] = { to };
      continue;
    }
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[key] = { from, to };
  }
  return changes;
}

function stripIgnored(row: any) {
  if (!row || typeof row !== 'object') return row;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) if (!IGNORE_KEYS.has(k) || k === 'id') out[k] = norm(v, k);
  return out;
}

/** Fremd-IDs → Namen (rekursiv), damit das Protokoll lesbar ist */
const ID_TABLES: Record<string, string> = {
  sauna_id: 'saunas',
  assigned_user_id: 'users',
  user_id: 'users',
  template_id: 'aufguss_templates',
  scent_id: 'scents',
};
const UUID_RE = /^[0-9a-f-]{36}$/i;

async function resolveNames<T>(value: T): Promise<T> {
  // table = Tabelle, auf die der aktuelle Wert zeigt (ID-Feld selbst oder dessen { from, to })
  const childTable = (k: string, table?: string) => ID_TABLES[k] ?? (k === 'from' || k === 'to' ? table : undefined);
  const wanted: Record<string, Set<string>> = {};
  const collect = (v: any, table?: string) => {
    if (typeof v === 'string') {
      if (table && UUID_RE.test(v)) (wanted[table] ??= new Set()).add(v);
      return;
    }
    if (Array.isArray(v)) { v.forEach(x => collect(x)); return; }
    if (!v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) collect(x, childTable(k, table));
  };
  collect(value);

  const names = new Map<string, string>();
  for (const [table, ids] of Object.entries(wanted)) {
    const rows = await query<{ id: string; name: string }>(`SELECT id, name FROM ${table} WHERE id = ANY($1::uuid[])`, [[...ids]]);
    for (const r of rows) names.set(r.id, r.name);
  }

  const replace = (v: any, table?: string): any => {
    if (typeof v === 'string') return table && names.has(v) ? names.get(v) : v;
    if (Array.isArray(v)) return v.map(x => replace(x));
    if (!v || typeof v !== 'object') return v;
    const out: Record<string, any> = {};
    for (const [k, x] of Object.entries(v)) out[k] = replace(x, childTable(k, table));
    return out;
  };
  return replace(value);
}

async function label(sql: string | undefined, id: string | undefined): Promise<string | null> {
  if (!sql || !id) return null;
  try {
    const row = await queryOne<{ label: string }>(sql, [id]);
    return row?.label ?? null;
  } catch { return null; }
}

// ---------- Middleware ----------

export async function auditMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  // Nur Änderungen angemeldeter Benutzer (ohne Token lehnt requireAuth ohnehin ab)
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) || !req.headers.authorization) { next(); return; }
  const path = req.path;
  if (SKIP_PREFIXES.some(p => path === p || path.startsWith(`${p}/`))) { next(); return; }

  const rule = RULES.find(r => r.method === method && r.path.test(path));
  const m = rule ? path.match(rule.path)! : ([] as unknown as RegExpMatchArray);
  const pathId = rule ? m[rule.idGroup ?? 1] : undefined;

  // Zustand VOR der Änderung festhalten
  let before: any = null;
  let labelBefore: string | null = null;
  if (rule && (method === 'PUT' || method === 'DELETE' || rule.snapshot)) {
    try {
      if (rule.snapshot) {
        const row = await queryOne<any>(rule.snapshot, rule.snapshot.includes('$1') ? [pathId] : []);
        before = row && 's' in row && Object.keys(row).length === 1 ? row.s : row;
      }
      labelBefore = await label(rule.labelSql, pathId);
    } catch (err) {
      console.error('Protokoll: Vorher-Zustand nicht lesbar:', err);
    }
  }

  // Antwort mitschneiden (für die ID neu angelegter Datensätze)
  let resBody: any;
  const originalJson = res.json.bind(res);
  res.json = (b: any) => { resBody = b; return originalJson(b); };

  res.on('finish', () => {
    if (res.statusCode >= 400 || !req.user) return;
    const user = req.user;
    const body = Buffer.isBuffer(req.body) ? undefined : req.body;
    (async () => {
      if (!rule) {
        await writeAudit({
          userId: user.id, userName: user.name, action: method === 'DELETE' ? 'delete' : method === 'POST' ? 'create' : 'update',
          summary: `${method} ${path}`, details: { data: body }, ip: req.ip,
        });
        return;
      }
      const ctx: Ctx = { m, body, resBody, before };
      const id = pathId ?? (resBody && typeof resBody === 'object' ? resBody.id : undefined);
      const name = (await label(rule.labelSql, id)) ?? labelBefore;

      let details: any;
      if (rule.action === 'delete') details = { deleted: stripIgnored(before) };
      else if (before) details = { changes: diff(before, body) };
      else if (body && Object.keys(body).length) details = { data: stripIgnored(body) };
      // Antwort bei „Tagesvorlage anwenden“: was wurde angelegt/übersprungen
      if (rule.path.source.includes('apply') && resBody) details = { ...details, result: resBody };
      details = details ? await resolveNames(details) : undefined;

      const parts = [rule.entity, name ? `„${name}“` : null, rule.suffix?.(ctx), rule.verb].filter(Boolean);
      await writeAudit({
        userId: user.id,
        userName: user.name,
        action: rule.action,
        entity: rule.entity,
        entityId: id ?? null,
        summary: parts.join(' '),
        details,
        ip: req.ip,
      });
    })().catch(err => console.error('Protokoll fehlgeschlagen:', err));
  });

  next();
}
