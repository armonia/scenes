import { tempo } from "../../../primitives/tempo.ts";
import type { Ratio } from "../../../kit/stage.ts";
import { CARD_HANDOFF_BASE, GRAB, LAG, SETTLE_END } from "../handoff.ts";

type Catalog = {
  scenes: { id: string; durationInFrames: number }[];
  tempoFixtures: { id: string; scene: string; durationInFrames: number }[];
};

/**
 * tempo.py: dove le battute di CardHandoff NON devono scalare.
 *
 * La card sta dove stava la mano tre frame fa (LAG) e si inclina con la
 * differenza fra due campioni: sono soglie percettive, e di proposito restano in
 * frame nudi quando la scena accelera. Quindi dalla presa alla fine della posa,
 * piu' il ritardo, il provino veloce e il render lungo a tempo normalizzato
 * restano diversi, ed e' giusto. Fuori da quella finestra devono coincidere.
 *
 * La finestra e' in frame DEL PROVINO VELOCE, perche' e' sul provino che il
 * banco campiona. Il rapporto non cambia la finestra, cambia quanto pesa: in
 * 9:16 la card e' grande il doppio e la camera la segue, e il residuo dentro la
 * finestra occupa piu' pixel. Era questo a far sembrare un ritaglio il 9:16
 * quando la mediana si prendeva su tutto il tratto.
 */
export const geometry = (_ratio: Ratio, { catalog }: { catalog: Catalog }) => {
  const scene = catalog.scenes.find((s) => s.id === "CardHandoff");
  const fast = catalog.tempoFixtures.find((f) => f.scene === "CardHandoff");
  if (!scene || !fast) throw new Error("catalog.json: manca CardHandoff o il suo provino");
  const T = tempo(fast.durationInFrames, CARD_HANDOFF_BASE);
  return {
    scene: "CardHandoff",
    long: scene.durationInFrames,
    fast: fast.durationInFrames,
    perceptual: [[Math.floor(T.at(GRAB)), Math.ceil(T.at(SETTLE_END)) + LAG]],
  };
};
