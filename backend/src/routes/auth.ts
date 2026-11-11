import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { queryOne } from '../db/client';
import { signToken, requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
    return;
  }
  const user = await queryOne<any>('SELECT * FROM users WHERE email = $1 AND active = true', [email]);
  if (!user) {
    res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    return;
  }
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    return;
  }
  const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_url: user.avatar_url } });
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const user = await queryOne<any>('SELECT id, name, email, role, avatar_url FROM users WHERE id = $1', [req.user!.id]);
  res.json(user);
});

export default router;
