/**
 * Lo stage: il quadro in cui finisce la lastra, in pixel.
 *
 * PERCHE' ESISTE. Fino a settembre 2026 il quadro era scritto dentro la
 * geometria: `slabPointOnScreen` e `centreOn` usavano 1920 e 1080 come
 * costanti, quindi valevano solo in 16:9. Un film di prodotto esce in tre
 * rapporti e ognuno si ri-renderizza con la sua camera, non si ritaglia: lo
 * stage e' un parametro, non un'assunzione.
 *
 * E' UN MODULO PURO, e tutti i file di `kit/` che non finiscono in `.tsx` lo
 * sono: niente React, niente Remotion, import con l'estensione `.ts` scritta.
 * Li leggono anche i banchi, da Node, senza passare dal bundler, cosi' la
 * geometria che il render usa e quella che il banco misura sono lo stesso
 * codice e non due copie.
 */

export type Ratio = "16x9" | "9x16" | "4x5";

export type Stage = { ratio: Ratio; w: number; h: number };

export const STAGES: Record<Ratio, Stage> = {
  "16x9": { ratio: "16x9", w: 1920, h: 1080 },
  "9x16": { ratio: "9x16", w: 1080, h: 1920 },
  "4x5": { ratio: "4x5", w: 1080, h: 1350 },
};

export const RATIOS: readonly Ratio[] = ["16x9", "9x16", "4x5"];
