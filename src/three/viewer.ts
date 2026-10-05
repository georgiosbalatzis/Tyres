/**
 * The single WebGL viewport. Loaded lazily; the page is complete without it.
 * Renders on demand: frames are only drawn while something moves (tween, damping, auto-rotate)
 * and never while the tab is hidden, the canvas is off-screen, or the Data mode hides it.
 */
import {
  Box3,
  Color,
  DoubleSide,
  Group,
  type Mesh,
  MeshStandardMaterial,
  NeutralToneMapping,
  type Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Spherical,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CORNERS, type Corner, deriveView, heatColour } from '../domain/derivedMetrics.ts';
import type { RaceRecord, TrackShape } from '../domain/schema.ts';
import { PAGE, STRINGS } from '../ui/strings.ts';
import { type Mode, sortedCompounds, type ViewState } from '../ui/templates.ts';
import type { CarModel } from './car.ts';
import { buildCircuit } from './circuit.ts';
import { loadCarModel } from './modelLoader.ts';
import { contactShadow, setupStudio } from './studio.ts';
import { demandMaterial, REAR_TYRE, setPattern, tyreGeometry, wheel } from './tyre.ts';

export interface ViewerOptions {
  record: RaceRecord;
  track: TrackShape | null;
  view: ViewState;
  reducedMotion: boolean;
  onPick: (sel: { corner?: Corner; compound?: string }) => void;
  onFailure: (reason: string) => void;
  /** Called once the first frame with the model is ready to be shown. */
  onReady: () => void;
}

export interface Viewer {
  setRace(record: RaceRecord, track: TrackShape | null, view: ViewState): void;
  setState(view: ViewState): void;
  resetCamera(): void;
  setAutoRotate(on: boolean): void;
  dispose(): void;
}

const COMPOUND_HEX: Record<string, string> = { hard: '#f2f1ec', medium: '#f5c518', soft: '#e5322d' };

interface Framing {
  pos: [number, number, number];
  target: [number, number, number];
  min: number;
  max: number;
}

const FRAMING: Record<Exclude<Mode, 'data'>, Framing> = {
  car: { pos: [3.7, 2.5, 7.4], target: [0, 0.4, 0], min: 4.2, max: 13 },
  circuit: { pos: [0, 5.3, 3.5], target: [0, 0, 0.1], min: 3, max: 12 },
  tyres: { pos: [0.5, 1.15, 3.9], target: [0, 0.34, 0], min: 2.2, max: 6.5 },
};

type Tween = { t0: number; dur: number; step: (k: number) => void };
const ease = (t: number) => 1 - (1 - t) ** 3;

