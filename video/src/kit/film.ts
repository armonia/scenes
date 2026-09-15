/**
 * Un film come fila di finestre: ogni scena occupa un intervallo di frame del
 * film, e dentro quell'intervallo vede il proprio tempo.
 *
 * PERCHE' ESISTE. Le scene di questo repo sono clip separate che si agganciano
 * alla giunta, e `seam.sh` misura che l'ultimo fotogramma di una somigli al
 * primo della successiva. Un film di prodotto (Cifra, Zeno) e' invece un file
 * solo: le stesse scene, una dopo l'altra, dentro una composition. Se la
 * finestra sbaglia l'inizio di un frame, la scena parte con un fotogramma di
 * ritardo e la giunta, che nelle clip era esatta, nel film diventa un salto.
 *
 * La finestra si calcola qui, da durate e ordine, e non la scrive nessuno a
 * mano: `SceneWindow.tsx` la usa per il render e `scripts/manifest.mjs` la
 * stampa per `film-identity.sh`, che confronta i fotogrammi del film con quelli
 * delle scene prese da sole.
 *
 * Modulo puro, letto da Node.
 */

export type FilmScene = { id: string; durationInFrames: number };

/** L'intervallo di una scena nel film: da `start` compreso per `frames` frame. */
export type FilmWindow = { id: string; start: number; frames: number };

/** Le finestre, una dopo l'altra, nell'ordine dato. */
export const filmWindows = (scenes: readonly FilmScene[]): FilmWindow[] => {
  const out: FilmWindow[] = [];
  let start = 0;
  for (const s of scenes) {
    if (!Number.isInteger(s.durationInFrames) || s.durationInFrames <= 0) {
      throw new Error(`${s.id}: durata non valida (${s.durationInFrames})`);
    }
    out.push({ id: s.id, start, frames: s.durationInFrames });
    start += s.durationInFrames;
  }
  return out;
};

/** La durata del film: la fine dell'ultima finestra. */
export const filmFrames = (windows: readonly FilmWindow[]): number => {
  const last = windows[windows.length - 1];
  return last ? last.start + last.frames : 0;
};

/**
 * Chi occupa il frame `frame` del film, e a che punto del proprio tempo e'.
 * `progress` va da 0 al primo frame della finestra a 1 all'ultimo, come la prop
 * `progress` delle scene.
 */
export const windowAt = (
  windows: readonly FilmWindow[],
  frame: number,
): { window: FilmWindow; local: number; progress: number } | null => {
  for (const w of windows) {
    if (frame >= w.start && frame < w.start + w.frames) {
      const local = frame - w.start;
      return { window: w, local, progress: w.frames > 1 ? local / (w.frames - 1) : 0 };
    }
  }
  return null;
};

/**
 * Le scene di un catalogo nell'ordine delle giunte: si parte da quella che non
 * dichiara `seamAfter` e si segue la catena. Un catalogo con due teste, un anello
 * o una scena che segue un id inesistente non e' un film, e lo si dice.
 */
export const chainOrder = <S extends FilmScene & { seamAfter?: string }>(
  scenes: readonly S[],
): S[] => {
  const heads = scenes.filter((s) => !s.seamAfter);
  if (heads.length !== 1) {
    throw new Error(
      `una catena ha una testa sola, qui ne ha ${heads.length}: ${heads.map((s) => s.id).join(", ")}`,
    );
  }
  const out: S[] = [heads[0] as S];
  for (;;) {
    const prev = out[out.length - 1] as S;
    const next = scenes.filter((s) => s.seamAfter === prev.id);
    if (next.length > 1) {
      throw new Error(`${prev.id} ha piu' di un seguito: ${next.map((s) => s.id).join(", ")}`);
    }
    if (next.length === 0) break;
    out.push(next[0] as S);
  }
  if (out.length !== scenes.length) {
    const left = scenes.filter((s) => !out.includes(s)).map((s) => s.id);
    throw new Error(`scene fuori dalla catena: ${left.join(", ")}`);
  }
  return out;
};
