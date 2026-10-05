import type { CarView, Corner } from '../domain/derivedMetrics.ts';
import {
  type Manifest,
  type ManifestRace,
  Manifest as ManifestSchema,
  parseWith,
  RaceRecord,
  TrackShape as TrackSchema,
  type TrackShape,
} from '../domain/schema.ts';
import { allRaces, neighbours, pickLatest, raceForYearChange, racesInYear } from '../domain/selection.ts';
import {
  type EmbedLang,
  type EmbedPanel,
  embedImagePath,
  embedPath,
  PANEL_IMAGE,
  parseLocation,
  racePath,
  resolveRequest,
  seasonEmbedPath,
  seasonImagePath,
} from '../domain/urlState.ts';
import type { Viewer } from '../three/viewer.ts';
import { formatCountdown, nextRace } from './countdown.ts';
import { html, setHtml } from './html.ts';
import { describe, seasonSection } from './page.ts';
import { PAGE, STRINGS } from './strings.ts';
import {
  band,
  compounds,
  DEFAULT_VIEW,
  dataTable,
  fallbackVisual,
  identity,
  type Mode,
  ratings,
  readout,
  setup,
  sortedCompounds,
  specs,
  titleBlock,
  type ViewState,
} from './templates.ts';

const BASE = import.meta.env.BASE_URL;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T;

interface State {
  manifest: Manifest | null;
  record: RaceRecord;
  track: TrackShape | null;
  view: ViewState;
  viewer: Viewer | null;
  navToken: number;
}

let state: State;
const raceCache = new Map<string, Promise<RaceRecord>>();
const trackCache = new Map<string, Promise<TrackShape | null>>();

/* ------------------------------------------------------------------ notices */

function notice(message: string | null) {
  const el = $('#notice');
  if (message) setHtml(el, html`<p>${message}</p>`);
  else el.replaceChildren();
}

function announce(message: string) {
  $('#announcer').textContent = message;
}

/* ------------------------------------------------------------------ data loading */

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function loadRace(id: string): Promise<RaceRecord> {
  if (!raceCache.has(id)) {
    const p = fetchJson(`${BASE}data/races/${encodeURIComponent(id)}.json`).then((json) => {
      const parsed = parseWith(RaceRecord, json);
      if (!parsed.ok) throw new Error('the race file failed validation');
      return parsed.value;
    });
    p.catch(() => raceCache.delete(id));
    raceCache.set(id, p);
  }
  return raceCache.get(id)!;
}

function loadTrack(id: string | null): Promise<TrackShape | null> {
  if (!id) return Promise.resolve(null);
  if (!trackCache.has(id)) {
    trackCache.set(
      id,
      fetchJson(`${BASE}data/tracks/${encodeURIComponent(id)}.json`)
        .then((json) => {
          const parsed = parseWith(TrackSchema, json);
          return parsed.ok ? parsed.value : null;
        })
        .catch(() => {
          // Network failure: don't remember it, so the next visit to this circuit retries.
          trackCache.delete(id);
          return null;
        }),
    );
  }
  return trackCache.get(id)!;
}

/* ------------------------------------------------------------------ rendering */

function renderRace(animate: boolean) {
  const { record: r, view } = state;
  const figuresBefore = readFigures();
  setHtml($('#r-identity'), identity(r));
  setHtml($('#r-band'), band(r));
  setHtml($('#r-specs'), specs(r));
  setHtml($('#r-ratings'), ratings(r));
  setHtml($('#r-setup'), setup(r));
  setHtml($('#r-compounds'), compounds(r, view.mode === 'tyres' ? view.compound : null));
  setHtml($('#r-source'), titleBlock(r));
  if (state.manifest) setHtml($('#r-season'), seasonSection(state.manifest, r));
  setHtml($('#r-data'), dataTable(r));
  renderView();
  if (animate && !reducedMotion.matches) {
    tweenFigures(figuresBefore);
    const list = $('#r-ratings .rating-list');
    list?.classList.add('is-entering');
    requestAnimationFrame(() => requestAnimationFrame(() => list?.classList.remove('is-entering')));
  }
}

function renderView() {
  const { record: r, track, view } = state;
  const stage = $('#main');
  stage.dataset.mode = view.mode;
  for (const b of document.querySelectorAll<HTMLButtonElement>('.mode')) {
    b.setAttribute('aria-pressed', String(b.dataset.mode === view.mode));
  }
  ($('#r-data') as HTMLElement).hidden = view.mode !== 'data';
  setHtml($('#r-readout'), readout(r, track, view));
  setHtml($('#r-fallback'), fallbackVisual(r, track, view));
  for (const b of document.querySelectorAll<HTMLButtonElement>('.compound')) {
    b.setAttribute('aria-pressed', String(view.mode === 'tyres' && b.dataset.compound === view.compound));
  }
  state.viewer?.setState(view);
}

