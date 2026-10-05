/**
 * Pure render functions. Used by the browser AND by the build-time prerender (vite.config.ts),
 * so every page ships with the full race data as real HTML.
 */
import {
  CAR_VIEWS,
  type CarView,
  CORNERS,
  type Corner,
  deriveView,
  HEAT_STOPS,
  heatColour,
} from '../domain/derivedMetrics.ts';
import { characteristicsFor, compoundCssVar, RACE_LABEL_ORDER } from '../domain/format.ts';
import type { Manifest, RaceRecord, TrackShape } from '../domain/schema.ts';
import { allRaces, neighbours } from '../domain/selection.ts';
import { racePath } from '../domain/urlState.ts';
import { carPlanSvg, circuitSvg } from './fallbackSvg.ts';
import { html, type SafeHtml, safeUrl } from './html.ts';
import { fmt, PAGE, STRINGS } from './strings.ts';

const T = STRINGS.el;
const F = fmt(T);
const NP = T.notProvided;
const num = (v: number | null | undefined, digits: number, unit = '') => F.num(v, digits, unit) ?? NP;
const psi = (v: number | null | undefined, prefix = '') => (v == null ? NP : `${prefix}${F.num(v, 1)} psi`);
const derive = (r: RaceRecord, view: CarView) => deriveView(r, view, PAGE.derivedText);
const distanceKm = (v: number | null | undefined) =>
  v == null ? NP : new Intl.NumberFormat(T.locale, { maximumFractionDigits: 3 }).format(v);
const compoundName = (raceLabel: string) => T.compound[raceLabel] ?? raceLabel;

export const MODES = ['car', 'circuit', 'tyres', 'data'] as const;
export type Mode = (typeof MODES)[number];

export interface ViewState {
  mode: Mode;
  carView: CarView;
  corner: Corner | null;
  compound: string | null;
}

export const DEFAULT_VIEW: ViewState = { mode: 'car', carView: 'longitudinal', corner: null, compound: null };

export const sortedCompounds = (r: RaceRecord) =>
  [...(r.compounds ?? [])].sort(
    (a, b) => RACE_LABEL_ORDER.indexOf(a.raceLabel) - RACE_LABEL_ORDER.indexOf(b.raceLabel),
  );

/* ------------------------------------------------------------------ identity */

export function identity(r: RaceRecord): SafeHtml {
  const meta = [r.circuit.name, r.race.location, F.dates(r.race)].filter(Boolean).join(' · ');
  return html`<h2 id="race-title" class="hero-subtitle">${r.race.name}</h2>${meta ? html`<p class="hero-meta">${meta}</p>` : ''}`;
}

/** The signal band: what this page is and how far to trust it. The status is always visible. */
export function band(r: RaceRecord): SafeHtml {
  const sep = html`<span class="signal-sep" aria-hidden="true"></span>`;
  return html`<span class="signal-live">${PAGE.band.preview} · ${PAGE.band.season(r.season)}</span>${r.round ? html`${sep}<span>${T.round(r.round)}</span>` : ''}${sep}<span data-status="${r.validation.status}">${T.status[r.validation.status]}</span>`;
}

/* ------------------------------------------------------------------ specs */

function spec(
  label: string,
  value: string,
  unit: string | null,
  note: SafeHtml | string | null = null,
  id = '',
): SafeHtml {
  const missing = value === NP;
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
  return html`<h2 class="section-title">${T.panel.circuit}</h2>
    <dl class="spec-list">
      ${spec(T.length, num(c.lengthKm, 3), 'km', null, 'length')}
      ${spec(T.laps, c.laps == null ? NP : String(c.laps), null, null, 'laps')}
      ${spec(T.distance, distanceKm(c.raceDistanceKm), 'km', null, 'distance')}
      ${spec(
        T.pitLoss,
        pit ? num(pit.seconds, 1) : NP,
        's',
        pit && pit.kind !== 'unspecified' ? T.pitKind[pit.kind] : null,
        'pit',
      )}
      ${spec(T.lapRecord, lr?.time ?? NP, null, lr ? `${lr.driver}, ${lr.year}` : null)}
    </dl>`;
}

