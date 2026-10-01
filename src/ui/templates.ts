/**
 * Pure render functions. Used by the browser AND by the build-time prerender (vite.config.ts),
 * so every page ships with the full race data as real HTML.
 */
import {
  CAR_VIEWS,
  type CarView,
  CORNERS,
  type Corner,
  DERIVED_LABEL,
  deriveView,
  HEAT_STOPS,
  heatColour,
  VIEW_TITLES,
} from '../domain/derivedMetrics.ts';
import {
  characteristicsFor,
  compoundCssVar,
  eventDates,
  fixed,
  NOT_PROVIDED,
  publishedText,
  RACE_LABEL_ORDER,
  STATUS_TEXT,
  shortDate,
  signedDeg,
} from '../domain/format.ts';
import type { Manifest, RaceRecord, TrackShape } from '../domain/schema.ts';
import { allRaces, neighbours } from '../domain/selection.ts';
import { racePath } from '../domain/urlState.ts';
import { carPlanSvg, circuitSvg } from './fallbackSvg.ts';
import { html, type SafeHtml, safeUrl } from './html.ts';

export const MODES = ['car', 'circuit', 'tyres', 'data'] as const;
export type Mode = (typeof MODES)[number];

export interface ViewState {
  mode: Mode;
  carView: CarView;
  corner: Corner | null;
  compound: string | null;
}

export const DEFAULT_VIEW: ViewState = { mode: 'car', carView: 'longitudinal', corner: null, compound: null };

export const heroWord = (r: RaceRecord) =>
  r.slug
    .split('-')
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');

const CORNER_NAMES: Record<Corner, string> = {
  FL: 'Front left',
  FR: 'Front right',
  RL: 'Rear left',
  RR: 'Rear right',
};

export const sortedCompounds = (r: RaceRecord) =>
  [...(r.compounds ?? [])].sort(
    (a, b) => RACE_LABEL_ORDER.indexOf(a.raceLabel) - RACE_LABEL_ORDER.indexOf(b.raceLabel),
  );

/* ------------------------------------------------------------------ identity */

export function identity(r: RaceRecord): SafeHtml {
  const dates = eventDates(r.race);
  return html`
    <p class="kicker">${r.round ? `Round ${r.round}` : 'Round not provided'}<span class="kicker-sep"><span class="visually-hidden">, </span></span>${r.season} season</p>
    <h1 id="race-title" class="race-title">${r.race.name}</h1>
    <p class="venue">${r.circuit.name ?? NOT_PROVIDED}</p>
    <p class="place">${r.race.location ?? ''}</p>
    <p class="dates">${dates ? html`<time datetime="${r.race.startDate}">${dates}</time>` : html`<span class="muted">Event dates not provided</span>`}</p>`;
}

/* ------------------------------------------------------------------ specs */

function spec(
  label: string,
  value: string,
  unit: string | null,
  note: SafeHtml | string | null = null,
  id = '',
): SafeHtml {
  const missing = value === NOT_PROVIDED;
  return html`<div class="spec${missing ? ' is-missing' : ''}">
    <dt>${label}</dt>
    <dd><span class="figure" ${id ? html`data-figure="${id}"` : ''}>${value}</span>${!missing && unit ? html`<span class="unit">${unit}</span>` : ''}
    ${note ? html`<span class="spec-note">${note}</span>` : ''}</dd>
  </div>`;
}

