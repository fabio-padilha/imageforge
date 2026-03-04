import path from 'path';

export function getTmpDir() {
  return process.env.TMP_DIR || '/tmp/imageforge';
}

export function sanitizeName(filename) {
  if (!filename) return 'upload';
  const base = path.basename(filename);
  // Remove chars perigosos, mantém letras, números, -, _, .
  return base.replace(/[^a-zA-Z0-9\-_.]/g, '_').slice(0, 128);
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
