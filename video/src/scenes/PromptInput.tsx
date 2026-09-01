import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SLAB_BACKDROP, app, fontStack } from "../theme";
import { Board } from "../primitives/Board";
import { bubbleCurve } from "../primitives/Assistant";
import { Cursor, type Waypoint } from "../primitives/Cursor";
import { typedCount, typingSchedule } from "../primitives/rhythm";
import { SlabEdge, SlabLighting } from "../primitives/SlabChrome";
import {
  CARD_RELEASE_END_POSE,
  COLUMNS,
  COMPOSER_H,
  COMPOSER_X,
  COMPOSER_Y,
  HANDOFF_FROM_COL,
  HANDOFF_FROM_IDX,
  PROMPT_INPUT_END_POSE,
  SEND_H,
  SEND_W,
  SEND_X,
  SEND_Y,
  SLAB_H,
  SLAB_W,
  handoffCard,
  handoffLandedRect,
} from "../primitives/slab";

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

  const schedule = typingSchedule({
    text: prompt,
    startFrame: T.typeStart,
    fps,
    cps: 13,
  });

  const typeEnd = schedule[schedule.length - 1] ?? T.typeStart;
  const nTyped = typedCount(schedule, frame);
  const typed = prompt.slice(0, nTyped);

  const sendTravelStart = typeEnd + T.pauseAfterTyping;
  const sendClick = sendTravelStart + T.travelToSend;
  const bubbleAt = sendClick + 4;
  const thinkAt = bubbleAt + T.bubble;
  const streamAt = thinkAt + T.thinking;

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
  const CAM_SETTLE = 132;

  // Lo streaming va a blocchi di parole, non a caratteri. Un LLM non scrive
  // lettera per lettera: arriva a token, e l'occhio lo riconosce.
  const words = response.split(" ");
  const streamed = Math.max(
    0,
    Math.min(
      words.length,
      Math.floor(
        interpolate(frame, [streamAt, last - 18], [0, words.length], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      ),
    ),
  );
  const answer = words.slice(0, streamed).join(" ");

  // La camera: una curva sola, inOut, derivata nulla ai due capi. A sinistra
  // per agganciarsi alla fine di CardRelease, a destra perche' la scena si
  // ferma e un'altra ci si possa attaccare.
  const at = (from: number, to: number): number =>
    interpolate(frame, [0, CAM_SETTLE], [from, to], {
      easing: Easing.inOut(Easing.cubic),
      extrapolateRight: "clamp",
    });

  const yaw = at(CARD_RELEASE_END_POSE.yaw, PROMPT_INPUT_END_POSE.yaw);
  const pitch = at(CARD_RELEASE_END_POSE.pitch, PROMPT_INPUT_END_POSE.pitch);
  const pushZ = at(CARD_RELEASE_END_POSE.pushZ, PROMPT_INPUT_END_POSE.pushZ);
  const slideX = at(CARD_RELEASE_END_POSE.slideX, PROMPT_INPUT_END_POSE.slideX);
  const slideY = at(
    CARD_RELEASE_END_POSE.slideY ?? 0,
    PROMPT_INPUT_END_POSE.slideY ?? 0,
  );

  const bgYaw = yaw * 0.6;
  const bgSlideX = slideX * 0.45;
  const bgSlideY = slideY * 0.45;

  const focused = frame >= T.clickField;
  // Il caret lampeggia a 15 frame, e il calcolo e' sul frame: nessun keyframe CSS.
  const caretOn = focused && !sent && Math.floor(frame / 15) % 2 === 0;

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
  const attn = interpolate(frame, [streamAt - 6, streamAt + 26], [1, attnFloor], {
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
  // le costanti di slab.ts, non due numeri copiati dal layout: se il composer
  // si sposta il puntatore lo segue.
  const path: Waypoint[] = [
    { x: 2620, y: 1330, at: 0 },
    { x: 2620, y: 1330, at: T.travelStart },
    { x: 1760, y: 1214, at: T.travelStart + 22 },
    { x: COMPOSER_X + 110, y: COMPOSER_Y + COMPOSER_H / 2, at: T.travelEnd },
    { x: COMPOSER_X + 110, y: COMPOSER_Y + COMPOSER_H / 2, at: sendTravelStart },
    { x: SEND_X + SEND_W / 2, y: SEND_Y + SEND_H / 2, at: sendClick },
    // La mano si ritira mentre la risposta scorre. Non e' una gentilezza: al
    // suo posto resterebbe una freccia sull'ultimo fotogramma, e la scena dopo
    // un cursore non ce l'ha, quindi la giunta la mostrerebbe sparire.
    { x: SEND_X + SEND_W / 2, y: SEND_Y + SEND_H / 2, at: streamAt + 16 },
    { x: 2620, y: 1330, at: streamAt + 58 },
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
    <AbsoluteFill style={{ background: app.bg, fontFamily: fontStack }}>
      <AbsoluteFill
        style={{
          perspective: SLAB_BACKDROP.perspective,
          perspectiveOrigin: SLAB_BACKDROP.perspectiveOrigin,
          opacity: SLAB_BACKDROP.opacity,
          filter: `blur(${SLAB_BACKDROP.blur}px)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: (1920 - SLAB_W) / 2 - 180 + bgSlideX,
            top: (1080 - SLAB_H) / 2 - 80 + bgSlideY,
            width: SLAB_W,
            height: SLAB_H,
            transform: `rotateY(${bgYaw + 8}deg) rotateX(${pitch + 4}deg) scale(0.92)`,
            transformOrigin: "50% 50%",
            background: app.surface,
            border: `1px solid ${app.border}`,
            borderRadius: 20,
            overflow: "hidden",
          }}
        >
          <Board {...board} assistant={assistant} boardOpacity={attn} dimmed />
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ perspective: 2600, perspectiveOrigin: "50% 46%" }}>
        {/* Lo spessore, dietro. Fratello e non figlio: la lastra ritaglia, e
            qualunque ritaglio appiattisce il 3D dei suoi figli. */}
        <SlabEdge
          left={(1920 - SLAB_W) / 2 + slideX}
          top={(1080 - SLAB_H) / 2 + slideY}
          pushZ={pushZ}
          yaw={yaw}
          pitch={pitch}
        />
        <div
          style={{
            position: "absolute",
            left: (1920 - SLAB_W) / 2 + slideX,
            top: (1080 - SLAB_H) / 2 + slideY,
            width: SLAB_W,
            height: SLAB_H,
            transform: `translateZ(${pushZ}px) rotateY(${yaw}deg) rotateX(${pitch}deg) scale(1.04)`,
            transformOrigin: "50% 50%",
            transformStyle: "preserve-3d",
            background: app.bg,
            borderRadius: 18,
            border: `1px solid ${app.borderLight}`,
            boxShadow:
              "0 80px 160px rgba(0,0,0,0.78), 0 0 0 1px rgba(255,255,255,0.05) inset",
            overflow: "hidden",
          }}
        >
          <Board {...board} assistant={assistant} boardOpacity={attn} />

          {/* Il cursore sta DENTRO la lastra, quindi prende la stessa
              prospettiva e appoggia sul piano. Uno disegnato sopra il quadro,
              dritto, tradisce subito che la lastra e' un'immagine. */}
          <Cursor path={path} clicks={[T.clickField, sendClick]} />
        </div>
      </AbsoluteFill>

      <SlabLighting />
    </AbsoluteFill>
  );
};
