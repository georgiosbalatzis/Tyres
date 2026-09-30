/**
 * The seam for swapping the procedural car for a licensed GLB.
 *
 * v1 returns the procedural model. To use a GLB later:
 *   1. Verify its licence, store the licence text next to it in public/models/, credit it in the footer.
 *   2. Keep it ≤ 2 MB (Meshopt/Draco only if it measurably helps), +X forward, metres.
 *   3. Name the nodes Car, Chassis, Halo, FrontWing, RearWing, FrontLeftTyre, FrontRightTyre,
 *      RearLeftTyre, RearRightTyre. Each tyre node's mesh must receive demandMaterial() and needs the
 *      aAxial / aTread / aSide attributes (or regenerate the tyres procedurally and keep only the body).
 *   4. Load with `three/examples/jsm/loaders/GLTFLoader.js` here and return the same CarModel shape.
 *      On any failure, fall back to buildCar() so the viewer never ends up empty.
 */
import { buildCar, type CarModel } from './car.ts';

export async function loadCarModel(): Promise<CarModel> {
  return buildCar();
}
