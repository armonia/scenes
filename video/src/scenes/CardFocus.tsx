import React from "react";
import {
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  CARD_FOCUS_END_POSE,
  CARD_HANDOFF_END_POSE,
  COLUMNS,
  HANDOFF_FROM_COL,
  HANDOFF_FROM_IDX,
  TOPICS_RIG,
  TOPICS_SLAB,
  handoffCard,
  handoffLandedRect,
} from "../primitives/slab";
import { Board } from "../primitives/Board";
import { Shot } from "../kit/Shot";
import { TOPICS_SHOT_MATERIAL } from "../primitives/material";

/**
 * CardFocus: la quarta scena, e il terzo anello della catena.
 *
 * Con tre scene la regola "niente tagli" era una proprieta' di UNA coppia. Con
 * quattro diventa una proprieta' della sequenza, che e' una cosa diversa: una
 * catena si rompe al primo anello che nessuno misura, e finora l'unico anello
 * misurato era UIMockup -> CardHandoff.
 *
 * ENTRA DALLA POSA IN CUI CARDHANDOFF SI FERMA, e disegna la board nello stato
 * in cui quella la lascia: consegna avvenuta, colonna richiusa. Non la ridisegna
 * per conto suo, passa `travel: 1, lift: 0, closeGap: 1` allo STESSO componente
 * `Board`. Il primo frame di questa e' l'ultimo di quella per costruzione, e
 * `seam.sh` lo misura invece di dare per buono che lo sia.
 *
 * LA CAMERA NON INVERTE MAI IL VERSO. Lungo le quattro scene lo yaw va da -18 a
 * -9 a -4 a 0, il pitch da 5 a 2,5 a 1,2 a 0, la spinta da 0 a 48 a 96 a 1494.
 * Tutte e tre le grandezze sono monotone, ed e' la condizione che rende una
 * giunta invisibile anche quando i pixel coincidono: l'occhio segue la derivata
 * del movimento, e un'inversione la legge come uno stacco.
 *
 * IL MACRO E' IL MOTIVO PER CUI LA LASTRA DEVE ESSERE DOM. La camera arriva
 * addosso alla card ingrandendola di due volte e un terzo. Uno screenshot a
 * 1920 a quella scala si sfalda; qui il testo tiene perche' viene rasterizzato
 * alla dimensione finale. Non e' un'opinione, la misura `focus-sharpness.sh`.
 *
 * Frame-locked: ogni valore viene da useCurrentFrame().
 */

export type CardFocusProps = {
  progress?: number;
};

export const CardFocus: React.FC<CardFocusProps> = ({ progress }) => {
  const localFrame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const frame =
    progress === undefined ? localFrame : progress * (durationInFrames - 1);
  const last = durationInFrames - 1;

  // Una curva sola per tutta la scena, come nelle due precedenti. inOut arriva
  // agli estremi con derivata nulla: a sinistra si aggancia alla fine di
  // CardHandoff, che e' ferma, a destra lascia una scena che si puo' mettere
  // prima di qualunque altra.
  const at = (from: number, to: number): number =>
    interpolate(frame, [0, last], [from, to], {
      easing: Easing.inOut(Easing.cubic),
      extrapolateRight: "clamp",
    });

  const yaw = at(CARD_HANDOFF_END_POSE.yaw, CARD_FOCUS_END_POSE.yaw);
  const pitch = at(CARD_HANDOFF_END_POSE.pitch, CARD_FOCUS_END_POSE.pitch);
  const pushZ = at(CARD_HANDOFF_END_POSE.pushZ, CARD_FOCUS_END_POSE.pushZ);
  const slideX = at(CARD_HANDOFF_END_POSE.slideX, CARD_FOCUS_END_POSE.slideX);
  const slideY = at(
    CARD_HANDOFF_END_POSE.slideY ?? 0,
    CARD_FOCUS_END_POSE.slideY ?? 0,
  );

  // La board a consegna avvenuta: sono i tre valori che CardHandoff raggiunge
  // al suo ultimo frame, e la card sta dove dice `handoffLandedRect`.
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

  // Il piano attenuato dietro segue la camera piu' lentamente della lastra: i
  // fattori stanno nel materiale di Topics, uguali per tutte le scene.
  return (
    <Shot
      rig={TOPICS_RIG}
      slab={TOPICS_SLAB}
      material={TOPICS_SHOT_MATERIAL}
      pose={{ yaw, pitch, pushZ, slideX, slideY }}
      backdrop={<Board {...board} dimmed />}
    >
      <Board {...board} />
    </Shot>
  );
};
