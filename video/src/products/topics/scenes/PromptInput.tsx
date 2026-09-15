import React from "react";
import {
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Board } from "../Board";
import { bubbleCurve } from "../Assistant";
import { Cursor, type Waypoint } from "../../../primitives/Cursor";
import { typedCount, typingSchedule } from "../../../primitives/rhythm";
import { tempo } from "../../../primitives/tempo";
import {
  COLUMNS,
  COMPOSER_H,
  COMPOSER_X,
  COMPOSER_Y,
  HANDOFF_FROM_COL,
  HANDOFF_FROM_IDX,
  SEND_H,
  SEND_W,
  SEND_X,
  SEND_Y,
  handoffCard,
  handoffLandedRect,
  TOPICS_RIG,
  TOPICS_SLAB,
} from "../geometry";
import { poseAt } from "../../../kit/camera";
import {
  PROMPT_INPUT_BASE as BASE,
  promptInputTrack,
} from "../tracks";
import { Shot } from "../../../kit/Shot";
import { TOPICS_SHOT_MATERIAL } from "../material";

/**
 * PromptInput: il quinto anello. Il cursore scende sul composer, scrive, invia,
 * e la risposta arriva a blocchi di parole.
 *
 * ERA FUORI CATENA, e non per distrazione. Si disegnava una lastra sua, larga
 * 2200 a prospettiva 2800 e scala 1,045, con un'altra chrome e un'altra
 * sidebar: un secondo schermo. Fra due schermi diversi il passaggio e' per
 * forza uno stacco, quindi la scena non aveva `seamAfter` e i tredici secondi
 * che contengono meta' della recita del film - la digitazione, l'esitazione, il
 * clic, lo streaming - restavano staccati dagli altri ventotto.
 *
 * Adesso la lastra e' quella di tutti, e il composer sta nella meta' bassa che
 * il kanban non usa. Il passaggio dalla board al composer non e' piu' un
 * cambio di schermo: e' una camera che scende, cioe' il movimento che il
 * catalogo chiama CAM-04, applicato a un altro soggetto.
 *
 * LA CAMERA NON RUOTA. Parte dalla posa finale di CardRelease, che e' frontale,
 * e arriva frontale sul composer: solo spinta e scorrimento. La vita della
 * scena sta nel cursore e nel testo, che e' quello di cui parla questo pezzo
 * del film; una camera che gira mentre qualcuno scrive toglie leggibilita' a
 * un'inquadratura che serve leggibile. La spinta e' monotona in avanti, da
 * -140 a +278, quindi la giunta non rovescia nessuna derivata.
 *
 * Frame-locked: ogni valore viene da useCurrentFrame().
 */

export type PromptInputProps = {
  prompt?: string;
  response?: string;
  branch?: string;
  /** Via di fuga: 0 a 1, per farsi pilotare da una timeline padre. */
  progress?: number;
  /**
   * Il pavimento dell'attenuazione. Esiste come prop per una ragione sola:
   * contrast-floor.py ha bisogno di poter renderizzare la stessa scena con un
   * valore troppo basso, per avere il caso che il banco deve bocciare. Un banco
   * senza il suo contronegativo non misura niente.
   */
  attnFloor?: number;
};

// I frame della recita. La pausa prima dell'invio e' la parte che la rende
// credibile: senza, l'invio parte insieme all'ultimo tasto e legge come uno
// script che esegue, non come qualcuno che rilegge.
/* La durata di riferimento a cui sono scritti i tempi (BASE) sta in
   products/topics/tracks.ts, perche' la legge anche la traccia della camera. */

