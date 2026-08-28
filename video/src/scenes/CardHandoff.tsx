import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { app, fontStack } from "../theme";
import {
  COLUMNS,
  COL_W,
  Card,
  SLAB_H,
  SLAB_W,
  UI_MOCKUP_END_POSE,
  addCardY,
  cardY,
  columnX,
} from "../primitives/slab";
import {
  AddCard,
  AppChrome,
  AppSidebar,
  CardBox,
  ColumnHeader,
  DetailPanel,
  SlabLighting,
} from "../primitives/SlabChrome";

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

/** L'indice della card che si muove: "Metriche latenza p99", In corso -> In review. */
const FROM_COL = 1;
const FROM_IDX = 1;
const TO_COL = 2;

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
  const yaw = interpolate(frame, [0, last], [UI_MOCKUP_END_POSE.yaw, -4], {
    easing: Easing.inOut(Easing.quad),
    extrapolateRight: "clamp",
  });
  const pitch = interpolate(frame, [0, last], [UI_MOCKUP_END_POSE.pitch, 1.2], {
    easing: Easing.inOut(Easing.quad),
    extrapolateRight: "clamp",
  });
  const pushZ = interpolate(frame, [0, last], [UI_MOCKUP_END_POSE.pushZ, 96], {
    easing: Easing.inOut(Easing.quad),
    extrapolateRight: "clamp",
  });

  // NESSUN fade-in. Un fade da nero all'inizio sarebbe un taglio con le buone
  // maniere: il primo frame deve essere gia' pieno, identico all'ultimo di prima.
  const bgYaw = yaw * 0.6;

  const moving = COLUMNS[FROM_COL]!.cards[FROM_IDX] as Card;

  // Colonna di partenza senza la card che vola, colonna di arrivo con la card
  // in coda: sono gli elenchi da cui si calcolano le due posizioni di slot.
  const fromRest = COLUMNS[FROM_COL]!.cards.filter((_, i) => i !== FROM_IDX);
  const toWith = [...COLUMNS[TO_COL]!.cards, moving];

  const x0 = columnX(FROM_COL);
  const y0 = cardY(COLUMNS[FROM_COL]!.cards, FROM_IDX);
  const x1 = columnX(TO_COL);
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
          perspective: 3200,
          perspectiveOrigin: "50% 46%",
          opacity: 0.45,
          filter: "blur(14px)",
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

type BoardProps = {
  closeGap: number;
  travel: number;
  lift: number;
  cardX: number;
  cardY: number;
  moving: Card;
  fromRest: Card[];
  dimmed?: boolean;
};

const Board: React.FC<BoardProps> = ({
  closeGap,
  travel,
  lift,
  cardX,
  cardY: movingY,
  moving,
  fromRest,
  dimmed = false,
}) => {
  const op = dimmed ? 0.5 : 1;

  return (
    <>
      <AppChrome />
      <AppSidebar activeIdx={1} />

      {COLUMNS.map((col, colIdx) => {
        // I contatori cambiano a meta' tragitto, quando la card ha "lasciato"
        // la colonna di partenza: e' il momento in cui una board vera aggiorna
        // il numero, non allo stacco e non all'atterraggio.
        const handedOver = travel >= 0.5 ? 1 : 0;
        const count =
          colIdx === FROM_COL
            ? col.cards.length - handedOver
            : colIdx === TO_COL
              ? col.cards.length + handedOver
              : col.cards.length;

        return (
          <React.Fragment key={col.name}>
            <ColumnHeader
              name={col.name}
              count={count}
              colIdx={colIdx}
              highlight={colIdx === TO_COL ? travel : 0}
            />

            {col.cards.map((card, cardIdx) => {
              // La card che vola e' disegnata a parte, sopra tutto.
              if (colIdx === FROM_COL && cardIdx === FROM_IDX) return null;

              let y = cardY(col.cards, cardIdx);

              // Nella colonna di partenza, le card sotto quella andata via
              // risalgono per chiudere il vuoto, ma solo mentre l'altra si posa.
              if (colIdx === FROM_COL && cardIdx > FROM_IDX) {
                const restIdx = cardIdx - 1;
                const yClosed = cardY(fromRest, restIdx);
                y = interpolate(closeGap, [0, 1], [y, yClosed]);
              }

              return (
                <div
                  key={card.title}
                  style={{
                    position: "absolute",
                    left: columnX(colIdx),
                    top: y,
                    width: COL_W,
                    opacity: op,
                  }}
                >
                  <CardBox card={card} />
                </div>
              );
            })}

            <AddCard
              colIdx={colIdx}
              y={
                colIdx === FROM_COL
                  ? interpolate(
                      closeGap,
                      [0, 1],
                      [addCardY(col.cards), addCardY(fromRest)],
                    )
                  : colIdx === TO_COL
                    ? interpolate(
                        travel,
                        [0, 1],
                        [
                          addCardY(col.cards),
                          addCardY([...col.cards, moving]),
                        ],
                      )
                    : addCardY(col.cards)
              }
              dimmed={dimmed}
            />
          </React.Fragment>
        );
      })}

      <DetailPanel
        title={moving.title}
        rows={[
          { label: "Status", value: travel >= 0.5 ? "In review" : "In corso" },
          { label: "Priority", value: "P1" },
          { label: "Branch", value: "topics/latency-p99" },
          { label: "Assignee", value: "Agent" },
        ]}
        description="La card cambia colonna senza un taglio: si alza, attraversa in arco, si posa, e solo mentre si posa la colonna sotto si richiude."
      />

      {/* La card in viaggio: fuori dal flusso, sopra tutto, con l'ombra che
          cresce mentre si stacca dal piano. */}
      <div
        style={{
          position: "absolute",
          left: cardX,
          top: movingY,
          width: COL_W,
          opacity: op,
          transform: `scale(${1 + lift * 0.035})`,
          transformOrigin: "50% 50%",
          zIndex: 10,
        }}
      >
        <CardBox card={moving} lifted={lift} />
      </div>
    </>
  );
};