export function specs(r: RaceRecord): SafeHtml {
  const c = r.circuit;
  const lr = c.lapRecord;
  const pit = c.pitStopLoss;
  return html`<h2 class="section-title">Circuit</h2>
    <dl class="spec-list">
      ${spec('Circuit length', fixed(c.lengthKm, 3), 'km', null, 'length')}
      ${spec('Laps', c.laps == null ? NOT_PROVIDED : String(c.laps), null, null, 'laps')}
      ${spec('Race distance', c.raceDistanceKm == null ? NOT_PROVIDED : String(c.raceDistanceKm), 'km', null, 'distance')}
      ${spec(
        'Pit-stop time loss',
        pit ? pit.seconds.toFixed(1) : NOT_PROVIDED,
        's',
        pit
          ? pit.kind === 'estimate'
            ? 'Pirelli estimate'
            : pit.kind === 'average'
              ? 'Pirelli average'
              : null
          : null,
        'pit',
      )}
      ${spec('Lap record', lr?.time ?? NOT_PROVIDED, null, lr ? `${lr.driver}, ${lr.year}` : null)}
    </dl>`;
}

/* ------------------------------------------------------------------ ratings */

export function ratings(r: RaceRecord): SafeHtml {
  const rows = characteristicsFor(r).map(({ key, label }) => {
    const v = r.characteristics[key] ?? null;
    return html`<li class="rating${v == null ? ' is-missing' : ''}" style="--v:${v ?? 0};--heat:${v ? `var(--heat-${v})` : 'transparent'}">
      <span class="rating-label">${label}</span>
      <span class="scale" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
      <span class="rating-value">${v == null ? html`<span class="nd">Not provided</span>` : html`${v}<span class="of"> / 5</span>`}</span>
    </li>`;
  });
  return html`<header class="section-title"><h2>Track demands</h2><p class="section-aside">Pirelli rating, 1–5</p></header>
    <ul class="rating-list">${rows}</ul>
    <details class="explain">
      <summary>What the ratings mean</summary>
      <dl>${characteristicsFor(r).map((c) => html`<dt>${c.label}</dt><dd>${c.explain}</dd>`)}</dl>
    </details>`;
}

/* ------------------------------------------------------------------ setup */

function pair(label: string, front: string, rear: string, note?: string): SafeHtml {
  return html`<div class="pair">
    <dt>${label}${note ? html`<span class="pair-note">${note}</span>` : ''}</dt>
    <dd><span class="axle">Front</span><span class="figure sm">${front}</span></dd>
    <dd><span class="axle">Rear</span><span class="figure sm">${rear}</span></dd>
  </div>`;
}

export function setup(r: RaceRecord): SafeHtml {
  const s = r.setup;
  const psi = (v: number | null | undefined, prefix = '') =>
    v == null ? NOT_PROVIDED : `${prefix}${v.toFixed(1)} psi`;
  return html`<header class="section-title"><h2>Setup limits</h2><p class="section-aside">18-inch slick</p></header>
    <dl class="pair-list">
      ${pair('Minimum starting pressure', psi(s.minimumStartingPressurePsi?.front), psi(s.minimumStartingPressurePsi?.rear), 'Subject to change after FP2')}
      ${s.expectedRunningPressurePsi === null && r.season < 2026 ? '' : pair('Expected running pressure', psi(s.expectedRunningPressurePsi?.front, '≥ '), psi(s.expectedRunningPressurePsi?.rear, '≥ '))}
      ${pair('End-of-straight camber limit', signedDeg(s.camberLimitDeg?.front), signedDeg(s.camberLimitDeg?.rear))}
    </dl>`;
}

/* ------------------------------------------------------------------ compounds */

export function compounds(r: RaceRecord, selected: string | null): SafeHtml {
  const list = sortedCompounds(r);
  if (!list.length)
    return html`<h2 class="section-title" id="compounds-title">Weekend compounds</h2><p class="muted">Compounds not provided.</p>`;
  return html`<h2 class="section-title" id="compounds-title">Weekend compounds</h2>
    <ul class="compound-list">
      ${list.map(
        (c) => html`<li>
          <button type="button" class="compound" data-compound="${c.compound}" data-label="${c.raceLabel}" aria-pressed="${String(selected === c.compound)}"
            style="--tone:${compoundCssVar(c.raceLabel)}">
            <span class="disc" aria-hidden="true"><span>${c.compound}</span></span>
            <span class="compound-text"><span class="compound-label">${c.raceLabel}</span><span class="compound-id">${c.compound}</span></span>
          </button>
        </li>`,
      )}
    </ul>`;
}

