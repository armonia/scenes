import {
  CARD_FOCUS_END_POSE,
  CARD_HANDOFF_END_POSE,
  COMP_H,
  COMP_W,
  PERSPECTIVE_ORIGIN_Y,
  PROMPT_INPUT_END_POSE,
  SIDEBAR_W,
  SLAB_H,
  SLAB_SCALE,
  THREAD_TOP,
  handoffLandedRect,
  slabPointOnScreen,
  zoomForPush,
} from "../primitives/slab.ts";

/**
 * Quello che i banchi delle scene di Topics devono sapere della geometria:
 * ritagli, bande, ingrandimenti. Calcolato qui, da slab.ts, e stampato da
 * `scripts/manifest.mjs`.
 *
 * PERCHE' ESISTE. Quattro banchi (handoff-travel, focus-sharpness,
 * fixture-screenshot, contrast-floor) importavano slab.ts dentro uno script
 * `node -e` scritto nel proprio corpo, e rifacevano ognuno per conto suo gli
 * stessi conti di ripresa: dove sta la card, quanto ingrandisce la spinta,
 * dove cade l'intestazione del thread. Quattro copie di un calcolo restano
 * uguali finche' nessuno ne tocca una. Qui stanno una volta sola, i banchi
 * chiedono il numero, e le loro uscite sono identiche a prima riga per riga.
 *
 * I conti sono QUELLI DI PRIMA, operazione per operazione, e usano la
 * proiezione con yaw e pitch a zero, esatta per le pose frontali che questi
 * banchi misurano. Il manifest per un prodotto qualsiasi usera' kit/project.ts.
 *
 * Modulo puro, letto da Node.
 */

/** handoff-travel.sh: dove comincia il pannello assistente, in percento dell'altezza. */
export const handoffBand = (): number =>
  Math.round((THREAD_TOP / SLAB_H) * 100) - 4;

/**
 * focus-sharpness.sh e fixture-screenshot.sh: la card consegnata all'ultimo
 * frame di CardFocus, dove stava nel campo largo, e quanto manca da li' alla
 * scala finale.
 */
export const cardFocusGeometry = (): {
  cw: number;
  ch: number;
  cx: number;
  cy: number;
  zoom: string;
  wx: number;
  wy: number;
  k: string;
} => {
  const r = handoffLandedRect();
  const p = slabPointOnScreen(r.x + r.w / 2, r.y + r.h / 2);
  const ox = COMP_W / 2;
  const oy = COMP_H * PERSPECTIVE_ORIGIN_Y;
  const k1 = zoomForPush(CARD_FOCUS_END_POSE.pushZ);
  const k0 = zoomForPush(CARD_HANDOFF_END_POSE.pushZ);
  const wx = ox + (p.x - ox) * k0;
  const wy = oy + (p.y - oy) * k0;
  return {
    cw: Math.round(r.w * SLAB_SCALE * k1),
    ch: Math.round(r.h * SLAB_SCALE * k1),
    cx: Math.round(ox),
    cy: Math.round(oy),
    zoom: k1.toFixed(4),
    wx: Math.round(wx),
    wy: Math.round(wy),
    k: (k1 / k0).toFixed(4),
  };
};

/**
 * contrast-floor.py: l'intestazione del thread all'ultima posa di PromptInput.
 * Contenuto vero, attenuato per costruzione mentre la risposta scorre, e in una
 * posizione aritmetica invece che dipendente da come vanno a capo i messaggi.
 * Dimensioni pari: su una sorgente yuv420p ffmpeg arrotonda un ritaglio dispari
 * al pixel sotto, e il banco scambierebbe una riga in meno per un'estrazione
 * fallita.
 */
export const contrastCrop = (): { x: number; y: number; w: number; h: number } => {
  const p = PROMPT_INPUT_END_POSE;
  const k = zoomForPush(p.pushZ);
  const ox = COMP_W / 2;
  const oy = COMP_H * PERSPECTIVE_ORIGIN_Y;
  const x0 = SIDEBAR_W + 20;
  const x1 = SIDEBAR_W + 560;
  const y0 = THREAD_TOP + 10;
  const y1 = THREAD_TOP + 44;
  const P = (x: number, y: number): [number, number] => {
    const s = slabPointOnScreen(x, y);
    return [ox + (s.x + p.slideX - ox) * k, oy + (s.y + (p.slideY ?? 0) - oy) * k];
  };
  const a = P(x0, y0);
  const b = P(x1, y1);
  const pari = (v: number): number => 2 * Math.floor(v / 2);
  return {
    x: pari(Math.max(0, Math.round(a[0]))),
    y: pari(Math.round(a[1])),
    w: pari(Math.round(b[0] - a[0])),
    h: pari(Math.round(b[1] - a[1])),
  };
};