const T = {
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
const CARET_PERIOD = 15;

/**
 * QUATTRO FRAME FRA IL COLPO E LA CONSEGUENZA, e non si scalano nemmeno questi.
 * click-gap.sh misura che stiano fra 1 e 8: e' la finestra in cui l'occhio lega
 * il gesto al suo effetto, non una decisione di ritmo. A velocita' doppia
 * diventerebbero due, sul bordo di sparire.
 */
const BUBBLE_AFTER_CLICK = 4;

const DEFAULT_PROMPT = "Rifai il flusso di auth e apri la PR";

const DEFAULT_RESPONSE =
  "Trovati tre punti di chiamata in server/auth.ts. Sposto il refresh del token dentro un guard solo, poi apro la PR su topics/auth-refresh.";

export const PromptInput: React.FC<PromptInputProps> = ({
  prompt = DEFAULT_PROMPT,
  response = DEFAULT_RESPONSE,
  branch = "topics/verdant-ether",
  progress,
  attnFloor = 0.62,
}) => {
  const localFrame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const frame =
    progress === undefined ? localFrame : progress * (durationInFrames - 1);
  const last = durationInFrames - 1;
  const K = tempo(durationInFrames, BASE);

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
  const nTyped = typedCount(schedule, frame);
  const typed = prompt.slice(0, nTyped);

  const sendTravelStart = typeEnd + K.at(T.pauseAfterTyping);
  const sendClick = sendTravelStart + K.at(T.travelToSend);
  const bubbleAt = sendClick + BUBBLE_AFTER_CLICK;
  const thinkAt = bubbleAt + K.at(T.bubble);
  const streamAt = thinkAt + K.at(T.thinking);

  const sent = frame >= sendClick;

  /**
   * LA CAMERA SI FERMA A f132, e non alla fine della scena.
   *
   * Non e' una scelta di gusto, e' venuta da un banco. `click-gap.sh` trova il
   * colpo e la conseguenza nel render cercando il fotogramma il cui conto di
   * pixel cambiati sfonda la mediana della finestra. Con la camera che scivola
   * per tutti i 450 frame, ogni fotogramma cambia molto e il clic non sfonda
   * piu' niente: il banco smetteva di trovare i due eventi, e aveva ragione,
   * perche' se non li trova una misura non li vede nemmeno l'occhio.
   *
   * Ed e' anche film migliore. Si scende sul composer mentre la mano arriva,
   * poi ci si ferma: nessuno muove la macchina mentre qualcuno scrive e legge,
   * perche' l'inquadratura in cui si legge deve stare ferma.
   */
  // La finestra e' PROMPT_INPUT_CAM_SETTLE in products/topics/tracks.ts.

  // Lo streaming va a blocchi di parole, non a caratteri. Un LLM non scrive
  // lettera per lettera: arriva a token, e l'occhio lo riconosce.
  const words = response.split(" ");
  const streamed = Math.max(
    0,
    Math.min(
      words.length,
      Math.floor(
        interpolate(frame, [streamAt, last - K.at(18)], [0, words.length], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      ),
    ),
  );
  const answer = words.slice(0, streamed).join(" ");

  // La camera: una curva sola, inOut, derivata nulla ai due capi. A sinistra
  // per agganciarsi alla fine di CardRelease, a destra perche' la scena si
  // ferma e un'altra ci si possa attaccare. La curva, e la finestra di 132 frame
  // spiegata qui sopra, stanno in products/topics/tracks.ts.
  const pose = poseAt(promptInputTrack(durationInFrames), frame);


  const focused = frame >= K.at(T.clickField);
  // Il caret lampeggia a 15 frame, e il calcolo e' sul frame: nessun keyframe CSS.
  const caretOn = focused && !sent && Math.floor(frame / CARET_PERIOD) % 2 === 0;

  /**
   * CAM-05: mentre la risposta arriva, tutto quello che non e' la risposta
   * scende a 0,62 e ci resta.
   *
   * NON E' UNA SFOCATURA, ed e' la differenza che vale la voce: sfocando, il
   * fondo smette di essere leggibile e il quadro perde meta' del suo contenuto.
   * Abbassando l'opacita' nessun pixel diventa illeggibile, cambia solo dove
   * sta il contrasto pieno, e l'occhio ci va da solo. Il numero e' un
   * pavimento: sotto, il contenuto attenuato scende sotto 3:1 una volta
   * renderizzato e legge come sporco sul fondo invece che come un piano dietro.
   */
  const attn = interpolate(frame, [streamAt - K.at(6), streamAt + K.at(26)], [1, attnFloor], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const press = interpolate(
    frame,
    [sendClick, sendClick + 5, sendClick + 12],
    [1, 0.9, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Il percorso del cursore, in coordinate della lastra condivisa. Le mire sono
  // le costanti di topics/geometry.ts, non due numeri copiati dal layout: se il composer
  // si sposta il puntatore lo segue.
  const path: Waypoint[] = [
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

  // La board sta come l'ha lasciata CardRelease: consegna avvenuta, niente in
  // volo. E' lo stesso componente con gli stessi valori, quindi il primo frame
  // di questa scena e' l'ultimo di quella per costruzione.
  const moving = handoffCard();
  const fromRest = COLUMNS[HANDOFF_FROM_COL]!.cards.filter(
    (_, i) => i !== HANDOFF_FROM_IDX,
  );
  const landed = handoffLandedRect();

  const board = {
    closeGap: 1,
    travel: 1,
    lift: 0,
    cardX: landed.x,
    cardY: landed.y,
    moving,
    fromRest,
  };

  const assistant = {
    typed,
    focused,
    caretOn,
    sent,
    sentPrompt: prompt,
    bubbleIn: bubbleCurve(frame, bubbleAt),
    thinking: frame >= thinkAt && frame < streamAt + 2,
    answer,
    press,
    frame,
    branch,
    attn,
  };

  return (
    <Shot
      rig={TOPICS_RIG}
      slab={TOPICS_SLAB}
      material={TOPICS_SHOT_MATERIAL}
      pose={pose}
      highlight={false}
      backdrop={<Board {...board} assistant={assistant} boardOpacity={attn} dimmed />}
    >
      <Board {...board} assistant={assistant} boardOpacity={attn} />

      {/* Il cursore sta DENTRO la lastra, quindi prende la stessa
          prospettiva e appoggia sul piano. Uno disegnato sopra il quadro,
          dritto, tradisce subito che la lastra e' un'immagine. */}
      <Cursor path={path} clicks={[T.clickField, sendClick]} frame={frame} />
    </Shot>
  );
};
