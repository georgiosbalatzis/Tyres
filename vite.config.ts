/// <reference types="vitest/config" />
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { Manifest, parseWith, RaceRecord, TrackShape } from './src/domain/schema.ts';
import {
  EMBED_LANGS,
  EMBED_PANELS,
  type EmbedLang,
  type EmbedPanel,
  embedPath,
  racePath,
  seasonEmbedPath,
} from './src/domain/urlState.ts';
import { Weekend } from './src/domain/weekend.ts';
import { renderEmbed, renderSeasonEmbed } from './src/ui/embed.ts';
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
// Embeds are pure HTML and CSS, except the 3D embed, which loads the viewer on request.
const EMBED_CSP = CSP.replace("script-src 'self'", "script-src 'none'");
const embedFile = (panel: EmbedPanel) => (panel === '3d' ? 'embed-3d.html' : 'embed.html');
const EMBED_ROUTE = /^embed\/(el|en)\/(\d{4})\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/;
const SEASON_ROUTE = /^embed\/(el|en)\/(\d{4})\/season\/?$/;

async function seasonContext(lang: EmbedLang, season: number) {
  const { manifest } = await context(null, '');
  const races = manifest.years.find((y) => y.year === season)?.races ?? [];
  return races.length ? { season, races, lang, base: BASE, siteUrl: SITE_URL } : null;
}

async function loadJson<T>(file: string, schema: Parameters<typeof parseWith<T>>[0]): Promise<T | null> {
  try {
    const json = JSON.parse(await readFile(file, 'utf8'));
    if (json === null) return null;
    const parsed = parseWith(schema, json);
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
  const weekend = await loadJson(path.join(DATA_DIR, 'weekends', `${id}.json`), Weekend);
  return { manifest, record, track, weekend, base: BASE, siteUrl: SITE_URL, path: pagePath };
}

/**
 * Prerender: index.html shows the latest preview; /{season}/{slug}/index.html exists for every race;
 * 404.html is the shell GitHub Pages serves for unknown paths.
 */
async function embedContext(lang: EmbedLang, season: number, slug: string, panel: EmbedPanel) {
  const { manifest } = await context(null, '');
  const race = manifest.years.flatMap((y) => y.races).find((r) => r.season === season && r.slug === slug);
  if (!race) return null;
  const { record, track } = await context(race.id, '');
  return { record, track, panel, lang, base: BASE, siteUrl: SITE_URL };
}

function prerender(): Plugin {
  let template = '';
  const embedTemplates: Record<string, string> = {};
  let outDir = 'dist';
  let isBuild = false;
  return {
    name: 'tyre-intel-prerender',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
      isBuild = config.command === 'build';
    },
    // Dev: serve /embed/{lang}/{season}/{slug}/{panel}/ on the fly, so the copy dialog's preview works locally.
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const s = SEASON_ROUTE.exec((req.url ?? '').split('?')[0]!.slice(BASE.length));
        if (s) {
          const ctx = await seasonContext(s[1] as EmbedLang, Number(s[2]));
          if (!ctx) return next();
          const raw = await readFile(path.resolve(import.meta.dirname, 'embed.html'), 'utf8');
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(renderSeasonEmbed(await server.transformIndexHtml(req.url!, raw), ctx));
          return;
        }
        const m = EMBED_ROUTE.exec((req.url ?? '').split('?')[0]!.slice(BASE.length));
        if (!m || !(EMBED_PANELS as readonly string[]).includes(m[4]!)) return next();
        try {
          const ctx = await embedContext(m[1] as EmbedLang, Number(m[2]), m[3]!, m[4] as EmbedPanel);
          if (!ctx) return next();
          const raw = await readFile(path.resolve(import.meta.dirname, embedFile(ctx.panel)), 'utf8');
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(renderEmbed(await server.transformIndexHtml(req.url!, raw), ctx));
        } catch (err) {
          next(err);
        }
      });
    },
    transformIndexHtml: {
      order: 'post',
      async handler(html, ctx) {
        const file = path.basename(ctx.path);
        if (file === 'embed.html' || file === 'embed-3d.html') {
          if (isBuild) {
            const csp = file === 'embed.html' ? EMBED_CSP : CSP;
            embedTemplates[file] = html.replace(
              '<head>',
              () => `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
            );
          }
          return html;
        }
        // Preload the hashed fonts the first paint needs (Latin and Greek text, the Barlow display title) straight
        // from the bundle so every prerendered page gets a final URL (asset placeholders in index.html are only
        // resolved after this hook runs).
        const files = Object.values(ctx.bundle ?? {}).map((f) => f.fileName);
        const preload = [
          /ibm-plex-sans-400-600-(?!latin-ext|greek).*\.woff2$/,
          /ibm-plex-sans-400-600-greek-.*\.woff2$/,
          /barlow-condensed-700-.*\.woff2$/,
        ]
          .map((re) => files.find((f) => re.test(f)))
          .filter((f): f is string => !!f)
          .map(
            (f) => `\n    <link rel="preload" href="${BASE}${f}" as="font" type="font/woff2" crossorigin />`,
          )
          .join('');
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
      // Article embeds: every race × panel × language. The bare template is not a page of its own.
      if (embedTemplates['embed.html'] && embedTemplates['embed-3d.html']) {
        for (const race of manifest.years.flatMap((y) => y.races)) {
          for (const lang of EMBED_LANGS) {
            for (const panel of EMBED_PANELS) {
              const ctx = await embedContext(lang, race.season, race.slug, panel);
              if (!ctx) continue;
              const dir = path.join(outDir, embedPath('', lang, race, panel));
              await mkdir(dir, { recursive: true });
              await writeFile(
                path.join(dir, 'index.html'),
                renderEmbed(embedTemplates[embedFile(panel)]!, ctx),
              );
            }
          }
        }
        for (const year of manifest.years) {
          for (const lang of EMBED_LANGS) {
            const ctx = await seasonContext(lang, year.year);
            if (!ctx) continue;
            const dir = path.join(outDir, seasonEmbedPath('', lang, year.year));
            await mkdir(dir, { recursive: true });
            await writeFile(
              path.join(dir, 'index.html'),
              renderSeasonEmbed(embedTemplates['embed.html']!, ctx),
            );
          }
        }
        await rm(path.join(outDir, 'embed.html'));
        await rm(path.join(outDir, 'embed-3d.html'));
      }
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [prerender()],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
        embed: path.resolve(import.meta.dirname, 'embed.html'),
        embed3d: path.resolve(import.meta.dirname, 'embed-3d.html'),
      },
    },
    assetsInlineLimit: 0,
    sourcemap: true,
    // The Three.js viewer (with GLTFLoader) is a deliberately isolated lazy chunk (~178 KB gzip).
    chunkSizeWarningLimit: 700,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
