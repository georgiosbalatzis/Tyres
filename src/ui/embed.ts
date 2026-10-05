/**
 * Article embeds: one small, script-free page per race × panel × language, for iframes in
 * f1stories.gr articles. Every panel keeps the same height at any width ≥ 300 px, so a fixed
 * iframe height fits (the copy dialog measures it; tests/e2e checks it stays constant).
 */
import { type CarView, deriveView, HEAT_STOPS } from '../domain/derivedMetrics.ts';
import { characteristicsFor, RACE_LABEL_ORDER } from '../domain/format.ts';
import type {
  CharacteristicKey,
  DataStatus,
  ManifestRace,
  RaceRecord,
  TrackShape,
} from '../domain/schema.ts';
import { type EmbedLang, type EmbedPanel, racePath } from '../domain/urlState.ts';
import { carPlanSvg, trackPathD } from './fallbackSvg.ts';
import { escapeHtml, html, inlineJson, SafeHtml, safeUrl } from './html.ts';
import { fmt, PAGE, STRINGS, type Strings } from './strings.ts';
import { DEFAULT_VIEW, fallbackVisual, sortedCompounds } from './templates.ts';

/** The four rating-based views; pressures are official values and live in the setup panel. */
const DEMAND_VIEWS = [
  'longitudinal',
  'lateral',
  'stress',
  'brakingTraction',
] as const satisfies readonly CarView[];

/* ------------------------------------------------------------------ panels */

interface Ctx {
  /** Absolute URL of the full race page. */
  full: string;
  lang: EmbedLang;
  r: RaceRecord;
  track: TrackShape | null;
  t: Strings;
  f: ReturnType<typeof fmt>;
}

const nd = (t: Strings) => html`<span class="e-nd">${t.notProvided}</span>`;

function compoundRow({ r, t }: Ctx): SafeHtml {
  const list = sortedCompounds(r);
  if (!list.length) return html`<p class="e-compounds e-empty">${t.noCompounds}</p>`;
  return html`<ul class="e-compounds">${list.map(
    (
      c,
    ) => html`<li data-label="${c.raceLabel}" style="--tone:var(--c-${RACE_LABEL_ORDER.includes(c.raceLabel) ? c.raceLabel : 'text-2'})">
      <span class="e-disc" aria-hidden="true">${c.compound}</span>
      <span class="e-compound"><span class="e-compound-label">${t.compound[c.raceLabel] ?? c.raceLabel}</span> <span class="e-compound-id">${c.compound}</span></span>
    </li>`,
  )}</ul>`;
}

function ratingRows({ r, t }: Ctx, keys: CharacteristicKey[]): SafeHtml {
  return html`<ul class="e-ratings">${keys.map((key) => {
    const v = r.characteristics[key] ?? null;
    return html`<li style="--v:${v ?? 0};--heat:${v ? `var(--heat-${v})` : 'transparent'}">
      <span class="e-rating-label">${t.rating[key]}</span>
      <span class="e-scale" aria-hidden="true"></span>
      <span class="e-rating-value">${v == null ? nd(t) : html`${v}<span class="e-of">/5</span>`}</span>
    </li>`;
  })}</ul>`;
}

function axlePair(t: Strings, front: string | null, rear: string | null): SafeHtml {
  return html`<span class="e-axles"><span class="e-axle">${t.front}</span> <span class="e-fig">${front ?? nd(t)}</span> <span class="e-axle">${t.rear}</span> <span class="e-fig">${rear ?? nd(t)}</span></span>`;
}

