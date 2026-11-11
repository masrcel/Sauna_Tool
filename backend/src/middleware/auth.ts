import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db/client';

export interface AuthUser { id: string; email: string; role: string; name: string }

export interface AuthRequest extends Request {
  user?: AuthUser;
}

const JWT_SECRET = process.env.JWT_SECRET || 'sauna-secret-change-in-production';

/**
 * Prüft das JWT und lädt den Benutzer bei jeder Anfrage frisch aus der Datenbank.
 * Dadurch greifen Deaktivierung und Rollenänderungen sofort, nicht erst nach Ablauf des Tokens.
 */
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Nicht angemeldet' });
    return;
  }
  let payload: any;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    res.status(401).json({ error: 'Token ungültig' });
    return;
  }
  try {
    const user = await queryOne<AuthUser & { active: boolean }>(
      'SELECT id, email, role, name, active FROM users WHERE id = $1',
      [payload.id]
    );
    if (!user || !user.active) {
      res.status(401).json({ error: 'Konto deaktiviert oder nicht vorhanden' });
      return;
    }
    req.user = { id: user.id, email: user.email, role: user.role, name: user.name };
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

export function signToken(payload: AuthUser) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
