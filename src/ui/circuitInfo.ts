import history from '../../data/reference/circuit-history.json' with { type: 'json' };
import type { RaceRecord, TrackShape } from '../domain/schema.ts';
import type { EmbedLang } from '../domain/urlState.ts';
import { circuitSvg } from './fallbackSvg.ts';
import { html, type SafeHtml, safeUrl } from './html.ts';
import { fmt, STRINGS, type Strings } from './strings.ts';

const ICON_PATHS = {
  length: 'M5 19 3 16 10 4h7l3 3-5 7h4l2 3-3 3H6Z',
  debut: 'M7 3h10v7a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 3v5m-4 1h8',
  record: 'M9 2h6m-3 0v3m6 1 2-2M12 9v5l3 2M21 14a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  laps: 'M4 22V3m0 1c6-4 10 4 16 0v12c-6 4-10-4-16 0m5-13v12m6-11v12M4 10c6-4 10 4 16 0',
  distance: 'M20 9c0 6-8 13-8 13S4 15 4 9a8 8 0 1 1 16 0ZM15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
};

function fact(
  t: Strings,
  icon: keyof typeof ICON_PATHS,
  label: string,
  value: string | null,
  unit = '',
  note: string | null = null,
): SafeHtml {
  return html`<div class="circuit-fact${value == null ? ' is-missing' : ''}" data-circuit-fact="${icon}">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON_PATHS[icon]}" /></svg>
    <div><dt>${label}</dt><dd><span class="circuit-fact-value">${value ?? t.notProvided}</span>${value != null && unit ? html`<span class="circuit-fact-unit">${unit}</span>` : ''}${note ? html`<span class="circuit-fact-note">${note}</span>` : ''}</dd></div>
  </div>`;
}

/** Shared by the static page and race navigation; weekend facts always use the selected record. */
export function circuitInfo(
  r: RaceRecord,
  track: TrackShape | null,
  base: string,
  lang: EmbedLang = 'el',
): SafeHtml {
  const T = STRINGS[lang];
  const F = fmt(T);
  const c = r.circuit;
  const debut = history.circuits.find((entry) => entry.trackId === c.trackId);
  const country = r.race.countryCode;
  // Match the circuit's location, even when an event is hosted outside its namesake country.
  const flag = country && /^[A-Z]{2}$/.test(country) ? country.toLowerCase() : null;
  return html`<header class="circuit-info-header">
    ${flag ? html`<img class="circuit-flag" src="${base}images/flags/${flag}.svg" width="80" height="60" alt="${new Intl.DisplayNames([T.locale], { type: 'region' }).of(country!)}" />` : ''}
    <div><h2 id="circuit-info-title">${c.name ?? r.race.name}</h2>${r.race.location ? html`<p>${r.race.location}</p>` : ''}</div>
  </header>
  <div class="circuit-info-layout">
    <figure class="circuit-map">
      ${track ? circuitSvg(track, c.name, T.circuitInfo.outlineLabel(c.name ?? r.race.name)) : html`<div class="plate"><p>${T.noTrack}</p></div>`}
      <figcaption>${T.circuitInfo.mapNote}</figcaption>
    </figure>
    <dl class="circuit-facts">
      ${fact(T, 'length', T.length, F.num(c.lengthKm, 3), 'km')}
      ${fact(T, 'debut', T.circuitInfo.firstGrandPrix, debut ? String(debut.firstGrandPrix) : null, '', debut ? T.circuitInfo.firstGrandPrixNote : null)}
      ${fact(T, 'record', T.lapRecord, c.lapRecord?.time ?? null, '', c.lapRecord ? `${c.lapRecord.driver} (${c.lapRecord.year})` : null)}
      ${fact(T, 'laps', T.laps, c.laps == null ? null : String(c.laps))}
      ${fact(T, 'distance', T.distance, F.num(c.raceDistanceKm, 3), 'km')}
    </dl>
  </div>
  <footer class="circuit-info-sources">
    <a href="${safeUrl(r.source.articleUrl)}" target="_blank" rel="noopener external">${T.circuitInfo.factsSource}</a>
    ${debut ? html`<a href="${safeUrl(debut.sourceUrl)}" target="_blank" rel="noopener external">${T.circuitInfo.historySource}</a>` : ''}
    ${track ? html`<span>${T.circuitInfo.outlineLead} <a href="${safeUrl(track.source.url)}" target="_blank" rel="noopener external">${track.source.name}</a> (${track.source.license})</span>` : ''}
  </footer>`;
}
