import fs from 'fs/promises';
import path from 'path';
import { getTmpDir } from './utils.js';

const CLEANUP_MINUTES = parseInt(process.env.CLEANUP_MINUTES || '60');

export function cleanupJob() {
  const interval = Math.min(CLEANUP_MINUTES, 30) * 60 * 1000; // checa no mínimo a cada 30min
  setInterval(async () => {
    const tmpDir = getTmpDir();
    try {
      const dirs = await fs.readdir(tmpDir);
      const now = Date.now();
      for (const dir of dirs) {
        const full = path.join(tmpDir, dir);
        const stat = await fs.stat(full).catch(() => null);
        if (!stat) continue;
        const ageMin = (now - stat.mtimeMs) / 60000;
        if (ageMin > CLEANUP_MINUTES) {
          await fs.rm(full, { recursive: true, force: true });
          console.log(`[cleanup] Removed batch: ${dir}`);
        }
      }
    } catch (err) {
      console.error('[cleanup] Error:', err.message);
    }
  }, interval);

  console.log(`[cleanup] Job started — TTL: ${CLEANUP_MINUTES}min, check every ${Math.min(CLEANUP_MINUTES, 30)}min`);
}
