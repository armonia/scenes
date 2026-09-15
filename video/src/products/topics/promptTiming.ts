import { interpolate } from "remotion";
import { typingSchedule } from "../../primitives/rhythm.ts";
import { tempo } from "../../primitives/tempo.ts";
import type { Waypoint } from "../../primitives/path.ts";
import {
  COMPOSER_H,
  COMPOSER_X,
  COMPOSER_Y,
  SEND_H,
  SEND_W,
  SEND_X,
  SEND_Y,
} from "./geometry.ts";
import { PROMPT_INPUT_BASE } from "./tracks.ts";

/**
 * La recita di PromptInput come dato: quando la mano arriva, quando si scrive,
 * quando parte l'invio, quando arrivano la bolla, i puntini e la risposta.
 *
 * Stava dentro PromptInput.tsx. E' qui, in un modulo puro, perche' click-gap.sh
 * e beats.sh devono sapere in che frame cercare il clic e le battute: prima se
 * li scrivevano da soli (450, 170, 210, 300...), copiati a mano dalla scena e
 * giusti solo alla durata di riferimento e nel 16:9.
 *
 * Modulo puro, letto da Node.
 */

// I frame della recita. La pausa prima dell'invio e' la parte che la rende
// credibile: senza, l'invio parte insieme all'ultimo tasto e legge come uno
// script che esegue, non come qualcuno che rilegge.
/* La durata di riferimento a cui sono scritti i tempi (PROMPT_INPUT_BASE) sta
   in products/topics/tracks.ts, perche' la legge anche la traccia della camera. */

export const T = {
  travelStart: 56,
  travelEnd: 114,
  clickField: 116,
  typeStart: 132,
  pauseAfterTyping: 24,
  travelToSend: 32,
  bubble: 14,
  thinking: 26,
} as const;

/**
 * IL BATTITO DEL CARET NON SI SCALA: quindici frame sono una frequenza, non una
 * durata. Un cursore che lampeggia al doppio della velocita' non legge come una
 * scena piu' rapida, legge come un cursore rotto.
 */
export const CARET_PERIOD = 15;

/**
 * QUATTRO FRAME FRA IL COLPO E LA CONSEGUENZA, e non si scalano nemmeno questi.
 * click-gap.sh misura che stiano fra 1 e 8: e' la finestra in cui l'occhio lega
 * il gesto al suo effetto, non una decisione di ritmo. A velocita' doppia
 * diventerebbero due, sul bordo di sparire.
 */
export const BUBBLE_AFTER_CLICK = 4;

export const DEFAULT_PROMPT = "Rifai il flusso di auth e apri la PR";

export const DEFAULT_RESPONSE =
  "Trovati tre punti di chiamata in server/auth.ts. Sposto il refresh del token dentro un guard solo, poi apro la PR su topics/auth-refresh.";


/** I frame della recita a una durata. `fps` serve alla battitura. */
export const promptInputTimeline = (
  durationInFrames: number,
  fps: number,
  prompt: string = DEFAULT_PROMPT,
) => {
  const last = durationInFrames - 1;
  const K = tempo(durationInFrames, PROMPT_INPUT_BASE);

  /**
   * LA BATTITURA SCALA, e SI DIVIDE invece di moltiplicarsi. Tredici caratteri
   * al secondo e' un ritmo umano, quindi sarebbe da lasciare fermo; ma una
   * scena piu' rapida in cui il testo si scrive alla stessa velocita' non ci
   * sta dentro: la spedizione arriva dopo l'ultimo fotogramma e la scena
   * finisce a meta' gesto.
   *
   * `cps` e' una VELOCITA', non una durata, quindi va all'inverso del fattore:
   * a meta' durata servono il doppio dei caratteri al secondo. Scrivendolo
   * moltiplicato - come era la prima volta - una scena piu' corta si ritrovava
   * un dattilografo piu' LENTO, la spedizione slittava all'83 per cento della
   * durata invece del 60, e `beats.sh` trovava il campo ancora pieno dove si
   * aspettava il segnaposto. Sbagliato di un reciproco, e visibile solo
   * misurando.
   *
   * Il limite superiore esiste e non e' misurato: oltre una certa velocita' la
   * battitura smette di leggere come una mano e comincia a leggere come un
   * incolla. A meta' durata sono 26 caratteri al secondo, ed e' probabilmente
   * la' intorno.
   */
  const schedule = typingSchedule({
    text: prompt,
    startFrame: K.at(T.typeStart),
    fps,
    cps: 13 / K.k,
  });

  const typeEnd = schedule[schedule.length - 1] ?? T.typeStart;
  const sendTravelStart = typeEnd + K.at(T.pauseAfterTyping);
  const sendClick = sendTravelStart + K.at(T.travelToSend);
  const bubbleAt = sendClick + BUBBLE_AFTER_CLICK;
  const thinkAt = bubbleAt + K.at(T.bubble);
  const streamAt = thinkAt + K.at(T.thinking);

  return {
    K,
    last,
    schedule,
    typeStart: K.at(T.typeStart),
    typeEnd,
    /** Il clic sul campo, che gli da' il fuoco. */
    fieldClick: K.at(T.clickField),
    sendTravelStart,
    sendClick,
    bubbleAt,
    thinkAt,
    streamAt,
    /** Lo streaming finisce qui: l'ultima parola arriva diciotto frame (a riferimento) prima della fine. */
    streamEnd: last - K.at(18),
    /** CAM-05: l'attenuazione scende in questa finestra e poi resta al pavimento. */
    attnFrom: streamAt - K.at(6),
    attnTo: streamAt + K.at(26),
  };
};

export type PromptInputTimeline = ReturnType<typeof promptInputTimeline>;

/** Quante parole della risposta si vedono al frame `frame`. */
export const streamedWordCount = (
  tl: PromptInputTimeline,
  frame: number,
  words: number,
): number =>
  Math.max(
    0,
    Math.min(
      words,
      Math.floor(
        interpolate(frame, [tl.streamAt, tl.streamEnd], [0, words], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      ),
    ),
  );

/**
 * Il percorso del cursore, in coordinate della lastra condivisa. Le mire sono
 * le costanti di topics/geometry.ts, non due numeri copiati dal layout: se il
 * composer si sposta il puntatore lo segue.
 */
export const promptInputPath = (
  tl: PromptInputTimeline,
  durationInFrames: number,
): Waypoint[] => {
  const { K, sendTravelStart, sendClick, streamAt } = tl;
  return [
    { x: 2620, y: 1330, at: 0 },
    { x: 2620, y: 1330, at: K.at(T.travelStart) },
    { x: 1760, y: 1214, at: K.at(T.travelStart + 22) },
    { x: COMPOSER_X + 110, y: COMPOSER_Y + COMPOSER_H / 2, at: K.at(T.travelEnd) },
    { x: COMPOSER_X + 110, y: COMPOSER_Y + COMPOSER_H / 2, at: sendTravelStart },
    { x: SEND_X + SEND_W / 2, y: SEND_Y + SEND_H / 2, at: sendClick },
    // La mano si ritira mentre la risposta scorre. Non e' una gentilezza: al
    // suo posto resterebbe una freccia sull'ultimo fotogramma, e la scena dopo
    // un cursore non ce l'ha, quindi la giunta la mostrerebbe sparire.
    { x: SEND_X + SEND_W / 2, y: SEND_Y + SEND_H / 2, at: streamAt + K.at(16) },
    { x: 2620, y: 1330, at: streamAt + K.at(58) },
    { x: 2620, y: 1330, at: durationInFrames },
  ];
};
