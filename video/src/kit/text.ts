import { Easing, interpolate } from "remotion";
import { typedCount, typingSchedule } from "../primitives/rhythm.ts";

/**
 * Il testo che si compone: battitura con correzione (TXT-01, TXT-05), numero che
 * sale e si posa (TXT-03), risposta che arriva a parole (TXT-02).
 *
 * Tutte funzioni del fotogramma e di un seme: nessuna usa l'orologio, quindi due
 * render dello stesso frame danno lo stesso testo.
 *
 * Modulo puro rispetto a React, letto anche da Node.
 */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Un'azione su un campo di testo: scrivere, fermarsi, cancellare.
 *
 * CANCELLARE NON E' SCRIVERE AL CONTRARIO. Nessuno cancella mentre pensa: si
 * tiene premuto il tasto, e il testo se ne va a cadenza fissa, quasi quattro
 * volte piu' veloce della battitura (gli script: 1,6 caratteri per frame contro
 * 0,43). E si cancella fino al confine di parola, non a un carattere a caso.
 */
export type TypingStep =
  | { kind: "type"; text: string; cps?: number; seed?: number }
  | { kind: "pause"; frames: number }
  | { kind: "erase"; to: string; charsPerFrame?: number };

export type TypingPlan = {
  start: number;
  fps: number;
  steps: readonly TypingStep[];
};

type Segment =
  | { kind: "type"; from: number; base: string; text: string; schedule: number[] }
  | { kind: "pause"; from: number; to: number; text: string }
  | { kind: "erase"; from: number; to: number; before: string; after: string; cpf: number };

/** I tratti del piano, con i frame calcolati una volta sola. */
export const typingSegments = (plan: TypingPlan): Segment[] => {
  const segs: Segment[] = [];
  let t = plan.start;
  let text = "";
  for (const s of plan.steps) {
    if (s.kind === "type") {
      const schedule = typingSchedule({ text: s.text, startFrame: t, fps: plan.fps, cps: s.cps ?? 13, seed: s.seed });
      segs.push({ kind: "type", from: t, base: text, text: s.text, schedule });
      t = schedule[schedule.length - 1] ?? t;
      text += s.text;
    } else if (s.kind === "pause") {
      segs.push({ kind: "pause", from: t, to: t + s.frames, text });
      t += s.frames;
    } else {
      if (!text.startsWith(s.to)) throw new Error(`non si puo' cancellare "${text}" fino a "${s.to}": non ne e' l'inizio`);
      const cpf = s.charsPerFrame ?? 1.6;
      const n = text.length - s.to.length;
      segs.push({ kind: "erase", from: t, to: t + n / cpf, before: text, after: s.to, cpf });
      t += n / cpf;
      text = s.to;
    }
  }
  return segs;
};

/** Il testo nel campo al fotogramma `frame`. */
export const typedAt = (plan: TypingPlan, frame: number): string => {
  const segs = typingSegments(plan);
  let current = "";
  for (const seg of segs) {
    if (frame < seg.from) return current;
    if (seg.kind === "type") {
      current = seg.base + seg.text.slice(0, typedCount(seg.schedule, frame));
    } else if (seg.kind === "pause") {
      current = seg.text;
    } else {
      const gone = Math.min(seg.before.length - seg.after.length, Math.floor((frame - seg.from) * seg.cpf));
      current = seg.before.slice(0, seg.before.length - gone);
    }
  }
  return current;
};

/** La fine del piano: l'ultimo frame in cui il testo cambia. */
export const typingEnd = (plan: TypingPlan): number => {
  const segs = typingSegments(plan);
  const last = segs[segs.length - 1];
  if (!last) return plan.start;
  if (last.kind === "type") return last.schedule[last.schedule.length - 1] ?? last.from;
  return last.to;
};

/** Il confine di parola piu' vicino prima della posizione `at` di `text`. */
export const wordBoundaryBefore = (text: string, at: number): string => {
  const cut = text.lastIndexOf(" ", Math.max(0, at - 1));
  return cut < 0 ? "" : text.slice(0, cut + 1);
};

/**
 * TXT-03: un numero che sale e si posa, con un piccolo scavalco invece di
 * scorrere come un contachilometri. Lo scavalco e' una frazione del salto (la
 * grammatica dice 7,5%; su un prezzo gli script scendono al 2,5%, perche' uno
 * scavalco verso l'alto racconta che poteva costare di piu').
 */
export type Settle = { from: number; to: number; start: number; frames: number; overshoot?: number };

export const settleAt = (s: Settle, frame: number): number => {
  const over = s.to + (s.to - s.from) * (s.overshoot ?? 0.075);
  const peak = s.start + s.frames * 0.7;
  if (frame <= peak) {
    return interpolate(frame, [s.start, peak], [s.from, over], { easing: Easing.out(Easing.cubic), ...clamp });
  }
  return interpolate(frame, [peak, s.start + s.frames], [over, s.to], { easing: Easing.inOut(Easing.cubic), ...clamp });
};

/**
 * TXT-02: quante parole di una risposta si vedono. Arrivano a blocchi di
 * parole, non a caratteri: un modello linguistico scrive a token, e l'occhio lo
 * riconosce.
 */
export const streamedWords = (text: string, frame: number, start: number, end: number): string => {
  const words = text.split(" ");
  const n = Math.max(0, Math.min(words.length, Math.floor(interpolate(frame, [start, end], [0, words.length], clamp))));
  return words.slice(0, n).join(" ");
};
