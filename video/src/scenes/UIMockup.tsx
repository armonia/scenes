import React from "react";
import { Assistant } from "../primitives/Assistant";
import {
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  COLUMNS,
  UI_MOCKUP_END_POSE,
  UI_MOCKUP_START_POSE,
  addCardY,
  cardY,
  columnX,
  COL_W,
  TOPICS_RIG,
  TOPICS_SLAB,
} from "../primitives/slab";
import { Shot } from "../kit/Shot";
import { TOPICS_SHOT_MATERIAL } from "../primitives/material";
import {
  AddCard,
  AppChrome,
  AppSidebar,
  CardBox,
  ColumnHeader,
  DetailPanel,
} from "../primitives/SlabChrome";

/**
 * UIMockup: app window su piano CSS 3D inclinato, con parallasse su camera move.
 *
 * La grammatica e' quella dei Linear Diffs: una lastra di UI VERA che riempie il
 * quadro, entra da fuori frame, e si stabilizza senza mai tagliare. Il "vera"
 * significa token da theme.ts, raggi 8/6/4, font di sistema, non un wireframe.
 *
 * Tre decisioni strutturali:
 *
 * LA LASTRA ENTRA DA FUORI FRAME. La scena comincia con la finestra a destra del
 * quadro e scivola in posizione con un easing in-out. Cosi' il primo frame non e'
 * una composizione statica: c'e' gia' movimento, e il movimento porta l'occhio.
 *
 * IL PIANO HA SPESSORE. `transformStyle: preserve-3d` + un bordo posteriore
 * simulato con un pseudo-bordo assoluto dietro la lastra. Chi ha visto i Linear
 * commercials sa che e' il bordo inferiore che dice "questo e' un oggetto fisico".
 *
 * LA PROFONDITA' DI CAMPO STACCA I PIANI. Il layer di sfondo e' sfocato e
 * attenuato, la lastra principale e' nitida: la differenza di fuoco dice all'occhio
 * qual e' il piano principale, senza mai spiegarlo.
 *
 * LA POSA FINALE NON STA PIU' QUI. Le due pose vivono in `primitives/slab.ts`
 * perche' `CardHandoff` deve partire esattamente da dove questa finisce, e due
 * copie dello stesso numero restano uguali solo finche' nessuno tocca una delle
 * due. Ora la giunta e' verificabile: `seam.sh` confronta i pixel dell'ultimo
 * frame di questa con il primo frame di quella.
 *
 * Frame-locked: ogni valore deriva da useCurrentFrame(). Nessun CSS keyframe,
 * nessun requestAnimationFrame.
 */

export type UIMockupProps = {
  /** Via di fuga: 0 a 1, per farsi pilotare da una timeline padre. */
  progress?: number;
};

export const UIMockup: React.FC<UIMockupProps> = ({ progress }) => {
  const localFrame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const frame =
    progress === undefined ? localFrame : progress * (durationInFrames - 1);

  const last = durationInFrames - 1;

  // Entrata: la lastra scivola da destra dentro il quadro.
  const slideProgress = interpolate(frame, [0, 80], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const slideX = interpolate(
    slideProgress,
    [0, 1],
    [UI_MOCKUP_START_POSE.slideX, UI_MOCKUP_END_POSE.slideX],
  );

  // La camera ruota lentamente: da piu' inclinata a piu' frontale. Finisce
  // frontale cosi' la scena successiva puo' partire da qui.
  const yaw = interpolate(
    frame,
    [0, last],
    [UI_MOCKUP_START_POSE.yaw, UI_MOCKUP_END_POSE.yaw],
    { easing: Easing.inOut(Easing.quad), extrapolateRight: "clamp" },
  );
  const pitch = interpolate(
    frame,
    [0, last],
    [UI_MOCKUP_START_POSE.pitch, UI_MOCKUP_END_POSE.pitch],
    { easing: Easing.inOut(Easing.quad), extrapolateRight: "clamp" },
  );
  const pushZ = interpolate(
    frame,
    [0, last],
    [UI_MOCKUP_START_POSE.pushZ, UI_MOCKUP_END_POSE.pushZ],
    { easing: Easing.inOut(Easing.quad), extrapolateRight: "clamp" },
  );

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });


  const cardRevealStart = 75;

  return (
    <Shot
      rig={TOPICS_RIG}
      slab={TOPICS_SLAB}
      material={TOPICS_SHOT_MATERIAL}
      pose={{ yaw, pitch, pushZ, slideX, slideY: 0 }}
      opacity={fadeIn}
      backdrop={<SlabBody frame={frame} cardRevealStart={cardRevealStart} dimmed />}
    >
      <SlabBody frame={frame} cardRevealStart={cardRevealStart} />
    </Shot>
  );
};

/**
 * Il corpo della lastra. Le card entrano con stagger: ogni colonna 12 frame
 * dopo la precedente, ogni card 8 dopo quella sopra.
 */
const SlabBody: React.FC<{
  frame: number;
  cardRevealStart: number;
  dimmed?: boolean;
}> = ({ frame, cardRevealStart, dimmed = false }) => (
  <>
    <AppChrome />
    <AppSidebar activeIdx={1} />

    {COLUMNS.map((col, colIdx) => (
      <React.Fragment key={col.name}>
        <ColumnHeader name={col.name} count={col.cards.length} colIdx={colIdx} />

        {col.cards.map((card, cardIdx) => {
          const start = cardRevealStart + colIdx * 12 + cardIdx * 8;
          const p = interpolate(frame, [start, start + 22], [0, 1], {
            easing: Easing.out(Easing.cubic),
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={card.title}
              style={{
                position: "absolute",
                left: columnX(colIdx),
                top: cardY(col.cards, cardIdx),
                width: COL_W,
                opacity: dimmed ? p * 0.5 : p,
                transform: `translateY(${(1 - p) * 20}px)`,
              }}
            >
              <CardBox card={card} />
            </div>
          );
        })}

        <AddCard colIdx={colIdx} y={addCardY(col.cards)} dimmed={dimmed} />
      </React.Fragment>
    ))}

    <DetailPanel />
    <Assistant />
  </>
);