/* ------------------------------------------------------------------ ratings */

export function ratings(r: RaceRecord): SafeHtml {
  const rows = characteristicsFor(r).map(({ key }) => {
    const v = r.characteristics[key] ?? null;
    return html`<li class="rating${v == null ? ' is-missing' : ''}" style="--v:${v ?? 0};--heat:${v ? `var(--heat-${v})` : 'transparent'}">
      <span class="rating-label">${T.rating[key]}</span>
      <span class="scale" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
      <span class="rating-value">${v == null ? html`<span class="nd">${NP}</span>` : html`${v}<span class="of"> / 5</span>`}</span>
    </li>`;
  });
  return html`<header class="section-title"><h2>${T.panel.demands}</h2><p class="section-aside">${T.ratingScale}</p></header>
    <ul class="rating-list">${rows}</ul>
    <details class="explain">
      <summary>${PAGE.ratingsLink}</summary>
      <dl>${characteristicsFor(r).map((c) => html`<dt>${T.rating[c.key]}</dt><dd>${PAGE.ratingExplain[c.key]}</dd>`)}</dl>
    </details>`;
}

/* ------------------------------------------------------------------ setup */

function pair(label: string, front: string, rear: string, note?: string): SafeHtml {
  return html`<div class="pair">
    <dt>${label}${note ? html`<span class="pair-note">${note}</span>` : ''}</dt>
    <dd><span class="axle">${T.front}</span><span class="figure sm">${front}</span></dd>
    <dd><span class="axle">${T.rear}</span><span class="figure sm">${rear}</span></dd>
  </div>`;
}

export function setup(r: RaceRecord): SafeHtml {
  const s = r.setup;
  return html`<header class="section-title"><h2>${T.panel.setup}</h2><p class="section-aside">${T.slick}</p></header>
    <dl class="pair-list">
      ${pair(T.minPressure, psi(s.minimumStartingPressurePsi?.front), psi(s.minimumStartingPressurePsi?.rear), T.minPressureNote)}
      ${s.expectedRunningPressurePsi === null && r.season < 2026 ? '' : pair(T.runningPressure, psi(s.expectedRunningPressurePsi?.front, '≥ '), psi(s.expectedRunningPressurePsi?.rear, '≥ '))}
      ${pair(T.camber, num(s.camberLimitDeg?.front, 2, '°'), num(s.camberLimitDeg?.rear, 2, '°'))}
    </dl>`;
}

/* ------------------------------------------------------------------ compounds */

export function compounds(r: RaceRecord, selected: string | null): SafeHtml {
  const list = sortedCompounds(r);
  if (!list.length)
    return html`<h2 class="section-title" id="compounds-title">${T.panel.compounds}</h2><p class="muted">${T.noCompounds}</p>`;
  return html`<h2 class="section-title" id="compounds-title">${T.panel.compounds}</h2>
    <ul class="compound-list">
      ${list.map(
        (c) => html`<li>
          <button type="button" class="compound" data-compound="${c.compound}" data-label="${c.raceLabel}" aria-pressed="${String(selected === c.compound)}"
            style="--tone:${compoundCssVar(c.raceLabel)}">
            <span class="disc" aria-hidden="true"><span>${c.compound}</span></span>
            <span class="compound-text"><span class="compound-label">${compoundName(c.raceLabel)}</span><span class="compound-id">${c.compound}</span></span>
          </button>
        </li>`,
      )}
    </ul>`;
}

/* ------------------------------------------------------------------ title block (provenance) */

