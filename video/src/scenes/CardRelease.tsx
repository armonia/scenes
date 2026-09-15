import React from "react";
import {
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  CARD_FOCUS_END_POSE,
  CARD_RELEASE_END_POSE,
  COLUMNS,
  HANDOFF_FROM_COL,
  HANDOFF_FROM_IDX,
  handoffCard,
  handoffLandedRect,
  TOPICS_RIG,
  TOPICS_SLAB,
} from "../primitives/slab";
import { Shot } from "../kit/Shot";
import { TOPICS_SHOT_MATERIAL } from "../primitives/material";
import { Board } from "../primitives/Board";

/**
 * CardRelease: il quarto anello, e la fine del film.
 *
 * La camera si stacca dalla card e torna larga e frontale, con la board di
 * nuovo tutta leggibile. Serve perche' un piano sequenza deve finire da
 * qualche parte, e finire addosso a un dettaglio lascia il pezzo aperto.
 *
 * QUESTA SCENA INVERTE LA SPINTA, ed e' l'unica. Altrove il repo sostiene che
 * un'inversione a una giunta si legge come uno stacco anche a pixel
 * coincidenti, il che e' vero dove la giunta e' in MOVIMENTO: li' l'occhio
 * segue la derivata. Qui i due lati sono fermi, CardFocus arriva a derivata
 * nulla e questa riparte da derivata nulla, quindi non c'e' nessuna derivata da
 * rovesciare. E' la stessa ragione per cui due scene ferme agli estremi si
 * possono mettere in qualunque ordine, e adesso `rest-point.sh` la misura
 * invece di lasciarla scritta.
 *
 * LA BOARD E' QUELLA A CONSEGNA AVVENUTA, come in CardFocus e per lo stesso
 * motivo: e' lo stesso componente con gli stessi valori, quindi il primo frame
 * di questa e' l'ultimo di quella per costruzione.
 *
 * Frame-locked: ogni valore viene da useCurrentFrame().
 */

export type CardReleaseProps = {
  progress?: number;
};

export const CardRelease: React.FC<CardReleaseProps> = ({ progress }) => {
  const localFrame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const frame =
    progress === undefined ? localFrame : progress * (durationInFrames - 1);
  const last = durationInFrames - 1;

  // Una curva sola, inOut: derivata nulla a sinistra per agganciarsi alla fine
  // di CardFocus, derivata nulla a destra perche' e' l'ultimo frame del film.
  const at = (from: number, to: number): number =>
    interpolate(frame, [0, last], [from, to], {
      easing: Easing.inOut(Easing.cubic),
      extrapolateRight: "clamp",
    });

  const yaw = at(CARD_FOCUS_END_POSE.yaw, CARD_RELEASE_END_POSE.yaw);
  const pitch = at(CARD_FOCUS_END_POSE.pitch, CARD_RELEASE_END_POSE.pitch);
  const pushZ = at(CARD_FOCUS_END_POSE.pushZ, CARD_RELEASE_END_POSE.pushZ);
  const slideX = at(CARD_FOCUS_END_POSE.slideX, CARD_RELEASE_END_POSE.slideX);
  const slideY = at(
    CARD_FOCUS_END_POSE.slideY ?? 0,
    CARD_RELEASE_END_POSE.slideY ?? 0,
  );


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
