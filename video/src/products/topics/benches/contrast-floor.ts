import { STAGES } from "../../../kit/stage.ts";
import type { Ratio } from "../../../kit/stage.ts";
import { project } from "../../../kit/project.ts";
import { SIDEBAR_W, THREAD_TOP, TOPICS_RIG, TOPICS_SLAB } from "../geometry.ts";
import { TOPICS_POSES } from "../poses.ts";
import { promptInputTimeline } from "../promptTiming.ts";

type Catalog = {
  scenes: { id: string; durationInFrames: number; fps: number }[];
  tempoFixtures: { id: string; scene: string; durationInFrames: number }[];
};

/**
 * Il fotogramma da guardare, alla durata di riferimento: tardi nello streaming,
 * quando l'attenuazione e' a regime. Segue la durata come le battute.
 */
const FRAME_AT_BASE = 430;

/**
 * contrast-floor.py: l'intestazione del thread all'ultima posa di PromptInput,
 * nel rapporto chiesto, e il fotogramma in cui leggerla.
 *
 * L'INTESTAZIONE STA A THREAD_TOP, che e' una costante, e per questo e' il
 * soggetto: i messaggi hanno altezze naturali e scorrono appena le metriche dei
 * font cambiano. Il ritaglio va da SIDEBAR_W+20 a SIDEBAR_W+560 in orizzontale e
 * da THREAD_TOP+10 a THREAD_TOP+44 in verticale, proiettato con la posa finale
 * del rapporto (frontale, quindi la proiezione e' esatta).
 *
 * NEL 16:9 ESCE {0, 410, 628, 40} COME PRIMA: stesso arrotondamento al pari,
 * stessa x portata a zero quando il bordo sinistro cade appena fuori quadro.
 * Negli altri rapporti in piu' si taglia a destra sul bordo del quadro, e se
 * quello che resta e' troppo poco per leggere un contrasto il modulo lo dice
 * invece di restituire un ritaglio vuoto.
 */
export const geometry = (ratio: Ratio, { catalog }: { catalog: Catalog }) => {
  const stage = STAGES[ratio];
  const pose = { slideY: 0, ...TOPICS_POSES[ratio].PROMPT_INPUT_END_POSE };
  const a = project(stage, TOPICS_RIG, TOPICS_SLAB, pose, { x: SIDEBAR_W + 20, y: THREAD_TOP + 10 });
  const b = project(stage, TOPICS_RIG, TOPICS_SLAB, pose, { x: SIDEBAR_W + 560, y: THREAD_TOP + 44 });
  const pari = (v: number): number => 2 * Math.floor(v / 2);
  const x = pari(Math.max(0, Math.round(a.x)));
  const y = pari(Math.round(a.y));
  const w = pari(Math.min(Math.round(b.x - a.x), stage.w - x));
  const h = pari(Math.min(Math.round(b.y - a.y), stage.h - y));
  if (w < 40 || h < 12 || y < 0) {
    throw new Error(`in ${ratio} l'intestazione del thread non sta nel quadro: ${x},${y} ${w}x${h}`);
  }
  const scene = catalog.scenes.find((s) => s.id === "PromptInput");
  if (!scene) throw new Error("catalog.json: manca PromptInput");
  const variants = [
    { id: "PromptInput", durationInFrames: scene.durationInFrames },
    ...catalog.tempoFixtures
      .filter((f) => f.scene === "PromptInput")
      .map((f) => ({ id: f.id, durationInFrames: f.durationInFrames })),
  ].map((v) => {
    const tl = promptInputTimeline(v.durationInFrames, scene.fps);
    const frame = Math.round(tl.K.at(FRAME_AT_BASE));
    if (frame < tl.attnTo || frame > tl.last) {
      throw new Error(`${v.id}: il frame ${frame} non cade dopo l'attenuazione e prima della fine`);
    }
    return { ...v, frame };
  });
  return { crop: { x, y, w, h }, stage: { w: stage.w, h: stage.h }, variants };
};
