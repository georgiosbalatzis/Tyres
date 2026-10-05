/**
 * DERIVED VISUALISATION LOGIC — NOT OFFICIAL PIRELLI MEASUREMENTS.
 *
 * Pirelli publishes circuit characteristics as 1–5 ratings for the whole car and track.
 * It does not publish per-tyre loads, energies or temperatures. The functions here turn
 * those ratings into per-corner intensities (0–1) purely so the 3D car and SVG fallback
 * can *illustrate* where a circuit's demands concentrate.
 *
 * Every visual driven by this module must carry the derived label (STRINGS[lang].derived in src/ui/strings.ts,
 * "Παράγωγη απεικόνιση με βάση τα χαρακτηριστικά πίστας της Pirelli" in Greek).
 * Never call these values temperature, energy in joules, or load in newtons.
 */
import type { RaceRecord } from './schema.ts';

export const CAR_VIEWS = ['longitudinal', 'lateral', 'stress', 'brakingTraction', 'pressures'] as const;
export type CarView = (typeof CAR_VIEWS)[number];
export const CORNERS = ['FL', 'FR', 'RL', 'RR'] as const;
export type Corner = (typeof CORNERS)[number];

/** How intensity is distributed across the tread in the shader: centre band, outer shoulders, or uniform. */
export type TreadPattern = 'centre' | 'shoulder' | 'even';

export interface CornerValue {
  /** 0–1 intensity for colour mapping, or null when the inputs were not published. */
  intensity: number | null;
  /** What the number shown to the user is, e.g. "4 / 5 φρενάρισμα" or "25,0 psi ελάχιστο". */
  display: string;
}

/** Words for the strings a derived view prints; supplied by the UI layer so this module holds no copy. */
export interface DerivedText {
  notProvided: string;
  num: (v: number, digits: number) => string;
  derived: (value: string) => string;
  ratingOf: (rating: number, what: 'lateral' | 'stress' | 'braking' | 'traction') => string;
  psiMin: (psi: string) => string;
  longitudinal: (braking: string, traction: string) => string;
  lateral: string;
  stress: string;
  brakingTraction: string;
  pressures: (min: number, max: number) => string;
}

export interface DerivedView {
  view: CarView;
  pattern: TreadPattern;
  /** Plain-language explanation of the mapping, shown next to the visual. */
  method: string;
  corners: Record<Corner, CornerValue>;
}

/** 1–5 rating → 0–1. */
export function norm(rating: number | null | undefined): number | null {
  return rating == null ? null : Math.min(1, Math.max(0, (rating - 1) / 4));
}

/** Weighted mix that tolerates a missing input by using the one that exists. */
export function mix(a: number | null, wa: number, b: number | null, wb: number): number | null {
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return (a * wa + b * wb) / (wa + wb);
}

const same = (v: CornerValue): Record<Corner, CornerValue> => ({ FL: v, FR: v, RL: v, RR: v });
const axle = (front: CornerValue, rear: CornerValue): Record<Corner, CornerValue> => ({
  FL: front,
  FR: front,
  RL: rear,
  RR: rear,
});

/** Plausible slick-pressure window used only to place a psi value on the colour scale. */
export const PRESSURE_SCALE_PSI = { min: 18, max: 30 } as const;

export function deriveView(record: RaceRecord, view: CarView, text: DerivedText): DerivedView {
  const ratingText = (r: number | null | undefined, what: Parameters<DerivedText['ratingOf']>[1]) =>
    r == null ? text.notProvided : text.ratingOf(r, what);
  const c = record.characteristics;
  const braking = norm(c.braking);
  const traction = norm(c.traction);

  switch (view) {
    case 'longitudinal': {
      // Braking transfers weight forward (fronts work harder); traction is put down by the driven rears.
      // Both inputs are required: showing braking alone as "longitudinal" would overstate what we know.
      const both = braking != null && traction != null;
      const front = both ? mix(braking, 0.65, traction, 0.35) : null;
      const rear = both ? mix(braking, 0.35, traction, 0.65) : null;
      const shown = (v: number | null) =>
        v == null ? text.notProvided : text.derived(text.num(1 + 4 * v, 1));
      return {
        view,
        pattern: 'centre',
        method: text.longitudinal(String(c.braking ?? '–'), String(c.traction ?? '–')),
        corners: axle({ intensity: front, display: shown(front) }, { intensity: rear, display: shown(rear) }),
      };
    }
    case 'lateral':
      return {
        view,
        pattern: 'shoulder',
        method: text.lateral,
        corners: same({ intensity: norm(c.lateral), display: ratingText(c.lateral, 'lateral') }),
      };
    case 'stress':
      return {
        view,
        pattern: 'even',
        method: text.stress,
        corners: same({ intensity: norm(c.tyreStress), display: ratingText(c.tyreStress, 'stress') }),
      };
    case 'brakingTraction':
      return {
        view,
        pattern: 'centre',
        method: text.brakingTraction,
        corners: axle(
          { intensity: braking, display: ratingText(c.braking, 'braking') },
          { intensity: traction, display: ratingText(c.traction, 'traction') },
        ),
      };
    case 'pressures': {
      const p = record.setup.minimumStartingPressurePsi;
      const toIntensity = (psi: number | null | undefined) =>
        psi == null
          ? null
          : Math.min(
              1,
              Math.max(0, (psi - PRESSURE_SCALE_PSI.min) / (PRESSURE_SCALE_PSI.max - PRESSURE_SCALE_PSI.min)),
            );
      const shown = (psi: number | null | undefined) =>
        psi == null ? text.notProvided : text.psiMin(text.num(psi, 1));
      return {
        view,
        pattern: 'even',
        method: text.pressures(PRESSURE_SCALE_PSI.min, PRESSURE_SCALE_PSI.max),
        corners: axle(
          { intensity: toIntensity(p?.front), display: shown(p?.front) },
          { intensity: toIntensity(p?.rear), display: shown(p?.rear) },
        ),
      };
    }
  }
}

/** Five-step demand scale: cool teal → green → amber → orange → red. Mirrors --heat-1…5 in tokens.css. */
export const HEAT_STOPS = ['#2f8f9d', '#7fb069', '#e9c46a', '#f08c3a', '#d9412b'] as const;
/** Neutral used when a value is not provided — never a scale colour, so "missing" can't be read as "low". */
export const NO_DATA_COLOUR = '#4a5058';

export function heatColour(intensity: number | null): string {
  if (intensity == null || Number.isNaN(intensity)) return NO_DATA_COLOUR;
  const t = Math.min(1, Math.max(0, intensity)) * (HEAT_STOPS.length - 1);
  const i = Math.min(HEAT_STOPS.length - 2, Math.floor(t));
  return lerpHex(HEAT_STOPS[i]!, HEAT_STOPS[i + 1]!, t - i);
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const ch = (shift: number) =>
    Math.round(((pa >> shift) & 255) + (((pb >> shift) & 255) - ((pa >> shift) & 255)) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}