function readFigures(): Map<string, string> {
  const m = new Map<string, string>();
  for (const el of document.querySelectorAll<HTMLElement>('[data-figure]'))
    m.set(el.dataset.figure!, el.textContent ?? '');
  return m;
}

/** Numeric figures count from their previous value to the new one; text values just swap. */
function tweenFigures(before: Map<string, string>) {
  for (const el of document.querySelectorAll<HTMLElement>('[data-figure]')) {
    const to = el.textContent ?? '';
    const from = before.get(el.dataset.figure!) ?? '';
    const a = Number.parseFloat(from);
    const b = Number.parseFloat(to);
    if (!/^\d+(\.\d+)?$/.test(to) || Number.isNaN(a) || a === b) continue;
    const digits = to.split('.')[1]?.length ?? 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 550);
      const e = 1 - (1 - t) ** 3;
      el.textContent = t < 1 ? (a + (b - a) * e).toFixed(digits) : to;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

function updateHead() {
  const r = state.record;
  document.title = PAGE.seo.title(r.race.name, r.season);
  document.querySelector('meta[name="description"]')?.setAttribute('content', describe(r));
  document
    .querySelector('link[rel="canonical"]')
    ?.setAttribute('href', new URL(racePath(BASE, r), location.origin).href);
}

/* ------------------------------------------------------------------ navigation controls */

function summaryOf(id: string): ManifestRace | null {
  return state.manifest ? (allRaces(state.manifest).find((r) => r.id === id) ?? null) : null;
}

/** Compact enough for a phone-width select: "R16 Bahrain GP, Sepang". */
function optionLabel(r: ManifestRace) {
  const venue = r.slug
    .split('-')
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');
  return `${r.round ? `R${r.round} ` : ''}${r.name.replace(/ Grand Prix$/, ' GP')}, ${venue}`;
}

function syncControls() {
  const m = state.manifest;
  const yearSel = $<HTMLSelectElement>('#year');
  const raceSel = $<HTMLSelectElement>('#race');
  const prev = $<HTMLAnchorElement>('#prev');
  const next = $<HTMLAnchorElement>('#next');
  if (!m) {
    yearSel.disabled = raceSel.disabled = true;
    return;
  }
  const cur = summaryOf(state.record.id);
  setHtml(yearSel, html`${m.years.map((y) => html`<option value="${y.year}">${y.year}</option>`)}`);
  yearSel.value = String(state.record.season);
  setHtml(
    raceSel,
    html`${racesInYear(m, state.record.season).map((r) => html`<option value="${r.id}">${optionLabel(r)}</option>`)}`,
  );
  raceSel.value = state.record.id;
  raceSel.disabled = false;
  yearSel.disabled = false;

  const { prev: p, next: n } = cur ? neighbours(m, cur) : { prev: null, next: null };
  const hadFocus = document.activeElement;
  for (const [el, race, word] of [
    [prev, p, PAGE.scope.prev],
    [next, n, PAGE.scope.next],
  ] as const) {
    if (race) {
      el.href = racePath(BASE, race);
      el.removeAttribute('aria-disabled');
      el.setAttribute('aria-label', `${word}: ${race.name} ${race.season}`);
      el.dataset.race = race.id;
    } else {
      el.removeAttribute('href');
      el.setAttribute('aria-disabled', 'true');
      el.setAttribute('role', 'link');
      el.removeAttribute('aria-label');
      delete el.dataset.race;
    }
  }
  // Reaching the first/last race disables the step that was just used: keep keyboard focus nearby.
  if (hadFocus === prev || hadFocus === next) {
    const target = hadFocus.hasAttribute('href') ? null : hadFocus === next ? prev : next;
    if (target) (target.hasAttribute('href') ? target : raceSel).focus();
  }
  for (const a of document.querySelectorAll('.archive a')) {
    if (a.getAttribute('href') === racePath(BASE, state.record)) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

async function goTo(id: string, opts: { history: 'push' | 'replace' | 'none' }) {
  if (id === state.record.id) {
    // Cancel any slower switch still in flight: the visitor's latest choice wins.
    state.navToken++;
    $('#main').classList.remove('is-switching');
    syncControls();
    if (opts.history !== 'none') writeHistory(opts.history);
    return;
  }
  const token = ++state.navToken;
  const stage = $('#main');
  const host = $('#canvas-host');
  stage.classList.add('is-switching');
  if (!reducedMotion.matches) {
    host.style.setProperty('--sweep-to', `${host.clientWidth}px`);
    host.classList.remove('is-sweeping');
    void host.offsetWidth;
    host.classList.add('is-sweeping');
  }
  try {
    const record = await loadRace(id);
    const track = await loadTrack(record.circuit.trackId);
    if (token !== state.navToken) return;
    // Keep the selected tyre's weekend role (e.g. medium), not its compound number.
    const role = state.record.compounds?.find((c) => c.compound === state.view.compound)?.raceLabel;
    const list = sortedCompounds(record);
    const compound =
      list.find((c) => c.raceLabel === role)?.compound ?? list[1]?.compound ?? list[0]?.compound ?? null;
    state.view = { ...state.view, compound };
    state.record = record;
    state.track = track;
    renderRace(true);
    syncControls();
    updateHead();
    if (opts.history !== 'none') writeHistory(opts.history);
    state.viewer?.setRace(record, track, state.view);
    announce(PAGE.notice.showing(record.race.name, record.season));
    notice(null);
  } catch (err) {
    if (token !== state.navToken) return;
    const name = summaryOf(id)?.name ?? id;
    notice(PAGE.notice.loadFailed(name, (err as Error).message, state.record.race.name, state.record.season));
    syncControls();
  } finally {
    if (token === state.navToken) requestAnimationFrame(() => stage.classList.remove('is-switching'));
  }
}

function writeHistory(mode: 'push' | 'replace') {
  const url = racePath(BASE, state.record);
  const data = { raceId: state.record.id };
  if (mode === 'push' && location.pathname === url && !location.search) return;
  if (mode === 'push') history.pushState(data, '', url);
  else history.replaceState(data, '', url);
}

/* ------------------------------------------------------------------ view state */

function setView(patch: Partial<ViewState>) {
  state.view = { ...state.view, ...patch };
  renderView();
}

function onPick(sel: { corner?: Corner; compound?: string }) {
  if (sel.corner) setView({ corner: state.view.corner === sel.corner ? null : sel.corner });
  if (sel.compound) setView({ compound: sel.compound });
}

function bindEvents() {
  $('#year').addEventListener('change', (e) => {
    if (!state.manifest) return;
    const year = Number((e.target as HTMLSelectElement).value);
    const target = raceForYearChange(state.manifest, year, summaryOf(state.record.id));
    if (target) void goTo(target.id, { history: 'push' });
  });
  $('#race').addEventListener(
    'change',
    (e) => void goTo((e.target as HTMLSelectElement).value, { history: 'push' }),
  );

  for (const id of ['#prev', '#next']) {
    $(id).addEventListener('click', (e) => {
      const race = (e.currentTarget as HTMLElement).dataset.race;
      if (!race || !state.manifest) return;
      e.preventDefault();
      void goTo(race, { history: 'push' });
    });
  }

  document.querySelector('.archive')?.addEventListener('click', (e: Event) => {
    if (!(e instanceof MouseEvent)) return;
    const a = (e.target as Element).closest('a');
    if (!a || !state.manifest || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const req = parseLocation(new URL(a.href).pathname, '', BASE);
    const hit =
      req.year && req.race
        ? allRaces(state.manifest).find((r) => r.season === req.year && r.slug === req.race)
        : null;
    if (!hit) return;
    e.preventDefault();
    void goTo(hit.id, { history: 'push' });
    $('#main').focus({ preventScroll: false });
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  });

  window.addEventListener('popstate', () => {
    if (!state.manifest) return;
    const { race } = resolveRequest(
      state.manifest,
      parseLocation(location.pathname, location.search, BASE),
      latestOf(state.manifest),
    );
    if (race) void goTo(race.id, { history: 'none' });
  });

  $('#main').addEventListener('click', (e) => {
    const t = e.target as Element;
    const mode = t.closest<HTMLElement>('.mode')?.dataset.mode as Mode | undefined;
    if (mode) {
      const compound =
        mode === 'tyres' && !state.view.compound
          ? (sortedCompounds(state.record)[1]?.compound ?? null)
          : state.view.compound;
      setView({ mode, compound });
      announce(`${mode} view`);
      return;
    }
    const view = t.closest<HTMLElement>('.chip')?.dataset.view as CarView | undefined;
    if (view) return setView({ carView: view });
    const corner = t.closest<HTMLElement>('.corner')?.dataset.corner as Corner | undefined;
    if (corner) return onPick({ corner });
    const compound = t.closest<HTMLElement>('.compound')?.dataset.compound;
    if (compound) return setView({ mode: 'tyres', compound });
    const action = t.closest<HTMLElement>('.tool')?.dataset.action;
    if (action === 'reset') state.viewer?.resetCamera();
    if (action === 'rotate') {
      const btn = t.closest<HTMLElement>('.tool')!;
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      state.viewer?.setAutoRotate(on);
    }
  });
}

/* ------------------------------------------------------------------ 3D (progressive enhancement) */

function setupViewer() {
  const host = $('#canvas-host');
  const loading = $('#loading-3d');
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const start = async () => {
    loading.hidden = false;
    try {
      const { createViewer } = await import('../three/viewer.ts');
      state.viewer = createViewer(host, {
        record: state.record,
        track: state.track,
        view: state.view,
        reducedMotion: reducedMotion.matches,
        onPick,
        onReady: () => {
          host.classList.add('has-3d');
          $('#r-fallback').setAttribute('aria-hidden', 'true');
          ($('#view-tools') as HTMLElement).hidden = false;
          loading.hidden = true;
        },
        onFailure: (reason) => {
          state.viewer = null;
          host.classList.remove('has-3d');
          $('#r-fallback').removeAttribute('aria-hidden');
          ($('#view-tools') as HTMLElement).hidden = true;
          setHtml(loading, html`${reason} ${PAGE.viewer.flat}`);
          loading.hidden = false;
        },
      });
    } catch (err) {
      // WebGLRenderer throws when no context can be created (no GPU, blocked, or disabled).
      const noGl = /webgl|context/i.test(String((err as Error)?.message));
      host.dataset.webgl = noGl ? 'unavailable' : 'failed';
      setHtml(loading, noGl ? html`${STRINGS.el.noGl}` : html`${STRINGS.el.failed3d}`);
    }
  };
  if (conn?.saveData) {
    setHtml(loading, html`<button type="button" class="chip" id="load-3d">${PAGE.viewer.load}</button>`);
    loading.hidden = false;
    $('#load-3d').addEventListener('click', () => void start(), { once: true });
    return;
  }
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 200));
    idle(() => void start());
  });
  io.observe(host);
}

