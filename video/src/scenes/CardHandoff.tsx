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
  CARD_HANDOFF_END_POSE,
  COLUMNS,
  SLAB_H,
  SLAB_W,
  UI_MOCKUP_END_POSE,
  HANDOFF_FROM_COL,
  HANDOFF_FROM_IDX,
  HANDOFF_TO_COL,
  cardY,
  columnX,
  handoffCard,
  handoffTargetCards,
} from "../primitives/slab";
import { SlabLighting } from "../primitives/SlabChrome";
import { Board } from "../primitives/Board";

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

// I tempi. La card parte dopo un respiro, cosi' l'occhio ha il tempo di
// riconoscere la board come la stessa di prima: se si muovesse al frame 0, la
// giunta sarebbe corretta ma illeggibile.
const LIFT_START = 26;
const LIFT_END = 44;
const TRAVEL_START = 38;
const TRAVEL_END = 118;
const SETTLE_END = 140;

export const CardHandoff: React.FC<CardHandoffProps> = ({ progress }) => {
  const localFrame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const frame =
    progress === undefined ? localFrame : progress * (durationInFrames - 1);
  const last = durationInFrames - 1;

  // La camera continua l'arco di UIMockup: stessa direzione, stessa curva.
  const yaw = interpolate(frame, [0, last], [UI_MOCKUP_END_POSE.yaw, CARD_HANDOFF_END_POSE.yaw], {
    easing: Easing.inOut(Easing.quad),
    extrapolateRight: "clamp",
  });
  const pitch = interpolate(frame, [0, last], [UI_MOCKUP_END_POSE.pitch, CARD_HANDOFF_END_POSE.pitch], {
    easing: Easing.inOut(Easing.quad),
    extrapolateRight: "clamp",
  });
  const pushZ = interpolate(frame, [0, last], [UI_MOCKUP_END_POSE.pushZ, CARD_HANDOFF_END_POSE.pushZ], {
    easing: Easing.inOut(Easing.quad),
    extrapolateRight: "clamp",
  });

  // NESSUN fade-in. Un fade da nero all'inizio sarebbe un taglio con le buone
  // maniere: il primo frame deve essere gia' pieno, identico all'ultimo di prima.
  const bgYaw = yaw * 0.6;

  const moving = handoffCard();

  // Colonna di partenza senza la card che vola, colonna di arrivo con la card
  // in coda: sono gli elenchi da cui si calcolano le due posizioni di slot.
  const fromRest = COLUMNS[HANDOFF_FROM_COL]!.cards.filter((_, i) => i !== HANDOFF_FROM_IDX);
  const toWith = handoffTargetCards();

  const x0 = columnX(HANDOFF_FROM_COL);
  const y0 = cardY(COLUMNS[HANDOFF_FROM_COL]!.cards, HANDOFF_FROM_IDX);
  const x1 = columnX(HANDOFF_TO_COL);
  const y1 = cardY(toWith, toWith.length - 1);

  // Il sollevamento: sale e poi si riposa. Due interpolazioni distinte perche'
  // l'oggetto si stacca in fretta e si appoggia piano, come una mano vera.
  const lift =
    frame < TRAVEL_END
      ? interpolate(frame, [LIFT_START, LIFT_END], [0, 1], {
          easing: Easing.out(Easing.cubic),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : interpolate(frame, [TRAVEL_END, SETTLE_END], [1, 0], {
          easing: Easing.inOut(Easing.quad),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  const travel = interpolate(frame, [TRAVEL_START, TRAVEL_END], [0, 1], {
    easing: Easing.bezier(0.5, 0, 0.2, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // L'arco: la card non scorre in linea retta, si alza di 34px a meta' tragitto.
  // Una traslazione rettilinea legge come un oggetto trascinato su un tavolo,
  // non come uno preso in mano.
  const arc = Math.sin(travel * Math.PI) * 34;

  const cardX = interpolate(travel, [0, 1], [x0, x1]);
  const cardY_ = interpolate(travel, [0, 1], [y0, y1]) - arc - lift * 10;

  // Le card sotto risalgono mentre quella sopra si sta gia' posando, non prima.
  const closeGap = interpolate(frame, [TRAVEL_END - 34, SETTLE_END], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
            left: (1920 - SLAB_W) / 2 - 180,
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
          <Board
            closeGap={closeGap}
            travel={travel}
            lift={lift}
            cardX={cardX}
            cardY={cardY_}
            moving={moving}
            fromRest={fromRest}
            dimmed
          />
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ perspective: 2600, perspectiveOrigin: "50% 46%" }}>
        <div
          style={{
            position: "absolute",
            left: (1920 - SLAB_W) / 2,
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
          <Board
            closeGap={closeGap}
            travel={travel}
            lift={lift}
            cardX={cardX}
            cardY={cardY_}
            moving={moving}
            fromRest={fromRest}
          />

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

