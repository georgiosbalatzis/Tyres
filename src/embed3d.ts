/**
 * The 3D article embed (/embed/{lang}/{season}/{slug}/3d/). The page arrives as a complete poster:
 * the flat drawing on the dark bench plus the readout text. This script lets the reader switch views
 * and, only when asked, loads the shared Three.js viewer in place of the drawing.
 */
import type { CarView } from './domain/derivedMetrics.ts';
import { parseWith, RaceRecord, TrackShape } from './domain/schema.ts';
import type { EmbedLang } from './domain/urlState.ts';
import type { Viewer } from './three/viewer.ts';
import { type EmbedMode, embedReadout, embedText } from './ui/embed.ts';
import { setHtml } from './ui/html.ts';
import { DEFAULT_VIEW, fallbackVisual, type ViewState } from './ui/templates.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const boot = JSON.parse($('boot').textContent ?? '{}') as {
  record?: unknown;
  track?: unknown;
  lang?: EmbedLang;
};
const rec = parseWith(RaceRecord, boot.record);
const trk = boot.track ? parseWith(TrackShape, boot.track) : null;

if (rec.ok) {
  const record = rec.value;
  const track = trk?.ok ? trk.value : null;
  const lang: EmbedLang = boot.lang === 'en' ? 'en' : 'el';
  const host = $('canvas-host');
  const load = $<HTMLButtonElement>('load-3d');
  const note = $('e-load-note');
  const reset = $<HTMLButtonElement>('e-reset');
  const t = embedText(lang);
  let view: ViewState = { ...DEFAULT_VIEW, mode: 'car' };
  let viewer: Viewer | null = null;

  const render = () => {
    setHtml($('r-readout'), embedReadout(record, track, lang, view as { mode: EmbedMode; carView: CarView }));
    for (const b of document.querySelectorAll<HTMLButtonElement>('.e-mode'))
      b.setAttribute('aria-pressed', String(b.dataset.mode === view.mode));
    if (!viewer) setHtml($('r-fallback'), fallbackVisual(record, track, view));
    viewer?.setState(view);
  };

  document.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-mode], [data-view]');
    if (!el) return;
    if (el.dataset.mode) view = { ...view, mode: el.dataset.mode as EmbedMode };
    if (el.dataset.view) view = { ...view, carView: el.dataset.view as CarView };
    render();
  });

  const fail = (message: string) => {
    viewer = null;
    host.classList.remove('has-3d');
    load.hidden = true;
    reset.hidden = true;
    note.textContent = message;
  };

  $('e-load').hidden = false;
  load.addEventListener('click', async () => {
    load.disabled = true;
    note.textContent = t.loading3d;
    try {
      const { createViewer } = await import('./three/viewer.ts');
      viewer = createViewer(host, {
        record,
        track,
        view,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        onPick: (sel) => {
          view = { ...view, ...sel };
          render();
        },
        onReady: () => {
          host.classList.add('has-3d');
          $('r-fallback').setAttribute('aria-hidden', 'true');
          $('e-load').hidden = true;
          reset.hidden = false;
        },
        onFailure: () => fail(t.failed3d),
      });
    } catch (err) {
      const noGl = /webgl|context/i.test(String((err as Error)?.message));
      fail(noGl ? t.noGl : t.failed3d);
    }
  });
  reset.addEventListener('click', () => viewer?.resetCamera());
} else {
  // Damaged boot data: the poster drawing and readout stay; no 3D offer.
  $('e-load').hidden = true;
}
