import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { query, queryOne } from '../db/client';

export interface AuthUser { id: string; email: string; role: string; name: string }

export interface AuthRequest extends Request {
  user?: AuthUser;
  /** Kennung und Ablauf des verwendeten Tokens (für das Abmelden) */
  token?: { jti: string; exp: number };
}

interface TokenPayload { id: string; ver: number; jti: string; exp: number }

const JWT_SECRET = process.env.JWT_SECRET || 'sauna-secret-change-in-production';

/**
 * Prüft das JWT und lädt den Benutzer bei jeder Anfrage frisch aus der Datenbank.
 * Dadurch greifen Deaktivierung und Rollenänderungen sofort, nicht erst nach Ablauf des Tokens.
 * Ungültig ist ein Token außerdem, wenn
 *  - es beim Abmelden widerrufen wurde (Tabelle revoked_tokens), oder
 *  - die token_version des Benutzers inzwischen erhöht wurde (z. B. nach Passwortänderung).
 */
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Nicht angemeldet' });
    return;
  }
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
  } catch {
    res.status(401).json({ error: 'Token ungültig' });
    return;
  }
  // Tokens aus älteren Versionen (ohne ver/jti) werden nicht mehr akzeptiert
  if (typeof payload.id !== 'string' || typeof payload.ver !== 'number' || typeof payload.jti !== 'string') {
    res.status(401).json({ error: 'Token ungültig' });
    return;
  }
  try {
    const user = await queryOne<AuthUser & { active: boolean; token_version: number; revoked: boolean }>(
      `SELECT id, email, role, name, active, token_version,
              EXISTS (SELECT 1 FROM revoked_tokens WHERE jti = $2) AS revoked
       FROM users WHERE id = $1`,
      [payload.id, payload.jti]
    );
    if (!user || !user.active) {
      res.status(401).json({ error: 'Konto deaktiviert oder nicht vorhanden' });
      return;
    }
    if (user.revoked || user.token_version !== payload.ver) {
      res.status(401).json({ error: 'Sitzung abgelaufen, bitte neu anmelden' });
      return;
    }
    req.user = { id: user.id, email: user.email, role: user.role, name: user.name };
    req.token = { jti: payload.jti, exp: payload.exp };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Keine Berechtigung' });
      return;
    }
    next();
  });
}

export function isAdmin(req: AuthRequest) {
  return req.user?.role === 'admin';
}

/** Neues Token mit der aktuellen token_version des Benutzers. Rolle/Name stehen bewusst nicht drin – sie kommen bei jeder Anfrage frisch aus der DB. */
export function signToken(user: { id: string; token_version: number }) {
  return jwt.sign({ id: user.id, ver: user.token_version }, JWT_SECRET, {
    expiresIn: '7d',
    algorithm: 'HS256',
    jwtid: randomUUID(),
  });
}

/** Widerruft genau dieses eine Token (Abmelden auf diesem Gerät). */
export async function revokeToken(t: { jti: string; exp: number }) {
  await query(
    'INSERT INTO revoked_tokens (jti, expires_at) VALUES ($1, to_timestamp($2)) ON CONFLICT (jti) DO NOTHING',
    [t.jti, t.exp]
  );
}

/** Macht alle Tokens eines Benutzers ungültig (alle Geräte). */
export async function revokeAllTokens(userId: string) {
  await query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [userId]);
}

/** Abgelaufene Einträge aufräumen – danach lehnt jwt.verify die Tokens ohnehin ab. */
export async function cleanupRevokedTokens() {
  await query('DELETE FROM revoked_tokens WHERE expires_at < NOW()');
}
