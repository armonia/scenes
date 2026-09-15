import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { cssPerspectiveOrigin } from "../kit/rig";
import type { Ratio } from "../kit/stage";
import { cam06Expectation, specimenGeometry } from "./list";
import type { SpecimenProduct } from "./list";
import { AnchorMarker, ProbeSlab } from "../products/probe/Slab";
import { Board } from "../primitives/Board";
import {
  COLUMNS,
  HANDOFF_FROM_COL,
  HANDOFF_FROM_IDX,
  handoffCard,
  handoffLandedRect,
} from "../primitives/slab";
import { app, fontStack } from "../theme";

/**
 * CAM-06 fuori da Topics: il punto che non scappa, su due lastre e tre rapporti.
 *
 * La camera sta frontale (yaw e pitch a zero, dove centreOn e' esatto), la
 * lastra e' spostata una volta sola perche' il centro del bersaglio cada
 * sull'origine della prospettiva, e poi la spinta in Z la ingrandisce. Se la
 * geometria e' giusta il segno magenta sul bersaglio non si muove di un pixel
 * mentre tutto il resto scappa verso i bordi. `drift.py` lo misura sul render.
 *
 * DUE PROPS PER I CONTROLLI NEGATIVI, e servono proprio perche' il banco li
 * deve bocciare in ogni variante:
 * - `compensate: false` toglie lo spostamento, e il bersaglio parte gia' fuori
 *   posto e scappa;
 * - `originMismatch: true` lascia lo spostamento calcolato sul 46% ma mette nel
 *   CSS 50% 50%. E' l'incidente che la grammatica racconta: numeri giusti per
 *   un'origine, applicati a un'altra.
 *
 * Specimen, non scena: niente piano dietro, niente bordo, niente luce. C'e'
 * solo la geometria che la voce afferma, cosi' se il banco boccia non ci sono
 * altri sospettati.
 */

export type SpecimenCam06Props = {
  product: SpecimenProduct;
  ratio: Ratio;
  compensate?: boolean;
  originMismatch?: boolean;
};

export const SpecimenCam06: React.FC<SpecimenCam06Props> = ({
  product,
  ratio,
  compensate = true,
  originMismatch = false,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const g = specimenGeometry(product, ratio);
  const e = cam06Expectation(product, ratio);

  const push = interpolate(frame, [0, durationInFrames - 1], [0, e.pushEnd], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateRight: "clamp",
  });
  const slide = compensate ? e.slide : { slideX: 0, slideY: 0 };
  const origin = originMismatch ? "50% 50%" : cssPerspectiveOrigin(g.rig);
  const cx = g.anchor.x + g.anchor.w / 2;
  const cy = g.anchor.y + g.anchor.h / 2;

  return (
    <AbsoluteFill style={{ background: "#0d0e12", fontFamily: fontStack }}>
      <AbsoluteFill
        style={{ perspective: g.rig.perspective, perspectiveOrigin: origin }}
      >
        <div
          style={{
            position: "absolute",
            left: (g.stage.w - g.slab.w) / 2 + slide.slideX,
            top: (g.stage.h - g.slab.h) / 2 + slide.slideY,
            width: g.slab.w,
            height: g.slab.h,
            transform: `translateZ(${push}px) scale(${g.rig.slabScale})`,
            transformOrigin: "50% 50%",
            background: product === "topics" ? app.bg : undefined,
            borderRadius: 18,
            overflow: "hidden",
          }}
        >
          {product === "topics" ? <TopicsDelivered /> : <ProbeSlab />}
          <AnchorMarker x={cx} y={cy} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** La board di Topics a consegna avvenuta: lo stato in cui CardFocus la inquadra. */
const TopicsDelivered: React.FC = () => {
  const landed = handoffLandedRect();
  return (
    <Board
      closeGap={1}
      travel={1}
      lift={0}
      cardX={landed.x}
      cardY={landed.y}
      moving={handoffCard()}
      fromRest={COLUMNS[HANDOFF_FROM_COL]!.cards.filter(
        (_, i) => i !== HANDOFF_FROM_IDX,
      )}
    />
  );
};
