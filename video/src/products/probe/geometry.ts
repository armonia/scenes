import type { Rect, Rig, SlabSize } from "../../kit/rig.ts";

/**
 * La lastra sonda: un prodotto che non esiste, fatto per rompere le assunzioni
 * di Topics.
 *
 * PERCHE' ESISTE. Tutte le misure di questo repo erano state prese su una lastra
 * sola: scura, orizzontale (2400x1200), in 16:9. Una voce del registro che
 * funziona solo li' non e' una voce del registro, e' un dettaglio di Topics.
 * Questa lastra e' il contrario su ogni asse che conta: CHIARA, quindi i conti
 * di contrasto non possono piu' dare per scontato il tema scuro; VERTICALE
 * (1200x1800), quindi un centraggio che scambia larghezza e altezza si vede;
 * con una scala diversa, quindi un numero di Topics ricopiato non torna.
 *
 * NON IMITA NESSUN PRODOTTO VERO. E' un repo pubblico: niente interfacce, token
 * o font di prodotti privati, qui dentro.
 *
 * Modulo puro: lo leggono il manifest e i banchi, da Node.
 */

export const PROBE_SLAB: SlabSize = { w: 1200, h: 1800 };

export const PROBE_RIG: Rig = {
  perspective: 2600,
  originX: 0.5,
  originY: 0.46,
  slabScale: 1,
};

export const PROBE_HEADER_H = 96;
export const PROBE_ROW_H = 132;
export const PROBE_ROW_GAP = 16;
export const PROBE_PAD = 40;

/**
 * Le ancore: i rettangoli, in coordinate lastra, delle cose che una camera
 * inquadra o un cursore tocca. Aritmetica pura, come le card di Topics: una
 * posizione che si conosce solo dopo il layout non si puo' interpolare.
 *
 * `target` sta di proposito lontano dal centro e in basso a sinistra: centrato,
 * lo spostamento di `centreOn` sarebbe quasi zero e il banco non proverebbe
 * niente.
 */
export const PROBE_ANCHORS: Record<"target", Rect> = {
  target: { x: 120, y: 1180, w: 520, h: 220 },
};

/** Il centro di un rettangolo. */
export const rectCentre = (r: Rect): { x: number; y: number } => ({
  x: r.x + r.w / 2,
  y: r.y + r.h / 2,
});
