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
