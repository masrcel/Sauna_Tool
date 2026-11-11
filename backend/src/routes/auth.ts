import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { queryOne } from '../db/client';
import { signToken, requireAuth, revokeToken, AuthRequest } from '../middleware/auth';
import { loginLimiter, loginAccountLimiter } from '../middleware/rateLimit';
import { createRouter } from '../lib/errors';
import '../lib/validation'; // deutsche Fehlermeldungen für zod

const router = createRouter();

// Vergleichs-Hash für unbekannte E-Mails: So dauert die Antwort immer gleich lang (ein
// bcrypt-Vergleich) und verrät nicht, ob ein Konto existiert. Kostenfaktor wie bei echten Hashes.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

const loginSchema = z.object({
  email: z.preprocess(v => (typeof v === 'string' ? v.trim() : v), z.string().min(1, 'E-Mail und Passwort erforderlich').max(255)),
  password: z.string().min(1, 'E-Mail und Passwort erforderlich').max(200),
});

router.post('/login', loginLimiter, loginAccountLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
    return;
  }
  const { email, password } = parsed.data;
  const user = await queryOne<any>('SELECT * FROM users WHERE email = $1 AND active = true', [email]);
  // Immer vergleichen – auch ohne Benutzer (gegen den Dummy-Hash), siehe DUMMY_HASH
  const valid = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !valid) {
    res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    return;
  }
  const token = signToken(user);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_url: user.avatar_url } });
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const user = await queryOne<any>('SELECT id, name, email, role, avatar_url FROM users WHERE id = $1', [req.user!.id]);
  res.json(user);
});

// Abmelden: widerruft das aktuelle Token serverseitig (nur dieses Gerät)
router.post('/logout', requireAuth, async (req: AuthRequest, res) => {
  await revokeToken(req.token!);
  res.json({ ok: true });
});

export default router;