const PANELS: Record<EmbedPanel, (c: Ctx) => SafeHtml> = {
  compounds: (c) => compoundRow(c),

  // Poster first: the flat drawing on the dark bench. src/embed3d.ts swaps in the 3D view on request.
  '3d': ({ r, track, t, lang }) => {
    const view = { ...DEFAULT_VIEW, mode: 'car' as const };
    return html`<div class="e-modes" role="group" aria-label="${t.modesLabel}">${EMBED_MODES.map(
      (m) =>
        html`<button type="button" class="e-mode" data-mode="${m}" aria-pressed="${String(m === view.mode)}">${t.mode[m]}</button>`,
    )}</div>
    <div class="canvas-host e-stage" id="canvas-host">
      <div class="fallback" id="r-fallback">${fallbackVisual(r, track, view)}</div>
      <p class="e-load" id="e-load" hidden><button type="button" class="e-load-btn" id="load-3d">${t.load3d}</button><span class="e-load-note" id="e-load-note">${t.loadNote}</span></p>
      <button type="button" class="tool e-reset" id="e-reset" aria-label="${t.reset}" hidden><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 8.5A6 6 0 1 1 5 13.5M4.5 3.5v5h5" /></svg></button>
    </div>
    <p class="e-credit"><a href="https://sketchfab.com/3d-models/low-poly-f1-0ac02bfa81f64549be15acaa78f36f29" target="_blank" rel="noopener external">${t.modelCredit}</a></p>
    <div class="e-readout" id="r-readout" aria-live="polite">${embedReadout(r, track, lang, view)}</div>`;
  },

  // Derived visualisation: the same mapping as the 3D car (derivedMetrics.ts), front and rear as text.
  car: ({ r, t, f, full }) => {
    const value = (v: number | null, digits: number) =>
      v == null ? nd(t) : html`${f.num(1 + 4 * v, digits)}<span class="e-of">/5</span>`;
    return html`<ul class="e-demand">${DEMAND_VIEWS.map((key) => {
      const view = deriveView(r, key, PAGE.derivedText);
      const digits = key === 'longitudinal' ? 1 : 0;
      return html`<li>
        <p class="e-demand-title">${t.demandView[key]}</p>
        ${carPlanSvg(view, t.planLabel(t.demandView[key]))}
        <div class="e-demand-text">
          <p class="e-demand-row"><span class="e-axle">${t.front}</span> <span class="e-fig">${value(view.corners.FL.intensity, digits)}</span></p>
          <p class="e-demand-row"><span class="e-axle">${t.rear}</span> <span class="e-fig">${value(view.corners.RL.intensity, digits)}</span></p>
        </div>
      </li>`;
    })}</ul>
    <p class="e-legend" aria-hidden="true"><span>${t.low}</span><span class="e-legend-bar" style="background:linear-gradient(90deg,${HEAT_STOPS.join(',')})"></span><span>${t.high}</span></p>
    <p class="e-derived">${t.derived} <a href="${full}" target="_blank" rel="noopener">${t.method} ↗</a></p>`;
  },

  demands: (c) =>
    html`<p class="e-caption">${c.t.ratingScale}</p>${ratingRows(
      c,
      characteristicsFor(c.r).map((x) => x.key),
    )}`,

  setup: ({ r, t, f }) => {
    const s = r.setup;
    const psi = (v: number | null | undefined, prefix = '') =>
      v == null ? null : `${prefix}${f.num(v, 1)} psi`;
    const showRunning = !(s.expectedRunningPressurePsi === null && r.season < 2026);
    return html`<p class="e-caption">${t.slick}</p><dl class="e-pairs">
      <div class="e-pair"><dt>${t.minPressure}<span class="e-note">${t.minPressureNote}</span></dt>
        <dd>${axlePair(t, psi(s.minimumStartingPressurePsi?.front), psi(s.minimumStartingPressurePsi?.rear))}</dd></div>
      ${showRunning ? html`<div class="e-pair"><dt>${t.runningPressure}</dt><dd>${axlePair(t, psi(s.expectedRunningPressurePsi?.front, '≥ '), psi(s.expectedRunningPressurePsi?.rear, '≥ '))}</dd></div>` : ''}
      <div class="e-pair"><dt>${t.camber}</dt><dd>${axlePair(t, f.num(s.camberLimitDeg?.front, 2, '°'), f.num(s.camberLimitDeg?.rear, 2, '°'))}</dd></div>
    </dl>`;
  },

  circuit: ({ r, track, t, f }) => {
    const c = r.circuit;
    const pit = c.pitStopLoss;
    const row = (label: string, value: string | null, note: string | null = null) =>
      html`<div class="e-fact"><dt>${label}</dt> <dd>${value ?? nd(t)}${value && note ? html`<span class="e-note">${note}</span>` : ''}</dd></div>`;
    const map = track ? trackPathD(track) : null;
    return html`${
      map
        ? html`<svg class="e-map" viewBox="${map.viewBox}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${c.name ?? r.race.name}"><path d="${map.d}" class="e-map-casing"/><path d="${map.d}" class="e-map-line"/></svg>`
        : html`<p class="e-map e-empty">${t.noTrack}</p>`
    }<dl class="e-facts">
      ${row(t.length, f.num(c.lengthKm, 3, ' km'))}
      ${row(t.laps, c.laps == null ? null : String(c.laps))}
      ${row(t.distance, f.num(c.raceDistanceKm, 3, ' km'))}
      ${row(t.pitLoss, pit ? f.num(pit.seconds, 1, ' s') : null, pit && pit.kind !== 'unspecified' ? t.pitKind[pit.kind] : null)}
      ${row(t.lapRecord, c.lapRecord?.time ?? null, c.lapRecord ? `${c.lapRecord.driver}, ${c.lapRecord.year}` : null)}
    </dl>`;
  },

  summary: (c) => {
    const { r, t, f } = c;
    // Sorting Pirelli's own ratings, not deriving new values: the three highest, ties in Pirelli's order.
    const top = characteristicsFor(r)
      .map((x) => x.key)
      .filter((k) => r.characteristics[k] != null)
      .sort((a, b) => (r.characteristics[b] ?? 0) - (r.characteristics[a] ?? 0))
      .slice(0, 3);
    const p = r.setup.minimumStartingPressurePsi;
    return html`<div class="e-identity">
        <p class="e-title">${r.race.name}</p>
        <p class="e-venue">${[r.circuit.name, f.dates(r.race)].filter(Boolean).join(' · ') || t.notProvided}</p>
      </div>
      ${compoundRow(c)}
      <p class="e-caption">${t.topDemands} <span class="e-caption-aside">${t.ratingScale}</span></p>
      ${ratingRows(c, top)}
      <dl class="e-pairs e-pairs-inline"><div class="e-pair"><dt>${t.minPressureShort}</dt>
        <dd>${axlePair(t, p?.front == null ? null : `${f.num(p.front, 1)} psi`, p?.rear == null ? null : `${f.num(p.rear, 1)} psi`)}</dd></div></dl>`;
  },
};

