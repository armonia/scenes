import { RATIOS, STAGES } from "../kit/stage.ts";
import type { Ratio, Stage } from "../kit/stage.ts";
import {
  centreOn,
  originOnScreen,
  pushForFill,
  slabPointOnScreen,
} from "../kit/rig.ts";
import type { Point, Rect, Rig, SlabSize } from "../kit/rig.ts";
import {
  PROBE_ANCHORS,
  PROBE_RIG,
  PROBE_SLAB,
  rectCentre,
} from "../products/probe/geometry.ts";
import {
  TOPICS_RIG,
  TOPICS_SLAB,
  handoffLandedRect,
} from "../primitives/slab.ts";

/**
 * Gli specimen: una voce del registro girata su piu' lastre e in piu' rapporti.
 *
 * NON SONO SCENE DELLA VETRINA, e per questo non stanno in catalog.json: non
 * vanno sul sito, esistono perche' un banco possa dire che la voce funziona
 * anche lontano da Topics. Il primo e' CAM-06, il punto che non scappa: la
 * geometria su cui poggiano tutte le discese al macro.
 *
 * UNA SOLA SORGENTE. Root.tsx registra le composition da qui, e il manifest
 * che legge drift.py viene da qui: aggiungere un rapporto o una lastra e'
 * aggiungere una riga, e render e banco lo seguono senza essere toccati.
 *
 * Modulo puro, letto anche da Node.
 */

export type SpecimenProduct = "topics" | "probe";

export const SPECIMEN_PRODUCTS: readonly SpecimenProduct[] = ["topics", "probe"];

/**
 * Durata della discesa, e riempimento del bersaglio all'ultimo frame.
 *
 * IL 90% NON E' ESTETICA. Il controllo negativo sull'origine sbagliata sposta
 * il segno di (0,50 - 0,46) x altezza x (ingrandimento - 1). Al 55% la card di
 * Topics in 9:16 si ingrandiva solo 1,06 volte, perche' e' larga e il quadro
 * stretto, e lo scarto era 4,8 px contro una tolleranza di 2: un negativo che
 * boccia per un soffio non prova niente. Al 90% l'ingrandimento minimo sulle sei
 * varianti e' 1,74 e lo scarto minimo supera i 40 px.
 */
export const CAM06_FRAMES = 90;
export const CAM06_FILL = 0.9;

export type SpecimenGeometry = {
  product: SpecimenProduct;
  ratio: Ratio;
  stage: Stage;
  rig: Rig;
  slab: SlabSize;
  anchor: Rect;
};

export const specimenGeometry = (
  product: SpecimenProduct,
  ratio: Ratio,
): SpecimenGeometry => {
  const stage = STAGES[ratio];
  if (product === "topics") {
    return {
      product,
      ratio,
      stage,
      rig: TOPICS_RIG,
      slab: TOPICS_SLAB,
      anchor: handoffLandedRect(),
    };
  }
  return {
    product,
    ratio,
    stage,
    rig: PROBE_RIG,
    slab: PROBE_SLAB,
    anchor: PROBE_ANCHORS.target,
  };
};

export const cam06Id = (product: SpecimenProduct, ratio: Ratio): string =>
  `SpecimenCAM06-${product}-${ratio}`;

/** Le sei varianti: due lastre per tre rapporti. */
export const CAM06_SPECIMENS = SPECIMEN_PRODUCTS.flatMap((product) =>
  RATIOS.map((ratio) => ({
    id: cam06Id(product, ratio),
    product,
    ratio,
    width: STAGES[ratio].w,
    height: STAGES[ratio].h,
    fps: 30,
    durationInFrames: CAM06_FRAMES,
  })),
);

/**
 * Cosa il banco deve trovare sul render, calcolato qui e non nel banco.
 *
 * `origin` e' dove deve stare il segno per tutta la discesa. `uncompensated` e'
 * dove starebbe senza lo spostamento di centreOn prima della spinta: se i due
 * punti coincidessero, il controllo negativo non potrebbe fallire e il banco
 * non proverebbe niente, quindi il manifest lo dice.
 */
export const cam06Expectation = (
  product: SpecimenProduct,
  ratio: Ratio,
): {
  origin: Point;
  uncompensated: Point;
  slide: { slideX: number; slideY: number };
  pushEnd: number;
} => {
  const g = specimenGeometry(product, ratio);
  const c = rectCentre(g.anchor);
  return {
    origin: originOnScreen(g.stage, g.rig),
    uncompensated: slabPointOnScreen(g.stage, g.rig, g.slab, c),
    slide: centreOn(g.stage, g.rig, g.slab, c),
    pushEnd: pushForFill(g.stage, g.rig, g.anchor, CAM06_FILL),
  };
};
