/// <reference types="vitest/config" />
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { Manifest, parseWith, RaceRecord, TrackShape } from './src/domain/schema.ts';
import { racePath } from './src/domain/urlState.ts';
import { type PageContext, renderPage } from './src/ui/page.ts';

/**
 * GitHub Pages project sites live under /<repo>/. The deploy workflow passes the value from
 * actions/configure-pages; locally it defaults to '/'.
 */
const BASE = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/');
const SITE_URL = (process.env.SITE_URL ?? `http://localhost:5173${BASE}`).replace(/\/?$/, '/');
const DATA_DIR = path.resolve(import.meta.dirname, 'public/data');

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

async function loadJson<T>(file: string, schema: Parameters<typeof parseWith<T>>[0]): Promise<T | null> {
  try {
    const parsed = parseWith(schema, JSON.parse(await readFile(file, 'utf8')));
    if (!parsed.ok) throw new Error(parsed.error);
    return parsed.value;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new Error(`${path.basename(file)}: ${(err as Error).message}`);
  }
}

async function context(raceId: string | null, pagePath: string): Promise<PageContext> {
  const manifest = await loadJson(path.join(DATA_DIR, 'manifest.json'), Manifest);
  if (!manifest) throw new Error('public/data/manifest.json missing — run `npm run data:build` first.');
  const id = raceId ?? manifest.latest;
  const record = await loadJson(path.join(DATA_DIR, 'races', `${id}.json`), RaceRecord);
  if (!record) throw new Error(`race ${id} missing from public/data`);
  const track = record.circuit.trackId
    ? await loadJson(path.join(DATA_DIR, 'tracks', `${record.circuit.trackId}.json`), TrackShape)
    : null;
  return { manifest, record, track, base: BASE, siteUrl: SITE_URL, path: pagePath };
}

/**
 * Prerender: index.html shows the latest preview; /{season}/{slug}/index.html exists for every race;
 * 404.html is the shell GitHub Pages serves for unknown paths.
 */
function prerender(): Plugin {
  let template = '';
  let outDir = 'dist';
  let isBuild = false;
  return {
    name: 'tyre-intel-prerender',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
      isBuild = config.command === 'build';
    },
    transformIndexHtml: {
      order: 'post',
      async handler(html, ctx) {
        // Preload the hashed Archivo file straight from the bundle so every prerendered page gets a final URL
        // (asset placeholders in index.html are only resolved after this hook runs).
        const font = Object.values(ctx.bundle ?? {}).find((f) =>
          /archivo-latin-var.*\.woff2$/.test(f.fileName),
        );
        const preload = font
          ? `\n    <link rel="preload" href="${BASE}${font.fileName}" as="font" type="font/woff2" crossorigin />`
          : '';
        template = isBuild
          ? html.replace(
              '<head>',
              () => `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />${preload}`,
            )
          : html;
        return renderPage(template, await context(null, ''));
      },
    },
    async closeBundle() {
      if (!isBuild || !template) return;
      const { manifest } = await context(null, '');
      for (const year of manifest.years) {
        for (const race of year.races) {
          const rel = racePath('', race);
          const dir = path.join(outDir, rel);
          await mkdir(dir, { recursive: true });
          await writeFile(path.join(dir, 'index.html'), renderPage(template, await context(race.id, rel)));
        }
      }
      await writeFile(
        path.join(outDir, '404.html'),
        renderPage(template, { ...(await context(null, '')), notFound: true }),
      );
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [prerender()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    sourcemap: true,
    // The Three.js viewer is a deliberately isolated lazy chunk (~155 KB gzip).
    chunkSizeWarningLimit: 700,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