export function titleBlock(r: RaceRecord): SafeHtml {
  const status = r.validation.status;
  return html`<h2 class="visually-hidden">${PAGE.source.title}</h2>
    <dl class="tb">
      <div class="tb-cell tb-source">
        <dt>${PAGE.source.title}</dt>
        <dd><a href="${safeUrl(r.source.articleUrl)}" rel="noopener external" target="_blank">${r.source.articleTitle}<span class="visually-hidden"> ${PAGE.source.opensNewPress}</span></a></dd>
      </div>
      <div class="tb-cell"><dt>${PAGE.source.publisher}</dt><dd>${PAGE.source.publisherName}</dd></div>
      <div class="tb-cell"><dt>${PAGE.source.published}</dt><dd>${F.publishedTime(r.source.publishedAt) ?? NP}</dd></div>
      <div class="tb-cell"><dt>${PAGE.source.retrieved}</dt><dd>${F.published(r.source.retrievedAt) ?? NP}</dd></div>
      <div class="tb-cell">
        <dt>${PAGE.source.record}</dt>
        <dd>${r.id}${r.source.previewAssetUrl ? html`, <a href="${safeUrl(r.source.previewAssetUrl)}" rel="noopener external" target="_blank">${PAGE.source.graphic}<span class="visually-hidden"> ${PAGE.source.opensNew}</span></a>` : ''}</dd>
      </div>
      <div class="tb-cell tb-status" data-status="${r.validation.status}">
        <dt>${PAGE.source.status}</dt>
        <dd><strong>${T.status[status]}</strong> <span class="tb-explain">${PAGE.statusExplain[status]}</span></dd>
      </div>
    </dl>`;
}

/* ------------------------------------------------------------------ viewport readout */

function heatLegend(): SafeHtml {
  return html`<div class="heat-legend" aria-hidden="true">
    <span>${T.low}</span><span class="heat-bar" style="background:linear-gradient(90deg,${HEAT_STOPS.join(',')})"></span><span>${T.high}</span>
  </div>`;
}

export function carViews(active: CarView): SafeHtml {
  return html`<div class="chips" role="group" aria-label="${PAGE.aria.carViews}">
    ${CAR_VIEWS.map((v) => html`<button type="button" class="chip" data-view="${v}" aria-pressed="${String(v === active)}">${T.demandView[v]}</button>`)}
  </div>`;
}

export function readout(r: RaceRecord, track: TrackShape | null, s: ViewState): SafeHtml {
  if (s.mode === 'car') {
    const view = derive(r, s.carView);
    return html`${carViews(s.carView)}
      <div class="corners" role="group" aria-label="${PAGE.aria.tyres}">
        ${CORNERS.map((c) => {
          const v = view.corners[c];
          return html`<button type="button" class="corner" data-corner="${c}" aria-pressed="${String(s.corner === c)}">
            <span class="swatch" style="background:${heatColour(v.intensity)}" aria-hidden="true"></span>
            <span class="corner-name">${PAGE.corner[c]}</span>
            <span class="corner-value">${v.display}</span>
          </button>`;
        })}
      </div>
      ${heatLegend()}
      <p class="derived"><strong>${PAGE.derivedLabel}</strong> ${view.method} ${PAGE.derivedNote}</p>`;
  }
  if (s.mode === 'circuit') {
    return html`<p class="readout-line"><strong>${r.circuit.name ?? PAGE.readout.circuit}</strong>${r.circuit.lengthKm ? `, ${num(r.circuit.lengthKm, 3)} km` : ''}${r.circuit.laps ? `, ${T.laps2(r.circuit.laps)}` : ''}.</p>
      <p class="derived">${
        track
          ? html`${PAGE.readout.outlineLead} <a href="${safeUrl(track.source.url)}" rel="noopener external" target="_blank">${track.source.name}</a> (${track.source.license}). ${PAGE.readout.outlineTail}`
          : PAGE.noOutline
      }</p>`;
  }
  if (s.mode === 'tyres') {
    const list = sortedCompounds(r);
    const sel = list.find((c) => c.compound === s.compound) ?? list[1] ?? list[0];
    return html`<p class="readout-line">${
      sel
        ? html`<strong>${sel.compound}</strong> ${PAGE.readout.tyresRoleMid} <strong>${compoundName(sel.raceLabel)}</strong> ${PAGE.readout.tyresRoleEnd}`
        : T.noCompounds
    }</p>
      <p class="derived">${PAGE.readout.tyresNote}</p>`;
  }
  return html`<p class="derived">${PAGE.readout.data}</p>`;
}

