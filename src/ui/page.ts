/**
 * Whole-page composition for the build-time prerender. The browser re-uses the region
 * renderers from templates.ts; this module only adds the document-level parts.
 */

import type { Manifest, RaceRecord, TrackShape } from '../domain/schema.ts';
import { seasonStrip } from './embed.ts';
import { escapeHtml, html, inlineJson, SafeHtml } from './html.ts';
import {
  archive,
  compounds,
  DEFAULT_VIEW,
  dataTable,
  fallbackVisual,
  heroWord,
  identity,
  MODES,
  ratings,
  readout,
  setup,
  sortedCompounds,
  specs,
  stepper,
  titleBlock,
} from './templates.ts';

export const SITE_NAME = 'F1 Stories — Tyre Intelligence';

export interface PageContext {
  manifest: Manifest;
  record: RaceRecord;
  track: TrackShape | null;
  base: string;
  siteUrl: string;
  /** Path of this document relative to base ('' for the index). */
  path: string;
  notFound?: boolean;
}

export function describe(r: RaceRecord): string {
  const list = sortedCompounds(r).map((c) => c.compound);
  const comp = list.length ? `Compounds ${list.join(', ')}` : 'Tyre compounds';
  return `${comp} for the ${r.season} ${r.race.name}${r.circuit.name ? ` at ${r.circuit.name}` : ''}: track demands, starting pressures, camber limits and circuit data from Pirelli's race preview. Unofficial visualisation.`;
}

export function mainRegions(ctx: PageContext): SafeHtml {
  const { record: r, track } = ctx;
  const s = DEFAULT_VIEW;
  return html`
  <section class="identity" aria-labelledby="race-title" id="r-identity">${identity(r)}</section>
  <section class="specs" aria-label="Circuit facts" id="r-specs">${specs(r)}</section>
  <section class="viewport" aria-labelledby="viz-title">
    <h2 id="viz-title" class="visually-hidden">Visualisation</h2>
    <div class="modebar">
      <div class="modes" role="group" aria-label="View">
        ${MODES.map((m) => html`<button type="button" class="mode" data-mode="${m}" aria-pressed="${String(m === s.mode)}">${m}</button>`)}
      </div>
    </div>
    <div class="canvas-host" id="canvas-host">
      <p class="hero-word" id="r-hero" aria-hidden="true">${heroWord(r)}</p>
      <div class="fallback" id="r-fallback">${fallbackVisual(r, track, s)}</div>
      <p class="loading-3d" id="loading-3d" hidden>Loading 3D view</p>
      <span class="sweep" aria-hidden="true"></span>
      <div class="view-tools" id="view-tools" hidden>
        <button type="button" class="tool" data-action="reset" aria-label="Reset camera">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 8.5A6 6 0 1 1 5 13.5M4.5 3.5v5h5" /></svg>
        </button>
        <button type="button" class="tool" data-action="rotate" aria-pressed="false" aria-label="Auto-rotate">
          <svg viewBox="0 0 20 20" aria-hidden="true" class="i-play"><path d="M7 5l8 5-8 5z" /></svg>
          <svg viewBox="0 0 20 20" aria-hidden="true" class="i-pause"><path d="M7 5v10M13 5v10" /></svg>
        </button>
      </div>
    </div>
    <div class="data-panel" id="r-data" role="region" aria-labelledby="data-caption" tabindex="0" hidden>${dataTable(r)}</div>
    <div class="readout" id="r-readout">${readout(r, track, s)}</div>
  </section>
  <section class="demands" aria-label="Track demands and setup">
    <div id="r-ratings">${ratings(r)}</div>
    <div id="r-setup" class="setup">${setup(r)}</div>
  </section>
  <section class="compounds" id="r-compounds" aria-labelledby="compounds-title">${compounds(r, null)}</section>
  <section class="titleblock" id="r-source" aria-label="Source">${titleBlock(r)}</section>
  <section class="season" id="r-season" aria-labelledby="season-title">${seasonSection(ctx.manifest, r)}</section>`;
}

/** The season band: compound choices for every published round of this race's season. */
export function seasonSection(manifest: Manifest, r: RaceRecord): SafeHtml {
  const races = manifest.years.find((y) => y.year === r.season)?.races ?? [];
  return html`<header class="section-title"><h2 id="season-title">Compound choices, ${r.season} season</h2><p class="section-aside">${races.length} published Pirelli previews</p></header>
    ${seasonStrip(races, 'en', r.id)}`;
}

/** JSON inside <script type="application/json">: neutralise "<" so no payload can close the tag. */

export function renderPage(template: string, ctx: PageContext): string {
  const { record: r, siteUrl } = ctx;
  const canonical = `${siteUrl}${ctx.path}`;
  const title = ctx.notFound
    ? `Page not found | ${SITE_NAME}`
    : `${r.race.name} ${r.season} tyres and circuit | ${SITE_NAME}`;
  const description = describe(r);
  // Per-race card rendered at deploy time by scripts/og-images.ts; the generic image covers the 404 page.
  const ogImage = ctx.notFound ? `${siteUrl}og.png` : `${siteUrl}og/${r.season}/${r.slug}.png`;
  const ogAlt = ctx.notFound
    ? 'F1 Stories Tyre Intelligence: a generic Formula 1 car with tyres coloured by track demand'
    : `Tyre summary for the ${r.season} ${r.race.name}: compounds, circuit outline and Pirelli track-demand ratings`;
  const event =
    r.race.startDate && r.race.endDate
      ? {
          '@context': 'https://schema.org',
          '@type': 'SportsEvent',
          name: `${r.season} ${r.race.name}`,
          startDate: r.race.startDate,
          endDate: r.race.endDate,
          sport: 'Formula 1',
          location: { '@type': 'Place', name: r.circuit.name ?? r.race.location, address: r.race.location },
        }
      : null;

  const head = html`<title>${title}</title>
    <meta name="description" content="${description}" />
    ${ctx.notFound ? html`<meta name="robots" content="noindex" />` : html`<link rel="canonical" href="${canonical}" />`}
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${ogAlt}" />
    <meta name="twitter:card" content="summary_large_image" />
    ${event ? html`<script type="application/ld+json">${new SafeHtml(inlineJson(event))}</script>` : ''}`;

  const boot = inlineJson({ raceId: r.id, record: r, track: ctx.track, notFound: !!ctx.notFound });

  // Function replacers: data text must never be read as `$&`/`$'` replacement patterns.
  return template
    .replace(/<title>.*?<\/title>/s, () => '')
    .replace('<!--app:head-->', () => head.value)
    .replace('<!--app:main-->', () => mainRegions(ctx).value)
    .replace('<!--app:archive-->', () => archive(ctx.manifest, ctx.base, ctx.notFound ? null : r.id).value)
    .replace('<!--app:stepper-->', () => stepper(ctx.manifest, ctx.base, r.id).value)
    .replace('<!--app:boot-->', () => `<script type="application/json" id="boot">${boot}</script>`)
    .replace('<!--app:notice-->', () =>
      ctx.notFound ? `<p>${escapeHtml('That page does not exist. Showing the latest preview.')}</p>` : '',
    );
}