/* ------------------------------------------------------------------ boot */

const latestOf = (m: Manifest) => allRaces(m).find((r) => r.id === m.latest) ?? pickLatest(allRaces(m));

/* ------------------------------------------------------------------ article embeds */

/**
 * The "Embed" dialog: pick a panel and language, preview the script-free embed page, copy an iframe
 * snippet for an f1stories.gr article. The height comes from the preview itself (same origin), and
 * embed panels are built to keep that height at every width.
 */
function setupEmbedDialog() {
  const dialog = $<HTMLDialogElement>('#embed-dialog');
  const frame = $<HTMLIFrameElement>('#embed-preview');
  const code = $<HTMLTextAreaElement>('#embed-code');
  const copy = $<HTMLButtonElement>('#embed-copy');
  const download = $<HTMLAnchorElement>('#embed-download');
  const status = $('#embed-status');
  const open = $<HTMLButtonElement>('#embed-open');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  open.hidden = false;
  let src = '';

  const choice = (name: string) =>
    (dialog.querySelector(`input[name="${name}"]:checked`) as HTMLInputElement).value;
  const imageInput = dialog.querySelector<HTMLInputElement>('input[name="embed-format"][value="image"]')!;
  // Race panels live under the race, the season strip under the season.
  const pathFor = (
    race: (base: string, lang: EmbedLang, r: RaceRecord, panel: EmbedPanel) => string,
    season: (base: string, lang: EmbedLang, year: number) => string,
  ) => {
    const lang = choice('embed-lang') as EmbedLang;
    const panel = choice('embed-panel');
    return panel === 'season'
      ? season(BASE, lang, state.record.season)
      : race(BASE, lang, state.record, panel as EmbedPanel);
  };
  const update = () => {
    if (!state.record) return;
    // The 3D view has no still image.
    imageInput.disabled = choice('embed-panel') === '3d';
    if (imageInput.disabled && imageInput.checked)
      dialog.querySelector<HTMLInputElement>('input[name="embed-format"][value="iframe"]')!.checked = true;
    src = new URL(pathFor(embedPath, seasonEmbedPath), location.href).href;
    copy.disabled = true;
    download.hidden = true;
    status.textContent = '';
    code.value = '';
    frame.src = src;
  };
  frame.addEventListener('load', () => {
    const doc = frame.contentDocument;
    const panel = doc?.querySelector('.e');
    if (!doc || !panel || !src || !state.record) {
      code.value = '';
      if (src) status.textContent = PAGE.embedDialog.previewFailed;
      return;
    }
    const height = Math.ceil(panel.getBoundingClientRect().height);
    frame.style.height = `${height}px`;
    const title = doc.title.replace(/ \| F1 Stories$/, '');
    if (choice('embed-format') === 'image') {
      const img = new URL(pathFor(embedImagePath, seasonImagePath), location.href).href;
      // Alt text = the panel's own text (full, even where the panel clips it), minus the brand line.
      const text = panel.cloneNode(true) as HTMLElement;
      for (const el of text.querySelectorAll('.e-brand, [aria-hidden="true"]')) el.remove();
      const alt = (text.textContent ?? '').replace(/\s+/g, ' ').trim();
      const { width, margin } = PANEL_IMAGE;
      code.value =
        html`<img src="${img}" alt="${alt}" width="${width + 2 * margin}" height="${height + 2 * margin}" loading="lazy" style="display:block;width:100%;max-width:${width + 2 * margin}px;height:auto;" />`.value;
      download.href = img;
      download.hidden = false;
    } else {
      // Same shape as the other f1stories.gr tool embeds; html`` escapes every attribute value.
      code.value =
        html`<iframe src="${src}" title="${PAGE.embedDialog.iframeTitle(title)}" width="100%" height="${height}" loading="lazy" style="border:0;width:100%;max-width:100%;display:block;"></iframe>`.value;
    }
    copy.disabled = false;
  });
  open.addEventListener('click', () => {
    update();
    dialog.showModal();
  });
  dialog.addEventListener('change', update);
  dialog.addEventListener('close', () => {
    src = '';
    frame.src = 'about:blank';
  });
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.value);
      status.textContent = PAGE.embedDialog.copied;
    } catch {
      code.select();
      status.textContent = PAGE.embedDialog.copyBlocked;
    }
  });
}

