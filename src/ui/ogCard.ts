/**
 * 1200×630 social card for one race, as a self-contained HTML document (inline CSS, font as data URL).
 * Rendered to PNG at deploy time by scripts/og-images.ts. Everything shown is data from the record.
 */
import { characteristicsFor, compoundCssVar, eventDates, NOT_PROVIDED } from '../domain/format.ts';
import type { RaceRecord, TrackShape } from '../domain/schema.ts';
import { trackPathD } from './fallbackSvg.ts';
import { html, SafeHtml } from './html.ts';
import { sortedCompounds } from './templates.ts';

const TOKENS = `--c-carbon:#16181b;--c-gunmetal:#1e2226;--c-rule:#3a4047;--c-paper:#ebe7df;--c-graphite:#959ca5;
--c-hard:#f2f1ec;--c-medium:#f5c518;--c-soft:#e5322d;--c-soft-text:#ff6258;
--heat-1:#2f8f9d;--heat-2:#7fb069;--heat-3:#e9c46a;--heat-4:#f08c3a;--heat-5:#d9412b;`;

export function ogCardHtml(r: RaceRecord, track: TrackShape | null, fontDataUrl: string): string {
  const path = track ? trackPathD(track, 1000) : null;
  const dates = eventDates(r.race);
  const ratings = characteristicsFor(r).filter((c) => c.key !== 'downforce');
  const css = `
@font-face{font-family:A;src:url(${fontDataUrl}) format('woff2');font-weight:100 900;font-stretch:62% 125%}
:root{${TOKENS}}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;height:630px;background:var(--c-carbon);color:var(--c-paper);font-family:A,sans-serif;font-variant-numeric:tabular-nums;overflow:hidden}
.sheet{position:absolute;inset:28px;border:1px solid var(--c-rule);background:var(--c-gunmetal);display:grid;grid-template-rows:64px 1fr 150px}
.reg{position:absolute;width:14px;height:14px;border:0 solid var(--c-graphite)}
.tl{top:20px;left:20px;border-top-width:1px;border-left-width:1px}.tr{top:20px;right:20px;border-top-width:1px;border-right-width:1px}
.bl{bottom:20px;left:20px;border-bottom-width:1px;border-left-width:1px}.br{bottom:20px;right:20px;border-bottom-width:1px;border-right-width:1px}
header{display:flex;align-items:center;gap:14px;padding:0 32px;border-bottom:1px solid var(--c-rule)}
.mark{width:26px;height:26px;border-radius:50%;border:5px solid var(--c-paper);box-shadow:inset 0 0 0 2px var(--c-gunmetal),inset 0 0 0 4px var(--c-graphite)}
.brand{font-weight:800;font-stretch:70%;font-size:22px}.sub{color:var(--c-graphite);font-size:17px}
.round{margin-left:auto;color:var(--c-graphite);font-size:17px}
main{display:grid;grid-template-columns:1fr 360px;border-bottom:1px solid var(--c-rule)}
.id{padding:26px 32px;display:flex;flex-direction:column}
h1{font-size:74px;line-height:.9;font-weight:800;font-stretch:66%;letter-spacing:-.01em;max-width:700px}
.venue{margin-top:14px;font-size:24px;font-weight:550}.dates{color:var(--c-graphite);font-size:19px;margin-top:4px}
.comps{display:flex;gap:26px;margin-top:auto}
.comp{display:flex;align-items:center;gap:10px}
.disc{width:46px;height:46px;border-radius:50%;border:6px solid #0c0d0e;box-shadow:inset 0 0 0 4px var(--tone),inset 0 0 0 8px #0c0d0e;background:#24282d;display:grid;place-items:center;font-weight:800;font-stretch:70%;font-size:14px}
.label{font-weight:750;font-stretch:75%;letter-spacing:.08em;text-transform:uppercase;font-size:17px;color:var(--tone)}
.soft .label{color:var(--c-soft-text)}
.map{border-left:1px solid var(--c-rule);display:grid;place-items:center;padding:22px}
.map svg{width:100%;height:100%}
.ratings{display:grid;grid-template-columns:repeat(4,1fr);gap:14px 28px;padding:22px 32px}
.r{display:grid;grid-template-columns:1fr auto;align-items:center;gap:4px 10px;font-size:16px}
.r .v{font-weight:650;font-size:18px}
.scale{grid-column:1/-1;height:10px;background:linear-gradient(90deg,var(--heat) calc(var(--val)*20%),var(--c-rule) 0);
-webkit-mask:repeating-linear-gradient(90deg,#000 0 calc(20% - 3px),transparent calc(20% - 3px) 20%)}
.foot{grid-column:4;align-self:end;color:var(--c-graphite);font-size:13px;line-height:1.35}`;

  const card = html`<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${new SafeHtml(css)}</style></head>
<body>
<span class="reg tl"></span><span class="reg tr"></span><span class="reg bl"></span><span class="reg br"></span>
<div class="sheet">
  <header><span class="mark"></span><span class="brand">F1 Stories</span><span class="sub">Tyre intelligence</span>
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
        ? html`<svg viewBox="${path.viewBox}"><path d="${path.d}" fill="none" stroke="#2b3036" stroke-width="40" stroke-linejoin="round"/><path d="${path.d}" fill="none" stroke="#ebe7df" stroke-width="12" stroke-linejoin="round"/></svg>`
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
