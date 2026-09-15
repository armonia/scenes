import { Easing, interpolate } from "remotion";

/**
 * Il livello tipografico di un film come dato: battute, parole, soste.
 *
 * Una battuta e' una frase che entra a un fotogramma e resta finche' non entra la
 * successiva o finche' non esce. La frase e' fatta di righe e le righe di parole,
 * perche' il formato decide dove si va a capo: la stessa battuta in 9:16 ha piu'
 * righe che in 16:9, e le parole si confrontano per posizione nella riga.
 *
 * Modulo puro rispetto a React, letto anche da Node (i controlli delle soste li
 * fanno i banchi senza renderizzare).
 */

export type TypeCue = {
  /** Il fotogramma in cui la battuta comincia a entrare. */
  at: number;
  /** Le righe della frase, ognuna come elenco di parole. */
  rows: string[][];
  /** TYP-03: la parola che prende l'accento, come [riga, parola]. */
  accent?: [number, number];
  /** TYP-02: la parola che cresce, come [riga, parola], e di quanto. */
  key?: { word: [number, number]; scale: number };
  /**
   * Il fotogramma in cui la frase esce dal bordo alto senza che ne entri un'altra.
   * Se manca, la frase resta finche' non entra la battuta dopo.
   */
  exitAt?: number;
};

export type TypeTiming = {
  /** TYP-05: frame di salita di una parola dalla sua maschera (gli script: 26). */
  wordFrames: number;
  /** TYP-05: sfalsamento fra una parola e la successiva (gli script: 3,4). */
  stagger: number;
  /** TYP-04 e TYP-01: frame dello scambio fra due frasi (gli script: 24). */
  swapFrames: number;
  /** TYP-03: frame in cui l'accento si mescola (gli script: 24, mai un frame solo). */
  accentFrames: number;
  /** TYP-02: frame di crescita della parola chiave (gli script: 44). */
  keyFrames: number;
  /** Di quanto la parola sale fuori dalla maschera, in frazione della sua altezza (160%). */
  travel: number;
};

