import { Router } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import archiver from 'archiver';
import { getTmpDir } from '../utils.js';

export const downloadRouter = Router();

// Download arquivo individual
downloadRouter.get('/download/:batchId/:filename', async (req, res) => {
  const { batchId, filename } = req.params;
  // Sanitize: não permitir path traversal
  const safe = path.basename(filename);
  const file = path.join(getTmpDir(), path.basename(batchId), safe);

  try {
    await fs.access(file);
    res.download(file, safe);
  } catch {
    res.status(404).json({ error: 'Arquivo não encontrado.' });
  }
});

// Download ZIP do batch
downloadRouter.get('/download-zip/:batchId', async (req, res) => {
  const { batchId } = req.params;
  const batchDir = path.join(getTmpDir(), path.basename(batchId));

  try {
    await fs.access(batchDir);
  } catch {
    return res.status(404).json({ error: 'Batch não encontrado.' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="imageforge_${batchId.slice(0,8)}.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', err => { console.error('[zip]', err); res.end(); });
  archive.pipe(res);

  const files = await fs.readdir(batchDir);
  for (const f of files) {
    if (f.startsWith('orig_')) continue; // não incluir originais no zip
    archive.file(path.join(batchDir, f), { name: f });
  }
  await archive.finalize();
});
