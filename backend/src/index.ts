import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

import { runAutoStatus } from './jobs/autoStatus';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import saunaRoutes from './routes/saunas';
import scentRoutes from './routes/scents';
import templateRoutes from './routes/templates';
import eventRoutes from './routes/events';
import ideaRoutes from './routes/ideas';
import settingsRoutes from './routes/settings';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/saunas', saunaRoutes);
app.use('/api/scents', scentRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/ideas', ideaRoutes);
app.use('/api/settings', settingsRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

// Auto-Status Job: läuft jede Minute
runAutoStatus().catch(console.error);
setInterval(() => runAutoStatus().catch(console.error), 60_000);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message ?? 'Interner Serverfehler' });
});

app.listen(PORT, () => {
  console.log(`Backend läuft auf http://localhost:${PORT}`);
});