/* ------------------------------------------------------------------ data table */

export function dataTable(r: RaceRecord): SafeHtml {
  const origin = (group: keyof RaceRecord['provenance']) => {
    const p = r.provenance[group];
    if (!p) return PAGE.source.origin.none;
    return {
      'article-jsonld': PAGE.source.origin.metadata,
      'article-text': PAGE.source.origin.text,
      'media-filename': PAGE.source.origin.filename,
      'infographic-transcription': PAGE.source.origin.vision,
      manual: PAGE.source.origin.manual,
    }[p.method];
  };
  const s = r.setup;
  const c = r.circuit;
  const tb = PAGE.table;
  const axle = (label: string, side: string) => `${label}, ${side.toLowerCase()}`;
  type Row = [string, string, string];
  const groups: [string, keyof RaceRecord['provenance'], Row[]][] = [
    [
      T.panel.circuit,
      'circuit',
      [
        [T.length, num(c.lengthKm, 3, ' km'), tb.lengthNote],
        [T.laps, c.laps == null ? NP : String(c.laps), tb.lapsNote],
        [T.distance, c.raceDistanceKm == null ? NP : `${distanceKm(c.raceDistanceKm)} km`, tb.distanceNote],
        [
          T.lapRecord,
          c.lapRecord ? `${c.lapRecord.time} (${c.lapRecord.driver}, ${c.lapRecord.year})` : NP,
          tb.lapRecordNote,
        ],
        [
          T.pitLoss,
          c.pitStopLoss
            ? `${num(c.pitStopLoss.seconds, 1)} s${c.pitStopLoss.kind === 'unspecified' ? '' : `, ${T.pitKind[c.pitStopLoss.kind]}`}`
            : NP,
          tb.pitLossNote,
        ],
      ],
    ],
    [
      tb.demands,
      'characteristics',
      characteristicsFor(r).map(
        (x): Row => [
          T.rating[x.key],
          r.characteristics[x.key] == null ? NP : `${r.characteristics[x.key]} / 5`,
          PAGE.ratingExplain[x.key],
        ],
      ),
    ],
    [
      T.panel.setup,
      'setup',
      [
        [axle(T.minPressureShort, T.front), psi(s.minimumStartingPressurePsi?.front), tb.minPressureNote],
        [axle(T.minPressureShort, T.rear), psi(s.minimumStartingPressurePsi?.rear), tb.minPressureNote],
        [axle(T.runningPressure, T.front), psi(s.expectedRunningPressurePsi?.front), tb.runningPressureNote],
        [axle(T.runningPressure, T.rear), psi(s.expectedRunningPressurePsi?.rear), tb.runningPressureNote],
        [axle(T.camber, T.front), num(s.camberLimitDeg?.front, 2, '°'), tb.camberNote],
        [axle(T.camber, T.rear), num(s.camberLimitDeg?.rear, 2, '°'), tb.camberNote],
      ],
    ],
    [
      T.panel.compounds,
      'compounds',
      sortedCompounds(r).map((x): Row => [compoundName(x.raceLabel), x.compound, tb.compoundNote]),
    ],
  ];
  return html`<table class="data-table">
    <caption id="data-caption">${tb.caption(r.race.name, r.season)}</caption>
    <thead><tr><th scope="col">${tb.value}</th><th scope="col">${tb.figure}</th><th scope="col">${tb.meaning}</th></tr></thead>
    ${groups.map(
      ([title, key, rows]) => html`<tbody>
        <tr><th scope="rowgroup" colspan="3" class="group">${title}<span class="origin">${origin(key)}</span></th></tr>
        ${rows.map(
          ([a, b, m]) =>
            html`<tr${b === NP ? html` class="is-missing"` : ''}><th scope="row">${a}</th><td>${b}</td><td>${m}</td></tr>`,
        )}
      </tbody>`,
    )}
  </table>`;
}

/* ------------------------------------------------------------------ fallback visual */

