import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

import { runAutoStatus } from './jobs/autoStatus';
import { runBackupJob } from './jobs/backup';
import { auditMiddleware } from './middleware/audit';
import { errorHandler } from './lib/errors';
import { cleanupRevokedTokens } from './middleware/auth';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import saunaRoutes from './routes/saunas';
import scentRoutes from './routes/scents';
import templateRoutes from './routes/templates';
import eventRoutes from './routes/events';
import dayTemplateRoutes from './routes/dayTemplates';
import ideaRoutes from './routes/ideas';
import settingsRoutes from './routes/settings';
import auditRoutes from './routes/audit';
import backupRoutes from './routes/backup';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Im Live-Betrieb steht nginx davor: echte Client-IP aus X-Forwarded-For übernehmen
// (wichtig fürs Rate-Limiting). Nur einen Proxy vertrauen, damit der Header nicht fälschbar ist.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Protokoll: jede erfolgreiche Änderung wird mit Mitarbeiter + Zeitpunkt festgehalten
app.use('/api', auditMiddleware);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/saunas', saunaRoutes);
app.use('/api/scents', scentRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/day-templates', dayTemplateRoutes);
app.use('/api/ideas', ideaRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/backup', backupRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

// Auto-Status Job: läuft jede Minute
runAutoStatus().catch(console.error);
setInterval(() => runAutoStatus().catch(console.error), 60_000);

// Tägliches Backup + Aufräumen (alte Backups, altes Protokoll): Prüfung alle 10 Minuten
setTimeout(() => runBackupJob().catch(console.error), 30_000);
setInterval(() => runBackupJob().catch(console.error), 10 * 60_000);

// Abgelaufene widerrufene Tokens stündlich löschen
setInterval(() => cleanupRevokedTokens().catch(console.error), 60 * 60_000);

// Unbekannte API-Routen
app.use('/api', (_req, res) => { res.status(404).json({ error: 'Nicht gefunden' }); });

// Zentraler Error-Handler: alle Fehler aus Routen (auch async) landen hier
app.use(errorHandler);

process.on('unhandledRejection', err => console.error('Unhandled promise rejection:', err));

app.listen(PORT, () => {
  console.log(`Backend läuft auf http://localhost:${PORT}`);
});