/* ------------------------------------------------------------------ document */

export interface EmbedContext {
  record: RaceRecord;
  track: TrackShape | null;
  panel: EmbedPanel;
  lang: EmbedLang;
  base: string;
  siteUrl: string;
}

/** Fills embed.html's placeholders. */
interface Shell {
  lang: EmbedLang;
  panel: string;
  title: string;
  canonical: string;
  siteUrl: string;
  kicker: string;
  sub: string;
  body: SafeHtml;
  source: SafeHtml;
  after?: SafeHtml;
}

/** The page every embed shares: head, theme wrapper, header, provenance footer. */
function embedDocument(template: string, d: Shell): string {
  const t = STRINGS[d.lang];
  const head = html`<title>${d.title} | F1 Stories</title>
    <meta name="robots" content="noindex" />
    <link rel="canonical" href="${d.canonical}" />`;
  // id="dark": the iframe URL's #dark fragment makes this :target and switches it to the charcoal theme.
  const body = html`<div class="e-root" id="dark"><article class="e" data-panel="${d.panel}">
    <header class="e-head">
      <p class="e-kicker">${d.kicker}</p>
      <p class="e-race">${d.sub}</p>
    </header>
    <div class="e-body">${d.body}</div>
    <footer class="e-foot">
      <p class="e-source">${t.source}: ${d.source}</p>
      <p class="e-brand"><a href="${d.canonical}" target="_blank" rel="noopener"><span class="e-wordmark">F1 STORIES<span class="e-dot">.</span></span> <span class="e-open">${t.open} ↗</span><span class="e-site" hidden>Tyre Intelligence · ${d.siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span></a></p>
    </footer>
  </article></div>${d.after ?? ''}`;
  return template
    .replace('<html lang="en-GB">', () => `<html lang="${escapeHtml(d.lang)}">`)
    .replace(/<title>.*?<\/title>/s, () => '')
    .replace('<!--embed:head-->', () => head.value)
    .replace('<!--embed:body-->', () => body.value);
}