/* ------------------------------------------------------------------ title block (provenance) */

export function titleBlock(r: RaceRecord): SafeHtml {
  const st = STATUS_TEXT[r.validation.status];
  return html`<h2 class="visually-hidden">Source</h2>
    <dl class="tb">
      <div class="tb-cell tb-source">
        <dt>Source</dt>
        <dd><a href="${safeUrl(r.source.articleUrl)}" rel="noopener external" target="_blank">${r.source.articleTitle}<span class="visually-hidden"> (Pirelli press area, opens in a new tab)</span></a></dd>
      </div>
      <div class="tb-cell"><dt>Publisher</dt><dd>Pirelli Motorsport press</dd></div>
      <div class="tb-cell"><dt>Published</dt><dd>${publishedText(r.source.publishedAt)}</dd></div>
      <div class="tb-cell"><dt>Retrieved</dt><dd>${shortDate(r.source.retrievedAt)}</dd></div>
      <div class="tb-cell">
        <dt>Record</dt>
        <dd>${r.id}${r.source.previewAssetUrl ? html`, <a href="${safeUrl(r.source.previewAssetUrl)}" rel="noopener external" target="_blank">official graphic<span class="visually-hidden"> (opens in a new tab)</span></a>` : ''}</dd>
      </div>
      <div class="tb-cell tb-status" data-status="${r.validation.status}">
        <dt>Data status</dt>
        <dd><strong>${st.label}</strong> <span class="tb-explain">${st.explain}</span></dd>
      </div>
    </dl>`;
}

/* ------------------------------------------------------------------ viewport readout */

function heatLegend(): SafeHtml {
  return html`<div class="heat-legend" aria-hidden="true">
    <span>Low</span><span class="heat-bar" style="background:linear-gradient(90deg,${HEAT_STOPS.join(',')})"></span><span>High</span>
  </div>`;
}

export function carViews(active: CarView): SafeHtml {
  return html`<div class="chips" role="group" aria-label="Car visualisation">
    ${CAR_VIEWS.map((v) => html`<button type="button" class="chip" data-view="${v}" aria-pressed="${String(v === active)}">${VIEW_TITLES[v]}</button>`)}
  </div>`;
}

export function readout(r: RaceRecord, track: TrackShape | null, s: ViewState): SafeHtml {
  if (s.mode === 'car') {
    const view = deriveView(r, s.carView);
    return html`${carViews(s.carView)}
      <div class="corners" role="group" aria-label="Tyres">
        ${CORNERS.map((c) => {
          const v = view.corners[c];
          return html`<button type="button" class="corner" data-corner="${c}" aria-pressed="${String(s.corner === c)}">
            <span class="swatch" style="background:${heatColour(v.intensity)}" aria-hidden="true"></span>
            <span class="corner-name">${CORNER_NAMES[c]}</span>
            <span class="corner-value">${v.display}</span>
          </button>`;
        })}
      </div>
      ${heatLegend()}
      <p class="derived"><strong>${DERIVED_LABEL}.</strong> ${view.method} Colours show relative demand, not temperature.</p>`;
  }
  if (s.mode === 'circuit') {
    return html`<p class="readout-line"><strong>${r.circuit.name ?? 'Circuit'}</strong>${r.circuit.lengthKm ? `, ${r.circuit.lengthKm.toFixed(3)} km` : ''}${r.circuit.laps ? `, ${r.circuit.laps} laps` : ''}.</p>
      <p class="derived">${
        track
          ? html`Outline: <a href="${safeUrl(track.source.url)}" rel="noopener external" target="_blank">${track.source.name}</a> (${track.source.license}). Sector boundaries and elevation are not published in a reusable form, so none are drawn.`
          : 'No licensed outline is available for this circuit yet.'
      }</p>`;
  }
  if (s.mode === 'tyres') {
    const list = sortedCompounds(r);
    const sel = list.find((c) => c.compound === s.compound) ?? list[1] ?? list[0];
    return html`<p class="readout-line">${
      sel
        ? html`<strong>${sel.compound}</strong> runs as the <strong>${sel.raceLabel}</strong> tyre this weekend.`
        : 'Compounds not provided.'
    }</p>
      <p class="derived">Pirelli picks three slick compounds per race from its range. Sidewall colours mark the weekend role: white hard, yellow medium, red soft. Select a compound below or in the scene.</p>`;
  }
  return html`<p class="derived">Every value on this page as a table, with its origin.</p>`;
}

