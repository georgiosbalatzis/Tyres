import { BufferGeometry, Float32BufferAttribute, Group, type Material, Mesh } from 'three';
import type { TrackShape } from '../domain/schema.ts';

/** Scene size (in scene units) of the longest side of the circuit. */
const EXTENT = 5.4;

/**
 * Raised technical ribbon along the track centre-line: a top surface plus both side walls,
 * built so vertices run in lap order and `setDrawRange` can draw the lap on.
 */
export function ribbonGeometry(track: TrackShape, halfWidth: number, height: number) {
  const pts = track.points;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const scale = EXTENT / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  // Track y (north) maps to scene −Z so the map reads the right way up from the default camera.
  const P = pts.map(([x, y]) => [(x - cx) * scale, -(y - cy) * scale] as const);
  const n = P.length;

  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const a = P[(i - 1 + n) % n]!;
    const b = P[i % n]!;
    const c = P[(i + 1) % n]!;
    let tx = c[0] - a[0];
    let tz = c[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    tx /= l;
    tz /= l;
    const nx = -tz;
    const nz = tx;
    const L = [b[0] + nx * halfWidth, b[1] + nz * halfWidth];
    const R = [b[0] - nx * halfWidth, b[1] - nz * halfWidth];
    // 4 vertices per station: top-left, top-right, bottom-left, bottom-right
    pos.push(L[0]!, height, L[1]!, R[0]!, height, R[1]!, L[0]!, 0, L[1]!, R[0]!, 0, R[1]!);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 4;
    const b = a + 4;
    idx.push(a, a + 1, b, a + 1, b + 1, b); // top
    idx.push(a + 2, a, b + 2, a, b, b + 2); // left wall
    idx.push(a + 1, a + 3, b + 1, a + 3, b + 3, b + 1); // right wall
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { geometry: g, indexCount: idx.length, scale };
}

export function buildCircuit(track: TrackShape, surface: Material, casing: Material) {
  const group = new Group();
  group.name = 'Circuit';
  const casingGeo = ribbonGeometry(track, 0.12, 0.014);
  const top = ribbonGeometry(track, 0.048, 0.055);
  const casingMesh = new Mesh(casingGeo.geometry, casing);
  const topMesh = new Mesh(top.geometry, surface);
  group.add(casingMesh, topMesh);
  return {
    group,
    /** 0…1 draw-on progress. */
    setProgress(t: number) {
      const k = Math.max(0, Math.min(1, t));
      const snap = (count: number) => Math.floor((count * k) / 18) * 18;
      topMesh.geometry.setDrawRange(0, k >= 1 ? Number.POSITIVE_INFINITY : snap(top.indexCount));
      casingMesh.geometry.setDrawRange(0, k >= 1 ? Number.POSITIVE_INFINITY : snap(casingGeo.indexCount));
    },
    dispose() {
      casingGeo.geometry.dispose();
      top.geometry.dispose();
    },
  };
}
