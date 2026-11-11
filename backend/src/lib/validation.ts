import { Router } from 'express';
import { z, ZodErrorMap, ZodIssueCode } from 'zod';
import { HttpError } from './errors';

/** Deutsche Standard-Fehlermeldungen für alle Schemas */
const germanErrorMap: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') return { message: 'ist erforderlich' };
      if (issue.expected === 'number' || issue.expected === 'integer') return { message: 'muss eine Zahl sein' };
      if (issue.expected === 'string') return { message: 'muss ein Text sein' };
      if (issue.expected === 'boolean') return { message: 'muss ja/nein sein' };
      if (issue.expected === 'array') return { message: 'muss eine Liste sein' };
      if (issue.expected === 'object') return { message: 'muss ein Objekt sein' };
      return { message: 'hat einen ungültigen Typ' };
    case ZodIssueCode.too_small:
      if (issue.type === 'string') return { message: issue.minimum === 1 ? 'ist erforderlich' : `muss mindestens ${issue.minimum} Zeichen lang sein` };
      if (issue.type === 'array') return { message: `muss mindestens ${issue.minimum} Einträge haben` };
      return { message: `muss mindestens ${issue.minimum} sein` };
    case ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: `darf höchstens ${issue.maximum} Zeichen lang sein` };
      if (issue.type === 'array') return { message: `darf höchstens ${issue.maximum} Einträge haben` };
      return { message: `darf höchstens ${issue.maximum} sein` };
    case ZodIssueCode.invalid_string:
      if (issue.validation === 'uuid') return { message: 'ist keine gültige ID' };
      if (issue.validation === 'email') return { message: 'ist keine gültige E-Mail-Adresse' };
      return { message: 'hat ein ungültiges Format' };
    case ZodIssueCode.invalid_enum_value:
      return { message: `muss einer der Werte ${issue.options.map(o => `„${String(o)}“`).join(', ')} sein` };
    case ZodIssueCode.not_finite:
      return { message: 'muss eine endliche Zahl sein' };
    default:
      return { message: ctx.defaultError };
  }
};
z.setErrorMap(germanErrorMap);

// ---------- Vorverarbeitung ----------

/** Leere Eingaben ('' / null / undefined) einheitlich als null behandeln */
const blankToNull = (v: unknown) => (v === '' || v === undefined || v === null ? null : v);
/** Leere Eingaben als undefined behandeln, damit .default() greift */
const blankToUndefined = (v: unknown) => (v === '' || v === undefined || v === null ? undefined : v);
const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : v);
/** Zahlen dürfen auch als String kommen ("1.5"); "abc" wird zu NaN und damit abgelehnt */
const toNumber = (v: unknown) => (typeof v === 'string' ? Number(v.replace(',', '.')) : v);

// ---------- Bausteine ----------

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function isRealDate(s: string) {
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export const uuid = z.string().uuid();
export const optUuid = z.preprocess(blankToNull, uuid.nullable());

/** Pflicht-Text, wird getrimmt */
export const text = (max: number) => z.preprocess(trim, z.string().min(1).max(max));
/** Optionaler Text, getrimmt; leer → null */
export const optText = (max = 10_000) => z.preprocess(v => blankToNull(trim(v)), z.string().max(max).nullable());

export const time = z.string().regex(TIME_RE, 'ist keine gültige Uhrzeit (HH:MM)');
export const optTime = z.preprocess(blankToNull, time.nullable());

export const date = z.string()
  .regex(DATE_RE, 'ist kein gültiges Datum (JJJJ-MM-TT)')
  .refine(isRealDate, 'ist kein gültiges Datum');

export const color = z.string().regex(COLOR_RE, 'ist keine gültige Farbe (#RRGGBB)');
export const optColor = z.preprocess(blankToNull, color.nullable());

/** Optionale Dosierung o. Ä. (DECIMAL(6,2)) */
export const optAmount = z.preprocess(v => toNumber(blankToNull(v)), z.number().finite().min(0).max(9999.99).nullable());

/** Ganzzahl mit Standardwert, wenn leer */
export const intWithDefault = (def: number, min: number, max: number) =>
  z.preprocess(v => toNumber(blankToUndefined(v)), z.number().int().min(min).max(max).default(def));

export const boolWithDefault = (def: boolean) => z.preprocess(blankToUndefined, z.boolean().default(def));

/** Liste, bei der null/fehlend als leere Liste gilt */
export const list = <T extends z.ZodTypeAny>(item: T, max: number) =>
  z.preprocess(blankToUndefined, z.array(item).max(max).default([]));

/** Duft-Zuordnung (Vorlage, Plan, Tagesvorlage). Einträge ohne scent_id werden später herausgefiltert. */
export const scentEntry = z.object({
  scent_id: optUuid,
  dosage_ml: optAmount,
  dosage_note: optText(500),
});
export const scentList = list(scentEntry, 50);

/** Body prüfen; bei Fehler wirft zod einen ZodError, den der zentrale Error-Handler in 400 übersetzt. */
export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(data ?? {});
}

// ---------- URL-Parameter ----------

const UUID_PARAMS = ['id', 'scheduleId', 'commentId'];
const DATE_PARAMS = ['date'];

/**
 * Prüft bekannte URL-Parameter (:id, :scheduleId, :commentId → UUID; :date → JJJJ-MM-TT),
 * bevor ein Handler läuft. Ungültige Werte ergeben 400 statt eines Datenbankfehlers.
 */
export function validateParams(router: Router) {
  for (const name of UUID_PARAMS) {
    router.param(name, (_req, _res, next, value) => {
      next(uuid.safeParse(value).success ? undefined : new HttpError(400, `Ungültige ID (${name})`));
    });
  }
  for (const name of DATE_PARAMS) {
    router.param(name, (_req, _res, next, value) => {
      next(date.safeParse(value).success ? undefined : new HttpError(400, 'Ungültiges Datum (JJJJ-MM-TT erwartet)'));
    });
  }
}