/* ------------------------------------------------------------------ data table */

export function dataTable(r: RaceRecord): SafeHtml {
  const origin = (group: keyof RaceRecord['provenance']) => {
    const p = r.provenance[group];
    if (!p) return 'Origin not recorded';
    return {
      'article-jsonld': 'From the article metadata',
      'article-text': 'From the article text',
      'media-filename': 'From the media kit file name',
      'infographic-transcription': 'Transcribed from the official preview graphic',
      manual: 'Entered manually from the source',
    }[p.method];
  };
  const psi = (v: number | null | undefined) => (v == null ? NOT_PROVIDED : `${v.toFixed(1)} psi`);
  const s = r.setup;
  const c = r.circuit;
  type Row = [string, string, string];
  const groups: [string, keyof RaceRecord['provenance'], Row[]][] = [
    [
      'Circuit',
      'circuit',
      [
        ['Circuit length', fixed(c.lengthKm, 3, ' km'), 'Length of one lap.'],
        ['Laps', c.laps == null ? NOT_PROVIDED : String(c.laps), 'Scheduled race laps.'],
        [
          'Race distance',
          c.raceDistanceKm == null ? NOT_PROVIDED : `${c.raceDistanceKm} km`,
          'Scheduled race distance.',
        ],
        [
          'Lap record',
          c.lapRecord ? `${c.lapRecord.time} (${c.lapRecord.driver}, ${c.lapRecord.year})` : NOT_PROVIDED,
          'Fastest race lap as listed by Pirelli.',
        ],
        [
          'Pit-stop time loss',
          c.pitStopLoss ? `${c.pitStopLoss.seconds.toFixed(1)} s, ${c.pitStopLoss.kind}` : NOT_PROVIDED,
          'Time lost driving through the pit lane for a stop.',
        ],
      ],
    ],
    [
      'Track demands (1 low – 5 high)',
      'characteristics',
      characteristicsFor(r).map(
        (x): Row => [
          x.label,
          r.characteristics[x.key] == null ? NOT_PROVIDED : `${r.characteristics[x.key]} / 5`,
          x.explain,
        ],
      ),
    ],
    [
      'Setup limits',
      'setup',
      [
        [
          'Min. starting pressure, front',
          psi(s.minimumStartingPressurePsi?.front),
          'Lowest cold pressure allowed at the start.',
        ],
        [
          'Min. starting pressure, rear',
          psi(s.minimumStartingPressurePsi?.rear),
          'Lowest cold pressure allowed at the start.',
        ],
        [
          'Expected running pressure, front',
          psi(s.expectedRunningPressurePsi?.front),
          'Stabilised pressure expected on track.',
        ],
        [
          'Expected running pressure, rear',
          psi(s.expectedRunningPressurePsi?.rear),
          'Stabilised pressure expected on track.',
        ],
        [
          'Camber limit, front',
          signedDeg(s.camberLimitDeg?.front),
          'Maximum negative camber, measured at the end of the straight.',
        ],
        [
          'Camber limit, rear',
          signedDeg(s.camberLimitDeg?.rear),
          'Maximum negative camber, measured at the end of the straight.',
        ],
      ],
    ],
    [
      'Compounds',
      'compounds',
      sortedCompounds(r).map(
        (x): Row => [
          `${x.raceLabel[0]!.toUpperCase()}${x.raceLabel.slice(1)}`,
          x.compound,
          'Compound nominated for this weekend.',
        ],
      ),
    ],
  ];
  return html`<table class="data-table">
    <caption id="data-caption">${r.race.name} ${r.season}: all published values</caption>
    <thead><tr><th scope="col">Value</th><th scope="col">Figure</th><th scope="col">Meaning</th></tr></thead>
    ${groups.map(
      ([title, key, rows]) => html`<tbody>
        <tr><th scope="rowgroup" colspan="3" class="group">${title}<span class="origin">${origin(key)}</span></th></tr>
        ${rows.map(
          ([a, b, m]) =>
            html`<tr${b === NOT_PROVIDED ? html` class="is-missing"` : ''}><th scope="row">${a}</th><td>${b}</td><td>${m}</td></tr>`,
        )}
      </tbody>`,
    )}
  </table>`;
}

