import type { Stage } from "./stage.ts";

/**
 * L'impianto di ripresa: la prospettiva, la sua origine e la scala della lastra.
 *
 * L'ORIGINE E' UNA SCELTA, NON UN RISULTATO. I documenti di regia dei primi
 * film dicevano che il 46% di Topics "non e' una frazione del quadro ma il
 * risultato della geometria della lastra e del pitch". Non e' cosi': e' il
 * valore scritto nel CSS (`perspective-origin: 50% 46%`) e riletto dalla
 * matematica. Qui e' un parametro del rig. Quello che cambia davvero da un
 * rapporto all'altro e' lo spostamento che porta il soggetto sull'origine, e
 * lo calcola `centreOn` a partire dallo stage.
 *
 * `drift.py` misura sul render che il soggetto resti sull'origine per tutta la
 * spinta, in tre rapporti e su due lastre diverse.
 */

export type Rig = {
  perspective: number;
  /** Frazioni dello stage, non percentuali: 0.5 e 0.46 per Topics. */
  originX: number;
  originY: number;
  slabScale: number;
};

export type SlabSize = { w: number; h: number };
export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

/**
 * Dove cade un punto della lastra con yaw e pitch a zero, prima della spinta in
 * Z e senza spostamento: la lastra centrata nello stage e scalata attorno al
 * proprio centro.
 *
 * L'ordine delle operazioni e' lo stesso della versione che stava in slab.ts, e
 * non per scrupolo: in virgola mobile un ordine diverso cambia l'ultima cifra,
 * e le pose di Topics devono restare identiche al bit.
 */
export const slabPointOnScreen = (
  stage: Stage,
  rig: Rig,
  slab: SlabSize,
  p: Point,
): Point => ({
  x: (stage.w - slab.w) / 2 + slab.w / 2 + (p.x - slab.w / 2) * rig.slabScale,
  y: (stage.h - slab.h) / 2 + slab.h / 2 + (p.y - slab.h / 2) * rig.slabScale,
});

/** Il solo punto del quadro che non si sposta sotto una spinta in Z. */
export const originOnScreen = (stage: Stage, rig: Rig): Point => ({
  x: stage.w * rig.originX,
  y: stage.h * rig.originY,
});

/**
 * Lo spostamento che porta un punto della lastra sull'origine della prospettiva.
 *
 * E' la condizione perche' una discesa al macro resti puntata sul soggetto:
 * qualsiasi altro punto del quadro scappa verso il bordo mentre la camera
 * avanza. Esatto con yaw e pitch a zero; con la camera inclinata e'
 * un'approssimazione, ed e' il motivo per cui le pose di macro finiscono
 * frontali.
 */
export const centreOn = (
  stage: Stage,
  rig: Rig,
  slab: SlabSize,
  p: Point,
): { slideX: number; slideY: number } => {
  const s = slabPointOnScreen(stage, rig, slab, p);
  const o = originOnScreen(stage, rig);
  return { slideX: o.x - s.x, slideY: o.y - s.y };
};

/** L'ingrandimento che produce una spinta in Z, e la spinta che serve per un ingrandimento. */
export const zoomForPush = (rig: Rig, z: number): number =>
  rig.perspective / (rig.perspective - z);
export const pushForZoom = (rig: Rig, k: number): number =>
  rig.perspective * (1 - 1 / k);

/**
 * La spinta che fa occupare a un rettangolo della lastra una frazione dello
 * stage, sulla dimensione che arriva prima al limite.
 *
 * Esiste perche' i numeri di spinta non si portano da un formato all'altro: la
 * stessa spinta da' lo stesso ingrandimento, ma in un quadro stretto il
 * soggetto lo riempie molto prima. Si decide il riempimento, e la spinta ne
 * discende.
 */
export const pushForFill = (
  stage: Stage,
  rig: Rig,
  rect: { w: number; h: number },
  fill: number,
): number => {
  const k = Math.min(
    (fill * stage.w) / (rect.w * rig.slabScale),
    (fill * stage.h) / (rect.h * rig.slabScale),
  );
  return pushForZoom(rig, k);
};

/**
 * L'origine scritta come la vuole il CSS. `0.46 * 100` in virgola mobile vale
 * 46.00000000000001: arrotondato qui, lo stile resta "50% 46%" come nelle scene.
 */
export const cssPerspectiveOrigin = (rig: Rig): string =>
  `${pct(rig.originX)} ${pct(rig.originY)}`;

const pct = (v: number): string => `${Number((v * 100).toFixed(4))}%`;
