import {
  CanvasTexture,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Wind-tunnel studio: warm key, cool fill, strong cool rim, low-intensity room reflections. */
export function setupStudio(scene: Scene, renderer: WebGLRenderer) {
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.35;

  const key = new DirectionalLight('#fff0dc', 2.4);
  key.position.set(3, 5, 3);
  const rim = new DirectionalLight('#cfe4ff', 2.6);
  rim.position.set(-4.5, 3, -3.5);
  const fill = new HemisphereLight('#b9cfdc', '#15171a', 0.55);
  scene.add(key, rim, fill);
  return { key, rim, fill, env };
}

/** Soft contact shadow: a radial-gradient decal under the car. Cheaper and calmer than shadow maps. */
export function contactShadow(length: number, width: number) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.75)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new CanvasTexture(c);
  const mesh = new Mesh(
    new PlaneGeometry(length, width),
    new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.002;
  mesh.renderOrder = -1;
  const group = new Group();
  group.add(mesh);
  return group;
}
