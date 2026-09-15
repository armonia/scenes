import { STAGES } from "../../../kit/stage.ts";
import type { Ratio } from "../../../kit/stage.ts";
import { projectRect } from "../../../kit/project.ts";
import { poseAt } from "../../../kit/camera.ts";
import { COMPOSER_H, COMPOSER_X, COMPOSER_Y, TOPICS_RIG, TOPICS_SLAB } from "../geometry.ts";
import { promptInputTimeline, DEFAULT_PROMPT } from "../promptTiming.ts";
import { typedCount } from "../../../primitives/rhythm.ts";
import { promptInputTrack } from "../tracks.ts";

type Catalog = { scenes: { id: string; durationInFrames: number; fps: number }[] };

/**
 * framelocked-verdict.sh su PromptInput: i fotogrammi in cui la battitura si vede.
 *
 * PERCHE' ESISTE. I frame erano "150 175 200", scelti guardando il 16:9. Il
 * banco chiede due cose a quei frame: che lo stesso frame renderizzato due volte
 * dia lo stesso PNG, e che frame diversi diano immagini diverse. La seconda vale
 * solo se fra un frame e l'altro qualcosa di visibile cambia: se il testo che
 * si scrive cadesse fuori quadro, i tre frame sarebbero uguali e il banco
 * direbbe "timeline ferma" dando la colpa al frame-lock invece che
 * all'inquadratura.
 *
 * I frame si prendono al 25, 50 e 75 per cento della battitura, e si
 * controlla che le lettere scritte crescano davvero fra l'uno e l'altro e che il
 * testo del campo stia nel quadro alla posa di quel frame. Se non ci sta, il
 * modulo lo dice invece di restituire frame inutili.
 */
export const geometry = (ratio: Ratio, { catalog }: { catalog: Catalog }) => {
  const scene = catalog.scenes.find((s) => s.id === "PromptInput");
  if (!scene) throw new Error("catalog.json: manca PromptInput");
  const tl = promptInputTimeline(scene.durationInFrames, scene.fps);
  const span = tl.typeEnd - tl.typeStart;
  const frames = [0.25, 0.5, 0.75].map((q) => Math.round(tl.typeStart + span * q));
  const counts = frames.map((f) => typedCount(tl.schedule, f));
  for (let i = 1; i < counts.length; i++) {
    if ((counts[i] as number) <= (counts[i - 1] as number)) {
      throw new Error(`fra i frame ${frames.join(", ")} le lettere scritte non crescono: ${counts.join(", ")}`);
    }
  }
  // Il testo del campo: dal padding sinistro del composer per la larghezza del
  // prompt scritto per intero (25 px di corpo, circa 13 px a carattere).
  const stage = STAGES[ratio];
  const text = {
    x: COMPOSER_X + 24,
    y: COMPOSER_Y + COMPOSER_H / 2 - 18,
    w: DEFAULT_PROMPT.length * 13,
    h: 36,
  };
  const track = promptInputTrack(scene.durationInFrames, ratio);
  for (const f of frames) {
    const r = projectRect(stage, TOPICS_RIG, TOPICS_SLAB, poseAt(track, f), text);
    if (r.x < 0 || r.y < 0 || r.x + r.w > stage.w || r.y + r.h > stage.h) {
      throw new Error(
        `al frame ${f} il testo del campo esce dal quadro ${stage.w}x${stage.h}: ` +
          `${r.x.toFixed(0)},${r.y.toFixed(0)} ${r.w.toFixed(0)}x${r.h.toFixed(0)}`,
      );
    }
  }
  return { composition: "PromptInput", frames, typed: counts };
};
