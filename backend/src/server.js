import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { convertRouter } from './routes/convert.js';
import { downloadRouter } from './routes/download.js';
import { cleanupJob } from './cleanup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

// ── Middlewares ────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// ── Health ─────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── API ────────────────────────────────────────────────────────────────────────
app.use('/api', convertRouter);
app.use('/api', downloadRouter);

// ── Static frontend (build do Vite) ───────────────────────────────────────────
const distPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[ImageForge] Server running on port ${PORT}`);
  cleanupJob(); // inicia o cron de limpeza
});
