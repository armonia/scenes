import type { Ratio } from "../../kit/stage.ts";
import { DEFAULT_TYPE_TIMING } from "../../kit/type.ts";
import type { TypeCue } from "../../kit/type.ts";
import { COMPANION, cuesFor } from "./timeline.ts";
import { DEMO_FRAMES } from "./geometry.ts";

/**
 * I fotogrammi in cui guardare la tipografia di Registro: per ogni battuta, a meta'
 * sosta (tutta entrata, non ancora uscita), e per la parola chiave alla fine della
 * crescita, che e' quando e' piu' grande. Poi il compagno, a dissolvenza finita.
 *
 * `layer` e' lo strato che DemoFilm rende da solo con la prop `solo` (la maschera
 * delle lettere), `role` dice a film-type.py che soglia usare: una frase e' testo
 * grande (3:1), una didascalia no (4,5:1).
 */
export type TypeSample = { frame: number; layer: "piano" | "vetro" | "compagno"; role: "frase" | "didascalia"; text: string };

export const typeSamples = (ratio: Ratio): TypeSample[] => {
  const t = DEFAULT_TYPE_TIMING;
  const { plane, glass } = cuesFor(ratio);
  const frames = (cues: TypeCue[], layer: "piano" | "vetro"): TypeSample[] =>
    cues.map((c, i) => {
      const words = c.rows.flat();
      const prev = cues[i - 1];
      const masked = !prev || prev.exitAt !== undefined;
      const entered = masked ? c.at + (words.length - 1) * t.stagger + t.wordFrames : c.at + t.swapFrames;
      const leaves = c.exitAt ?? cues[i + 1]?.at ?? DEMO_FRAMES - 1;
      const settled = c.key || c.accent ? Math.max(entered, c.at + t.swapFrames) + Math.max(t.keyFrames, t.accentFrames) : entered;
      const frame = Math.round(Math.min(leaves - 2, Math.max(settled, (entered + leaves) / 2)));
      return { frame, layer, role: "frase" as const, text: words.join(" ") };
    });
  const companion: TypeSample = {
    frame: Math.min(DEMO_FRAMES - 2, COMPANION.to + 20),
    layer: "compagno",
    role: "didascalia",
    text: COMPANION.text,
  };
  return [...frames(plane, "piano"), ...frames(glass, "vetro"), companion];
};
