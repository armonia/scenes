/**
 * Il ritmo della recita, e il motivo per cui e' un PRNG con seme e non Math.random.
 *
 * Un input che si digita a cadenza costante legge come una macchina. Uno che si
 * digita a caso legge come una macchina rotta. Quello che legge come una persona
 * ha pause dove una persona pensa: dopo la punteggiatura, prima di una parola
 * lunga, e raffiche veloci dentro le parole che le dita conoscono.
 *
 * L'irregolarita' deve pero' essere la STESSA a ogni render. Math.random rompe
 * il vincolo frame-locked in modo silenzioso: il video esce lo stesso, ma due
 * render dello stesso frame danno pixel diversi, quindi non e' piu' riproducibile
 * e un provino a contatto non prova piu' niente. Da qui mulberry32 con seme
 * fisso, che e' deterministico e sta in cinque righe.
 */

export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Per ogni carattere, il frame in cui compare. L'array cumulativo si calcola una
 * volta e poi la scena fa una sola ricerca: quanti frame sono passati, quanti
 * caratteri si vedono.
 */
export const typingSchedule = ({
  text,
  startFrame,
  fps,
  seed = 20260812,
  cps = 13,
}: {
  text: string;
  startFrame: number;
  fps: number;
  seed?: number;
  cps?: number;
}): number[] => {
  const rand = mulberry32(seed);
  const base = fps / cps;
  const out: number[] = [];
  let t = startFrame;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    const prev = i > 0 ? (text[i - 1] as string) : "";

    // Il jitter di fondo, sempre presente: nessuna battuta dura quanto la
    // precedente.
    let d = base * (0.55 + rand() * 0.95);

    // Dopo la punteggiatura si pensa. E' la pausa piu' lunga di tutte.
    if (/[.,;:!?]/.test(prev)) d += base * (2.2 + rand() * 1.8);

    // Prima di una parola lunga si pensa un po'. Lo spazio e' il punto in cui
    // la mano si ferma, non la lettera dopo.
    if (prev === " ") {
      const rest = text.slice(i);
      const word = rest.split(" ")[0] ?? "";
      if (word.length >= 6) d += base * (0.8 + rand() * 1.2);
    }

    // Le raffiche: dentro una parola, ogni tanto tre o quattro tasti partono
    // insieme perche' le dita conoscono la sequenza.
    if (ch !== " " && prev !== " " && rand() < 0.34) d *= 0.42;

    t += d;
    out.push(t);
  }

  return out;
};

/** Quanti caratteri sono comparsi a questo frame. */
export const typedCount = (schedule: number[], frame: number): number => {
  let n = 0;
  while (n < schedule.length && (schedule[n] as number) <= frame) n++;
  return n;
};
