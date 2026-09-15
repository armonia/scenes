import React from "react";
import {
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  BOARD_ORBIT_END_POSE,
  COLUMNS,
  HANDOFF_FROM_COL,
  HANDOFF_FROM_IDX,
  PROMPT_INPUT_END_POSE,
  handoffCard,
  handoffLandedRect,
  TOPICS_RIG,
  TOPICS_SLAB,
} from "../primitives/slab";
import { Shot } from "../kit/Shot";
import { TOPICS_SHOT_MATERIAL } from "../primitives/material";
import { Board } from "../primitives/Board";
import { tempo } from "../primitives/tempo";

/**
 * BoardOrbit: il sesto anello, e la fine del film.
 *
 * La camera lascia il composer e gira attorno alla lastra quanto basta a
 * mostrarle un bordo. Serve perche' un pezzo che finisce addosso a un dettaglio
 * resta aperto, e perche' finora la lastra non aveva mai dichiarato di essere
 * un oggetto: frontale, un piano inclinato con dentro della UI e'
 * indistinguibile da una carta da parati incollata sul fondo. E' l'unica cosa
 * che un film di prodotto dice una volta sola, all'inizio o alla fine.
 *
 * LO SPESSORE ESISTE SOLO PERCHE' LA CAMERA GIRA. Lo disegna `kit/Shot.tsx` in tutte e
 * cinque le scene precedenti, e in nessuna si vede: a yaw piccoli sta esattamente
 * dietro la lastra. Qui sporge, ed e' il motivo per cui e' stato scritto.
 *
 * L'ATTENUAZIONE SI RIAPRE. Il primo fotogramma la trova a 0,62, che e' dove
 * PromptInput l'ha lasciata, e la riporta a 1 lungo l'orbita: la risposta e'
 * finita, l'attenzione torna all'oggetto intero. Partire da 1 avrebbe rotto la
 * giunta di piu' di quanto qualunque posa possa fare.
 *
 * LA CAMERA SI FERMA PRIMA DELLA FINE, a f118 su 150. Gli ultimi trenta
 * fotogrammi sono fermi, cosi' il pezzo finisce su una posa e non su un
 * movimento interrotto, e un'altra scena potrebbe attaccarsi qui.
 *
 * Frame-locked: ogni valore viene da useCurrentFrame().
 */

export type BoardOrbitProps = {
  progress?: number;
};

/** La durata di riferimento a cui e' scritto SETTLE. Vedi primitives/tempo.ts. */
const BASE = 150;

/** Il frame in cui la camera arriva e si ferma. */
const SETTLE = 118;

export const BoardOrbit: React.FC<BoardOrbitProps> = ({ progress }) => {
  const localFrame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const frame =
    progress === undefined ? localFrame : progress * (durationInFrames - 1);

  const T = tempo(durationInFrames, BASE);

  const at = (from: number, to: number): number =>
    interpolate(frame, [0, T.at(SETTLE)], [from, to], {
      easing: Easing.inOut(Easing.cubic),
      extrapolateRight: "clamp",
    });

  const yaw = at(PROMPT_INPUT_END_POSE.yaw, BOARD_ORBIT_END_POSE.yaw);
  const pitch = at(PROMPT_INPUT_END_POSE.pitch, BOARD_ORBIT_END_POSE.pitch);
  const pushZ = at(PROMPT_INPUT_END_POSE.pushZ, BOARD_ORBIT_END_POSE.pushZ);
  const slideX = at(PROMPT_INPUT_END_POSE.slideX, BOARD_ORBIT_END_POSE.slideX);
  const slideY = at(
    PROMPT_INPUT_END_POSE.slideY ?? 0,
    BOARD_ORBIT_END_POSE.slideY ?? 0,
  );

  // Il quadro si riapre: 0,62 e' dove PromptInput ha lasciato l'attenuazione.
  const attn = at(0.62, 1);


  // La board sta come l'hanno lasciata le scene prima: consegna avvenuta, e il
  // thread con la risposta gia' arrivata per intero.
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
    moving: { ...moving, age: "ora" },
    fromRest,
  };

  const assistant = {
    sent: true,
    sentPrompt: "Rifai il flusso di auth e apri la PR",
    answer:
      "Trovati tre punti di chiamata in server/auth.ts. Sposto il refresh del token dentro un guard solo, poi apro la PR su topics/auth-refresh.",
    frame,
    attn,
  };


  return (
    <Shot
      rig={TOPICS_RIG}
      slab={TOPICS_SLAB}
      material={TOPICS_SHOT_MATERIAL}
      pose={{ yaw, pitch, pushZ, slideX, slideY }}
      highlight={false}
      backdrop={<Board {...board} assistant={assistant} boardOpacity={attn} dimmed />}
    >
      <Board {...board} assistant={assistant} boardOpacity={attn} />
    </Shot>
  );
};
