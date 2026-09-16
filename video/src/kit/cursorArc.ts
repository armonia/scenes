import { Easing, interpolate } from "remotion";

/**
 * Il puntatore che recita: arrivo in arco con scavalco e assestamento (CUR-01),
 * esitazione prima della pressione (CUR-02).
 *
 * PERCHE' NON I WAYPOINT. `primitives/path.ts` interpola a tratti fra punti, con
 * un easing per tratto: per disegnare un arco bisognava spezzarlo in molti punti,
 * e ogni punto diventava una frenata. Qui un movimento e' una curva di Bezier
 * quadratica col punto di controllo fuori asse, percorsa con un easing solo, che
 * va un filo oltre il bersaglio e ci torna.
 *
 * Modulo puro rispetto a React, letto anche da Node.
 */

export type Point = { x: number; y: number };

export type ArcMove = {
  to: Point;
  /** Il fotogramma in cui il puntatore parte. */
  start: number;
  /** Frame di corsa fino al punto di scavalco (gli script: 78). */
  travel?: number;
  /** Frame per tornare dallo scavalco al bersaglio (gli script: 12). */
  settle?: number;
  /** Scavalco oltre il bersaglio, in frazione della corsa (gli script: 7,5%). */
  overshoot?: number;
  /** Quanto l'arco esce dalla retta, in frazione della distanza. Positivo a sinistra del verso. */
  bend?: number;
};

export type CursorTimeline = {
  from: Point;
  moves: readonly ArcMove[];
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const bezier = (a: Point, c: Point, b: Point, t: number): Point => ({
  x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
  y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
});

/** Dove sta il puntatore al fotogramma `frame`. Fra un movimento e l'altro resta fermo. */
export const cursorAt = (tl: CursorTimeline, frame: number): Point => {
  let here = tl.from;
  for (const m of tl.moves) {
    const travel = m.travel ?? 78;
    const settle = m.settle ?? 12;
    if (frame < m.start) return here;
    const dx = m.to.x - here.x;
    const dy = m.to.y - here.y;
    const over = m.overshoot ?? 0.075;
    const beyond = { x: m.to.x + dx * over, y: m.to.y + dy * over };
    const bend = m.bend ?? 0.2;
    // Il punto di controllo sta a meta' strada, spostato sulla perpendicolare.
    const ctrl = { x: (here.x + beyond.x) / 2 - dy * bend, y: (here.y + beyond.y) / 2 + dx * bend };
    const end = m.start + travel;
    if (frame <= end) {
      const t = interpolate(frame, [m.start, end], [0, 1], { easing: Easing.inOut(Easing.cubic), ...clamp });
      return bezier(here, ctrl, beyond, t);
    }
    if (frame <= end + settle) {
      const t = interpolate(frame, [end, end + settle], [0, 1], { easing: Easing.inOut(Easing.quad), ...clamp });
      return { x: beyond.x + (m.to.x - beyond.x) * t, y: beyond.y + (m.to.y - beyond.y) * t };
    }
    here = m.to;
  }
  return here;
};

/** Il fotogramma in cui il puntatore e' fermo sul bersaglio di un movimento. */
export const arrivalOf = (m: ArcMove): number => m.start + (m.travel ?? 78) + (m.settle ?? 12);

/**
 * CUR-02: fra l'arrivo e la pressione ci deve essere un'attesa vera. Sotto dieci
 * frame non si registra, sopra venticinque sembra che l'interfaccia si sia
 * bloccata. E' l'unico punto di un film in cui il software aspetta la persona.
 */
export const hesitationProblems = (arrive: number, press: number, min = 10, max = 25): string[] => {
  const wait = press - arrive;
  if (wait < min) return [`l'attesa prima della pressione e' di ${wait.toFixed(1)} frame: sotto ${min} non si vede`];
  if (wait > max) return [`l'attesa prima della pressione e' di ${wait.toFixed(1)} frame: oltre ${max} sembra un blocco`];
  return [];
};
