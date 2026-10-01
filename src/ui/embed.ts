/**
 * Article embeds: one small, script-free page per race × panel × language, for iframes in
 * f1stories.gr articles. Every panel keeps the same height at any width ≥ 300 px, so a fixed
 * iframe height fits (the copy dialog measures it; tests/e2e checks it stays constant).
 */
import { type CarView, deriveView, HEAT_STOPS } from '../domain/derivedMetrics.ts';
import { characteristicsFor, RACE_LABEL_ORDER } from '../domain/format.ts';
import type { CharacteristicKey, DataStatus, RaceRecord, TrackShape } from '../domain/schema.ts';
import { type EmbedLang, type EmbedPanel, racePath } from '../domain/urlState.ts';
import { carPlanSvg, trackPathD } from './fallbackSvg.ts';
import { escapeHtml, html, SafeHtml, safeUrl } from './html.ts';
import { inlineJson } from './page.ts';
import { DEFAULT_VIEW, fallbackVisual, sortedCompounds } from './templates.ts';

/** The four rating-based views; pressures are official values and live in the setup panel. */
const DEMAND_VIEWS = [
  'longitudinal',
  'lateral',
  'stress',
  'brakingTraction',
] as const satisfies readonly CarView[];

interface Strings {
  locale: string;
  panel: Record<EmbedPanel, string>;
  rating: Record<CharacteristicKey, string>;
  compound: Record<string, string>;
  status: Record<DataStatus, string>;
  notProvided: string;
  round: (n: number) => string;
  ratingScale: string;
  topDemands: string;
  front: string;
  rear: string;
  minPressure: string;
  minPressureShort: string;
  minPressureNote: string;
  runningPressure: string;
  camber: string;
  slick: string;
  length: string;
  laps: string;
  distance: string;
  pitLoss: string;
  pitKind: { estimate: string; average: string };
  lapRecord: string;
  noCompounds: string;
  noTrack: string;
  source: string;
  open: string;
  demandView: Record<CarView, string>;
  mode: Record<'car' | 'circuit' | 'tyres', string>;
  modesLabel: string;
  viewsLabel: string;
  load3d: string;
  loadNote: string;
  loading3d: string;
  noGl: string;
  failed3d: string;
  reset: string;
  laps2: (n: number) => string;
  outline: (name: string, licence: string) => string;
  tyresNote: string;
  modelCredit: string;
  planLabel: (view: string) => string;
  low: string;
  high: string;
  derived: string;
  method: string;
}

