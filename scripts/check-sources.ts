/**
 * Verifies that every source URL in the dataset still resolves (polite, sequential).
 *   node scripts/check-sources.ts
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { USER_AGENT } from './pirelli/http.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

const urls = new Set<string>();
for (const layer of ['generated', 'overrides']) {
  const entries = await readdir(path.join(ROOT, 'data', layer), {
    recursive: true,
    withFileTypes: true,
  }).catch(() => []);
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.json')) continue;
    const r = JSON.parse(await readFile(path.join(e.parentPath, e.name), 'utf8'));
    for (const u of [r.source?.articleUrl, r.source?.previewAssetUrl]) if (typeof u === 'string') urls.add(u);
  }
}

let broken = 0;
for (const url of [...urls].sort()) {
  const res = await fetch(url, {
    method: 'HEAD',
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(20000),
  }).catch((err: Error) => ({ status: err.message }) as const);
  const ok = typeof res.status === 'number' && res.status < 400;
  if (!ok) broken++;
  console.log(`${ok ? 'ok   ' : 'FAIL '} ${res.status}  ${url}`);
  await new Promise((r) => setTimeout(r, 5000));
}
console.log(`${urls.size - broken}/${urls.size} source URLs reachable`);
process.exitCode = broken ? 1 : 0;