/* ------------------------------------------------------------------ fallback visual */

export function fallbackVisual(r: RaceRecord, track: TrackShape | null, s: ViewState): SafeHtml {
  if (s.mode === 'circuit') return circuitSvg(track, r.circuit.name ?? 'the circuit');
  if (s.mode === 'tyres') {
    return html`<div class="fallback-tyres" role="img" aria-label="${sortedCompounds(r)
      .map((c) => `${c.compound} ${c.raceLabel}`)
      .join(', ')}">
      ${sortedCompounds(r).map(
        (c) =>
          html`<span class="fallback-tyre${c.compound === s.compound ? ' is-selected' : ''}" style="--tone:${compoundCssVar(c.raceLabel)}"><span>${c.compound}</span></span>`,
      )}
    </div>`;
  }
  return carPlanSvg(deriveView(r, s.carView));
}

/* ------------------------------------------------------------------ archive (static links for crawlers and no-JS) */

export function archive(manifest: Manifest, base: string, currentId: string | null): SafeHtml {
  return html`<nav class="archive" aria-labelledby="archive-title">
    <h2 id="archive-title" class="section-title">All previews</h2>
    ${manifest.years.map(
      (y) => html`<div class="archive-year"><h3>${y.year}</h3><ul>
        ${[...y.races].map(
          (race) =>
            html`<li><a href="${racePath(base, race)}"${race.id === currentId ? html` aria-current="page"` : ''}>${
              race.round ? html`<span class="archive-round">R${race.round}</span>` : ''
            }${race.name}</a></li>`,
        )}
      </ul></div>`,
    )}
  </nav>`;
}

/* ------------------------------------------------------------------ previous / next (real links, work without JS) */

export function stepper(manifest: Manifest, base: string, currentId: string): SafeHtml {
  const current = allRaces(manifest).find((r) => r.id === currentId);
  const { prev, next } = current ? neighbours(manifest, current) : { prev: null, next: null };
  const link = (id: 'prev' | 'next', race: typeof prev, word: string, icon: SafeHtml) =>
    race
      ? html`<a class="step" id="${id}" rel="${id}" href="${racePath(base, race)}" data-race="${race.id}" aria-label="${`${word}: ${race.name} ${race.season}`}">${id === 'prev' ? icon : ''}<span>${word}</span>${id === 'next' ? icon : ''}</a>`
      : html`<a class="step" id="${id}" role="link" aria-disabled="true">${id === 'prev' ? icon : ''}<span>${word}</span>${id === 'next' ? icon : ''}</a>`;
  return html`<div class="stepper">
    ${link('prev', prev, 'Previous', html`<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5" /></svg>`)}
    ${link('next', next, 'Next', html`<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5 13 10l-5.5 5.5" /></svg>`)}
  </div>`;
}