export function fallbackVisual(r: RaceRecord, track: TrackShape | null, s: ViewState): SafeHtml {
  if (s.mode === 'circuit') return circuitSvg(track, r.circuit.name);
  if (s.mode === 'tyres') {
    return html`<div class="fallback-tyres" role="img" aria-label="${sortedCompounds(r)
      .map((c) => `${c.compound} ${compoundName(c.raceLabel)}`)
      .join(', ')}">
      ${sortedCompounds(r).map(
        (c) =>
          html`<span class="fallback-tyre${c.compound === s.compound ? ' is-selected' : ''}" style="--tone:${compoundCssVar(c.raceLabel)}"><span>${c.compound}</span></span>`,
      )}
    </div>`;
  }
  return carPlanSvg(derive(r, s.carView));
}

/* ------------------------------------------------------------------ archive (static links for crawlers and no-JS) */

export function archive(manifest: Manifest, base: string, currentId: string | null): SafeHtml {
  return html`<nav class="archive" aria-labelledby="archive-title">
    <h2 id="archive-title" class="section-title">${PAGE.archive.title}</h2>
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
    ${link('prev', prev, PAGE.scope.prev, html`<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5" /></svg>`)}
    ${link('next', next, PAGE.scope.next, html`<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5 13 10l-5.5 5.5" /></svg>`)}
  </div>`;
}

/* ------------------------------------------------------------------ embed dialog and credits */

const D = PAGE.embedDialog;
const radio = (name: string, value: string, label: string, checked = false, extra: SafeHtml | '' = '') =>
  html`<label><input type="radio" name="${name}" value="${value}"${checked ? html` checked` : ''} ${extra} /><span>${label}</span></label>`;

/** The author tool for article embeds (opened from the scope row). */
export function embedDialog(): SafeHtml {
  const panels = [
    ['summary', T.panel.summary],
    ['compounds', T.panel.compounds],
    ['demands', T.panel.demands],
    ['car', T.panel.car],
    ['setup', T.panel.setup],
    ['circuit', T.panel.circuit],
    ['3d', T.panel['3d']],
    ['season', T.seasonPanel],
  ] as const;
  return html`<dialog class="embed-dialog" id="embed-dialog" aria-labelledby="embed-title">
      <form method="dialog" class="embed-form">
        <header class="embed-head">
          <h2 id="embed-title" class="section-title">${D.title}</h2>
          <button type="submit" class="tool" aria-label="${D.close}">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15" /></svg>
          </button>
        </header>
        <fieldset class="embed-choice">
          <legend>${D.panel}</legend>
          ${panels.map(([value, label], i) => radio('embed-panel', value, label, i === 0, i === 0 ? html`autofocus` : ''))}
        </fieldset>
        <fieldset class="embed-choice">
          <legend>${D.format}</legend>
          ${radio('embed-format', 'iframe', D.iframe, true)}
          ${radio('embed-format', 'image', D.image)}
        </fieldset>
        <fieldset class="embed-choice">
          <legend>${D.language}</legend>
          <label><input type="radio" name="embed-lang" value="el" checked /><span lang="el">Ελληνικά</span></label>
          <label><input type="radio" name="embed-lang" value="en" /><span lang="en">English</span></label>
        </fieldset>
        <label class="embed-label" for="embed-code">${D.code}</label>
        <textarea class="embed-code" id="embed-code" rows="3" readonly spellcheck="false"></textarea>
        <p class="embed-actions">
          <button type="button" class="embed-copy" id="embed-copy" disabled>${D.copy}</button>
          <a class="embed-download" id="embed-download" href="#" download hidden>${D.download}</a>
          <span class="embed-status" id="embed-status" role="status"></span>
        </p>
        <p class="embed-label">${D.preview}</p>
        <iframe class="embed-preview" id="embed-preview" title="${D.previewTitle}"></iframe>
      </form>
    </dialog>`;
}

/** Disclaimer and attributions, in the colophon. */
export function credits(): SafeHtml {
  return html`<p>${PAGE.credits.disclaimer}</p><p>${PAGE.credits.sources}</p>`;
}
