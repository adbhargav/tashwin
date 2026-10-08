// Copies every file in server/uploads to the R2 bucket (same file names, so saved /uploads/... paths keep working).
// Safe to re-run: files already in the bucket are skipped. Run: npm run migrate-uploads
import { readdirSync, statSync } from 'node:fs';
import { localDir, r2Enabled, readLocal, saveUpload, uploadExists } from './storage.js';

if (!r2Enabled) { console.error('Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET in .env first.'); process.exit(1); }
const types = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime' };
let copied = 0, skipped = 0;
for (const name of readdirSync(localDir)) {
  if (name.startsWith('.') || !statSync(`${localDir}/${name}`).isFile()) continue;
  if (await uploadExists(name)) { skipped++; continue; }
  await saveUpload(name, readLocal(name), types[name.slice(name.lastIndexOf('.')).toLowerCase()] || 'application/octet-stream');
  copied++;
  console.log('uploaded', name);
}
console.log(`Done: ${copied} uploaded, ${skipped} already in the bucket.`);
