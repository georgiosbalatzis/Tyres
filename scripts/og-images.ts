/**
 * Renders, after `npm run build` (needs Playwright's Chromium: `npx playwright install chromium`):
 *   - a 1200×630 social card per race into <out>/og/{season}/{slug}.png
 *   - every static embed panel, both languages, as an image for social posts and newsletters into
 *     <out>/img/{lang}/{season}/{slug}/{panel}.png, straight from the built embed pages (no server).
 *
 *   BASE_PATH=/Tyres/ node scripts/og-images.ts [--out dist]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { Manifest, parseWith, RaceRecord, TrackShape } from '../src/domain/schema.ts';
import { EMBED_LANGS, embedImagePath, embedPath, IMAGE_PANELS, PANEL_IMAGE } from '../src/domain/urlState.ts';
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
console.log(`og: ${count} card(s) → ${path.relative(ROOT, path.join(OUT, 'og'))}/`);

/* Panel images: load the built embed pages from <out>, mapping the site's base path onto it. */
const BASE = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/');
const ORIGIN = 'http://tyres.local';
const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};
const { width, margin, scale } = PANEL_IMAGE;
const panels = await browser.newPage({
  viewport: { width: width + 2 * margin, height: 1200 },
  deviceScaleFactor: scale,
});
await panels.route(`${ORIGIN}/**`, async (route) => {
  const rel = decodeURIComponent(new URL(route.request().url()).pathname).slice(BASE.length);
  const file = path.join(OUT, rel.endsWith('/') || rel === '' ? `${rel}index.html` : rel);
  try {
    await route.fulfill({
      body: await readFile(file),
      contentType: TYPES[path.extname(file)] ?? 'application/octet-stream',
    });
  } catch {
    await route.fulfill({ status: 404, body: '' });
  }
});
let images = 0;
for (const race of manifest.years.flatMap((y) => y.races)) {
  for (const lang of EMBED_LANGS) {
    for (const panel of IMAGE_PANELS) {
      const res = await panels.goto(`${ORIGIN}${embedPath(BASE, lang, race, panel)}`);
      if (!res?.ok()) throw new Error(`panel page missing: ${lang} ${race.id} ${panel}`);
      // A still image can't be clicked: show the site address instead of "Open in …".
      await panels.addStyleTag({
        content: `.e-root{min-height:0;padding:${margin}px}.e-open{display:none}.e-site[hidden]{display:inline}`,
      });
      await panels.evaluate(() => document.fonts.ready);
      const file = path.join(OUT, embedImagePath('', lang, race, panel));
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, await panels.locator('.e-root').screenshot({ type: 'png' }));
      images++;
    }
  }
}
await browser.close();
console.log(`img: ${images} panel image(s) → ${path.relative(ROOT, path.join(OUT, 'img'))}/`);
