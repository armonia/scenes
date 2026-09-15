import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  COLUMNS,
  HANDOFF_FROM_COL,
  HANDOFF_FROM_IDX,
  handoffCard,
  TOPICS_RIG,
  TOPICS_SLAB,
} from "../geometry";
import { poseAt } from "../../../kit/camera";
import { cardHandoffTrack } from "../tracks";
import { GRAB, RELEASE, cardHandoffMotion } from "../handoff";
import { stageFor } from "../../../kit/stage";
import { Shot } from "../../../kit/Shot";
import { TOPICS_SHOT_MATERIAL } from "../material";
import { Board } from "../Board";
import { Cursor } from "../../../primitives/Cursor";

/**
 * CardHandoff: la terza scena, e quella che rende dimostrabile la regola
 * "niente tagli".
 *
 * Con due scene la regola resta un'affermazione. Due clip che iniziano e
 * finiscono entrambe da ferme si possono mettere in fila in qualsiasi ordine e
 * nessuno vede il taglio, perche' non c'e' movimento da spezzare. Serve una
 * scena che NON parta da ferma: che nasca gia' nella posa in cui la precedente
 * si e' fermata, e che continui il gesto invece di ricominciarlo.
 *
 * IL PRIMO FRAME DI QUESTA E' L'ULTIMO FRAME DI UIMOCKUP. Non "molto simile":
 * identico, perche' entrambe leggono `UI_MOCKUP_END_POSE` dallo stesso modulo e
 * disegnano gli stessi componenti. Ed e' verificabile senza fidarsi: `seam.sh`
 * estrae i due fotogrammi e li confronta pixel per pixel. Se qualcuno cambia la
 * posa in una sola delle due, la misura lo dice.
 *
 * LA CARD VIAGGIA, LA COLONNA NON COLLASSA NELLO STESSO ISTANTE. Il gesto e'
 * quello vero di una board: la card si alza, attraversa, si posa, e solo mentre
 * si posa le card sotto risalgono a chiudere il vuoto. Farle risalire di scatto
 * nel frame dello stacco sarebbe un taglio travestito da animazione, e si vede
 * come un lampo.
 *
 * LA CAMERA CONTINUA IL SUO ARCO. UIMockup va da yaw -18 a -9; questa prosegue
 * da -9 verso -4, cioe' nella stessa direzione e con la stessa curva. Invertire
 * il verso qui leggerebbe come uno stacco anche a giunta perfetta, perche'
 * l'occhio segue la derivata del movimento, non solo la posizione.
 *
 * Frame-locked: ogni valore viene da useCurrentFrame().
 */

export type CardHandoffProps = {
  progress?: number;
};

// I tempi, il percorso della mano e dove sta la card a ogni frame sono in
// products/topics/handoff.ts: li legge anche handoff-travel.sh, e nei rapporti
// verticali la traccia della camera segue la card nella finestra del
// trascinamento.

export const CardHandoff: React.FC<CardHandoffProps> = ({ progress }) => {
  const localFrame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const { ratio } = stageFor(width, height);
  const frame =
    progress === undefined ? localFrame : progress * (durationInFrames - 1);

  // La camera continua l'arco di UIMockup: stessa direzione, stessa curva
  // (products/topics/tracks.ts).
  const pose = poseAt(cardHandoffTrack(durationInFrames, ratio), frame);

  const moving = handoffCard();

  // Colonna di partenza senza la card che vola: l'elenco da cui la board
  // ricalcola gli slot che restano.
  const fromRest = COLUMNS[HANDOFF_FROM_COL]!.cards.filter((_, i) => i !== HANDOFF_FROM_IDX);

  const m = cardHandoffMotion(durationInFrames, frame);
  const { path, cardX, closeGap, lift, tilt, travel } = m;
  const cardY_ = m.cardY;

  // Il terzo anello della catena: la card si riscrive l'eta'.
  const movingNow = m.aged ? { ...moving, age: "ora" } : moving;

  return (
    <Shot
      rig={TOPICS_RIG}
      slab={TOPICS_SLAB}
      material={TOPICS_SHOT_MATERIAL}
      pose={pose}
      backdrop={
        <Board
          closeGap={closeGap}
          travel={travel}
          lift={lift}
          cardX={cardX}
          cardY={cardY_}
          moving={movingNow}
          fromRest={fromRest}
          tilt={tilt}
          handed={m.handed ? 1 : 0}
          statusChanged={m.aged ? 1 : 0}
          dimmed
        />
      }
    >
      <Board
        closeGap={closeGap}
        travel={travel}
        lift={lift}
        cardX={cardX}
        cardY={cardY_}
        moving={movingNow}
        fromRest={fromRest}
        tilt={tilt}
        handed={m.handed ? 1 : 0}
        statusChanged={m.aged ? 1 : 0}
      />

      {/* La mano sta DENTRO la lastra, quindi prende la stessa prospettiva
          e appoggia sul piano. Al primo e all'ultimo frame sta fuori dai
          2400x1200 e l'overflow la taglia: e' cosi' che le due giunte
          restano identiche a scene che un cursore non ce l'hanno. */}
      <Cursor path={path} clicks={[m.T.at(GRAB), m.T.at(RELEASE)]} frame={frame} />
    </Shot>
  );
};

