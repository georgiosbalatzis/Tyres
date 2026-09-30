/**
 * Import a circuit centre-line from bacinger/f1-circuits (MIT) into data/tracks/{trackId}.json.
 *
 *   node scripts/import-track.ts <upstream-id> <track-id> "<Circuit name>"
 *   node scripts/import-track.ts --all      # every circuit in data/reference/circuits.json used by a race record
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseWith, SCHEMA_VERSION, TrackShape } from '../src/domain/schema.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const UPSTREAM = 'https://raw.githubusercontent.com/bacinger/f1-circuits/master/circuits';
const UA = 'F1StoriesTyreIntel/1.0 (+https://github.com/georgiosbalatzis; build-time track import)';

type Pt = [number, number];

/** Equirectangular projection around the centroid; < 0.1 % distortion at circuit scale. Output metres, y north. */
export function project(lonLat: Pt[]): Pt[] {
  const R = 6371008.8;
  const lon0 = lonLat.reduce((s, p) => s + p[0], 0) / lonLat.length;
  const lat0 = lonLat.reduce((s, p) => s + p[1], 0) / lonLat.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  return lonLat.map(([lon, lat]) => [
    ((lon - lon0) * Math.PI * R * k) / 180,
    ((lat - lat0) * Math.PI * R) / 180,
  ]);
}

/** Ramer–Douglas–Peucker simplification (iterative). */
export function simplify(points: Pt[], tolerance: number): Pt[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = points[a]!;
    const [bx, by] = points[b]!;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let max = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i]!;
      const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (d > max) [max, idx] = [d, i];
    }
    if (max > tolerance && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

export function pathLength(points: Pt[], closed: boolean): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++)
    sum += Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]);
  if (closed && points.length > 1)
    sum += Math.hypot(points[0]![0] - points.at(-1)![0], points[0]![1] - points.at(-1)![1]);
  return sum;
}

export function toTrack(geojson: unknown, trackId: string, name: string, upstreamId: string): TrackShape {
  const feature = (geojson as { features?: { geometry?: { type?: string; coordinates?: unknown } }[] })
    .features?.[0];
  if (feature?.geometry?.type !== 'LineString') throw new Error('Expected a LineString feature');
  const raw = (feature.geometry.coordinates as number[][]).map((c) => [c[0], c[1]] as Pt);
  let pts = project(raw);
  // Drop a duplicated closing point: the ribbon is rendered as a closed loop.
  const first = pts[0]!;
  const last = pts.at(-1)!;
  if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1) pts = pts.slice(0, -1);
  const simplified = simplify(pts, 1.5).map(
    ([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as Pt,
  );
  const track = {
    schemaVersion: SCHEMA_VERSION,
    id: trackId,
    name,
    points: simplified,
    lengthM: Math.round(pathLength(simplified, true)),
    sectors: null,
    source: {
      name: 'bacinger/f1-circuits',
      url: `https://github.com/bacinger/f1-circuits/blob/master/circuits/${upstreamId}.geojson`,
      license: 'MIT',
      upstreamId,
      note: 'Centre-line only. No elevation, sector boundaries, race direction or start/finish index in the source.',
    },
  };
  const parsed = parseWith(TrackShape, track);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

async function importOne(upstreamId: string, trackId: string, name: string) {
  const res = await fetch(`${UPSTREAM}/${upstreamId}.geojson`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${upstreamId}: HTTP ${res.status}`);
  const track = toTrack(await res.json(), trackId, name, upstreamId);
  await writeFile(path.join(ROOT, 'data/tracks', `${trackId}.json`), `${JSON.stringify(track)}\n`);
  console.log(`${trackId}: ${track.points.length} points, ${track.lengthM} m (from ${upstreamId})`);
}

async function usedTrackIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const layer of ['generated', 'overrides']) {
    const entries = await readdir(path.join(ROOT, 'data', layer), {
      recursive: true,
      withFileTypes: true,
    }).catch(() => []);
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith('.json')) continue;
      const rec = JSON.parse(await readFile(path.join(e.parentPath, e.name), 'utf8'));
      if (rec.circuit?.trackId) ids.add(rec.circuit.trackId);
    }
  }
  return ids;
}

if (import.meta.main) {
  const [a, b, c] = process.argv.slice(2);
  if (a === '--all') {
    const ref = JSON.parse(await readFile(path.join(ROOT, 'data/reference/circuits.json'), 'utf8')) as {
      circuits: { trackId: string; name: string; upstreamId: string }[];
    };
    const used = await usedTrackIds();
    for (const circuit of ref.circuits.filter((x) => used.has(x.trackId))) {
      await importOne(circuit.upstreamId, circuit.trackId, circuit.name);
    }
  } else if (a && b && c) {
    await importOne(a, b, c);
  } else {
    console.error('usage: node scripts/import-track.ts <upstream-id> <track-id> "<name>" | --all');
    process.exit(1);
  }
}