/** The masthead's next-GP countdown, from the bundled calendar. Stays hidden once the calendar has run out. */
function startCountdown() {
  const el = document.getElementById('nav-countdown');
  if (!el) return;
  const tick = () => {
    const race = nextRace(Date.now());
    el.hidden = !race;
    if (!race) return;
    el.querySelector('.nav-countdown-name')!.textContent = race.name;
    el.querySelector('.nav-countdown-time')!.textContent = formatCountdown(race.start - Date.now());
  };
  tick();
  setInterval(tick, 60_000);
}

export async function start() {
  startCountdown();
  window.addEventListener('unhandledrejection', (e) => {
    console.warn('Unhandled:', e.reason);
    e.preventDefault();
  });

  const bootEl = document.getElementById('boot');
  const boot = JSON.parse(bootEl?.textContent ?? '{}') as {
    raceId?: string;
    record?: unknown;
    track?: unknown;
    notFound?: boolean;
  };
  const rec = parseWith(RaceRecord, boot.record);
  if (!rec.ok) {
    notice(PAGE.notice.bootDamaged);
  }
  const trk = boot.track ? parseWith(TrackSchema, boot.track) : null;

  state = {
    manifest: null,
    record: rec.ok ? rec.value : (undefined as unknown as RaceRecord),
    track: trk?.ok ? trk.value : null,
    view: { ...DEFAULT_VIEW },
    viewer: null,
    navToken: 0,
  };
  bindEvents();
  setupEmbedDialog();

  try {
    const parsed = parseWith(ManifestSchema, await fetchJson(`${BASE}data/manifest.json`));
    if (!parsed.ok) throw new Error('invalid');
    state.manifest = parsed.value;
  } catch {
    notice(PAGE.notice.manifestFailed);
  }

  if (state.manifest) {
    const req = parseLocation(location.pathname, location.search, BASE);
    const latest = latestOf(state.manifest);
    const { race, notice: msg } = resolveRequest(state.manifest, req, latest);
    if (!rec.ok && race) {
      state.record = await loadRace(race.id).catch(() => undefined as unknown as RaceRecord);
      state.track = state.record ? await loadTrack(state.record.circuit.trackId) : null;
      if (state.record) {
        renderRace(false);
        updateHead();
      }
    }
    if (!state.record) return;
    if (race && race.id !== state.record.id) {
      await goTo(race.id, { history: 'replace' });
    } else if (location.search && race) {
      writeHistory('replace');
    }
    if (msg && !boot.notFound) notice(PAGE.notice.resolve(msg));
    history.replaceState({ raceId: state.record.id }, '');
  }
  if (!state.record) return;
  syncControls();
  setupViewer();
}
