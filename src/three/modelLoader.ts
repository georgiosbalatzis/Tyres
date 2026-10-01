/**
 * The car body is "Low Poly-F1" by salasilma13 (CC BY 4.0, see public/models/LICENSE-f1car.txt), the same
 * generic single-seater the F1 Stories ghostcar uses. Its own tyres are hidden and replaced by procedural
 * wheels at the same positions, because only those carry the demand shader (aAxial / aTread / aSide).
 * On any failure the procedural car is used, so the viewer never ends up empty.
 */
import { Box3, Group, type Material, type Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Corner } from '../domain/derivedMetrics.ts';
import { buildCar, type CarModel, carMaterials } from './car.ts';
import { demandMaterial, tyreGeometry, wheel } from './tyre.ts';

const MODEL_URL = `${import.meta.env.BASE_URL}models/f1car.glb`;

/** The asset is +Z forward in arbitrary units; its wheelbase (front to rear tyre centre) is 7.314 units. */
const WHEELBASE_UNITS = 7.314;
const WHEELBASE_M = 3.4;

const TYRE_NODES: Record<string, Corner> = { FL_Tire: 'FL', FR_Tire: 'FR', RL_Tire: 'RL', RR_Tire: 'RR' };

export async function loadCarModel(): Promise<CarModel> {
  try {
    return await loadGlbCar();
  } catch (err) {
    console.warn('Car model failed to load; using the procedural car.', err);
    return buildCar();
  }
}

async function loadGlbCar(): Promise<CarModel> {
  const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
  const M = carMaterials();
  // Satin graphite livery, carbon aero: the only saturated colour on the car is the tyre data.
  const recolour: Record<string, Material> = {
    BaseColor: M.paint,
    '2ndColor': M.paintDark,
    '3rdColor': M.paintDark,
    Mirror: M.titanium,
    Dark_Black: M.carbon,
  };

  const body = gltf.scene;
  body.rotation.y = Math.PI / 2; // +Z forward → +X forward; the model's left tyres land on −Z, as ours do
  body.scale.setScalar(WHEELBASE_M / WHEELBASE_UNITS);
  const root = new Group();
  root.name = 'Car';
  root.add(body);
  root.updateMatrixWorld(true);
  // Centre along the length and stand the car on y = 0.
  const box = new Box3().setFromObject(body);
  body.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  root.updateMatrixWorld(true);

  const tyreNodes: [Corner, Box3][] = [];
  body.traverse((o) => {
    const corner = TYRE_NODES[o.name];
    if (corner) {
      tyreNodes.push([corner, new Box3().setFromObject(o)]);
      o.visible = false;
    }
    const mesh = o as Mesh;
    if (mesh.isMesh) {
      const name = (mesh.material as Material).name;
      if (recolour[name]) mesh.material = recolour[name];
    }
  });
  if (tyreNodes.length !== 4) throw new Error(`expected 4 tyre nodes, found ${tyreNodes.length}`);

  const tyres = {} as CarModel['tyres'];
  const tyreMaterials = {} as CarModel['tyreMaterials'];
  for (const [corner, b] of tyreNodes) {
    const size = b.getSize(new Vector3());
    const radius = size.y / 2;
    const spec = { radius, width: size.z * 0.92, rimRadius: radius * 0.62 };
    const mat = demandMaterial();
    const { group, tyre } = wheel(spec, mat, M.rim, M.hub, tyreGeometry(spec));
    group.position.copy(b.getCenter(new Vector3()));
    if (group.position.z < 0) group.rotation.y = Math.PI;
    tyre.userData.corner = corner;
    root.add(group);
    tyres[corner] = tyre;
    tyreMaterials[corner] = mat;
  }
  return { root, tyres, tyreMaterials };
}
