import {
  BufferAttribute,
  Color,
  CylinderGeometry,
  Group,
  LatheGeometry,
  type Material,
  Mesh,
  MeshStandardMaterial,
  Vector2,
} from 'three';
import type { TreadPattern } from '../domain/derivedMetrics.ts';

export interface TyreSpec {
  radius: number;
  width: number;
  rimRadius: number;
}

export const FRONT_TYRE: TyreSpec = { radius: 0.36, width: 0.3, rimRadius: 0.235 };
export const REAR_TYRE: TyreSpec = { radius: 0.36, width: 0.38, rimRadius: 0.235 };

/**
 * Lathe profile of an 18-inch slick: bead → sidewall bulge → rounded shoulder → flat tread.
 * Two custom attributes drive the demand shader:
 *   aAxial  −1…1 across the width (for centre vs shoulder patterns)
 *   aTread  0 on the sidewall … 1 on the running surface
 *   aSide   0 on tread … 1 at the sidewall band where the compound colour sits
 */
export function tyreGeometry(spec: TyreSpec, radial = 72) {
  const { radius: R, width: W, rimRadius: r0 } = spec;
  const h = W / 2;
  const shoulder = 0.055;
  const pts: Vector2[] = [];
  const push = (rad: number, axial: number) => pts.push(new Vector2(rad, axial));
  // inner bead to outer sidewall (axial = -h side)
  const side = (s: number) => {
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const rad = r0 + (R - shoulder - r0) * t;
      const bulge = Math.sin(t * Math.PI) * 0.018;
      push(rad, s * (h - 0.012 + bulge));
    }
  };
  side(-1);
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    push(R - shoulder + Math.sin(a) * shoulder, -(h - shoulder) - Math.cos(a) * (shoulder - 0.006));
  }
  for (let i = 1; i < 10; i++) push(R, -(h - shoulder) + ((2 * (h - shoulder)) / 10) * i);
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    push(R - shoulder + Math.cos(a) * shoulder, h - shoulder + Math.sin(a) * (shoulder - 0.006));
  }
  const tail: Vector2[] = [];
  for (let i = 8; i >= 0; i--) {
    const t = i / 8;
    const rad = r0 + (R - shoulder - r0) * t;
    tail.push(new Vector2(rad, h - 0.012 + Math.sin(t * Math.PI) * 0.018));
  }
  pts.push(...tail.slice(1));

  const geo = new LatheGeometry(pts, radial);
  // Lathe revolves around Y; lay the tyre so its axis is Z (car width direction).
  geo.rotateX(Math.PI / 2);
  const pos = geo.getAttribute('position');
  const axial = new Float32Array(pos.count);
  const tread = new Float32Array(pos.count);
  const sideBand = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const rad = Math.hypot(x, y);
    axial[i] = Math.max(-1, Math.min(1, z / h));
    tread[i] = smooth(R - shoulder * 0.9, R - 0.004, rad) * (1 - smooth(h - 0.01, h + 0.01, Math.abs(z)));
    const band = (rad - r0) / (R - r0);
    sideBand[i] = (1 - tread[i]!) * smooth(0.55, 0.62, band) * (1 - smooth(0.74, 0.8, band));
  }
  geo.setAttribute('aAxial', new BufferAttribute(axial, 1));
  geo.setAttribute('aTread', new BufferAttribute(tread, 1));
  geo.setAttribute('aSide', new BufferAttribute(sideBand, 1));
  geo.computeVertexNormals();
  return geo;
}

function smooth(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

const PATTERN_ID: Record<TreadPattern, number> = { centre: 0, shoulder: 1, even: 2 };

export interface DemandUniforms {
  uHeat: { value: Color };
  uHeatMix: { value: number };
  uPattern: { value: number };
  uCompound: { value: Color };
  uCompoundMix: { value: number };
  uSelected: { value: number };
}

/**
 * Matte rubber (MeshStandardMaterial) with an injected tint for the *derived* demand colour on the tread,
 * a compound colour band on the sidewall, and a fresnel rim for selection.
 */
export function demandMaterial(): MeshStandardMaterial & { userData: { uniforms: DemandUniforms } } {
  const uniforms: DemandUniforms = {
    uHeat: { value: new Color('#4a5058') },
    uHeatMix: { value: 0 },
    uPattern: { value: 2 },
    uCompound: { value: new Color('#f5c518') },
    uCompoundMix: { value: 0 },
    uSelected: { value: 0 },
  };
  const mat = new MeshStandardMaterial({ color: '#16171a', roughness: 0.9, metalness: 0 });
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float aAxial;\nattribute float aTread;\nattribute float aSide;\nvarying float vAxial;\nvarying float vTread;\nvarying float vSide;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvAxial = aAxial;\nvTread = aTread;\nvSide = aSide;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uHeat; uniform float uHeatMix; uniform float uPattern;
uniform vec3 uCompound; uniform float uCompoundMix; uniform float uSelected;
varying float vAxial; varying float vTread; varying float vSide;
float patternWeight(float a) {
  float x = abs(a);
  if (uPattern < 0.5) return 1.0 - 0.7 * smoothstep(0.25, 0.95, x);
  if (uPattern < 1.5) return 0.3 + 0.7 * smoothstep(0.15, 0.85, x);
  return 1.0;
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float heatW = uHeatMix * vTread * patternWeight(vAxial);
diffuseColor.rgb = mix(diffuseColor.rgb, uHeat, heatW * 0.92);
diffuseColor.rgb = mix(diffuseColor.rgb, uCompound, vSide * uCompoundMix);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += uHeat * heatW * 0.18 + uCompound * vSide * uCompoundMix * 0.12;
float fres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.5);
totalEmissiveRadiance += vec3(0.61, 0.8, 0.86) * fres * uSelected * 0.9;`,
      );
  };
  mat.customProgramCacheKey = () => 'tyre-demand-v1';
  return mat as MeshStandardMaterial & { userData: { uniforms: DemandUniforms } };
}

export function setPattern(mat: ReturnType<typeof demandMaterial>, pattern: TreadPattern) {
  mat.userData.uniforms.uPattern.value = PATTERN_ID[pattern];
}

/** Tyre + rim assembly. Returns the group and the tyre mesh (the pick target). */
export function wheel(
  spec: TyreSpec,
  tyreMat: Material,
  rimMat: Material,
  hubMat: Material,
  geo = tyreGeometry(spec),
) {
  const g = new Group();
  const tyre = new Mesh(geo, tyreMat);
  g.add(tyre);
  const rim = new Mesh(
    new CylinderGeometry(spec.rimRadius + 0.004, spec.rimRadius + 0.004, spec.width * 0.86, 48, 1, true),
    rimMat,
  );
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  const face = new Mesh(new CylinderGeometry(spec.rimRadius, spec.rimRadius * 0.9, 0.02, 48), hubMat);
  face.rotation.x = Math.PI / 2;
  face.position.z = spec.width * 0.36;
  g.add(face);
  const face2 = face.clone();
  face2.position.z = -spec.width * 0.36;
  g.add(face2);
  const nut = new Mesh(new CylinderGeometry(0.045, 0.05, 0.05, 6), rimMat);
  nut.rotation.x = Math.PI / 2;
  nut.position.z = spec.width * 0.38;
  g.add(nut);
  return { group: g, tyre };
}
