/**
 * 1200×630 social card for one race, as a self-contained HTML document (inline CSS, font as data URL).
 * Rendered to PNG at deploy time by scripts/og-images.ts. Everything shown is data from the record.
 */
import { characteristicsFor, compoundCssVar, eventDates, NOT_PROVIDED } from '../domain/format.ts';
import type { RaceRecord, TrackShape } from '../domain/schema.ts';
import { trackPathD } from './fallbackSvg.ts';
import { html, SafeHtml } from './html.ts';
import { sortedCompounds } from './templates.ts';

// Light "paper and ink" edition, matching the site; the circuit map sits on the dark bench.
const TOKENS = `--c-ink:#20251f;--c-bg:#f2eee4;--c-rule:#c8c8b9;--c-text:#20251f;--c-text-2:#545b50;--c-signal:#ed4c32;
--c-hard:#f2f1ec;--c-medium:#f5c518;--c-soft:#e5322d;--c-hard-text:#20251f;--c-medium-text:#7a5a00;--c-soft-text:#b3261e;
--heat-1:#2f8f9d;--heat-2:#7fb069;--heat-3:#e9c46a;--heat-4:#f08c3a;--heat-5:#d9412b;`;

/** Font files as data URLs: IBM Plex Sans (text) and Barlow Condensed (wordmark). */
export interface CardFonts {
  text: string;
  brand: string;
}

export function ogCardHtml(r: RaceRecord, track: TrackShape | null, fonts: CardFonts): string {
  const path = track ? trackPathD(track, 1000) : null;
  const dates = eventDates(r.race);
  const ratings = characteristicsFor(r).filter((c) => c.key !== 'downforce');
  const css = `
@font-face{font-family:P;src:url(${fonts.text}) format('woff2');font-weight:400 600}
@font-face{font-family:B;src:url(${fonts.brand}) format('woff2');font-weight:700}
:root{${TOKENS}}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;height:630px;background:var(--c-bg);color:var(--c-text);font-family:P,sans-serif;font-variant-numeric:tabular-nums;overflow:hidden}
.sheet{position:absolute;inset:0 48px;display:grid;grid-template-rows:76px 1fr 140px}
header{display:flex;align-items:center;gap:22px;border-bottom:1px solid var(--c-ink)}
.brand{font-family:B,sans-serif;font-weight:700;font-size:34px;letter-spacing:-.035em}.dot{color:var(--c-signal)}
.kicker,.round{font-size:14px;font-weight:600;letter-spacing:.13em;text-transform:uppercase}
.round{margin-left:auto;color:var(--c-text-2)}
main{display:grid;grid-template-columns:1fr 380px;gap:40px;padding:28px 0;border-bottom:1px solid var(--c-rule)}
.id{display:flex;flex-direction:column}
h1{font-size:64px;line-height:1.02;font-weight:600;letter-spacing:-.025em;max-width:700px}
.venue{margin-top:14px;font-size:24px;font-weight:500}.dates{color:var(--c-text-2);font-size:19px;margin-top:4px}
.comps{display:flex;gap:26px;margin-top:auto}
.comp{display:flex;align-items:center;gap:10px}
.disc{width:46px;height:46px;border-radius:50%;border:6px solid #0c0d0e;box-shadow:inset 0 0 0 4px var(--tone),inset 0 0 0 8px #0c0d0e;background:#24282d;color:#eee8db;display:grid;place-items:center;font-weight:600;font-size:14px}
.label{font-weight:600;letter-spacing:.13em;text-transform:uppercase;font-size:15px}
.hard .label{color:var(--c-hard-text)}.medium .label{color:var(--c-medium-text)}.soft .label{color:var(--c-soft-text)}
.map{background:#1b1a19;display:grid;place-items:center;padding:22px}
.map svg{width:100%;height:100%}
.ratings{display:grid;grid-template-columns:repeat(4,1fr);gap:14px 28px;padding:22px 0}
.r{display:grid;grid-template-columns:1fr auto;align-items:center;gap:4px 10px;font-size:16px}
.r .v{font-weight:600;font-size:18px}
.scale{grid-column:1/-1;height:10px;background:linear-gradient(90deg,var(--heat) calc(var(--val)*20%),var(--c-rule) 0);
-webkit-mask:repeating-linear-gradient(90deg,#000 0 calc(20% - 3px),transparent calc(20% - 3px) 20%)}
.foot{grid-column:4;align-self:end;color:var(--c-text-2);font-size:13px;line-height:1.35}`;

  const card = html`<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${new SafeHtml(css)}</style></head>
<body>
<div class="sheet">
  <header><span class="brand">F1 STORIES<span class="dot">.</span></span><span class="kicker">Tyre intelligence</span>
    <span class="round">${r.round ? `Round ${r.round}, ` : ''}${r.season} season</span></header>
  <main>
    <div class="id">
      <h1>${r.race.name}</h1>
      <p class="venue">${r.circuit.name ?? NOT_PROVIDED}</p>
      <p class="dates">${[r.race.location, dates].filter(Boolean).join(', ')}</p>
      <div class="comps">${sortedCompounds(r).map(
        (c) =>
          html`<span class="comp ${c.raceLabel}" style="--tone:${compoundCssVar(c.raceLabel)}"><span class="disc">${c.compound}</span><span class="label">${c.raceLabel}</span></span>`,
      )}</div>
    </div>
    <div class="map">${
      path
        ? html`<svg viewBox="${path.viewBox}"><path d="${path.d}" fill="none" stroke="#2e2c29" stroke-width="40" stroke-linejoin="round"/><path d="${path.d}" fill="none" stroke="#eee8db" stroke-width="12" stroke-linejoin="round"/></svg>`
        : ''
    }</div>
  </main>
  <section class="ratings">
    ${ratings.map((c) => {
      const v = r.characteristics[c.key] ?? null;
      return html`<div class="r" style="--val:${v ?? 0};--heat:${v ? `var(--heat-${v})` : 'transparent'}"><span>${c.label}</span><span class="v">${v ?? '–'}</span><span class="scale"></span></div>`;
    })}
    <p class="foot">Unofficial. Data: Pirelli Motorsport race preview.</p>
  </section>
</div>
</body></html>`;
  return card.value;
}
