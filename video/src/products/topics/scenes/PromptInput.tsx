import React from "react";
import {
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Board } from "../Board";
import { bubbleCurve } from "../Assistant";
import { Cursor } from "../../../primitives/Cursor";
import { typedCount } from "../../../primitives/rhythm";
import {
  CARET_PERIOD,
  DEFAULT_PROMPT,
  DEFAULT_RESPONSE,
  promptInputPath,
  promptInputTimeline,
  streamedWordCount,
} from "../promptTiming";
import {
  COLUMNS,
  HANDOFF_FROM_COL,
  HANDOFF_FROM_IDX,
  handoffCard,
  handoffLandedRect,
  TOPICS_RIG,
  TOPICS_SLAB,
} from "../geometry";
import { poseAt } from "../../../kit/camera";
import { stageFor } from "../../../kit/stage";
import { promptInputTrack } from "../tracks";
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

// I frame della recita, la battitura, i testi e il percorso del cursore sono
// in products/topics/promptTiming.ts: li leggono anche click-gap.sh e beats.sh.

export const PromptInput: React.FC<PromptInputProps> = ({
  prompt = DEFAULT_PROMPT,
  response = DEFAULT_RESPONSE,
  branch = "topics/verdant-ether",
  progress,
  attnFloor = 0.62,
}) => {
  const localFrame = useCurrentFrame();
  const { durationInFrames, fps, width, height } = useVideoConfig();
  const { ratio } = stageFor(width, height);
  const frame =
    progress === undefined ? localFrame : progress * (durationInFrames - 1);

  const tl = promptInputTimeline(durationInFrames, fps, prompt);
  const { schedule, sendClick, bubbleAt, thinkAt, streamAt } = tl;
  const nTyped = typedCount(schedule, frame);
  const typed = prompt.slice(0, nTyped);

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
  const streamed = streamedWordCount(tl, frame, words.length);
  const answer = words.slice(0, streamed).join(" ");

  // La camera: una curva sola, inOut, derivata nulla ai due capi. A sinistra
  // per agganciarsi alla fine di CardRelease, a destra perche' la scena si
  // ferma e un'altra ci si possa attaccare. La curva, e la finestra di 132 frame
  // spiegata qui sopra, stanno in products/topics/tracks.ts.
  const pose = poseAt(promptInputTrack(durationInFrames, ratio), frame);

  const focused = frame >= tl.fieldClick;
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
  const attn = interpolate(frame, [tl.attnFrom, tl.attnTo], [1, attnFloor], {
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

  const path = promptInputPath(tl, durationInFrames);

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
      <Cursor path={path} clicks={[tl.fieldClick, sendClick]} frame={frame} />
    </Shot>
  );
};
