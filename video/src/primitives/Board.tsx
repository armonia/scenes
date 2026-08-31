import React from "react";
import { Assistant, type AssistantProps } from "./Assistant";
import { interpolate } from "remotion";
import {
  COLUMNS,
  COL_W,
  Card,
  HANDOFF_FROM_COL,
  HANDOFF_FROM_IDX,
  HANDOFF_TO_COL,
  addCardY,
  cardY,
  columnX,
} from "./slab";
import {
  AddCard,
  AppChrome,
  AppSidebar,
  CardBox,
  ColumnHeader,
  DetailPanel,
} from "./SlabChrome";

/**
 * La board disegnata una volta per tutte le scene che la mostrano.
 *
 * Stava dentro `CardHandoff.tsx`, ed e' rimasta li' finche' era una scena sola
 * a mostrarla in quello stato. `CardFocus` entra dalla posa in cui CardHandoff
 * si ferma, quindi deve disegnare la board ESATTAMENTE come la lascia: non
 * "uguale", la stessa. Copiarla avrebbe reso la giunta vera solo finche'
 * qualcuno teneva allineate due copie a mano, che e' precisamente la cosa che
 * `primitives/slab.ts` esiste per impedire.
 *
 * I parametri sono lo stato del gesto, non il gesto: passando travel 1, lift 0
 * e closeGap 1 si ottiene la board a consegna avvenuta, che e' il primo frame
 * della scena dopo.
 */
export type BoardProps = {
  closeGap: number;
  travel: number;
  lift: number;
  cardX: number;
  cardY: number;
  moving: Card;
  fromRest: Card[];
  dimmed?: boolean;
  /** Inclinazione della card in viaggio, in gradi. Proporzionale alla velocita'. */
  tilt?: number;
  /**
   * I due anelli della catena di conseguenze, separati dall'evento che li
   * causa e separati fra loro. Assenti, scattano insieme a meta' tragitto, che
   * e' quello che facevano prima: tre cose che cambiano sullo stesso frame non
   * leggono come una causa, leggono come tre cose scollegate.
   */
  handed?: number;
  statusChanged?: number;
  /**
   * CAM-05: quanto resta acceso cio' che non e' il soggetto. 1 = tutto acceso.
   * Attenua la meta' kanban e NON l'assistente, perche' quando questo valore
   * scende il soggetto sta li' sotto.
   */
  boardOpacity?: number;
  /** Lo stato del pannello assistente. Assente = a riposo, campo vuoto. */
  assistant?: AssistantProps;
};

export const Board: React.FC<BoardProps> = ({
  closeGap,
  travel,
  lift,
  cardX,
  cardY: movingY,
  moving,
  fromRest,
  dimmed = false,
  tilt = 0,
  handed,
  statusChanged,
  boardOpacity = 1,
  assistant,
}) => {
  const handedOver = handed ?? (travel >= 0.5 ? 1 : 0);
  const statusOver = statusChanged ?? (travel >= 0.5 ? 1 : 0);
  const op = dimmed ? 0.5 : 1;

  return (
    <>
      {/* La meta' bassa della lastra. La disegnano tutte le scene, se no la
          giunta con PromptInput mostra meta' schermo che compare dal niente. */}
      <Assistant {...assistant} dimmed={dimmed} />

      <div style={{ position: "absolute", inset: 0, opacity: boardOpacity }}>
      <AppChrome />
      <AppSidebar activeIdx={1} />

      {COLUMNS.map((col, colIdx) => {
        const count =
          colIdx === HANDOFF_FROM_COL
            ? col.cards.length - handedOver
            : colIdx === HANDOFF_TO_COL
              ? col.cards.length + handedOver
              : col.cards.length;

        return (
          <React.Fragment key={col.name}>
            <ColumnHeader
              name={col.name}
              count={count}
              colIdx={colIdx}
              highlight={colIdx === HANDOFF_TO_COL ? travel : 0}
            />

            {col.cards.map((card, cardIdx) => {
              // La card che vola e' disegnata a parte, sopra tutto.
              if (colIdx === HANDOFF_FROM_COL && cardIdx === HANDOFF_FROM_IDX) return null;

              let y = cardY(col.cards, cardIdx);

              // Nella colonna di partenza, le card sotto quella andata via
              // risalgono per chiudere il vuoto, ma solo mentre l'altra si posa.
              if (colIdx === HANDOFF_FROM_COL && cardIdx > HANDOFF_FROM_IDX) {
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
                colIdx === HANDOFF_FROM_COL
                  ? interpolate(
                      closeGap,
                      [0, 1],
                      [addCardY(col.cards), addCardY(fromRest)],
                    )
                  : colIdx === HANDOFF_TO_COL
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
          { label: "Status", value: statusOver ? "In review" : "In corso" },
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
          transform: `scale(${1 + lift * 0.035}) rotate(${tilt.toFixed(2)}deg)`,
          transformOrigin: "50% 50%",
          zIndex: 10,
        }}
      >
        <CardBox card={moving} lifted={lift} />
      </div>
      </div>
    </>
  );
};