export function createViewer(host: HTMLElement, opts: ViewerOptions): Viewer {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const lowPower = coarse && (navigator.hardwareConcurrency ?? 8) <= 4;
  // Create the WebGL2 context ourselves (Three.js needs WebGL2) so "no GPU" is a quiet, handled path.
  const glCanvas = document.createElement('canvas');
  const gl = glCanvas.getContext('webgl2', {
    antialias: !lowPower,
    alpha: true,
    powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('WebGL unavailable');
  const renderer = new WebGLRenderer({ canvas: glCanvas, context: gl, antialias: !lowPower, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'application');
  canvas.setAttribute('aria-roledescription', '3D viewer');
  canvas.setAttribute('aria-describedby', 'r-readout');
  canvas.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown + - Home');
  host.appendChild(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minPolarAngle = 0.18;
  controls.maxPolarAngle = 1.45;
  controls.autoRotateSpeed = 0.9;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 0.6;
  // One finger scrolls the page on touch devices; two fingers rotate/zoom.
  controls.touches = { ONE: -1 as never, TWO: 2 as never };

  let studio: ReturnType<typeof setupStudio> | null = null;

  let record = opts.record;
  let track = opts.track;
  let view = opts.view;
  let failed = false;
  // Off by default: the page should be calm; the visitor can start it with the play control.
  let autoRotateWanted = false;
  let resumeTimer = 0;

  /* ---------- content ---------- */
  const carGroup = new Group();
  const shadow = contactShadow(6.4, 2.6);
  carGroup.add(shadow);
  scene.add(carGroup);
  let car: CarModel | null = null;

  const tyresGroup = new Group();
  const bench: {
    mesh: Mesh;
    group: Group;
    mat: ReturnType<typeof demandMaterial>;
    compound: string | null;
  }[] = [];
  const benchGeo = tyreGeometry(REAR_TYRE);
  const rimMat = new MeshStandardMaterial({ color: '#2a2d31', roughness: 0.35, metalness: 0.9 });
  const hubMat = new MeshStandardMaterial({ color: '#1c1e21', roughness: 0.55, metalness: 0.6 });
  for (let i = 0; i < 3; i++) {
    const mat = demandMaterial();
    const { group, tyre } = wheel(REAR_TYRE, mat, rimMat, hubMat, benchGeo);
    group.position.set((i - 1) * 1.05, REAR_TYRE.radius, 0);
    group.rotation.y = -0.38;
    tyresGroup.add(group);
    bench.push({ mesh: tyre, group, mat, compound: null });
  }
  const benchShadow = contactShadow(3.6, 1.4);
  tyresGroup.add(benchShadow);
  scene.add(tyresGroup);

  const circuitGroup = new Group();
  scene.add(circuitGroup);
  const surfaceMat = new MeshStandardMaterial({
    color: '#ebe7df',
    roughness: 0.62,
    metalness: 0,
    side: DoubleSide,
  });
  const casingMat = new MeshStandardMaterial({
    color: '#3a4047',
    roughness: 0.8,
    metalness: 0.1,
    side: DoubleSide,
  });
  let circuit: ReturnType<typeof buildCircuit> | null = null;
  let circuitDrawnFor: string | null = null;

  /* ---------- loop ---------- */
  const tweens = new Set<Tween>();
  let raf = 0;
  let onScreen = true;
  let pageVisible = !document.hidden;

  function animate(dur: number, step: (k: number) => void): Tween | null {
    if (opts.reducedMotion || dur <= 0) {
      step(1);
      schedule();
      return null;
    }
    const t = { t0: performance.now(), dur, step };
    tweens.add(t);
    schedule();
    return t;
  }

  /** Only one tween may drive the camera; a new one (or the user grabbing the view) replaces it. */
  let cameraTween: Tween | null = null;
  function animateCamera(dur: number, step: (k: number) => void) {
    if (cameraTween) tweens.delete(cameraTween);
    cameraTween = animate(dur, step);
  }
  function releaseCamera() {
    if (cameraTween) tweens.delete(cameraTween);
    cameraTween = null;
  }
  function pauseAutoRotate() {
    clearTimeout(resumeTimer);
    controls.autoRotate = false;
    resumeTimer = window.setTimeout(() => {
      controls.autoRotate = autoRotateWanted && view.mode !== 'circuit';
      schedule();
    }, 3000);
  }

  function frame(now: number) {
    raf = 0;
    if (failed) return;
    for (const t of tweens) {
      const k = Math.min(1, (now - t.t0) / t.dur);
      t.step(ease(k));
      if (k >= 1) tweens.delete(t);
    }
    const moving = controls.update();
    renderer.render(scene, camera);
    if (tweens.size || moving || controls.autoRotate) schedule();
  }

  function schedule() {
    if (!raf && !failed && onScreen && pageVisible && view.mode !== 'data')
      raf = requestAnimationFrame(frame);
  }

  controls.addEventListener('change', schedule);
  controls.addEventListener('start', () => {
    clearTimeout(resumeTimer);
    releaseCamera();
    controls.autoRotate = false;
  });
  controls.addEventListener('end', () => {
    clearTimeout(resumeTimer);
    resumeTimer = window.setTimeout(() => {
      controls.autoRotate = autoRotateWanted && view.mode !== 'circuit';
      schedule();
    }, 3000);
  });

  /* ---------- camera ---------- */
  /** What each mode must keep in frame (shadow planes excluded). Null until it exists. */
  function fitSubject(mode: Exclude<Mode, 'data'>): Object3D[] | null {
    if (mode === 'car') return car ? [car.root] : null;
    if (mode === 'circuit') return circuit ? [circuit.group] : null;
    return bench.map((b) => b.group);
  }

  const fitBox = new Box3();
  const probe = new PerspectiveCamera();
  const corner = new Vector3();
  /**
   * Distance multiplier along the mode's framing direction: the smallest that keeps the subject's
   * bounding box inside the frame (with a margin), for any canvas aspect, circuit shape or car model.
   */
  function fitScale(mode: Exclude<Mode, 'data'>, target: Vector3, dir: Vector3): number {
    const subject = fitSubject(mode);
    if (!subject) return Math.min(1.9, Math.max(1, 1.45 / (camera.aspect || 1)));
    fitBox.makeEmpty();
    for (const o of subject) fitBox.expandByObject(o);
    probe.copy(camera);
    const fits = (k: number) => {
      probe.position.copy(dir).multiplyScalar(k).add(target);
      probe.lookAt(target);
      probe.updateMatrixWorld();
      for (let i = 0; i < 8; i++) {
        corner.set(
          i & 1 ? fitBox.max.x : fitBox.min.x,
          i & 2 ? fitBox.max.y : fitBox.min.y,
          i & 4 ? fitBox.max.z : fitBox.min.z,
        );
        corner.project(probe);
        // ponytail: box corners overestimate curved shapes slightly; the margin absorbs it.
        // The top edge keeps clear of the reset / rotate buttons.
        if (Math.abs(corner.x) > 0.9 || corner.y > 0.74 || corner.y < -0.86 || corner.z > 1) return false;
      }
      return true;
    };
    let lo = 0.3;
    let hi = 4;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    return hi;
  }

  function frameMode(mode: Mode, dur: number) {
    if (mode === 'data') return;
    const f = FRAMING[mode];
    const target = new Vector3(...f.target);
    const s = fitScale(mode, target, new Vector3(...f.pos).sub(target));
    const pos = new Vector3(...f.pos).sub(target).multiplyScalar(s).add(target);
    controls.minDistance = f.min * s * 0.85;
    controls.maxDistance = f.max * s;
    const fromPos = camera.position.clone();
    const fromTarget = controls.target.clone();
    animateCamera(dur, (k) => {
      camera.position.lerpVectors(fromPos, pos, k);
      controls.target.lerpVectors(fromTarget, target, k);
    });
  }

  const spherical = new Spherical();
  function orbitBy(dTheta: number, dPhi: number, zoom = 1) {
    const offset = camera.position.clone().sub(controls.target);
    spherical.setFromVector3(offset);
    spherical.theta += dTheta;
    spherical.phi = Math.min(controls.maxPolarAngle, Math.max(controls.minPolarAngle, spherical.phi + dPhi));
    spherical.radius = Math.min(
      controls.maxDistance,
      Math.max(controls.minDistance, spherical.radius * zoom),
    );
    camera.position.copy(controls.target).add(new Vector3().setFromSpherical(spherical));
    schedule();
  }

  /* ---------- data → visuals ---------- */
  function applyCarView(dur: number) {
    if (!car) return;
    const d = deriveView(record, view.carView, PAGE.derivedText);
    for (const c of CORNERS) {
      const mat = car.tyreMaterials[c];
      const u = mat.userData.uniforms;
      setPattern(mat, d.pattern);
      const from = u.uHeat.value.clone();
      const to = new Color(heatColour(d.corners[c].intensity));
      const fromMix = u.uHeatMix.value;
      const fromSel = u.uSelected.value;
      const toSel = view.corner === c ? 1 : 0;
      animate(dur, (k) => {
        u.uHeat.value.lerpColors(from, to, k);
        u.uHeatMix.value = fromMix + (1 - fromMix) * k;
        u.uSelected.value = fromSel + (toSel - fromSel) * k;
      });
    }
  }

  function applyCompounds(dur: number) {
    const list = sortedCompounds(record);
    const selected = view.compound ?? list[1]?.compound ?? list[0]?.compound ?? null;
    bench.forEach((b, i) => {
      const c = list[i];
      b.group.visible = !!c;
      b.compound = c?.compound ?? null;
      if (!c) return;
      const u = b.mat.userData.uniforms;
      u.uHeatMix.value = 0;
      const from = u.uCompound.value.clone();
      const to = new Color(COMPOUND_HEX[c.raceLabel] ?? '#959ca5');
      const isSel = c.compound === selected;
      const fromZ = b.group.position.z;
      const toZ = isSel ? 0.45 : 0;
      const fromSel = u.uSelected.value;
      animate(dur, (k) => {
        u.uCompound.value.lerpColors(from, to, k);
        u.uCompoundMix.value = 1;
        b.group.position.z = fromZ + (toZ - fromZ) * k;
        u.uSelected.value = fromSel + ((isSel ? 0.6 : 0) - fromSel) * k;
      });
    });
  }

  function rebuildCircuit() {
    circuit?.dispose();
    circuitGroup.clear();
    circuit = null;
    if (!track) return;
    circuit = buildCircuit(track, surfaceMat, casingMat);
    circuitGroup.add(circuit.group);
    circuitDrawnFor = null;
  }

  function drawCircuitIfNeeded() {
    if (view.mode !== 'circuit' || !circuit || circuitDrawnFor === record.id) return;
    circuitDrawnFor = record.id;
    const c = circuit;
    c.setProgress(0);
    animate(600, (k) => c.setProgress(k));
  }

  function showMode() {
    carGroup.visible = view.mode === 'car';
    tyresGroup.visible = view.mode === 'tyres';
    circuitGroup.visible = view.mode === 'circuit';
    controls.autoRotate = autoRotateWanted && view.mode !== 'circuit';
    canvas.setAttribute('aria-label', ariaLabel());
  }

  function ariaLabel() {
    if (view.mode === 'car') {
      return PAGE.viewer.ariaCar(STRINGS.el.demandView[view.carView].toLowerCase());
    }
    if (view.mode === 'circuit') return PAGE.viewer.ariaCircuit(record.circuit.name);
    return PAGE.viewer.ariaTyres(
      sortedCompounds(record)
        .map((c) => `${c.compound} ${STRINGS.el.compound[c.raceLabel] ?? c.raceLabel}`)
        .join(', '),
    );
  }

  /* ---------- input ---------- */
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  let downAt: [number, number] | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    downAt = [e.clientX, e.clientY];
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    downAt = null;
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    if (view.mode === 'car' && car) {
      const hit = raycaster.intersectObjects(Object.values(car.tyres), false)[0];
      if (hit) opts.onPick({ corner: hit.object.userData.corner as Corner });
    } else if (view.mode === 'tyres') {
      const hit = raycaster.intersectObjects(
        bench.filter((b) => b.group.visible).map((b) => b.mesh),
        false,
      )[0];
      const b = bench.find((x) => x.mesh === hit?.object);
      if (b?.compound) opts.onPick({ compound: b.compound });
    }
  });
  canvas.addEventListener('keydown', (e) => {
    const step = 0.17;
    const map: Record<string, () => void> = {
      ArrowLeft: () => orbitBy(-step, 0),
      ArrowRight: () => orbitBy(step, 0),
      ArrowUp: () => orbitBy(0, -step * 0.6),
      ArrowDown: () => orbitBy(0, step * 0.6),
      '+': () => orbitBy(0, 0, 0.88),
      '=': () => orbitBy(0, 0, 0.88),
      '-': () => orbitBy(0, 0, 1.14),
      Home: () => frameMode(view.mode, 450),
    };
    const fn = map[e.key];
    if (!fn) return;
    e.preventDefault();
    releaseCamera();
    pauseAutoRotate();
    fn();
  });

  /* ---------- lifecycle ---------- */
  const ro = new ResizeObserver(() => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const before = camera.aspect;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (Math.abs(camera.aspect - before) / before > 0.1) frameMode(view.mode, 0);
    schedule();
  });
  ro.observe(host);
  const io = new IntersectionObserver((entries) => {
    onScreen = entries.some((e) => e.isIntersecting);
    schedule();
  });
  io.observe(host);
  const onVisibility = () => {
    pageVisible = !document.hidden;
    schedule();
  };
  document.addEventListener('visibilitychange', onVisibility);

  function fail(reason: string) {
    if (failed) return;
    failed = true;
    dispose();
    opts.onFailure(reason);
  }
  renderer.debug.onShaderError = () => fail(PAGE.viewer.graphicsError);
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    fail(PAGE.viewer.contextLost);
  });

  function dispose() {
    cancelAnimationFrame(raf);
    clearTimeout(resumeTimer);
    ro.disconnect();
    io.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    controls.dispose();
    scene.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.dispose();
      }
    });
    studio?.env.dispose();
    renderer.dispose();
    canvas.remove();
  }

  /* ---------- init ---------- */
  const w0 = host.clientWidth || 800;
  const h0 = host.clientHeight || 550;
  renderer.setSize(w0, h0, false);
  camera.aspect = w0 / h0;
  camera.updateProjectionMatrix();
  camera.position.set(...FRAMING.car.pos);
  controls.target.set(...FRAMING.car.target);
  rebuildCircuit();
  showMode();
  frameMode(view.mode, 0);
  applyCompounds(0);

  // Heavy setup is spread over several tasks so the main thread never blocks for long.
  const nextTask = () => new Promise<void>((r) => setTimeout(r, 0));
  void (async () => {
    await nextTask();
    if (failed) return;
    studio = setupStudio(scene, renderer);
    await nextTask();
    const model = await loadCarModel();
    if (failed) return;
    car = model;
    carGroup.add(model.root);
    applyCarView(0);
    await nextTask();
    // Parallel compile where the browser supports it; otherwise a normal (short) synchronous compile.
    if (renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
    if (failed) return;
    // Opening beat: one short settle into the studio framing, then stillness.
    if (view.mode === 'car' && !opts.reducedMotion) {
      const s = new Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      s.theta -= 0.55;
      s.radius *= 1.12;
      camera.position.copy(controls.target).add(new Vector3().setFromSpherical(s));
      frameMode('car', 900);
    } else if (view.mode === 'car') frameMode('car', 0);
    renderer.render(scene, camera);
    opts.onReady();
    schedule();
  })().catch(() => fail(PAGE.viewer.buildFailed));

  return {
    setRace(nextRecord, nextTrack, nextView) {
      const trackChanged = nextTrack?.id !== track?.id;
      record = nextRecord;
      track = nextTrack;
      view = nextView;
      if (trackChanged) rebuildCircuit();
      else circuitDrawnFor = null;
      showMode();
      if (trackChanged && view.mode === 'circuit') frameMode('circuit', 450);
      applyCarView(700);
      applyCompounds(700);
      drawCircuitIfNeeded();
      // Hero beat: a small purposeful camera re-presentation and a rim-light response.
      const rim0 = 2.6;
      const start = new Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      const nudge = view.mode === 'car' && !controls.autoRotate ? 0.12 : 0;
      animate(700, (k) => {
        if (studio) studio.rim.intensity = rim0 + Math.sin(k * Math.PI) * 1.4;
      });
      if (nudge) {
        animateCamera(700, (k) => {
          const s = start.clone();
          s.theta += nudge * k;
          camera.position.copy(controls.target).add(new Vector3().setFromSpherical(s));
        });
      }
    },
    setState(next) {
      const modeChanged = next.mode !== view.mode;
      view = next;
      showMode();
      if (modeChanged) frameMode(view.mode, 450);
      applyCarView(modeChanged ? 0 : 320);
      applyCompounds(modeChanged ? 0 : 320);
      drawCircuitIfNeeded();
      schedule();
    },
    resetCamera() {
      frameMode(view.mode, 450);
    },
    setAutoRotate(on) {
      autoRotateWanted = on;
      controls.autoRotate = on && view.mode !== 'circuit';
      schedule();
    },
    dispose() {
      if (!failed) {
        failed = true;
        dispose();
      }
    },
  };
}
