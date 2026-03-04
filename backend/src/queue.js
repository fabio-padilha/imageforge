import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';

const CONCURRENCY = parseInt(process.env.CONCURRENCY || '3');

// Tamanhos automáticos
const AUTO_SIZES = [
  { label: '2560px', width: 2560 },
  { label: '1920px', width: 1920 },
  { label: '1280px', width: 1280 },
  { label: '768px',  width: 768  },
  { label: '480px',  width: 480  },
];

export async function processQueue(batchId, batchDir, files, options) {
  const {
    format       = 'webp',
    quality      = 85,
    keepOriginal = false,
    keepExif     = false,
    forceSquare  = false,
    customSizes  = null, // array de { label, width }
  } = options;

  const sizes = customSizes || AUTO_SIZES;
  const allTasks = [];

  for (const file of files) {
    const baseName = path.parse(file.name).name;

    // Original (se solicitado)
    if (keepOriginal) {
      allTasks.push({ file, label: 'original', width: null, baseName });
    }

    // 5 tamanhos
    for (const sz of sizes) {
      allTasks.push({ file, label: sz.label, width: sz.width, baseName });
    }
  }

  // Processa em chunks paralelos
  const results = [];
  for (let i = 0; i < allTasks.length; i += CONCURRENCY) {
    const chunk = allTasks.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map(task => processTask(task, batchDir, { format, quality, keepExif, forceSquare }))
    );
    results.push(...chunkResults);
  }

  // Agrupar por arquivo original
  const grouped = {};
  for (const r of results) {
    if (!grouped[r.originalName]) grouped[r.originalName] = [];
    grouped[r.originalName].push(r);
  }

  return grouped;
}

async function processTask(task, batchDir, opts) {
  const { file, label, width, baseName } = task;
  const { format, quality, keepExif, forceSquare } = opts;

  const outName = `${baseName}_${label}.${format}`;
  const outPath = path.join(batchDir, outName);

  let pipeline = sharp(file.buffer);

  // Metadata original
  const meta = await pipeline.metadata();
  const origW = meta.width;
  const origH = meta.height;
  const origSize = file.buffer.length;

  // Resize
  if (width && origW > width) {
    if (forceSquare) {
      pipeline = pipeline.resize(width, width, { fit: 'cover', position: 'center' });
    } else {
      pipeline = pipeline.resize(width, null, { fit: 'inside', withoutEnlargement: true });
    }
  }

  // EXIF
  if (!keepExif) {
    pipeline = pipeline.withMetadata(false);
  } else {
    pipeline = pipeline.withMetadata();
  }

  // Formato + qualidade
  const fmtOpts = {};
  if (['jpeg','jpg','webp','avif'].includes(format)) fmtOpts.quality = quality;
  if (format === 'jpeg' || format === 'jpg') pipeline = pipeline.jpeg(fmtOpts);
  else if (format === 'png') pipeline = pipeline.png({ compressionLevel: 8 });
  else if (format === 'webp') pipeline = pipeline.webp(fmtOpts);
  else if (format === 'avif') pipeline = pipeline.avif(fmtOpts);

  const outBuffer = await pipeline.toBuffer({ resolveWithObject: true });
  await fs.writeFile(outPath, outBuffer.data);

  return {
    originalName: file.name,
    label,
    filename: outName,
    width: outBuffer.info.width,
    height: outBuffer.info.height,
    size: outBuffer.data.length,
    origSize,
    origWidth: origW,
    origHeight: origH,
    format,
    skipped: width && origW <= width,
  };
}
