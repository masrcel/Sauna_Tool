import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import { query, queryOne } from '../db/client';
import { requireAdmin, requireAuth, isAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/avatars'),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', requireAuth, async (_, res) => {
  const users = await query('SELECT id, name, email, role, avatar_url, active FROM users ORDER BY name');
  res.json(users);
});

router.post('/', requireAdmin, async (req: AuthRequest, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    res.status(400).json({ error: 'Name, E-Mail und Passwort erforderlich' });
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  const user = await queryOne(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role, avatar_url',
    [name, email, hash, role || 'staff']
  );
  res.status(201).json(user);
});

router.put('/:id', requireAdmin, async (req: AuthRequest, res) => {
  const { name, email, role, active, password } = req.body;
  const { id } = req.params;
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    await query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, id]);
  }
  const user = await queryOne(
    'UPDATE users SET name=$1, email=$2, role=$3, active=$4, updated_at=NOW() WHERE id=$5 RETURNING id, name, email, role, avatar_url, active',
    [name, email, role, active ?? true, id]
  );
  res.json(user);
});

// Eigenes Profilfoto: jeder; fremde Profilfotos: nur Admins (Prüfung vor dem Upload)
function canEditAvatar(req: AuthRequest, res: any, next: any) {
  if (!isAdmin(req) && req.params.id !== req.user!.id) {
    res.status(403).json({ error: 'Du darfst nur dein eigenes Profilbild ändern' });
    return;
  }
  next();
}

router.post('/:id/avatar', requireAuth, canEditAvatar, upload.single('avatar'), async (req: AuthRequest, res) => {
  if (!req.file) { res.status(400).json({ error: 'Kein Bild hochgeladen' }); return; }
  const url = `/uploads/avatars/${req.file.filename}`;
  await query('UPDATE users SET avatar_url=$1 WHERE id=$2', [url, req.params.id]);
  res.json({ avatar_url: url });
});

router.delete('/:id', requireAdmin, async (req, res) => {
  await query('UPDATE users SET active=false WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
