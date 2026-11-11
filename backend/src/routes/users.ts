import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import { z } from 'zod';
import { query, queryOne } from '../db/client';
import { requireAdmin, requireAuth, isAdmin, signToken, AuthRequest } from '../middleware/auth';
import { createRouter, HttpError } from '../lib/errors';
import { parse, validateParams, text, boolWithDefault } from '../lib/validation';

const router = createRouter();
validateParams(router);

const email = z.preprocess(v => (typeof v === 'string' ? v.trim() : v), z.string().min(1).max(255).email());
const role = z.preprocess(v => (v === '' || v == null ? undefined : v), z.enum(['admin', 'staff']).default('staff'));
// Mindestens 10 Zeichen; bcrypt berücksichtigt nur die ersten 72 Byte
const MIN_PASSWORD_LENGTH = 10;
const password = z.string().min(MIN_PASSWORD_LENGTH).max(72);

const createUserSchema = z.object({
  name: text(100),
  email,
  password,
  role,
});

const updateUserSchema = z.object({
  name: text(100),
  email,
  role,
  active: boolWithDefault(true),
  // leer = Passwort unverändert lassen
  password: z.preprocess(v => (v === '' || v == null ? undefined : v), password.optional()),
});

// Nur JPG und PNG erlaubt – Dateiendung wird aus dem MIME-Typ abgeleitet, nicht vom Dateinamen übernommen
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
};
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/avatars'),
  filename: (_, file, cb) => {
    cb(null, `${Date.now()}${ALLOWED_IMAGE_TYPES[file.mimetype]}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_IMAGE_TYPES[file.mimetype] && ALLOWED_EXTENSIONS.includes(ext)) cb(null, true);
    else cb(new Error('INVALID_IMAGE_TYPE'));
  },
});

// Multer-Fehler (falscher Dateityp, zu groß) als verständliche 400er-Antwort zurückgeben
function avatarUpload(req: AuthRequest, res: any, next: any) {
  upload.single('avatar')(req, res, (err: any) => {
    if (!err) { next(); return; }
    if (err.message === 'INVALID_IMAGE_TYPE') next(new HttpError(400, 'Nur Bilder im Format JPG oder PNG sind erlaubt'));
    else if (err.code === 'LIMIT_FILE_SIZE') next(new HttpError(400, 'Das Bild darf maximal 5 MB groß sein'));
    else if (err instanceof multer.MulterError) next(new HttpError(400, 'Upload fehlgeschlagen: ungültige Anfrage'));
    else next(err);
  });
}

router.get('/', requireAuth, async (_, res) => {
  const users = await query('SELECT id, name, email, role, avatar_url, active FROM users ORDER BY name');
  res.json(users);
});

router.post('/', requireAdmin, async (req: AuthRequest, res) => {
  const { name, email, password, role } = parse(createUserSchema, req.body);
  const hash = await bcrypt.hash(password, 10);
  const user = await queryOne(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role, avatar_url',
    [name, email, hash, role]
  );
  res.status(201).json(user);
});

router.put('/:id', requireAdmin, async (req: AuthRequest, res) => {
  const { name, email, role, active, password } = parse(updateUserSchema, req.body);
  const { id } = req.params;
  const hash = password ? await bcrypt.hash(password, 10) : null;
  // Neues Passwort oder Deaktivierung: alle bestehenden Sitzungen des Mitarbeiters beenden
  const revoke = !!hash || !active;
  const user = await queryOne<any>(
    `UPDATE users SET name=$1, email=$2, role=$3, active=$4, updated_at=NOW(),
       password_hash = COALESCE($6, password_hash),
       token_version = token_version + CASE WHEN $7 THEN 1 ELSE 0 END
     WHERE id=$5 RETURNING id, name, email, role, avatar_url, active, token_version`,
    [name, email, role, active, id, hash, revoke]
  );
  if (!user) throw new HttpError(404, 'Mitarbeiter nicht gefunden');
  const { token_version, ...result } = user;
  // Eigenes Passwort geändert: dieses Gerät bekommt ein neues Token und bleibt angemeldet
  if (revoke && active && id === req.user!.id) {
    res.json({ ...result, token: signToken({ id, token_version }) });
    return;
  }
  res.json(result);
});

// Eigenes Profilfoto: jeder; fremde Profilfotos: nur Admins (Prüfung vor dem Upload)
function canEditAvatar(req: AuthRequest, res: any, next: any) {
  if (!isAdmin(req) && req.params.id !== req.user!.id) {
    res.status(403).json({ error: 'Du darfst nur dein eigenes Profilbild ändern' });
    return;
  }
  next();
}

router.post('/:id/avatar', requireAuth, canEditAvatar, avatarUpload, async (req: AuthRequest, res) => {
  if (!req.file) { res.status(400).json({ error: 'Kein Bild hochgeladen' }); return; }
  const url = `/uploads/avatars/${req.file.filename}`;
  await query('UPDATE users SET avatar_url=$1 WHERE id=$2', [url, req.params.id]);
  res.json({ avatar_url: url });
});

router.delete('/:id', requireAdmin, async (req, res) => {
  // Deaktivieren beendet auch alle Sitzungen (alte Tokens bleiben ungültig, falls später reaktiviert)
  await query('UPDATE users SET active=false, token_version = token_version + 1 WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
