/**
 * Article embeds: one small, script-free page per race × panel × language, for iframes in
 * f1stories.gr articles. Every panel keeps the same height at any width ≥ 300 px, so a fixed
 * iframe height fits (the copy dialog measures it; tests/e2e checks it stays constant).
 */
import { characteristicsFor, RACE_LABEL_ORDER } from '../domain/format.ts';
import type { CharacteristicKey, DataStatus, RaceRecord, TrackShape } from '../domain/schema.ts';
import { type EmbedLang, type EmbedPanel, racePath } from '../domain/urlState.ts';
import { trackPathD } from './fallbackSvg.ts';
import { escapeHtml, html, type SafeHtml, safeUrl } from './html.ts';
import { sortedCompounds } from './templates.ts';

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
}

/* Greek glossary: editorial choices, kept in one place so they are easy to review. */
const STRINGS: Record<EmbedLang, Strings> = {
  el: {
    locale: 'el-GR',
    panel: {
      summary: 'Ελαστικά αγώνα',
      compounds: 'Γόμες αγώνα',
      demands: 'Απαιτήσεις πίστας',
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
    compound: { hard: 'Σκληρή', medium: 'Μέση', soft: 'Μαλακή' },
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
  },
  en: {
    locale: 'en-GB',
    panel: {
      summary: 'Race tyres',
      compounds: 'Weekend compounds',
      demands: 'Track demands',
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
  const c: Ctx = { r, track: ctx.track, t, f: fmt(t) };
  const full = new URL(racePath('', r), ctx.siteUrl).href;
  const published = c.f.published(r.source.publishedAt);
  const title = `${t.panel[panel]}: ${r.race.name} ${r.season}`;
  const head = html`<title>${title} | F1 Stories</title>
    <meta name="robots" content="noindex" />
    <link rel="canonical" href="${full}" />`;
  const body = html`<article class="e" data-panel="${panel}">
    <header class="e-head">
      <p class="e-kicker">${t.panel[panel]}</p>
      <p class="e-race">${r.round ? `${t.round(r.round)} · ` : ''}${r.season}${panel === 'summary' ? '' : ` · ${r.race.name}`}</p>
    </header>
    <div class="e-body">${PANELS[panel](c)}</div>
    <footer class="e-foot">
      <p class="e-source">${t.source}: <a href="${safeUrl(r.source.articleUrl)}" target="_blank" rel="noopener external">Pirelli</a>${published ? ` · ${published}` : ''} · <span class="e-status" data-status="${r.validation.status}">${t.status[r.validation.status]}</span></p>
      <p class="e-brand"><a href="${full}" target="_blank" rel="noopener"><span class="e-wordmark">F1 STORIES<span class="e-dot">.</span></span> ${t.open} ↗</a></p>
    </footer>
  </article>`;
  return template
    .replace('<html lang="en-GB">', () => `<html lang="${escapeHtml(lang)}">`)
    .replace(/<title>.*?<\/title>/s, () => '')
    .replace('<!--embed:head-->', () => head.value)
    .replace('<!--embed:body-->', () => body.value);
}
