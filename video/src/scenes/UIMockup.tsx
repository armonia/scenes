import React from "react";
import { Assistant } from "../primitives/Assistant";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SLAB_BACKDROP, app, fontStack } from "../theme";
import {
  COLUMNS,
  SLAB_H,
  SLAB_W,
  UI_MOCKUP_END_POSE,
  UI_MOCKUP_START_POSE,
  addCardY,
  cardY,
  columnX,
  COL_W,
} from "../primitives/slab";
import {
  AddCard,
  AppChrome,
  AppSidebar,
  CardBox,
  ColumnHeader,
  DetailPanel,
  SlabEdge,
  SlabLighting,
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

  // Il layer di sfondo ha un parallasse piu' lento: si muove meno della lastra.
  const bgYaw = yaw * 0.6;
  const bgSlideX = slideX * 0.45;

  const cardRevealStart = 75;

  return (
    <AbsoluteFill
      style={{ background: app.bg, fontFamily: fontStack, opacity: fadeIn }}
    >
      {/* Layer di sfondo: un'altra istanza della stessa UI, sfocata e attenuata. */}
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
            top: (1080 - SLAB_H) / 2 - 80,
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
          <SlabBody frame={frame} cardRevealStart={cardRevealStart} dimmed />
        </div>
      </AbsoluteFill>

      {/* La lastra principale: nitida, frontale, e' il soggetto della scena. */}
      <AbsoluteFill style={{ perspective: 2600, perspectiveOrigin: "50% 46%" }}>
        {/* Lo spessore, dietro. Fratello e non figlio: la lastra ritaglia, e
            qualunque ritaglio appiattisce il 3D dei suoi figli. */}
        <SlabEdge
          left={(1920 - SLAB_W) / 2 + slideX}
          top={(1080 - SLAB_H) / 2}
          pushZ={pushZ}
          yaw={yaw}
          pitch={pitch}
        />
        <div
          style={{
            position: "absolute",
            left: (1920 - SLAB_W) / 2 + slideX,
            top: (1080 - SLAB_H) / 2,
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
          <SlabBody frame={frame} cardRevealStart={cardRevealStart} />

          {/* Spessore sul bordo inferiore: dice "oggetto fisico". */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 3,
              background:
                "linear-gradient(to right, transparent, rgba(255,255,255,0.12) 20%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.12) 80%, transparent)",
            }}
          />
        </div>
      </AbsoluteFill>

      <SlabLighting />
    </AbsoluteFill>
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
