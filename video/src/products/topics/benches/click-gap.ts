import { STAGES } from "../../../kit/stage.ts";
import type { Ratio } from "../../../kit/stage.ts";
import { projectRect } from "../../../kit/project.ts";
import { poseAt } from "../../../kit/camera.ts";
import { tempo } from "../../../primitives/tempo.ts";
import {
  COMPOSER_H,
  COMPOSER_X,
  COMPOSER_Y,
  MSG_AVATAR_W,
  MSG_GAP,
  SIDEBAR_W,
  THREAD_PAD_X,
  TOPICS_RIG,
  TOPICS_SLAB,
  USER_BUBBLE_EXTRA_W,
} from "../geometry.ts";
import { topicsLayout } from "../poses.ts";
import { DEFAULT_PROMPT, promptInputTimeline } from "../promptTiming.ts";
import { PROMPT_INPUT_BASE, PROMPT_INPUT_CAM_SETTLE, promptInputTrack } from "../tracks.ts";

type Catalog = {
  scenes: { id: string; durationInFrames: number; fps: number }[];
  tempoFixtures: { id: string; scene: string; durationInFrames: number }[];
};
type Rect = { x: number; y: number; w: number; h: number };

/**
 * click-gap.py: dove guardare il clic d'invio e la sua conseguenza, e in che
 * tratto della scena cercarli.
 *
 * DUE RETTANGOLI, e non il quadro intero. La prima versione contava i pixel
 * cambiati in tutto il fotogramma, e il clic si vedeva perche' nel 16:9 in
 * quadro c'erano il pulsante che si abbassa e l'anello del cursore. In 9:16 e
 * 4:5 il pulsante e' fuori dal quadro: i fotogrammi dopo il clic erano fermi, la
 * "quiete" valeva zero e qualunque cosa la superava, e il banco promuoveva
 * scarto 2 qualunque fosse lo scarto vero. Qui il colpo si cerca nel testo del
 * campo, che all'invio si svuota e torna al segnaposto, e la conseguenza nella
 * coda del thread, dove sale la bolla: due zone che in ogni rapporto stanno nel
 * quadro, e che il modulo verifica invece di presumere.
 *
 * IL TRATTO E' QUELLO A CAMERA FERMA, dalla fine della discesa sul composer
 * all'ultimo frame. Il banco cerca gli eventi dentro il tratto: questi numeri
 * delimitano la ricerca, non gli dicono la risposta. I frame del clic e della
 * bolla escono lo stesso, ma li usano solo i controlli per costruire i casi
 * guasti (eventi fusi, interfaccia lenta, clic mancato).
 */
export const geometry = (ratio: Ratio, { catalog }: { catalog: Catalog }) => {
  const stage = STAGES[ratio];
  const scene = catalog.scenes.find((s) => s.id === "PromptInput");
  if (!scene) throw new Error("catalog.json: manca PromptInput");
  const { msgMaxW } = topicsLayout(ratio);

  const slabRects: Record<"colpo" | "conseguenza", Rect> = {
    // Il testo del campo, dal padding sinistro per la larghezza del prompt intero.
    colpo: { x: COMPOSER_X + 24, y: COMPOSER_Y + COMPOSER_H / 2 - 18, w: DEFAULT_PROMPT.length * 13, h: 36 },
    // La coda del thread sopra il composer: la bolla nuova e i messaggi che salgono.
    conseguenza: {
      x: SIDEBAR_W + THREAD_PAD_X,
      y: COMPOSER_Y - 200,
      w: Math.min(900, MSG_AVATAR_W + MSG_GAP + msgMaxW + USER_BUBBLE_EXTRA_W),
      h: 192,
    },
  };

  const variants = [
    { id: "PromptInput", durationInFrames: scene.durationInFrames },
    ...catalog.tempoFixtures
      .filter((f) => f.scene === "PromptInput")
      .map((f) => ({ id: f.id, durationInFrames: f.durationInFrames })),
  ].map((v) => {
    const tl = promptInputTimeline(v.durationInFrames, scene.fps);
    const settle = tempo(v.durationInFrames, PROMPT_INPUT_BASE).at(PROMPT_INPUT_CAM_SETTLE);
    const pose = poseAt(promptInputTrack(v.durationInFrames, ratio), v.durationInFrames - 1);
    const rects = Object.fromEntries(
      Object.entries(slabRects).map(([name, r]) => {
        const p = projectRect(stage, TOPICS_RIG, TOPICS_SLAB, pose, r);
        const x0 = Math.max(0, Math.ceil(p.x));
        const y0 = Math.max(0, Math.ceil(p.y));
        const x1 = Math.min(stage.w, Math.floor(p.x + p.w));
        const y1 = Math.min(stage.h, Math.floor(p.y + p.h));
        const clipped = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        const kept = (clipped.w * clipped.h) / (p.w * p.h);
        if (clipped.w < 80 || clipped.h < 20 || kept < 0.6) {
          throw new Error(
            `${v.id} in ${ratio}: la zona "${name}" non sta nel quadro (${JSON.stringify(clipped)}, ` +
              `${Math.round(kept * 100)}% della zona)`,
          );
        }
        return [name, clipped];
      }),
    );
    return {
      id: v.id,
      durationInFrames: v.durationInFrames,
      window: [Math.ceil(settle) + 1, v.durationInFrames - 1],
      rects,
      events: { sendClick: tl.sendClick, bubbleAt: tl.bubbleAt, thinkAt: tl.thinkAt },
    };
  });
  return { stage: { w: stage.w, h: stage.h }, variants };
};
