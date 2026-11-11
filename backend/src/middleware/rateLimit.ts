import rateLimit from 'express-rate-limit';

const WINDOW_MINUTES = 15;

/**
 * Schutz gegen Passwort-Raten: pro IP höchstens 10 fehlgeschlagene Logins in 15 Minuten.
 * Erfolgreiche Logins zählen nicht mit, damit sich niemand durch normales Anmelden aussperrt.
 * Zusätzlich begrenzt nginx die Anfragerate auf /api/auth/login (siehe frontend/nginx.conf).
 */
export const loginLimiter = rateLimit({
  windowMs: WINDOW_MINUTES * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: `Zu viele fehlgeschlagene Anmeldeversuche. Bitte in ${WINDOW_MINUTES} Minuten erneut versuchen.` },
});

/**
 * Zusätzlich pro Konto (E-Mail): höchstens 10 fehlgeschlagene Logins in 15 Minuten, egal von
 * welcher IP. Bremst verteilte Angriffe (viele IPs) auf ein einzelnes Konto wie admin@sauna.local.
 * Nebenwirkung: Bei einem laufenden Angriff ist das betroffene Konto bis zu 15 Minuten gesperrt.
 * Anfragen ohne E-Mail lässt dieser Limiter durch (die IP-Grenze oben greift trotzdem).
 */
export const loginAccountLimiter = rateLimit({
  windowMs: WINDOW_MINUTES * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: req => typeof req.body?.email !== 'string' || !req.body.email.trim(),
  keyGenerator: req => `account:${String(req.body.email).trim().toLowerCase().slice(0, 255)}`,
  message: { error: `Zu viele fehlgeschlagene Anmeldeversuche für dieses Konto. Bitte in ${WINDOW_MINUTES} Minuten erneut versuchen.` },
});
