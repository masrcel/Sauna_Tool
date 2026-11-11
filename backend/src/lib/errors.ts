import { Request, Response, NextFunction, Router } from 'express';
import { ZodError } from 'zod';

/** Fehler mit HTTP-Status, deren Meldung bedenkenlos an den Client gehen darf. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Macht aus einem (evtl. async) Handler einen, dessen Fehler an next() gehen.
 * Fehler-Middleware (4 Parameter) und Nicht-Funktionen bleiben unverändert.
 */
function wrapHandler(fn: unknown): unknown {
  if (Array.isArray(fn)) return fn.map(wrapHandler);
  if (typeof fn !== 'function' || fn.length === 4) return fn;
  return function (req: Request, res: Response, next: NextFunction) {
    try {
      const result = fn(req, res, next);
      if (result && typeof result.then === 'function') result.catch(next);
    } catch (err) {
      next(err);
    }
  };
}

const WRAPPED_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'all'] as const;

/**
 * Wie express.Router(), aber jeder Route-Handler wird automatisch abgesichert:
 * Ein Fehler oder eine abgelehnte Promise landet im zentralen Error-Handler,
 * statt den Request hängen zu lassen oder den Prozess zu gefährden.
 */
export function createRouter(): Router {
  const router = Router();
  for (const method of WRAPPED_METHODS) {
    const original = (router as any)[method].bind(router);
    (router as any)[method] = (...args: unknown[]) => original(...args.map(wrapHandler));
  }
  return router;
}

/** „entries.0.start_time“ → „entries[1].start_time“ (menschenlesbarer Index ab 1) */
function formatPath(path: (string | number)[]): string {
  return path.reduce<string>((acc, part) =>
    typeof part === 'number' ? `${acc}[${part + 1}]` : acc ? `${acc}.${part}` : part, '');
}

function zodMessage(err: ZodError): string {
  const issue = err.issues[0];
  if (!issue) return 'Ungültige Eingabe';
  const field = formatPath(issue.path);
  return field ? `${field}: ${issue.message}` : issue.message;
}

/** Postgres-Fehlercodes, die auf ungültige Eingaben (nicht auf Serverfehler) hinweisen */
function pgError(err: any): { status: number; message: string } | null {
  if (typeof err?.code !== 'string' || typeof err?.severity !== 'string') return null;
  switch (err.code) {
    case '23505':
      if (err.constraint === 'users_email_key') return { status: 409, message: 'Diese E-Mail-Adresse wird bereits verwendet' };
      return { status: 409, message: 'Dieser Eintrag existiert bereits' };
    case '23503': return { status: 400, message: 'Ein verknüpfter Eintrag existiert nicht (mehr) oder wird noch verwendet' };
    case '23502': return { status: 400, message: 'Ein Pflichtfeld fehlt' };
    case '22001': return { status: 400, message: 'Ein Text ist zu lang' };
    case '22P02': return { status: 400, message: 'Ungültige ID oder ungültiger Wert' };
    case '22007':
    case '22008': return { status: 400, message: 'Ungültiges Datum oder ungültige Uhrzeit' };
    case '22003': return { status: 400, message: 'Zahl außerhalb des erlaubten Bereichs' };
    default: return null;
  }
}

/** Zentraler Error-Handler – als letzte Middleware registrieren. */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) { next(err); return; }

  if (err instanceof HttpError) { res.status(err.status).json({ error: err.message }); return; }
  if (err instanceof ZodError) { res.status(400).json({ error: zodMessage(err) }); return; }
  if (err?.type === 'entity.parse.failed') { res.status(400).json({ error: 'Ungültiges JSON im Request' }); return; }
  if (err?.type === 'entity.too.large') { res.status(413).json({ error: 'Anfrage ist zu groß' }); return; }

  const pg = pgError(err);
  if (pg) { res.status(pg.status).json({ error: pg.message }); return; }

  // Unerwartete Fehler: Details nur ins Log, nicht an den Client
  console.error(`Unhandled error bei ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({ error: 'Interner Serverfehler' });
}
