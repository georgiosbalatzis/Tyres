/**
 * Renders a 1200×630 social card per race into <out>/og/{season}/{slug}.png (default out: dist).
 * Run after `npm run build`; needs Playwright's Chromium (`npx playwright install chromium`).
 *
 *   node scripts/og-images.ts [--out dist]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { Manifest, parseWith, RaceRecord, TrackShape } from '../src/domain/schema.ts';
import { ogCardHtml } from '../src/ui/ogCard.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const outArg = process.argv.indexOf('--out');
const OUT = path.resolve(ROOT, outArg >= 0 ? process.argv[outArg + 1]! : 'dist');
const DATA = path.join(ROOT, 'public/data');

async function load<T>(file: string, schema: Parameters<typeof parseWith<T>>[0]): Promise<T | null> {
  try {
    const parsed = parseWith(schema, JSON.parse(await readFile(file, 'utf8')));
    return parsed.ok ? parsed.value : null;
  } catch {
    return null;
  }
}

const manifest = await load(path.join(DATA, 'manifest.json'), Manifest);
if (!manifest) throw new Error('public/data/manifest.json missing — run `npm run data:build` first.');
const fontUrl = async (file: string) =>
  `data:font/woff2;base64,${(await readFile(path.join(ROOT, 'src/assets/fonts', file))).toString('base64')}`;
const fonts = {
  text: await fontUrl('ibm-plex-sans-400-600.woff2'),
  brand: await fontUrl('barlow-condensed-700.woff2'),
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
let count = 0;
for (const summary of manifest.years.flatMap((y) => y.races)) {
  const record = await load(path.join(DATA, 'races', `${summary.id}.json`), RaceRecord);
  if (!record) continue;
  const track = record.circuit.trackId
    ? await load(path.join(DATA, 'tracks', `${record.circuit.trackId}.json`), TrackShape)
    : null;
  await page.setContent(ogCardHtml(record, track, fonts), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const file = path.join(OUT, 'og', String(record.season), `${record.slug}.png`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, await page.screenshot({ type: 'png' }));
  count++;
}
await browser.close();
console.log(`og: ${count} card(s) → ${path.relative(ROOT, path.join(OUT, 'og'))}/`);
