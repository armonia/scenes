import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SLAB_BACKDROP, app, fontStack } from "../theme";
import {
  BOARD_ORBIT_END_POSE,
  COLUMNS,
  HANDOFF_FROM_COL,
  HANDOFF_FROM_IDX,
  PROMPT_INPUT_END_POSE,
  SLAB_H,
  SLAB_W,
  handoffCard,
  handoffLandedRect,
} from "../primitives/slab";
import { SlabEdge, SlabLighting } from "../primitives/SlabChrome";
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
 * LO SPESSORE ESISTE SOLO PERCHE' LA CAMERA GIRA. `SlabEdge` sta in tutte e
 * cinque le scene precedenti e in nessuna si vede: a yaw piccoli sta esattamente
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

  const bgYaw = yaw * 0.6;
  const bgSlideX = slideX * 0.45;
  const bgSlideY = slideY * 0.45;

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

  const left = (1920 - SLAB_W) / 2 + slideX;
  const top = (1080 - SLAB_H) / 2 + slideY;

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
        <SlabEdge left={left} top={top} pushZ={pushZ} yaw={yaw} pitch={pitch} />

        <div
          style={{
            position: "absolute",
            left,
            top,
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
        </div>
      </AbsoluteFill>

      <SlabLighting />
    </AbsoluteFill>
  );
};
