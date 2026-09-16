import { Easing, interpolate } from "remotion";

/**
 * Le coreografie della UI come funzioni del fotogramma: consegna fra slot
 * (CHR-01), sfalsamento per distanza (CHR-02), catena di conseguenze (CHR-03),
 * inserimento in lista col varco anticipato (TXT-04).
 *
 * PERCHE' ESISTONO. Nel repo queste cose c'erano, ma scritte dentro CardHandoff
 * con le coordinate delle colonne di Topics: per usarle in un altro prodotto
 * bisognava copiare la scena e riscriverla. Qui lavorano su rettangoli e frame,
 * e non sanno niente di card o di colonne.
 *
 * Modulo puro rispetto a React, letto anche da Node.
 */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const inOutCubic = { easing: Easing.inOut(Easing.cubic), ...clamp };

export type Rect = { x: number; y: number; w: number; h: number };

/**
 * CHR-01: un elemento lascia uno slot e atterra in un altro.
 *
 * LA PARTE DIFFICILE NON E' IL VOLO, e' l'ordine dei tre eventi: il varco nella
 * destinazione si apre PRIMA che l'elemento parta, cosi' quando arriva il posto e'
 * gia' fatto; l'origine si richiude DOPO la partenza, mentre l'elemento e' in
 * aria. Se il varco si aprisse all'arrivo, l'elemento atterrerebbe su qualcosa e
 * poi lo spingerebbe via, che e' un urto e non una consegna. I tempi degli script:
 * varco a +30, volo da +40 a +126, chiusura a +56.
 */
export type Handoff = {
  from: Rect;
  to: Rect;
  /** Il fotogramma da cui si contano gli altri. */
  start: number;
  gapAt?: number;
  flightFrom?: number;
  flightTo?: number;
  closeAt?: number;
  /** Quanto dura l'apertura del varco e la chiusura dell'origine. */
  gapFrames?: number;
  /** Altezza dell'arco sopra la retta, in pixel. */
  arc?: number;
};

export type HandoffState = {
  x: number;
  y: number;
  /** 0 prima del volo, 1 all'arrivo. */
  travel: number;
  /** Quanto e' aperto il varco nella destinazione, da 0 a 1. */
  gapOpen: number;
  /** Quanto si e' richiusa l'origine, da 0 a 1. */
  originClosed: number;
  /** Sollevamento, da 0 a 1: su durante il volo, giu' all'arrivo. */
  lift: number;
};

export const handoffAt = (h: Handoff, frame: number): HandoffState => {
  const gapAt = h.start + (h.gapAt ?? 30);
  const flightFrom = h.start + (h.flightFrom ?? 40);
  const flightTo = h.start + (h.flightTo ?? 126);
  const closeAt = h.start + (h.closeAt ?? 56);
  const gapFrames = h.gapFrames ?? 24;
  const arc = h.arc ?? 96;
  const travel = interpolate(frame, [flightFrom, flightTo], [0, 1], inOutCubic);
  const x = h.from.x + (h.to.x - h.from.x) * travel;
  const y = h.from.y + (h.to.y - h.from.y) * travel - Math.sin(Math.PI * travel) * arc;
  return {
    x,
    y,
    travel,
    gapOpen: interpolate(frame, [gapAt, gapAt + gapFrames], [0, 1], inOutCubic),
    originClosed: interpolate(frame, [closeAt, closeAt + gapFrames], [0, 1], inOutCubic),
    lift: interpolate(frame, [flightFrom, flightFrom + 12, flightTo - 12, flightTo], [0, 1, 1, 0], clamp),
  };
};

/** L'ordine dei tre eventi di una consegna, per i banchi: varco prima del volo, chiusura dopo la partenza. */
export const handoffOrder = (h: Handoff): string[] => {
  const gapAt = h.gapAt ?? 30;
  const flightFrom = h.flightFrom ?? 40;
  const closeAt = h.closeAt ?? 56;
  const problems: string[] = [];
  if (!(gapAt < flightFrom)) problems.push(`il varco (+${gapAt}) non si apre prima del volo (+${flightFrom})`);
  if (!(closeAt > flightFrom)) problems.push(`l'origine (+${closeAt}) si chiude prima che l'elemento parta (+${flightFrom})`);
  return problems;
};

/**
 * CHR-02: il ritardo di ogni elemento dipende dalla distanza dal punto in cui e'
 * successo qualcosa, non dal suo indice. E' la differenza fra uno spazio che
 * reagisce e una lista che scorre. Gli script: 22 frame ogni 1400 pixel.
 */
export const staggerByDistance = <T extends { x: number; y: number }>(
  items: readonly T[],
  origin: { x: number; y: number },
  start: number,
  framesPer1400px = 22,
): (T & { at: number })[] =>
  items.map((it) => ({
    ...it,
    at: start + (Math.hypot(it.x - origin.x, it.y - origin.y) / 1400) * framesPer1400px,
  }));

/**
 * CHR-03: una catena di conseguenze. Ogni anello parte un certo numero di frame
 * dopo il precedente: e' il ritardo che si legge come causa. Tre cose che
 * cambiano sullo stesso frame non sono una catena, sono tre cose scollegate.
 */
export type ChainStep = { name: string; after: number };

export const chain = (cause: number, steps: readonly ChainStep[]): { name: string; at: number }[] => {
  let t = cause;
  return steps.map((s) => {
    t += s.after;
    return { name: s.name, at: t };
  });
};

/** Gli anelli che partono insieme al precedente: sotto due frame il nesso sparisce. */
export const chainProblems = (steps: readonly ChainStep[], minGap = 2, maxGap = 40): string[] =>
  steps.flatMap((s) =>
    s.after < minGap
      ? [`${s.name} parte ${s.after} frame dopo il precedente: sotto ${minGap} il nesso sparisce`]
      : s.after > maxGap
        ? [`${s.name} parte ${s.after} frame dopo il precedente: oltre ${maxGap} diventa lentezza`]
        : [],
  );

/**
 * TXT-04: una riga che entra in una lista. Il varco si apre `lead` frame prima che
 * la riga atterri (gli script: 18), cosi' la riga trova il posto gia' fatto.
 * Restituisce l'altezza del varco (0..1) e l'ingresso della riga (0..1).
 */
export const insertAt = (
  frame: number,
  landAt: number,
  lead = 18,
  landFrames = 14,
): { gap: number; enter: number } => ({
  gap: interpolate(frame, [landAt - lead, landAt - lead + Math.min(lead, 16)], [0, 1], inOutCubic),
  enter: interpolate(frame, [landAt - landFrames / 2, landAt + landFrames / 2], [0, 1], {
    easing: Easing.out(Easing.cubic),
    ...clamp,
  }),
});
