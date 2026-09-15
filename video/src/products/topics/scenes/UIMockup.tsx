import React from "react";
import { Assistant } from "../Assistant";
import {
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  COLUMNS,
  addCardY,
  cardY,
  columnX,
  COL_W,
  TOPICS_RIG,
  TOPICS_SLAB,
} from "../geometry";
import { poseAt } from "../../../kit/camera";
import { stageFor } from "../../../kit/stage";
import { uiMockupTrack } from "../tracks";
import { Shot } from "../../../kit/Shot";
import { TOPICS_SHOT_MATERIAL } from "../material";
import {
  AddCard,
  AppChrome,
  AppSidebar,
  CardBox,
  ColumnHeader,
  DetailPanel,
} from "../SlabChrome";

/**
 * UIMockup: app window su piano CSS 3D inclinato, con parallasse su camera move.
 *
 * La grammatica e' quella dei Linear Diffs: una lastra di UI VERA che riempie il
 * quadro, entra da fuori frame, e si stabilizza senza mai tagliare. Il "vera"
 * significa token da topics/tokens.ts, raggi 8/6/4, font di sistema, non un wireframe.
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
 * LA POSA FINALE NON STA PIU' QUI. Le due pose vivono in `products/topics/geometry.ts`
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
  const { durationInFrames, width, height } = useVideoConfig();
  const { ratio } = stageFor(width, height);
  const frame =
    progress === undefined ? localFrame : progress * (durationInFrames - 1);


  // La camera: la lastra entra da destra in 80 frame e la camera si raddrizza
  // per tutta la scena, finendo piu' frontale di come e' partita, cosi' la scena
  // successiva puo' partire da qui. La curva sta in products/topics/tracks.ts, la
  // stessa che leggono i banchi.
  const pose = poseAt(uiMockupTrack(durationInFrames, ratio), frame);

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
      pose={pose}
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