/* Greek glossary: editorial choices, kept in one place so they are easy to review. */
const STRINGS: Record<EmbedLang, Strings> = {
  el: {
    locale: 'el-GR',
    panel: {
      summary: 'Ελαστικά αγώνα',
      compounds: 'Γόμες αγώνα',
      demands: 'Απαιτήσεις πίστας',
      car: 'Απαίτηση ανά ελαστικό',
      '3d': 'Τρισδιάστατη προβολή',
      setup: 'Όρια ρυθμίσεων',
      circuit: 'Η πίστα',
    },
    rating: {
      traction: 'Πρόσφυση',
      braking: 'Φρενάρισμα',
      tyreStress: 'Καταπόνηση ελαστικών',
      asphaltAbrasion: 'Τραχύτητα ασφάλτου',
      asphaltGrip: 'Κράτημα ασφάλτου',
      lateral: 'Πλευρικά φορτία',
      trackEvolution: 'Εξέλιξη πίστας',
      downforce: 'Κάθετη δύναμη',
    },
    // Compound names stay in English, as in Greek F1 coverage.
    compound: { hard: 'Hard', medium: 'Medium', soft: 'Soft' },
    status: {
      verified: 'Επαληθευμένα',
      transcribed: 'Μεταγραφή, προς έλεγχο',
      'needs-review': 'Χρειάζεται έλεγχο',
      fixture: 'Δοκιμαστικά δεδομένα',
    },
    notProvided: 'Δεν δόθηκε',
    round: (n) => `Αγώνας ${n}`,
    ratingScale: 'Βαθμολογία Pirelli, 1–5',
    topDemands: 'Μεγαλύτερες απαιτήσεις',
    front: 'Εμπρός',
    rear: 'Πίσω',
    minPressure: 'Ελάχιστη πίεση εκκίνησης',
    minPressureShort: 'Ελάχ. πίεση εκκίνησης',
    minPressureNote: 'Μπορεί να αλλάξει μετά το FP2',
    runningPressure: 'Αναμενόμενη πίεση λειτουργίας',
    camber: 'Όριο camber στο τέλος της ευθείας',
    slick: 'Slick 18 ιντσών',
    length: 'Μήκος πίστας',
    laps: 'Γύροι',
    distance: 'Απόσταση αγώνα',
    pitLoss: 'Απώλεια χρόνου στο pit stop',
    pitKind: { estimate: 'εκτίμηση Pirelli', average: 'μέσος όρος Pirelli' },
    lapRecord: 'Ρεκόρ γύρου',
    noCompounds: 'Οι γόμες δεν έχουν ανακοινωθεί.',
    noTrack: 'Δεν υπάρχει ακόμη χάρτης της πίστας.',
    source: 'Πηγή',
    open: 'Άνοιγμα στο Tyre Intelligence',
    demandView: {
      longitudinal: 'Διαμήκη φορτία',
      lateral: 'Πλευρικά φορτία',
      stress: 'Καταπόνηση ελαστικών',
      brakingTraction: 'Φρενάρισμα / πρόσφυση',
      pressures: 'Πιέσεις',
    },
    mode: { car: 'Μονοθέσιο', circuit: 'Πίστα', tyres: 'Ελαστικά' },
    modesLabel: 'Προβολή',
    viewsLabel: 'Απεικόνιση ελαστικών',
    load3d: 'Προβολή σε 3D',
    loadNote: 'φορτώνει περίπου 300 KB',
    loading3d: 'Φόρτωση 3D…',
    noGl: 'Το 3D δεν είναι διαθέσιμο σε αυτή τη συσκευή. Εμφανίζεται το σχέδιο.',
    failed3d: 'Το 3D δεν φόρτωσε. Εμφανίζεται το σχέδιο.',
    reset: 'Επαναφορά κάμερας',
    laps2: (n) => `${n} γύροι`,
    outline: (name, licence) => `Χάραξη πίστας: ${name} (${licence}). Δεν σχεδιάζονται τομείς ή υψομετρικά.`,
    tyresNote: 'Το χρώμα στο πλάι δείχνει τον ρόλο της γόμας: λευκό Hard, κίτρινο Medium, κόκκινο Soft.',
    modelCredit: 'Μοντέλο: “Low Poly-F1”, salasilma13, CC BY 4.0',
    planLabel: (view) => `Κάτοψη μονοθεσίου: ${view} ανά ελαστικό`,
    low: 'Χαμηλή',
    high: 'Υψηλή απαίτηση',
    // The required "Derived visualisation" label (CLAUDE.md), in Greek.
    derived:
      'Παράγωγη απεικόνιση με βάση τα χαρακτηριστικά πίστας της Pirelli. Τα χρώματα δείχνουν σχετική απαίτηση, όχι θερμοκρασία.',
    method: 'Μέθοδος',
  },
  en: {
    locale: 'en-GB',
    panel: {
      summary: 'Race tyres',
      compounds: 'Weekend compounds',
      demands: 'Track demands',
      car: 'Tyre demand by corner',
      '3d': '3D view',
      setup: 'Setup limits',
      circuit: 'Circuit',
    },
    rating: {
      traction: 'Traction',
      braking: 'Braking',
      tyreStress: 'Tyre stress',
      asphaltAbrasion: 'Asphalt abrasion',
      asphaltGrip: 'Asphalt grip',
      lateral: 'Lateral',
      trackEvolution: 'Track evolution',
      downforce: 'Downforce',
    },
    compound: { hard: 'Hard', medium: 'Medium', soft: 'Soft' },
    status: {
      verified: 'Verified',
      transcribed: 'Transcribed, awaiting review',
      'needs-review': 'Needs review',
      fixture: 'Development fixture',
    },
    notProvided: 'Not provided',
    round: (n) => `Round ${n}`,
    ratingScale: 'Pirelli rating, 1–5',
    topDemands: 'Highest demands',
    front: 'Front',
    rear: 'Rear',
    minPressure: 'Minimum starting pressure',
    minPressureShort: 'Min. starting pressure',
    minPressureNote: 'Subject to change after FP2',
    runningPressure: 'Expected running pressure',
    camber: 'End-of-straight camber limit',
    slick: '18-inch slick',
    length: 'Circuit length',
    laps: 'Laps',
    distance: 'Race distance',
    pitLoss: 'Pit-stop time loss',
    pitKind: { estimate: 'Pirelli estimate', average: 'Pirelli average' },
    lapRecord: 'Lap record',
    noCompounds: 'Compounds not announced yet.',
    noTrack: 'Track outline not available yet.',
    source: 'Source',
    open: 'Open in Tyre Intelligence',
    demandView: {
      longitudinal: 'Longitudinal',
      lateral: 'Lateral',
      stress: 'Tyre stress',
      brakingTraction: 'Braking / traction',
      pressures: 'Pressures',
    },
    mode: { car: 'Car', circuit: 'Circuit', tyres: 'Tyres' },
    modesLabel: 'View',
    viewsLabel: 'Tyre visualisation',
    load3d: 'View in 3D',
    loadNote: 'loads about 300 KB',
    loading3d: 'Loading 3D…',
    noGl: '3D isn’t available on this device. Showing the drawing.',
    failed3d: 'The 3D view couldn’t load. Showing the drawing.',
    reset: 'Reset camera',
    laps2: (n) => `${n} laps`,
    outline: (name, licence) => `Outline: ${name} (${licence}). Sectors and elevation are not drawn.`,
    tyresNote: 'Sidewall colour marks the weekend role: white hard, yellow medium, red soft.',
    modelCredit: 'Model: “Low Poly-F1”, salasilma13, CC BY 4.0',
    planLabel: (view) => `Car plan view: ${view} by tyre`,
    low: 'Low',
    high: 'High demand',
    derived:
      'Derived visualisation based on Pirelli circuit characteristics. Colours show relative demand, not temperature.',
    method: 'Method',
  },
};