export const DEFAULT_TYPE_TIMING: TypeTiming = {
  wordFrames: 26,
  stagger: 3.4,
  swapFrames: 24,
  accentFrames: 24,
  keyFrames: 44,
  travel: 1.6,
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = { easing: Easing.inOut(Easing.cubic), ...clamp };

/** La battuta attiva a un fotogramma, e quella prima, se lo scambio e' in corso. */
export const cueAt = (cues: readonly TypeCue[], frame: number): { index: number; cue: TypeCue | null; prev: TypeCue | null } => {
  let index = -1;
  for (let i = 0; i < cues.length; i++) if ((cues[i] as TypeCue).at <= frame) index = i;
  return {
    index,
    cue: index >= 0 ? (cues[index] as TypeCue) : null,
    prev: index >= 1 ? (cues[index - 1] as TypeCue) : null,
  };
};

/**
 * Lo stato di una parola a un fotogramma.
 *
 * TRE MOVIMENTI DIVERSI, e la prima versione ne aveva due: la copia vecchia che
 * esce durante lo scambio (`oldOut`), la copia nuova che entra (`in`), e l'uscita
 * della parola alla fine della frase (`exit`), che sposta la copia visibile.
 * Mescolando la seconda con la prima, le parole nuove senza una vecchia al loro
 * posto uscivano mentre entravano, e di una frase di cinque parole se ne vedeva
 * una sola.
 *
 * Una parola uguale nella frase di prima e in quella nuova, nella stessa
 * posizione, non si muove (TYP-04). Una frase che arriva dopo che la precedente e'
 * gia' uscita entra con la maschera, parola per parola (TYP-05), come la prima.
 */
export type WordState = {
  old: string | null;
  word: string | null;
  /** 0..1: quanto la copia vecchia e' uscita dal bordo alto. */
  oldOut: number;
  /** 0..1: quanto la copia nuova e' entrata dal basso. */
  in: number;
  /** 0..1: quanto la parola e' uscita alla fine della frase. */
  exit: number;
  /**
   * 0..1: quanto la cella ha preso la larghezza della parola nuova invece di
   * quella vecchia. Va con lo scambio; 1 per le parole che non si scambiano.
   */
  mix: number;
  /** 0..1: quanto la parola ha preso l'accento. */
  accent: number;
  /** La scala della parola chiave (1 se non lo e'). */
  scale: number;
};

export const wordStates = (
  cues: readonly TypeCue[],
  frame: number,
  timing: TypeTiming = DEFAULT_TYPE_TIMING,
): WordState[][] => {
  const { cue, prev } = cueAt(cues, frame);
  if (!cue) return [];
  // Una frase precedente che ha un'uscita sua non si scambia con la nuova: e'
  // uscita (o sta uscendo) per conto suo, e la nuova entra con la maschera.
  // Che l'uscita finisca prima dell'ingresso lo controlla cueProblems.
  const live = prev && prev.exitAt === undefined ? prev : null;
  const rows = Math.max(cue.rows.length, live?.rows.length ?? 0);
  const out: WordState[][] = [];
  const exit =
    cue.exitAt === undefined ? 0 : interpolate(frame, [cue.exitAt, cue.exitAt + timing.swapFrames], [0, 1], ease);
  let order = 0;
  for (let r = 0; r < rows; r++) {
    const now = cue.rows[r] ?? [];
    const before = live?.rows[r] ?? [];
    const n = Math.max(now.length, before.length);
    const row: WordState[] = [];
    for (let k = 0; k < n; k++) {
      const word = now[k] ?? null;
      const oldWord = live ? (before[k] ?? null) : null;
      const same = oldWord !== null && oldWord === word;
      let wIn: number;
      let oldOut = 0;
      let mix = 1;
      let accentStart: number;
      if (!live) {
        const start = cue.at + order * timing.stagger;
        wIn = interpolate(frame, [start, start + timing.wordFrames], [0, 1], ease);
        accentStart = start + timing.wordFrames;
      } else if (same) {
        wIn = 1;
        accentStart = cue.at + timing.swapFrames;
      } else {
        const swap = interpolate(frame, [cue.at, cue.at + timing.swapFrames], [0, 1], ease);
        wIn = swap;
        oldOut = oldWord === null ? 0 : swap;
        mix = swap;
        accentStart = cue.at + timing.swapFrames;
      }
      const isAccent = cue.accent !== undefined && cue.accent[0] === r && cue.accent[1] === k;
      const isKey = cue.key !== undefined && cue.key.word[0] === r && cue.key.word[1] === k;
      row.push({
        old: same ? null : oldWord,
        word,
        oldOut,
        in: wIn,
        exit,
        mix,
        accent: isAccent ? interpolate(frame, [accentStart, accentStart + timing.accentFrames], [0, 1], ease) : 0,
        scale: isKey
          ? interpolate(frame, [accentStart, accentStart + timing.keyFrames], [1, (cue.key as { scale: number }).scale], ease)
          : 1,
      });
      if (word) order++;
    }
    out.push(row);
  }
  return out;
};

/** TYP-03: il colore a meta' strada fra due colori esadecimali. */
export const mixColor = (a: string, b: string, t: number): string => {
  const parse = (h: string) => {
    const v = h.replace("#", "");
    const full = v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${m(ar as number, br as number)}, ${m(ag as number, bg as number)}, ${m(ab as number, bb as number)})`;
};

/**
 * TYP-01: la sosta netta di ogni battuta, in caratteri al secondo. Netta vuol dire
 * dal momento in cui la frase e' tutta leggibile a quello in cui comincia a
 * uscire. Sopra 15,5 caratteri al secondo la gente perde la fine della riga.
 */
export const dwellProblems = (
  cues: readonly TypeCue[],
  fps: number,
  timing: TypeTiming = DEFAULT_TYPE_TIMING,
  maxCps = 15.5,
): string[] => {
  const problems: string[] = [];
  cues.forEach((cue, i) => {
    const words = cue.rows.flat();
    const chars = words.join(" ").length;
    // Entra con la maschera se e' la prima o se la precedente ha un'uscita sua,
    // altrimenti con lo scambio: la stessa regola di wordStates.
    const prevCue = cues[i - 1];
    const masked = !prevCue || prevCue.exitAt !== undefined;
    const entered = masked ? cue.at + (words.length - 1) * timing.stagger + timing.wordFrames : cue.at + timing.swapFrames;
    const next = cues[i + 1];
    const leaves = cue.exitAt ?? next?.at;
    if (leaves === undefined) return;
    const seconds = (leaves - entered) / fps;
    if (seconds <= 0) {
      problems.push(`"${words.join(" ")}" esce prima di essere entrata tutta`);
      return;
    }
    const cps = chars / seconds;
    if (cps > maxCps) {
      problems.push(`"${words.join(" ")}": ${cps.toFixed(1)} caratteri al secondo di sosta netta, oltre ${maxCps}`);
    }
  });
  return problems;
};

/**
 * Battute che si pestano i piedi: una frase che esce mentre la successiva sta gia'
 * entrando sparisce a meta' uscita, perche' il livello tipografico ne disegna una
 * sola alla volta; una parola chiave in mezzo alla riga cresce sopra le vicine.
 */
export const cueProblems = (cues: readonly TypeCue[], timing: TypeTiming = DEFAULT_TYPE_TIMING): string[] => {
  const problems: string[] = [];
  cues.forEach((cue, i) => {
    const next = cues[i + 1];
    const text = cue.rows.map((r) => r.join(" ")).join(" / ");
    if (next && cue.exitAt !== undefined && cue.exitAt + timing.swapFrames > next.at) {
      problems.push(`"${text}" esce fino a f${cue.exitAt + timing.swapFrames} ma la battuta dopo entra a f${next.at}`);
    }
    if (next && cue.exitAt !== undefined && cue.exitAt > next.at) {
      problems.push(`"${text}" ha l'uscita a f${cue.exitAt}, dopo l'ingresso della battuta successiva`);
    }
    if (cue.key) {
      const [r, k] = cue.key.word;
      const row = cue.rows[r] ?? [];
      if (row.length > 1 && k !== 0 && k !== row.length - 1) {
        problems.push(`"${text}": la parola chiave sta in mezzo alla riga e crescendo copre le vicine`);
      }
    }
  });
  return problems;
};
