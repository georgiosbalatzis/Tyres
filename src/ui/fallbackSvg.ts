/**
 * Static SVG visuals: shown before Three.js loads, and permanently when WebGL is unavailable.
 * They carry the same derived tyre colours as the 3D car and the same track geometry as the 3D circuit.
 */
import { type Corner, type DerivedView, heatColour } from '../domain/derivedMetrics.ts';
import type { TrackShape } from '../domain/schema.ts';
import { html, type SafeHtml } from './html.ts';
import { PAGE } from './strings.ts';

export function trackPathD(track: TrackShape, size = 1000): { d: string; viewBox: string } {
  const xs = track.points.map((p) => p[0]);
  const ys = track.points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxY = Math.max(...ys);
  const span = Math.max(Math.max(...xs) - minX, maxY - Math.min(...ys));
  const s = size / span;
  const pts = track.points.map(([x, y]) => `${((x - minX) * s).toFixed(1)} ${((maxY - y) * s).toFixed(1)}`);
  const w = ((Math.max(...xs) - minX) * s).toFixed(0);
  const h = ((maxY - Math.min(...ys)) * s).toFixed(0);
  const pad = size * 0.06;
  return {
    d: `M${pts.join('L')}Z`,
    viewBox: `${-pad} ${-pad} ${Number(w) + pad * 2} ${Number(h) + pad * 2}`,
  };
}

export function circuitSvg(
  track: TrackShape | null,
  name: string | null,
  label = PAGE.circuitOutline(name),
): SafeHtml {
  if (!track) {
    return html`<div class="plate" role="img" aria-label="${PAGE.noOutlineAria}">
      <p>${PAGE.noOutline}</p>
    </div>`;
  }
  const { d, viewBox } = trackPathD(track);
  return html`<svg class="fallback-circuit" viewBox="${viewBox}" role="img" aria-label="${label}">
    <path d="${d}" class="track-casing" />
    <path d="${d}" class="track-line" pathLength="1" />
  </svg>`;
}

const TYRE_RECT: Record<Corner, [number, number, number, number]> = {
  FL: [22, 92, 40, 72],
  FR: [178, 92, 40, 72],
  RL: [18, 330, 46, 84],
  RR: [176, 330, 46, 84],
};

/** Plan view of a generic single-seater, nose up. Tyre fills come from the derived view. */
export function carPlanSvg(view: DerivedView | null, label: string = PAGE.carPlan): SafeHtml {
  const tyre = (c: Corner) => {
    const [x, y, w, h] = TYRE_RECT[c];
    const fill = heatColour(view?.corners[c].intensity ?? null);
    return html`<rect class="plan-tyre" data-corner="${c}" x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${fill}" />`;
  };
  return html`<svg class="fallback-car" viewBox="0 0 240 470" role="img" aria-label="${label}">
    <g class="plan-body">
      <path d="M36 44h168v14H36z" />
      <path d="M112 28h16l6 150h-28z" />
      <path d="M100 178h40l14 70 26 16v66l-26 22-10 58h-44l-10-58-26-22v-66l26-16z" />
      <path d="M66 270h108v48H66z" opacity=".55" />
      <path d="M46 436h148v20H46z" />
      <path d="M108 190a12 12 0 0 1 24 0v34h-24z" class="plan-cockpit" />
    </g>
    ${(['FL', 'FR', 'RL', 'RR'] as const).map(tyre)}
  </svg>`;
}
