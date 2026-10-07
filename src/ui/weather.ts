import { type Condition, localDate, type Weekend, weatherCondition } from '../domain/weekend.ts';
import { html, type SafeHtml, safeUrl } from './html.ts';
import { PAGE, STRINGS } from './strings.ts';

const T = PAGE.weather;
const cloud = html`<path d="M9 27h24a7 7 0 0 0 0-14 10 10 0 0 0-19-3 8.5 8.5 0 0 0-5 17Z" />`;
const sun = html`<circle cx="24" cy="19" r="8"/><path d="M24 2v4M24 32v4M7 19h4M37 19h4M12 7l3 3M33 28l3 3M12 31l3-3M33 10l3-3"/>`;
function icon(condition: Condition): SafeHtml {
  const shape =
    condition === 'sun'
      ? sun
      : condition === 'unknown'
        ? html`<circle cx="24" cy="24" r="17"/><path d="M18 18a6 6 0 0 1 12 0c0 5-6 4-6 9M24 33v1"/>`
        : html`${condition === 'partial' ? html`<circle cx="33" cy="10" r="6"/>` : ''}${cloud}${condition === 'rain' || condition === 'drizzle' ? html`<path d="m14 34-3 6m13-6-3 6m13-6-3 6"/>` : ''}${condition === 'storm' ? html`<path d="m25 29-6 9h8l-5 8"/>` : ''}${condition === 'fog' ? html`<path d="M9 34h30M14 40h20"/>` : ''}${condition === 'snow' ? html`<path d="M16 33v10m-4-8 8 6m-8 0 8-6M32 33v10m-4-8 8 6m-8 0 8-6"/>` : ''}`;
  return html`<svg class="weather-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shape}</svg>`;
}
const value = (n: number | null | undefined, unit: string) =>
  n == null ? STRINGS.el.notProvided : `${Math.round(n)}${unit}`;
const dayLabel = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('el-GR', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));

export function weatherPreview(w: Weekend | null, displayZone = 'Europe/Athens', now = new Date()): SafeHtml {
  if (!w)
    return html`<header class="weather-header"><h2 id="weather-title">${T.title}</h2></header><p class="weather-empty">${T.unavailable}</p>`;
  const weather = w.weather;
  const stale =
    weather?.kind === 'forecast' && now.getTime() - Date.parse(weather.retrievedAt) > 24 * 60 * 60 * 1000;
  const updated = weather
    ? new Intl.DateTimeFormat('el-GR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        hourCycle: 'h23',
        minute: '2-digit',
        timeZone: 'Europe/Athens',
      }).format(new Date(weather.retrievedAt))
    : null;
  return html`<header class="weather-header">
    <div><h2 id="weather-title">${T.title}</h2><p class="weather-meta">${weather ? (weather.kind === 'archived-forecast' ? T.archived : T.forecast) : T.noForecast}${w.sessions.some((s) => s.id === 'sprint') ? html` · ${T.sprintWeekend}` : ''}</p></div>
    <label class="weather-timezone">${T.sessionTimeZone}<select id="weather-timezone"><option value="Europe/Athens" ${displayZone === 'Europe/Athens' ? html`selected` : ''}>${T.athens}</option><option value="${w.timeZone}" ${displayZone === w.timeZone && w.timeZone !== 'Europe/Athens' ? html`selected` : ''}>${T.track} (${w.timeZone})</option></select></label>
  </header>
  ${!weather ? html`<p class="weather-notice">${T.forecastWindow}</p>` : ''}
  ${stale ? html`<p class="weather-notice" role="status">${T.stale}</p>` : ''}
  <p class="weather-scroll-hint">${T.scrollHint}</p>
  <div class="weather-scroll" role="region" aria-label="${T.title}" tabindex="0"><div class="weather-days">
    ${w.dates.map((date) => {
      const d = weather?.days.find((day) => day.date === date);
      const condition = weatherCondition(d?.code ?? null);
      const sessions = w.sessions.filter((s) => localDate(s.start, w.timeZone) === date);
      return html`<section class="weather-day" aria-label="${dayLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })}">
        <header><h3>${dayLabel(date, { weekday: 'long' })}</h3><time datetime="${date}">${dayLabel(date, { day: 'numeric', month: 'short' })}</time></header>
        <div class="weather-condition" data-condition="${condition}">${icon(condition)}<span>${T.conditions[condition]}</span></div>
        <dl class="weather-measures">
          <div class="weather-temperature"><dt>${T.temperature}</dt><dd>${value(d?.highC, '°C')}<span>${T.maximum}</span></dd></div>
          <div><dt>${T.minimum}</dt><dd>${value(d?.lowC, '°C')}</dd></div>
          <div><dt>${T.humidity}</dt><dd>${value(d?.humidityPct, '%')}</dd></div>
          <div><dt>${T.rainChance}</dt><dd>${value(d?.rainChancePct, '%')}</dd></div>
        </dl>
        <div class="weather-sessions"><h4>${T.sessions}</h4>${
          sessions.length
            ? html`<dl>${sessions.map((s) => {
                const shifted = localDate(s.start, displayZone) !== date;
                const time = new Intl.DateTimeFormat('el-GR', {
                  hour: '2-digit',
                  hourCycle: 'h23',
                  minute: '2-digit',
                  timeZone: displayZone,
                }).format(new Date(s.start));
                const shiftedDate = shifted
                  ? new Intl.DateTimeFormat('el-GR', {
                      day: 'numeric',
                      month: 'short',
                      timeZone: displayZone,
                    }).format(new Date(s.start))
                  : '';
                return html`<div data-session="${s.id}"><dt>${T.session[s.id]}</dt><dd><time datetime="${s.start}">${time}${shifted ? html`<small>${shiftedDate}</small>` : ''}</time></dd></div>`;
              })}</dl>`
            : html`<p>${T.noSchedule}</p>`
        }</div>
      </section>`;
    })}
  </div></div>
  <p class="weather-explanation">${T.dailyNote} ${T.daysNote(w.timeZone)}</p>
  <footer class="weather-sources"><a href="${safeUrl(w.scheduleUrl)}" target="_blank" rel="noopener noreferrer">${T.scheduleSource}</a>${weather ? html`<a href="${safeUrl(weather.sourceUrl)}" target="_blank" rel="noopener noreferrer">${T.weatherSource}</a><span>${T.updated}: ${updated} (${T.athens})</span>` : ''}</footer>`;
}
