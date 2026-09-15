import type { Ratio } from "../../../kit/stage.ts";
import { demoRules } from "../../demo/rules.ts";
import { typeSamples } from "../../demo/typeSamples.ts";
import { DEMO_FRAMES } from "../../demo/geometry.ts";

/**
 * film-rules.py e film-type.py sul film di esempio: le regole calcolate senza
 * render, e i fotogrammi in cui guardare la tipografia. Con `guasto`, le regole
 * della copia guasta corrispondente.
 *
 * Sta fra i banchi di Topics perche' il manifest cerca la geometria dei banchi
 * li'; il film e' di un altro prodotto, e i moduli che legge sono i suoi.
 */
export const geometry = (ratio: Ratio, ctx: { guasto?: string }) => ({
  composition: ratio === "16x9" ? "DemoFilm" : `DemoFilm-${ratio}`,
  frames: DEMO_FRAMES,
  rules: demoRules(ratio, ctx.guasto),
  samples: typeSamples(ratio),
});
