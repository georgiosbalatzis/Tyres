/**
 * A generic, unbranded modern single-seater built from primitives — not a replica of any team's car.
 * Proportions follow the public 2026 technical-regulation envelope (≈3.4 m wheelbase, ≈1.9 m width,
 * 18-inch wheels) closely enough to be recognisable, nothing more.
 *
 * Axes: +X forward, +Y up, +Z to the driver's right (right-handed). Units: metres.
 * Named nodes (the contract a future GLB must also satisfy — see modelLoader.ts):
 *   Car › Chassis, Halo, FrontWing, RearWing, FrontLeftTyre, FrontRightTyre, RearLeftTyre, RearRightTyre
 */
import {
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import type { Corner } from '../domain/derivedMetrics.ts';
import { demandMaterial, FRONT_TYRE, REAR_TYRE, tyreGeometry, wheel } from './tyre.ts';

/* ------------------------------------------------------------------ materials */

export function carMaterials() {
  return {
    paint: new MeshStandardMaterial({ color: '#737b85', roughness: 0.4, metalness: 0.2 }),
    paintDark: new MeshStandardMaterial({ color: '#343a41', roughness: 0.45, metalness: 0.25 }),
    carbon: new MeshStandardMaterial({ color: '#141619', roughness: 0.5, metalness: 0.15 }),
    titanium: new MeshStandardMaterial({ color: '#8d949c', roughness: 0.32, metalness: 0.85 }),
    rim: new MeshStandardMaterial({ color: '#2a2d31', roughness: 0.35, metalness: 0.9 }),
    hub: new MeshStandardMaterial({ color: '#1c1e21', roughness: 0.55, metalness: 0.6 }),
    visor: new MeshStandardMaterial({ color: '#0b0c0d', roughness: 0.15, metalness: 0.4 }),
    accent: new MeshStandardMaterial({ color: '#d8d4cb', roughness: 0.45, metalness: 0.1 }),
  };
}

/* ------------------------------------------------------------------ lofted bodywork */

export interface Station {
  x: number;
  w: number;
  h: number;
  y: number;
  z?: number;
  /** Superellipse exponent: 2 = ellipse, 4+ = rounded box. */
  n?: number;
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/** Loft superellipse cross-sections along X into a closed, smooth body. */
export function loft(stations: Station[], radial = 32, perSpan = 6): BufferGeometry {
  const keys: (keyof Station)[] = ['x', 'w', 'h', 'y', 'z', 'n'];
  const val = (s: Station, k: keyof Station) => (s[k] ?? (k === 'n' ? 2.5 : 0)) as number;
  const rings: Required<Station>[] = [];
  for (let i = 0; i < stations.length - 1; i++) {
    const p = [
      stations[Math.max(0, i - 1)]!,
      stations[i]!,
      stations[i + 1]!,
      stations[Math.min(stations.length - 1, i + 2)]!,
    ];
    for (let j = 0; j < perSpan; j++) {
      const t = j / perSpan;
      const s = {} as Required<Station>;
      for (const k of keys) s[k] = catmull(val(p[0]!, k), val(p[1]!, k), val(p[2]!, k), val(p[3]!, k), t);
      rings.push(s);
    }
  }
  const last = stations.at(-1)!;
  rings.push({ x: last.x, w: last.w, h: last.h, y: last.y, z: last.z ?? 0, n: last.n ?? 2.5 });

  const pos: number[] = [];
  const idx: number[] = [];
  for (const r of rings) {
    for (let k = 0; k < radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const e = 2 / r.n;
      pos.push(
        r.x,
        r.y + (r.h / 2) * Math.sign(s) * Math.abs(s) ** e,
        r.z + (r.w / 2) * Math.sign(c) * Math.abs(c) ** e,
      );
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < radial; k++) {
      const a = i * radial + k;
      const b = i * radial + ((k + 1) % radial);
      const c = a + radial;
      const d = b + radial;
      idx.push(a, c, b, b, c, d);
    }
  }
  // End caps (fan to ring centre).
  for (const [ring, flip] of [
    [0, true],
    [rings.length - 1, false],
  ] as const) {
    const r = rings[ring]!;
    const centre = pos.length / 3;
    pos.push(r.x, r.y, r.z);
    for (let k = 0; k < radial; k++) {
      const a = ring * radial + k;
      const b = ring * radial + ((k + 1) % radial);
      if (flip) idx.push(centre, a, b);
      else idx.push(centre, b, a);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Thin cambered airfoil profile (chord along −X from the leading edge), extruded across the car. */
function wingElement(chord: number, thickness: number, span: number, camber = 0.06) {
  const s = new Shape();
  const N = 14;
  const top: [number, number][] = [];
  const bottom: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const yc = camber * chord * 4 * t * (1 - t);
    const th =
      thickness *
      5 *
      (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t ** 3 - 0.1036 * t ** 4);
    top.push([-t * chord, yc + th]);
    bottom.push([-t * chord, yc - th]);
  }
  s.moveTo(...top[0]!);
  for (const p of top.slice(1)) s.lineTo(...p);
  for (const p of bottom.reverse()) s.lineTo(...p);
  const g = new ExtrudeGeometry(s, { depth: span, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -span / 2);
  g.computeVertexNormals();
  return g;
}

function plate(x: number, y: number, z: number, lx: number, ly: number, lz: number, mat: Material) {
  const s = new Shape();
  const r = Math.min(lx, ly) * 0.18;
  s.moveTo(-lx / 2 + r, -ly / 2);
  s.lineTo(lx / 2 - r, -ly / 2);
  s.quadraticCurveTo(lx / 2, -ly / 2, lx / 2, -ly / 2 + r);
  s.lineTo(lx / 2, ly / 2 - r);
  s.quadraticCurveTo(lx / 2, ly / 2, lx / 2 - r, ly / 2);
  s.lineTo(-lx / 2 + r, ly / 2);
  s.quadraticCurveTo(-lx / 2, ly / 2, -lx / 2, ly / 2 - r);
  s.lineTo(-lx / 2, -ly / 2 + r);
  s.quadraticCurveTo(-lx / 2, -ly / 2, -lx / 2 + r, -ly / 2);
  const g = new ExtrudeGeometry(s, { depth: lz, bevelEnabled: false, curveSegments: 3 });
  g.translate(0, 0, -lz / 2);
  const m = new Mesh(g, mat);
  m.position.set(x, y, z);
  return m;
}

function rod(a: Vector3, b: Vector3, radius: number, mat: Material) {
  const len = a.distanceTo(b);
  const m = new Mesh(new CylinderGeometry(radius, radius, len, 8), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

/* ------------------------------------------------------------------ assembly */

export interface CarModel {
  root: Group;
  tyres: Record<Corner, Mesh>;
  tyreMaterials: Record<Corner, ReturnType<typeof demandMaterial>>;
}

export const WHEEL_POS: Record<Corner, [number, number, number]> = {
  FL: [1.62, FRONT_TYRE.radius, -0.8],
  FR: [1.62, FRONT_TYRE.radius, 0.8],
  RL: [-1.78, REAR_TYRE.radius, -0.77],
  RR: [-1.78, REAR_TYRE.radius, 0.77],
};

export function buildCar(): CarModel {
  const M = carMaterials();
  const car = new Group();
  car.name = 'Car';

  /* Chassis: nose → monocoque → engine cover → gearbox, as one lofted body. */
  const chassis = new Group();
  chassis.name = 'Chassis';
  const body = new Mesh(
    loft(
      [
        { x: 2.74, w: 0.1, h: 0.07, y: 0.2, n: 2.2 },
        { x: 2.45, w: 0.2, h: 0.14, y: 0.25, n: 2.6 },
        { x: 1.95, w: 0.28, h: 0.24, y: 0.36, n: 3 },
        { x: 1.35, w: 0.38, h: 0.36, y: 0.46, n: 3.4 },
        { x: 0.8, w: 0.56, h: 0.46, y: 0.52, n: 4 },
        { x: 0.3, w: 0.72, h: 0.5, y: 0.53, n: 4.5 },
        { x: -0.15, w: 0.74, h: 0.56, y: 0.55, n: 4.5 },
        { x: -0.55, w: 0.56, h: 0.78, y: 0.63, n: 3.4 },
        { x: -1.05, w: 0.42, h: 0.6, y: 0.58, n: 3 },
        { x: -1.6, w: 0.3, h: 0.4, y: 0.5, n: 2.8 },
        { x: -2.1, w: 0.22, h: 0.28, y: 0.42, n: 2.6 },
        { x: -2.38, w: 0.16, h: 0.18, y: 0.4, n: 2.4 },
      ],
      40,
      7,
    ),
    M.paint,
  );
  chassis.add(body);

  // Engine-cover fin: a thin lofted blade along the spine.
  const fin = new Mesh(
    loft(
      [
        { x: -0.62, w: 0.02, h: 0.02, y: 1.0, n: 2 },
        { x: -0.95, w: 0.016, h: 0.14, y: 0.93, n: 4 },
        { x: -1.55, w: 0.014, h: 0.12, y: 0.8, n: 4 },
        { x: -1.9, w: 0.012, h: 0.03, y: 0.72, n: 2 },
      ],
      8,
      5,
    ),
    M.paintDark,
  );
  chassis.add(fin);

  // Airbox intake above the driver.
  chassis.add(plate(-0.5, 0.99, 0, 0.08, 0.14, 0.2, M.visor));

  // Sidepods with undercut, both sides.
  for (const side of [1, -1]) {
    const pod = new Mesh(
      loft(
        [
          { x: 0.64, z: side * 0.44, w: 0.2, h: 0.3, y: 0.5, n: 5 },
          { x: 0.4, z: side * 0.5, w: 0.3, h: 0.36, y: 0.5, n: 5 },
          { x: -0.2, z: side * 0.48, w: 0.3, h: 0.3, y: 0.49, n: 4.5 },
          { x: -0.9, z: side * 0.36, w: 0.24, h: 0.2, y: 0.44, n: 3.5 },
          { x: -1.6, z: side * 0.22, w: 0.14, h: 0.1, y: 0.38, n: 2.6 },
        ],
        28,
        6,
      ),
      M.paint,
    );
    chassis.add(pod);
    // Inlet mouth.
    const inlet = plate(0.65, 0.53, side * 0.44, 0.02, 0.2, 0.16, M.visor);
    chassis.add(inlet);
    // Mirror.
    chassis.add(plate(0.62, 0.74, side * 0.42, 0.05, 0.05, 0.13, M.paintDark));
    chassis.add(
      rod(new Vector3(0.62, 0.7, side * 0.38), new Vector3(0.66, 0.56, side * 0.3), 0.008, M.carbon),
    );
  }

  // Floor: plan-view outline, carbon.
  const floorShape = new Shape();
  floorShape.moveTo(1.15, 0.22);
  floorShape.lineTo(0.7, 0.62);
  floorShape.lineTo(-1.35, 0.72);
  floorShape.lineTo(-1.5, 0.52);
  floorShape.lineTo(-2.25, 0.34);
  floorShape.lineTo(-2.25, -0.34);
  floorShape.lineTo(-1.5, -0.52);
  floorShape.lineTo(-1.35, -0.72);
  floorShape.lineTo(0.7, -0.62);
  floorShape.lineTo(1.15, -0.22);
  floorShape.closePath();
  const floorGeo = new ExtrudeGeometry(floorShape, {
    depth: 0.03,
    bevelEnabled: true,
    bevelSize: 0.01,
    bevelThickness: 0.008,
    bevelSegments: 1,
  });
  floorGeo.rotateX(Math.PI / 2);
  const floor = new Mesh(floorGeo, M.carbon);
  floor.position.y = 0.1;
  chassis.add(floor);

  // Cockpit opening and helmet.
  const opening = new Mesh(
    loft(
      [
        { x: 0.48, w: 0.3, h: 0.02, y: 0.785, n: 3 },
        { x: 0.1, w: 0.46, h: 0.02, y: 0.79, n: 4 },
        { x: -0.32, w: 0.42, h: 0.02, y: 0.83, n: 4 },
      ],
      24,
      4,
    ),
    M.visor,
  );
  chassis.add(opening);
  const helmet = new Mesh(new SphereGeometry(0.125, 32, 20), M.accent);
  helmet.position.set(-0.05, 0.86, 0);
  helmet.scale.set(1.1, 1, 1);
  chassis.add(helmet);
  const visor = new Mesh(new SphereGeometry(0.127, 24, 12, -0.9, 1.8, 1.2, 0.5), M.visor);
  visor.position.copy(helmet.position);
  visor.rotation.y = Math.PI / 2;
  visor.scale.set(1, 1, 1.1);
  chassis.add(visor);
  car.add(chassis);

  /* Halo: titanium hoop plus centre pillar. */
  const halo = new Group();
  halo.name = 'Halo';
  const hoop = new CatmullRomCurve3([
    new Vector3(-0.3, 0.8, 0.3),
    new Vector3(-0.2, 0.96, 0.3),
    new Vector3(0.12, 1.0, 0.28),
    new Vector3(0.38, 1.0, 0.17),
    new Vector3(0.46, 1.0, 0),
    new Vector3(0.38, 1.0, -0.17),
    new Vector3(0.12, 1.0, -0.28),
    new Vector3(-0.2, 0.96, -0.3),
    new Vector3(-0.3, 0.8, -0.3),
  ]);
  halo.add(new Mesh(new TubeGeometry(hoop, 64, 0.03, 10, false), M.paintDark));
  const pillar = new CatmullRomCurve3([
    new Vector3(0.46, 1.0, 0),
    new Vector3(0.6, 0.92, 0),
    new Vector3(0.72, 0.74, 0),
  ]);
  halo.add(new Mesh(new TubeGeometry(pillar, 16, 0.028, 10, false), M.paintDark));
  car.add(halo);

  /* Front wing: three elements, endplates. */
  const frontWing = new Group();
  frontWing.name = 'FrontWing';
  const fwSpan = 1.72;
  const main = new Mesh(wingElement(0.34, 0.1, fwSpan, 0.05), M.carbon);
  main.position.set(2.92, 0.1, 0);
  frontWing.add(main);
  const flap1 = new Mesh(wingElement(0.2, 0.1, fwSpan - 0.1, 0.1), M.carbon);
  flap1.position.set(2.66, 0.15, 0);
  flap1.rotation.z = 0.22;
  frontWing.add(flap1);
  const flap2 = new Mesh(wingElement(0.16, 0.1, fwSpan - 0.2, 0.12), M.paint);
  flap2.position.set(2.5, 0.21, 0);
  flap2.rotation.z = 0.4;
  frontWing.add(flap2);
  for (const side of [1, -1])
    frontWing.add(plate(2.72, 0.17, side * (fwSpan / 2 + 0.005), 0.46, 0.2, 0.012, M.carbon));
  car.add(frontWing);

  /* Rear wing: mainplane + flap, endplates, beam wing, pylon. */
  const rearWing = new Group();
  rearWing.name = 'RearWing';
  const rwSpan = 1.0;
  const rMain = new Mesh(wingElement(0.3, 0.12, rwSpan, 0.08), M.carbon);
  rMain.position.set(-2.1, 0.86, 0);
  rMain.rotation.z = 0.12;
  rearWing.add(rMain);
  const rFlap = new Mesh(wingElement(0.2, 0.1, rwSpan, 0.1), M.paint);
  rFlap.position.set(-2.34, 0.97, 0);
  rFlap.rotation.z = 0.5;
  rearWing.add(rFlap);
  const beam = new Mesh(wingElement(0.2, 0.12, rwSpan - 0.1, 0.06), M.carbon);
  beam.position.set(-2.18, 0.5, 0);
  rearWing.add(beam);
  for (const side of [1, -1])
    rearWing.add(plate(-2.3, 0.78, side * (rwSpan / 2 + 0.006), 0.52, 0.5, 0.012, M.carbon));
  rearWing.add(plate(-2.2, 0.62, 0, 0.12, 0.34, 0.02, M.carbon));
  car.add(rearWing);

  /* Wheels, suspension. */
  const tyres = {} as Record<Corner, Mesh>;
  const tyreMaterials = {} as CarModel['tyreMaterials'];
  const frontGeo = tyreGeometry(FRONT_TYRE);
  const rearGeo = tyreGeometry(REAR_TYRE);
  const names: Record<Corner, string> = {
    FL: 'FrontLeftTyre',
    FR: 'FrontRightTyre',
    RL: 'RearLeftTyre',
    RR: 'RearRightTyre',
  };
  for (const corner of ['FL', 'FR', 'RL', 'RR'] as const) {
    const front = corner[0] === 'F';
    const spec = front ? FRONT_TYRE : REAR_TYRE;
    const mat = demandMaterial();
    const { group, tyre } = wheel(spec, mat, M.rim, M.hub, front ? frontGeo : rearGeo);
    group.name = names[corner];
    tyre.name = `${names[corner]}Rubber`;
    tyre.userData.corner = corner;
    const [x, y, z] = WHEEL_POS[corner];
    group.position.set(x, y, z);
    if (z < 0) group.rotation.y = Math.PI;
    car.add(group);
    tyres[corner] = tyre;
    tyreMaterials[corner] = mat;

    // Double wishbones from the chassis to the upright.
    const inner = front ? 0.16 : 0.2;
    const s = Math.sign(z);
    const hubZ = z - s * spec.width * 0.42;
    for (const [dy, spread] of [
      [0.14, 0.22],
      [-0.1, 0.28],
    ] as const) {
      const outer = new Vector3(x, y + dy, hubZ);
      car.add(rod(outer, new Vector3(x + spread, y + dy + 0.04, s * inner), 0.012, M.carbon));
      car.add(rod(outer, new Vector3(x - spread, y + dy + 0.04, s * inner), 0.012, M.carbon));
    }
  }

  car.traverse((o) => {
    if ((o as Mesh).isMesh) o.matrixAutoUpdate = true;
  });
  return { root: car, tyres, tyreMaterials };
}