/* ------------------------------------------------------------------ locale formatting */

function fmt(t: Strings) {
  const num = (v: number | null | undefined, digits: number, unit = '') =>
    v == null
      ? null
      : `${v < 0 ? '−' : ''}${new Intl.NumberFormat(t.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(v))}${unit}`;
  const day = new Intl.DateTimeFormat(t.locale, { day: 'numeric', timeZone: 'UTC' });
  const dayMonth = new Intl.DateTimeFormat(t.locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const full = new Intl.DateTimeFormat(t.locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const dates = (race: RaceRecord['race']) => {
    if (!race.startDate || !race.endDate) return null;
    const a = new Date(`${race.startDate}T00:00:00Z`);
    const b = new Date(`${race.endDate}T00:00:00Z`);
    return a.getUTCMonth() === b.getUTCMonth()
      ? `${day.format(a)}–${dayMonth.format(b)} ${b.getUTCFullYear()}`
      : `${dayMonth.format(a)} – ${dayMonth.format(b)} ${b.getUTCFullYear()}`;
  };
  const published = (iso: string | null) => {
    const t0 = iso ? Date.parse(iso) : Number.NaN;
    return Number.isNaN(t0) ? null : full.format(new Date(t0));
  };
  return { num, dates, published };
}

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
      <span class="e-compound"><span class="e-compound-label">${t.compound[c.raceLabel] ?? c.raceLabel}</span><span class="e-compound-id">${c.compound}</span></span>
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
  return html`<span class="e-axles"><span class="e-axle">${t.front}</span><span class="e-fig">${front ?? nd(t)}</span><span class="e-axle">${t.rear}</span><span class="e-fig">${rear ?? nd(t)}</span></span>`;
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
      const view = deriveView(r, key);
      const digits = key === 'longitudinal' ? 1 : 0;
      return html`<li>
        <p class="e-demand-title">${t.demandView[key]}</p>
        ${carPlanSvg(view, t.planLabel(t.demandView[key]))}
        <div class="e-demand-text">
          <p class="e-demand-row"><span class="e-axle">${t.front}</span><span class="e-fig">${value(view.corners.FL.intensity, digits)}</span></p>
          <p class="e-demand-row"><span class="e-axle">${t.rear}</span><span class="e-fig">${value(view.corners.RL.intensity, digits)}</span></p>
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
      html`<div class="e-fact"><dt>${label}</dt><dd>${value ?? nd(t)}${value && note ? html`<span class="e-note">${note}</span>` : ''}</dd></div>`;
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
export function renderEmbed(template: string, ctx: EmbedContext): string {
  const { record: r, panel, lang } = ctx;
  const t = STRINGS[lang];
  const full = new URL(racePath('', r), ctx.siteUrl).href;
  const c: Ctx = { full, lang, r, track: ctx.track, t, f: fmt(t) };
  const published = c.f.published(r.source.publishedAt);
  const title = `${t.panel[panel]}: ${r.race.name} ${r.season}`;
  const head = html`<title>${title} | F1 Stories</title>
    <meta name="robots" content="noindex" />
    <link rel="canonical" href="${full}" />`;
  // id="dark": the iframe URL's #dark fragment makes this :target and switches it to the charcoal theme.
  const body = html`<div class="e-root" id="dark"><article class="e" data-panel="${panel}">
    <header class="e-head">
      <p class="e-kicker">${t.panel[panel]}</p>
      <p class="e-race">${r.round ? `${t.round(r.round)} · ` : ''}${r.season}${panel === 'summary' ? '' : ` · ${r.race.name}`}</p>
    </header>
    <div class="e-body">${PANELS[panel](c)}</div>
    <footer class="e-foot">
      <p class="e-source">${t.source}: <a href="${safeUrl(r.source.articleUrl)}" target="_blank" rel="noopener external">Pirelli</a>${published ? ` · ${published}` : ''} · <span class="e-status" data-status="${r.validation.status}">${t.status[r.validation.status]}</span></p>
      <p class="e-brand"><a href="${full}" target="_blank" rel="noopener"><span class="e-wordmark">F1 STORIES<span class="e-dot">.</span></span> ${t.open} ↗</a></p>
    </footer>
  </article></div>${panel === '3d' ? html`<script type="application/json" id="boot">${new SafeHtml(inlineJson({ record: r, track: ctx.track, lang }))}</script>` : ''}`;
  return template
    .replace('<html lang="en-GB">', () => `<html lang="${escapeHtml(lang)}">`)
    .replace(/<title>.*?<\/title>/s, () => '')
    .replace('<!--embed:head-->', () => head.value)
    .replace('<!--embed:body-->', () => body.value);
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
    const d = deriveView(r, view.carView);
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
    <p class="e-values"><span class="e-axle">${t.front}</span><span class="e-fig">${shown('FL', p?.front)}</span><span class="e-axle">${t.rear}</span><span class="e-fig">${shown('RL', p?.rear)}</span></p>
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
