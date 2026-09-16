import type { Stage } from "./stage.ts";
import type { Point, Rig, SlabSize } from "./rig.ts";

/**
 * Dove finisce sullo schermo un punto della lastra, con la camera in qualunque
 * posa: la catena CSS del blocco di ripresa rifatta in aritmetica.
 *
 * PERCHE' ESISTE. `centreOn` e `slabPointOnScreen` sono esatti solo con yaw e
 * pitch a zero, ed e' il motivo per cui le pose di macro finiscono frontali.
 * Un banco che guarda la camera mentre si muove, cioe' quasi tutti i film di
 * prodotto, deve sapere dove sta un elemento a una posa inclinata: proiettato,
 * non indovinato con un ritaglio scelto a occhio.
 *
 * LA CATENA E' QUELLA DI `kit/Shot.tsx`, nello stesso ordine:
 * - la lastra e' posizionata a ((stage - lastra) / 2 + slide), quindi il suo
 *   centro sta a (stage / 2 + slide);
 * - `transform: translateZ(push) rotateY(yaw) rotateX(pitch) scale(s)` attorno
 *   al proprio centro, che per un punto vuol dire: prima la scala, poi rotateX,
 *   poi rotateY, poi la spinta;
 * - la prospettiva del contenitore, con l'origine del rig: il punto si allontana
 *   dall'origine di P / (P - z).
 * Le matrici di rotazione sono quelle della specifica CSS (rotate3d), con l'asse
 * y che scende.
 *
 * `scripts/project-check.py` la confronta con `getBoundingClientRect` di Chrome
 * su due lastre, tre stage e le pose della catena di Topics.
 */

export type Pose = {
  yaw: number;
  pitch: number;
  pushZ: number;
  slideX: number;
  slideY: number;
};

const rad = (deg: number): number => (deg * Math.PI) / 180;

export const project = (
  stage: Stage,
  rig: Rig,
  slab: SlabSize,
  pose: Pose,
  p: Point,
): { x: number; y: number; z: number } => {
  // Nel sistema della lastra, centrato sul suo centro, dopo la scala.
  const x0 = (p.x - slab.w / 2) * rig.slabScale;
  const y0 = (p.y - slab.h / 2) * rig.slabScale;

  // rotateX(pitch): y' = y cos - z sin, z' = y sin + z cos (z parte da 0).
  const cp = Math.cos(rad(pose.pitch));
  const sp = Math.sin(rad(pose.pitch));
  const y1 = y0 * cp;
  const z1 = y0 * sp;

  // rotateY(yaw): x' = x cos + z sin, z' = -x sin + z cos.
  const cy = Math.cos(rad(pose.yaw));
  const sy = Math.sin(rad(pose.yaw));
  const x2 = x0 * cy + z1 * sy;
  const z2 = -x0 * sy + z1 * cy;

  // translateZ(push), poi nel contenitore.
  const z = z2 + pose.pushZ;
  const X = stage.w / 2 + pose.slideX + x2;
  const Y = stage.h / 2 + pose.slideY + y1;

  // La prospettiva, attorno all'origine del rig.
  const ox = stage.w * rig.originX;
  const oy = stage.h * rig.originY;
  const k = rig.perspective / (rig.perspective - z);
  return { x: ox + (X - ox) * k, y: oy + (Y - oy) * k, z };
};

/** Il riquadro allineato agli assi che contiene un rettangolo della lastra proiettato. */
export const projectRect = (
  stage: Stage,
  rig: Rig,
  slab: SlabSize,
  pose: Pose,
  r: { x: number; y: number; w: number; h: number },
): { x: number; y: number; w: number; h: number } => {
  const corners = [
    project(stage, rig, slab, pose, { x: r.x, y: r.y }),
    project(stage, rig, slab, pose, { x: r.x + r.w, y: r.y }),
    project(stage, rig, slab, pose, { x: r.x, y: r.y + r.h }),
    project(stage, rig, slab, pose, { x: r.x + r.w, y: r.y + r.h }),
  ];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};

/**
 * Il contrario di `project` per una posa frontale (yaw e pitch a zero): il punto
 * della lastra che finisce nel punto `s` dello schermo. Serve a chiedere cosa
 * si vede, per esempio fin dove arriva il bordo destro del quadro sulla lastra.
 * Con la camera inclinata il contrario non e' una formula chiusa, e piuttosto
 * che un'approssimazione silenziosa si rifiuta.
 */
export const unprojectFrontal = (
  stage: Stage,
  rig: Rig,
  slab: SlabSize,
  pose: Pose,
  s: Point,
): Point => {
  if (pose.yaw !== 0 || pose.pitch !== 0) {
    throw new Error("unprojectFrontal vuole una posa frontale (yaw e pitch a zero)");
  }
  const ox = stage.w * rig.originX;
  const oy = stage.h * rig.originY;
  const k = rig.perspective / (rig.perspective - pose.pushZ);
  const X = ox + (s.x - ox) / k;
  const Y = oy + (s.y - oy) / k;
  return {
    x: (X - stage.w / 2 - pose.slideX) / rig.slabScale + slab.w / 2,
    y: (Y - stage.h / 2 - pose.slideY) / rig.slabScale + slab.h / 2,
  };
};