export function renderEmbed(template: string, ctx: EmbedContext): string {
  const { record: r, panel, lang } = ctx;
  const t = STRINGS[lang];
  const full = new URL(racePath('', r), ctx.siteUrl).href;
  const c: Ctx = { full, lang, r, track: ctx.track, t, f: fmt(t) };
  const published = c.f.published(r.source.publishedAt);
  return embedDocument(template, {
    lang,
    panel,
    title: `${t.panel[panel]}: ${r.race.name} ${r.season}`,
    canonical: full,
    siteUrl: ctx.siteUrl,
    kicker: t.panel[panel],
    sub: `${r.round ? `${t.round(r.round)} · ` : ''}${r.season}${panel === 'summary' ? '' : ` · ${r.race.name}`}`,
    body: PANELS[panel](c),
    source: html`<a href="${safeUrl(r.source.articleUrl)}" target="_blank" rel="noopener external">Pirelli</a>${published ? ` · ${published}` : ''} · <span class="e-status" data-status="${r.validation.status}">${t.status[r.validation.status]}</span>`,
    after:
      panel === '3d'
        ? html`<script type="application/json" id="boot">${new SafeHtml(inlineJson({ record: r, track: ctx.track, lang }))}</script>`
        : undefined,
  });
}

/* ------------------------------------------------------------------ season strip */

const compoundNumber = (id: string) => (/^C\d{1,2}$/.test(id) ? Number(id.slice(1)) : null);

/**
 * Compound choices across a season, Pirelli-style: compounds as rows (C1 hardest at the top), rounds as
 * columns, a marker in the weekend role's colour where a compound was nominated. A real table, so it reads
 * row by row with a screen reader. Only published previews appear.
 */
export function seasonStrip(
  races: ManifestRace[],
  lang: EmbedLang,
  currentId: string | null = null,
): SafeHtml {
  const t = STRINGS[lang];
  const list = [...races].sort(
    (a, b) => (a.round ?? 99) - (b.round ?? 99) || (a.startDate ?? '').localeCompare(b.startDate ?? ''),
  );
  const ids = list.flatMap((r) => r.compounds?.map((c) => c.compound) ?? []);
  const nums = ids.map(compoundNumber).filter((n): n is number => n != null);
  if (!ids.length) return html`<p class="ss-empty">${t.noCompounds}</p>`;
  // Every C-number between the softest and hardest nominated, so gaps in the range stay visible.
  const rows = [
    ...(nums.length
      ? Array.from(
          { length: Math.max(...nums) - Math.min(...nums) + 1 },
          (_, i) => `C${Math.min(...nums) + i}`,
        )
      : []),
    ...[...new Set(ids.filter((id) => compoundNumber(id) == null))].sort(),
  ];
  const current = (r: ManifestRace) => (r.id === currentId ? html` class="is-current"` : '');
  return html`<div class="ss-scroll" style="--rows:${rows.length}"><table class="ss" style="--cols:${list.length}">
    <caption class="visually-hidden">${t.seasonTitle(list[0]!.season)}</caption>
    <thead><tr><th scope="col" class="ss-corner"><span class="visually-hidden">${t.compoundCol}</span></th>${list.map(
      (r) =>
        html`<th scope="col"${current(r)}${r.id === currentId ? html` aria-current="true"` : ''}><span aria-hidden="true">${r.round ? `R${r.round}` : '–'}</span><span class="visually-hidden">${r.name}${r.compounds ? '' : `, ${t.notProvided}`}</span></th>`,
    )}</tr></thead>
    <tbody>${rows.map(
      (id) =>
        html`<tr><th scope="row">${id}</th>${list.map((r) => {
          const c = r.compounds?.find((x) => x.compound === id);
          return html`<td${current(r)}>${c ? html`<span class="ss-mark" data-label="${c.raceLabel}" title="${`${r.name}: ${id} ${t.compound[c.raceLabel] ?? c.raceLabel}`}"><span class="visually-hidden">${t.compound[c.raceLabel] ?? c.raceLabel}</span></span>` : ''}</td>`;
        })}</tr>`,
    )}</tbody>
  </table></div>
  <p class="ss-legend" aria-hidden="true">${['hard', 'medium', 'soft'].map(
    (l) => html`<span><span class="ss-mark" data-label="${l}"></span>${t.compound[l]}</span>`,
  )}</p>`;
}

