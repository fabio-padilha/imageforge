import { Router } from 'express';
import busboy from 'busboy';
import { v4 as uuidv4 } from 'uuid';
import { fileTypeFromBuffer } from 'file-type';
import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { processQueue } from '../queue.js';
import { getTmpDir, sanitizeName } from '../utils.js';

export const convertRouter = Router();

const MAX_FILE_SIZE  = parseInt(process.env.MAX_FILE_MB  || '25')  * 1024 * 1024;
const MAX_BATCH_SIZE = parseInt(process.env.MAX_BATCH_MB || '200') * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'image/jpeg','image/png','image/webp','image/avif',
  'image/gif','image/tiff','image/bmp','image/heic','image/heif'
]);

convertRouter.post('/convert', (req, res) => {
  const batchId  = uuidv4();
  const batchDir = path.join(getTmpDir(), batchId);
  const files    = [];      // { name, buffer, mime }
  let   options  = {};
  let   batchBytes = 0;
  let   hasError = false;

  const bb = busboy({ headers: req.headers, limits: { fileSize: MAX_FILE_SIZE } });

  bb.on('file', (fieldname, stream, info) => {
    const chunks = [];
    stream.on('data', chunk => {
      batchBytes += chunk.length;
      if (batchBytes > MAX_BATCH_SIZE) {
        hasError = true;
        stream.destroy();
        return;
      }
      chunks.push(chunk);
    });
    stream.on('end', () => {
      if (!hasError) {
        files.push({ name: sanitizeName(info.filename), buffer: Buffer.concat(chunks) });
      }
    });
    stream.on('limit', () => {
      hasError = true;
      console.warn(`[convert] File too large: ${info.filename}`);
    });
  });

  bb.on('field', (name, val) => {
    if (name === 'options') {
      try { options = JSON.parse(val); } catch {}
    }
  });

  bb.on('finish', async () => {
    if (hasError) return res.status(413).json({ error: 'Arquivo(s) excedem o limite de tamanho.' });
    if (!files.length) return res.status(400).json({ error: 'Nenhum arquivo recebido.' });

    // Validar MIME real
    const validated = [];
    for (const f of files) {
      const type = await fileTypeFromBuffer(f.buffer);
      if (!type || !ALLOWED_MIME.has(type.mime)) {
        return res.status(415).json({ error: `Formato não suportado: ${f.name}` });
      }
      validated.push({ ...f, detectedMime: type.mime });
    }

    // Salvar originals e enfileirar
    await fs.mkdir(batchDir, { recursive: true });
    for (const f of validated) {
      await fs.writeFile(path.join(batchDir, `orig_${f.name}`), f.buffer);
    }

    try {
      const results = await processQueue(batchId, batchDir, validated, options);
      res.json({ batchId, results });
    } catch (err) {
      console.error('[convert] Error:', err);
      res.status(500).json({ error: 'Erro ao processar imagens.' });
    }
  });

  req.pipe(bb);
});
