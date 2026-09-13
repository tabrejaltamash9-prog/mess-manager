import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { startMealCron } from './jobs/mealCron';
import authRoutes from './routes/auth.routes';
import scanRoutes from './routes/scan.routes';
import mealRoutes from './routes/meal.routes';
import studentRoutes from './routes/student.routes';
import reportRoutes from './routes/report.routes';

const app = express();

// ── Security & Parsing Middleware ────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/meal', mealRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/reports', reportRoutes);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[unhandled error]', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Start Server ──────────────────────────────────────────────────────────────
const PORT = parseInt(env.PORT);
app.listen(PORT, () => {
  console.log(`\n🍽️  Mess QR Backend running on port ${PORT}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
  console.log(`   Health check: http://localhost:${PORT}/health\n`);

  // Start the meal lifecycle cron
  startMealCron();
});

export default app;
