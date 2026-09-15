import { STAGES } from "../../../kit/stage.ts";
import type { Ratio } from "../../../kit/stage.ts";
import { projectRect, unprojectFrontal } from "../../../kit/project.ts";
import { poseAt } from "../../../kit/camera.ts";
import { TOPICS_RIG, TOPICS_SLAB, handoffLandedRect } from "../geometry.ts";
import { cardFocusTrack } from "../tracks.ts";

type Catalog = { scenes: { id: string; durationInFrames: number; fps: number }[] };
type Rect = { x: number; y: number; w: number; h: number };

/**
 * Il margine dentro la card, per lato: si misura la nitidezza del contenuto, non
 * del filo del bordo, che e' largo un pixel e sopravvive a qualsiasi trattamento.
 */
const MARGIN = 0.08;

/**
 * focus-sharpness.sh e fixture-screenshot.sh: la card consegnata all'ultimo
 * fotogramma di CardFocus, la stessa zona della lastra al primo, e quanto la
 * camera l'ha ingrandita fra i due.
 *
 * PERCHE' COSI'. La versione di prima lavorava col 16:9 in testa: il centro del
 * ritaglio era l'origine della prospettiva (giusto solo perche' la posa finale
 * centra la card), e il campo largo ignorava yaw -4 e pitch 1,2 della posa di
 * partenza, 5,9 px di errore gia' nel 16:9. In 9:16 e 4:5 la card deborda a
 * destra all'ultimo fotogramma, quindi il ritaglio e' la parte della card che
 * sta nel quadro, e la zona corrispondente del primo fotogramma si trova
 * riportando quel rettangolo sulla lastra (la posa finale e' frontale, il
 * contrario e' esatto) e riproiettandolo con la posa di partenza.
 *
 * K e' il rapporto fra le larghezze proiettate: quanto la camera ha ingrandito
 * quel contenuto, cioe' di quanto uno screenshot del campo largo andrebbe
 * ingrandito per sembrare l'ultimo fotogramma.
 */
export const geometry = (ratio: Ratio, { catalog }: { catalog: Catalog }) => {
  const scene = catalog.scenes.find((s) => s.id === "CardFocus");
  if (!scene) throw new Error("catalog.json: manca CardFocus");
  const stage = STAGES[ratio];
  const track = cardFocusTrack(scene.durationInFrames, ratio);
  const first = poseAt(track, 0);
  const last = poseAt(track, scene.durationInFrames - 1);
  const card = handoffLandedRect();

  const full = projectRect(stage, TOPICS_RIG, TOPICS_SLAB, last, card);
  const mx = full.w * MARGIN;
  const my = full.h * MARGIN;
  const x0 = Math.max(0, full.x) + mx;
  const y0 = Math.max(0, full.y) + my;
  const x1 = Math.min(stage.w, full.x + full.w) - mx;
  const y1 = Math.min(stage.h, full.y + full.h) - my;
  const ours: Rect = {
    x: Math.ceil(x0),
    y: Math.ceil(y0),
    w: Math.floor(x1) - Math.ceil(x0),
    h: Math.floor(y1) - Math.ceil(y0),
  };
  if (ours.w < 120 || ours.h < 60) {
    throw new Error(`in ${ratio} la card all'ultimo fotogramma e' troppo poco nel quadro: ${JSON.stringify(ours)}`);
  }

  // La stessa zona della lastra, al primo fotogramma.
  const a = unprojectFrontal(stage, TOPICS_RIG, TOPICS_SLAB, last, { x: ours.x, y: ours.y });
  const b = unprojectFrontal(stage, TOPICS_RIG, TOPICS_SLAB, last, { x: ours.x + ours.w, y: ours.y + ours.h });
  const region = { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
  const wide = projectRect(stage, TOPICS_RIG, TOPICS_SLAB, first, region);
  if (wide.x < 0 || wide.y < 0 || wide.x + wide.w > stage.w || wide.y + wide.h > stage.h) {
    throw new Error(`in ${ratio} la card al primo fotogramma esce dal quadro: ${JSON.stringify(wide)}`);
  }
  const k = ours.w / wide.w;
  return {
    composition: "CardFocus",
    stage: { w: stage.w, h: stage.h },
    frames: scene.durationInFrames,
    fps: scene.fps,
    ours,
    wide: {
      x: Number(wide.x.toFixed(2)),
      y: Number(wide.y.toFixed(2)),
      w: Number(wide.w.toFixed(2)),
      h: Number(wide.h.toFixed(2)),
    },
    k: Number(k.toFixed(4)),
    kh: Number((ours.h / wide.h).toFixed(4)),
  };
};
