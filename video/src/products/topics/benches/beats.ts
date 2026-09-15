import { STAGES } from "../../../kit/stage.ts";
import type { Ratio } from "../../../kit/stage.ts";
import { projectRect } from "../../../kit/project.ts";
import { poseAt } from "../../../kit/camera.ts";
import { typedCount } from "../../../primitives/rhythm.ts";
import {
  COMPOSER_Y,
  SIDEBAR_W,
  SLAB_H,
  THREAD_TOP,
  TOPICS_RIG,
  TOPICS_SLAB,
  TOOL_ROW_EXTRA_W,
} from "../geometry.ts";
import { topicsLayout } from "../poses.ts";
import {
  DEFAULT_PROMPT,
  DEFAULT_RESPONSE,
  promptInputTimeline,
  streamedWordCount,
} from "../promptTiming.ts";
import { THREAD_HISTORY } from "../thread.ts";
import { promptInputTrack } from "../tracks.ts";

type Catalog = {
  scenes: { id: string; durationInFrames: number; fps: number }[];
  tempoFixtures: { id: string; scene: string; durationInFrames: number }[];
};
type Rect = { x: number; y: number; w: number; h: number };

/** Le parole che l'OCR regge: solo lettere, almeno quattro, minuscole. */
const readable = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4);

/**
 * beats.py: i fotogrammi in cui guardare i quattro tempi di PromptInput, le
 * parole da cercare e la zona del quadro da leggere.
 *
 * I FRAME ESCONO DALLA RECITA, non da una tabella. Erano sei numeri (170, 210,
 * 300, 340, 385, 430) scelti guardando la scena a 450 fotogrammi e scalati con
 * la durata; il secondo campione della battitura cadeva quattro frame prima
 * della fine del prompt, e il commento diceva che li' c'era tutto. Adesso: un
 * campione a un terzo della battitura e uno a battitura finita, prima che la mano
 * parta per l'invio; uno fra la bolla ormai entrata e l'inizio dello streaming;
 * tre nello streaming, al 20, 55 e 90 per cento. Il modulo verifica che fra i due
 * della battitura le parole scritte crescano davvero, e cosi' fra i tre dello
 * streaming, contando solo le parole che il banco cerca.
 *
 * LE PAROLE GIA' IN QUADRO NON SI CERCANO. "solo" sta nella risposta e anche
 * nello scambio precedente del thread: contarla voleva dire trovare la risposta
 * prima che arrivasse.
 *
 * LA ZONA E' IL THREAD PIU' IL CAMPO, alla posa ferma finale, tagliata sul quadro:
 * l'OCR non legge la board, che non c'entra e che in 9:16 riempie meta' quadro.
 * La zona coperta per il negativo e' la coda del thread sopra il campo, dove
 * arrivano il messaggio e la risposta.
 */
export const geometry = (ratio: Ratio, { catalog }: { catalog: Catalog }) => {
  const stage = STAGES[ratio];
  const scene = catalog.scenes.find((s) => s.id === "PromptInput");
  if (!scene) throw new Error("catalog.json: manca PromptInput");
  const { msgMaxW } = topicsLayout(ratio);

  const history = new Set(
    THREAD_HISTORY.flatMap((item) => (item.kind === "msg" ? readable(item.text) : readable(item.file))),
  );
  const promptWords = [...new Set(readable(DEFAULT_PROMPT))].filter((w) => !history.has(w));
  // Le parole del prompt restano in quadro nel messaggio inviato, quindi non
  // dicono niente sulla risposta: "auth" sta in tutti e due.
  const responseWords = [...new Set(readable(DEFAULT_RESPONSE))].filter(
    (w) => !history.has(w) && !promptWords.includes(w),
  );

  const clip = (r: Rect, what: string, variant: string, pose: ReturnType<typeof poseAt>): Rect => {
    const p = projectRect(stage, TOPICS_RIG, TOPICS_SLAB, pose, r);
    const x0 = Math.max(0, Math.floor(p.x));
    const y0 = Math.max(0, Math.floor(p.y));
    const x1 = Math.min(stage.w, Math.ceil(p.x + p.w));
    const y1 = Math.min(stage.h, Math.ceil(p.y + p.h));
    const out = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    if (out.w < 200 || out.h < 100) {
      throw new Error(`${variant} in ${ratio}: la zona "${what}" non sta nel quadro (${JSON.stringify(out)})`);
    }
    return out;
  };

  const variants = [
    { id: "PromptInput", durationInFrames: scene.durationInFrames },
    ...catalog.tempoFixtures
      .filter((f) => f.scene === "PromptInput")
      .map((f) => ({ id: f.id, durationInFrames: f.durationInFrames })),
  ].map((v) => {
    const tl = promptInputTimeline(v.durationInFrames, scene.fps);
    const visible = (text: string, words: string[]) => {
      const seen = new Set(readable(text));
      return words.filter((w) => seen.has(w)).length;
    };
    // Una parola del prompt conta come scritta quando e' seguita da uno spazio o
    // e' l'ultima e la battitura e' finita.
    const typedWords = (f: number) => {
      const n = typedCount(tl.schedule, f);
      const done = DEFAULT_PROMPT.slice(0, n);
      const whole = n >= DEFAULT_PROMPT.length ? done : done.slice(0, done.lastIndexOf(" ") + 1);
      return visible(whole, promptWords);
    };
    const type1 = Math.round(tl.typeStart + (tl.typeEnd - tl.typeStart) / 3);
    const type2 = Math.ceil(tl.typeEnd) + 2;
    if (type2 >= tl.sendTravelStart) throw new Error(`${v.id}: nessun frame fra la fine della battitura e l'invio`);
    if (typedWords(type2) <= typedWords(type1)) {
      throw new Error(`${v.id}: fra f${type1} e f${type2} le parole del prompt non crescono`);
    }
    const sent = Math.round((tl.bubbleAt + 12 + tl.streamAt) / 2);
    if (!(sent > tl.bubbleAt + 12 && sent < tl.streamAt)) {
      throw new Error(`${v.id}: nessun frame fra la bolla entrata e lo streaming`);
    }
    const words = DEFAULT_RESPONSE.split(" ");
    const stream = [0.2, 0.55, 0.9].map((q) => Math.round(tl.streamAt + (tl.streamEnd - tl.streamAt) * q));
    const shown = stream.map((f) => visible(words.slice(0, streamedWordCount(tl, f, words.length)).join(" "), responseWords));
    for (let i = 1; i < shown.length; i++) {
      if ((shown[i] as number) <= (shown[i - 1] as number)) {
        throw new Error(`${v.id}: nei frame ${stream.join(", ")} le parole cercate non crescono (${shown.join(", ")})`);
      }
    }
    const pose = poseAt(promptInputTrack(v.durationInFrames, ratio), v.durationInFrames - 1);
    const read = clip(
      {
        x: SIDEBAR_W,
        y: THREAD_TOP + 52,
        w: Math.min(1400, msgMaxW + 200 + TOOL_ROW_EXTRA_W),
        h: SLAB_H - 20 - (THREAD_TOP + 52),
      },
      "lettura",
      v.id,
      pose,
    );
    const cover = clip({ x: 0, y: COMPOSER_Y - 420, w: TOPICS_SLAB.w, h: 420 }, "copertura", v.id, pose);
    return {
      id: v.id,
      durationInFrames: v.durationInFrames,
      frames: { type1, type2, sent, stream },
      read,
      cover,
    };
  });
  return { stage: { w: stage.w, h: stage.h }, fps: scene.fps, promptWords, responseWords, variants };
};
