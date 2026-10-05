/**
 * 1200×630 social card, as a self-contained HTML document (inline CSS, fonts as data URLs): the Race Desk
 * title with the race, its compounds and the circuit outline. With no race it is the generic card used by
 * the 404 page and as the site-wide fallback. Rendered to PNG at deploy time by scripts/og-images.ts.
 * Everything shown is data from the record; missing parts are left out, never invented.
 */
import { compoundCssVar } from '../domain/format.ts';
import type { RaceRecord, TrackShape } from '../domain/schema.ts';
import { trackPathD } from './fallbackSvg.ts';
import { html, SafeHtml } from './html.ts';
import { fmt, PAGE, STRINGS } from './strings.ts';
import { sortedCompounds } from './templates.ts';

// Light paper-and-ink edition, as the site's articles; values mirror tokens.css.
const TOKENS = `--c-ink:#20251f;--c-bg:#f2eee4;--c-surface:#e9e3d6;--c-rule:#c8c8b9;--c-text:#20251f;--c-text-2:#5b6256;--c-signal:#ed4c32;--c-signal-ink:#17191b;
--c-hard:#f2f1ec;--c-medium:#f5c518;--c-soft:#e5322d;--c-hard-text:#20251f;--c-medium-text:#7a5a00;--c-soft-text:#b3261e;`;

const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.84' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Cpath fill='%23000' filter='url%28%23n%29' opacity='.65' d='M0 0h180v180H0z'/%3E%3C/svg%3E")`;

/** Font files as data URLs: IBM Plex Sans (Latin and Greek subsets) and Barlow Condensed (wordmark, title, slogan). */
export interface CardFonts {
  text: string;
  textGreek: string;
  brand: string;
}

const T = STRINGS.el;

export function ogCardHtml(r: RaceRecord | null, track: TrackShape | null, fonts: CardFonts): string {
  const path = r && track ? trackPathD(track, 1000) : null;
  const dates = r ? fmt(T).dates(r.race) : null;
  const css = `
@font-face{font-family:P;src:url(${fonts.text}) format('woff2');font-weight:400 600}
@font-face{font-family:P;src:url(${fonts.textGreek}) format('woff2');font-weight:400 600;unicode-range:U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF}
@font-face{font-family:B;src:url(${fonts.brand}) format('woff2');font-weight:700}
:root{${TOKENS}}
*{box-sizing:border-box;margin:0;padding:0}
body{position:relative;width:1200px;height:630px;background:var(--c-bg);color:var(--c-text);font-family:P,sans-serif;font-variant-numeric:tabular-nums;overflow:hidden}
body::after{content:"";position:absolute;inset:0;opacity:.035;background-image:${GRAIN}}
.sheet{position:absolute;inset:0 0 72px;padding:0 48px;display:grid;grid-template-rows:76px 1fr}
header{position:relative;display:flex;align-items:flex-end;justify-content:space-between;padding-bottom:14px;border-top:1px solid var(--c-ink);margin-top:24px;height:52px}
.kicker{font-size:14px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;padding-top:14px;align-self:flex-start}
.product{position:absolute;right:0;top:-1px;padding-top:14px;border-top:3px solid var(--c-signal);font:700 22px/1 B,sans-serif;letter-spacing:.06em}
main{display:grid;grid-template-columns:1fr 380px;grid-template-rows:minmax(0,1fr);gap:48px;padding-top:12px;min-height:0}
.id{display:flex;flex-direction:column;min-width:0}
.title{font:700 176px/.84 B,sans-serif;letter-spacing:-.01em;text-transform:uppercase}.dot{color:var(--c-signal)}
.desc{margin-top:14px;font-size:15px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--c-text-2)}
h1{margin-top:18px;font-size:44px;line-height:1.1;font-weight:600;letter-spacing:-.025em;max-width:700px}
.venue{margin-top:8px;font-size:23px;color:var(--c-text-2)}
.tag{margin-top:24px;font-size:34px;line-height:1.25;color:var(--c-text-2)}
.comps{display:flex;gap:30px;margin-top:auto;padding-bottom:30px}
.comp{display:flex;align-items:center;gap:12px}
.disc{width:50px;height:50px;border-radius:50%;border:6px solid #0c0d0e;box-shadow:inset 0 0 0 4px var(--tone),inset 0 0 0 8px #0c0d0e;background:#24282d;color:#eee8db;display:grid;place-items:center;font-weight:600;font-size:15px}
.label{font-weight:600;letter-spacing:.12em;text-transform:uppercase;font-size:16px}
.hard .label{color:var(--c-hard-text)}.medium .label{color:var(--c-medium-text)}.soft .label{color:var(--c-soft-text)}
.map{position:relative;border-left:1px solid var(--c-rule)}
.map svg{position:absolute;inset:24px 0 30px 40px;width:calc(100% - 40px);height:calc(100% - 54px)}
.generic{display:grid;align-content:center;gap:22px;border-left:1px solid var(--c-rule);padding-left:40px}
.generic .comp{gap:16px}.generic .disc{width:64px;height:64px;border-width:7px;box-shadow:inset 0 0 0 5px var(--tone),inset 0 0 0 10px #0c0d0e}
.band{position:absolute;inset:auto 0 0;height:72px;padding:0 48px;display:flex;align-items:center;justify-content:space-between;background:var(--c-signal);color:var(--c-signal-ink);font-size:20px;font-weight:600}
.band .slogan{font:700 38px/1 B,sans-serif;letter-spacing:-.01em;text-transform:uppercase}`;

  const discs = (withIds: boolean) =>
    (r
      ? sortedCompounds(r)
      : [
          { raceLabel: 'hard', compound: '' },
          { raceLabel: 'medium', compound: '' },
          { raceLabel: 'soft', compound: '' },
        ]
    ).map(
      (c) =>
        html`<span class="comp ${c.raceLabel}" style="--tone:${compoundCssVar(c.raceLabel)}"><span class="disc">${withIds ? c.compound : ''}</span><span class="label">${T.compound[c.raceLabel] ?? c.raceLabel}</span></span>`,
    );

  const left = r
    ? html`<div class="title" lang="en">TYRES<span class="dot">.</span></div>
      <h1>${r.race.name}</h1>
      <p class="venue">${[r.circuit.name, dates].filter(Boolean).join(' · ')}</p>
      <div class="comps">${discs(true)}</div>`
    : html`<div class="title" lang="en">TYRES<span class="dot">.</span></div>
      <p class="desc">${PAGE.hero.descriptor}</p>
      <p class="tag">${PAGE.hero.tagline}</p>`;

  const right =
    r && path
      ? html`<div class="map"><svg viewBox="${path.viewBox}"><path d="${path.d}" fill="none" stroke="#20251f" stroke-width="16" stroke-linejoin="round"/></svg></div>`
      : r
        ? html`<div class="map"></div>`
        : html`<div class="generic">${discs(false)}</div>`;

  const bandLeft = r
    ? [PAGE.band.preview, r.round ? T.round(r.round) : null, PAGE.band.season(r.season)]
        .filter(Boolean)
        .join(' · ')
    : PAGE.credits.disclaimer.split('.')[0];

  const card = html`<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${new SafeHtml(css)}</style></head>
<body>
<div class="sheet">
  <header><span class="kicker">F1 STORIES / RACE DESK</span><span class="product" lang="en">TYRES</span></header>
  <main>
    <div class="id">${left}</div>
    ${right}
  </main>
</div>
<div class="band"><span>${bandLeft}</span><span class="slogan" lang="en">${PAGE.band.slogan}</span></div>
</body></html>`;
  return card.value;
}