export interface SeasonEmbedContext {
  season: number;
  races: ManifestRace[];
  lang: EmbedLang;
  base: string;
  siteUrl: string;
}

export function renderSeasonEmbed(template: string, ctx: SeasonEmbedContext): string {
  const t = STRINGS[ctx.lang];
  const counts = new Map<DataStatus, number>();
  for (const r of ctx.races) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  const latest = [...ctx.races].sort((a, b) => (b.round ?? 0) - (a.round ?? 0))[0];
  return embedDocument(template, {
    lang: ctx.lang,
    panel: 'season',
    title: t.seasonTitle(ctx.season),
    canonical: latest ? new URL(racePath('', latest), ctx.siteUrl).href : ctx.siteUrl,
    siteUrl: ctx.siteUrl,
    kicker: t.seasonPanel,
    sub: t.seasonTitle(ctx.season),
    body: html`<p class="e-caption">${t.roundsNote(ctx.races.length)}</p>${seasonStrip(ctx.races, ctx.lang)}`,
    source: html`${t.previews} · ${[...counts].map(([s, n]) => `${n} ${t.statusShort[s]}`).join(', ')}`,
  });
}

/* ------------------------------------------------------------------ 3D embed */

/** The 3D embed script's own messages (loading, failure), from the same glossary. */
export const embedText = (lang: EmbedLang) => STRINGS[lang];

export const EMBED_MODES = ['car', 'circuit', 'tyres'] as const;
export type EmbedMode = (typeof EMBED_MODES)[number];

/**
 * The text that accompanies the 3D/drawing for the current view: every fact the visual shows is also
 * here as HTML. Rendered at build time and re-rendered by src/embed3d.ts as the reader changes view.
 */
export function embedReadout(
  r: RaceRecord,
  track: TrackShape | null,
  lang: EmbedLang,
  view: { mode: EmbedMode; carView: CarView },
): SafeHtml {
  const t = STRINGS[lang];
  const f = fmt(t);
  const nd2 = nd(t);
  if (view.mode === 'car') {
    const d = deriveView(r, view.carView, PAGE.derivedText);
    const p = r.setup.minimumStartingPressurePsi;
    const shown = (corner: 'FL' | 'RL', psi: number | null | undefined) => {
      if (view.carView === 'pressures')
        return psi == null ? nd2 : html`${f.num(psi, 1)}<span class="e-of"> psi</span>`;
      const v = d.corners[corner].intensity;
      return v == null
        ? nd2
        : html`${f.num(1 + 4 * v, view.carView === 'longitudinal' ? 1 : 0)}<span class="e-of">/5</span>`;
    };
    return html`<div class="e-chips" role="group" aria-label="${t.viewsLabel}">${CAR_VIEWS_3D.map(
      (v) =>
        html`<button type="button" class="e-chip" data-view="${v}" aria-pressed="${String(v === view.carView)}">${t.demandView[v]}</button>`,
    )}</div>
    <p class="e-values"><span class="e-axle">${t.front}</span> <span class="e-fig">${shown('FL', p?.front)}</span> <span class="e-axle">${t.rear}</span> <span class="e-fig">${shown('RL', p?.rear)}</span></p>
    <p class="e-derived">${view.carView === 'pressures' ? `${t.minPressure}. ${t.minPressureNote}.` : t.derived}</p>`;
  }
  if (view.mode === 'circuit') {
    const c = r.circuit;
    const line = [c.name, f.num(c.lengthKm, 3, ' km'), c.laps == null ? null : t.laps2(c.laps)]
      .filter(Boolean)
      .join(' · ');
    return html`<p class="e-line">${line || t.notProvided}</p><p class="e-values"></p>
      <p class="e-derived">${track ? t.outline(track.source.name, track.source.license) : t.noTrack}</p>`;
  }
  const list = sortedCompounds(r);
  return html`<p class="e-line">${list.length ? list.map((c) => `${c.compound} ${t.compound[c.raceLabel] ?? c.raceLabel}`).join(' · ') : t.noCompounds}</p><p class="e-values"></p>
    <p class="e-derived">${t.tyresNote}</p>`;
}

const CAR_VIEWS_3D: CarView[] = ['longitudinal', 'lateral', 'stress', 'brakingTraction', 'pressures'];
