import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Il cursore che recita.
 *
 * Sta sotto a ogni scena della build list, quindi qui conta l'API piu'
 * dell'effetto: un percorso di waypoint con il frame in cui vanno raggiunti, e
 * una lista di frame in cui scatta il click. Chi la usa descrive la traiettoria,
 * non l'animazione.
 *
 * Due dettagli che sembrano estetici e non lo sono.
 *
 * L'interpolazione fra due waypoint e' con easing in-out, non lineare. Un
 * puntatore che parte e si ferma di colpo legge come un grafico, non come una
 * mano: e' l'accelerazione a monte e la frenata a valle che lo rendono un
 * braccio. Il costo e' una riga.
 *
 * Il click si vede due volte, perche' un click che non lascia traccia sul
 * render passa inosservato a 30 fotogrammi al secondo. C'e' la compressione
 * della freccia, che dura sei frame ed e' quasi subliminale, e c'e' l'anello
 * che si espande e svanisce, che e' la parte che l'occhio prende.
 */

export type Waypoint = { x: number; y: number; at: number };

/**
 * Dove sta il puntatore a un dato frame.
 *
 * ESPORTATA perche' una scena in cui il puntatore TRASCINA qualcosa ha bisogno
 * della sua posizione, non solo del suo disegno: la card che segue la mano sta
 * dove stava la mano tre frame prima, e l'inclinazione esce dalla differenza
 * fra due campioni. Tenuto dentro il componente, quel numero non era
 * raggiungibile e la scena avrebbe dovuto ricalcolarsi il percorso per conto
 * suo - due copie della stessa traiettoria, uguali finche' nessuno tocca una
 * delle due.
 */
export const pointOnPath = (
  path: Waypoint[],
  frame: number,
): { x: number; y: number } => {
  const first = path[0] as Waypoint;
  const last = path[path.length - 1] as Waypoint;
  if (frame <= first.at) return { x: first.x, y: first.y };
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i] as Waypoint;
    const b = path[i + 1] as Waypoint;
    if (frame >= a.at && frame <= b.at) {
      const ease = {
        easing: Easing.inOut(Easing.cubic),
        extrapolateLeft: "clamp" as const,
        extrapolateRight: "clamp" as const,
      };
      return {
        x: interpolate(frame, [a.at, b.at], [a.x, b.x], ease),
        y: interpolate(frame, [a.at, b.at], [a.y, b.y], ease),
      };
    }
  }
  return { x: last.x, y: last.y };
};

export type CursorProps = {
  /** I punti da toccare, in coordinate della scena, ciascuno col suo frame. */
  path: Waypoint[];
  /** I frame in cui parte un click. */
  clicks?: number[];
  /**
   * Via di fuga: 0 a 1. Se c'e', pilota la primitiva al posto del clock, cosi'
   * una timeline padre puo' guidarla. Se manca, il frame se lo prende da se'.
   */
  progress?: number;
  size?: number;
};

const CLICK_LEN = 20;

export const Cursor: React.FC<CursorProps> = ({
  path,
  clicks = [],
  progress,
  size = 34,
}) => {
  const localFrame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const frame =
    progress === undefined ? localFrame : progress * (durationInFrames - 1);

  if (path.length === 0) return null;

  const { x, y } = pointOnPath(path, frame);

  // Il click piu' recente ancora dentro la sua finestra.
  const active = clicks
    .filter((c) => frame >= c && frame < c + CLICK_LEN)
    .pop();

  const age = active === undefined ? -1 : frame - active;

  const press =
    age >= 0 && age < 7
      ? interpolate(age, [0, 3, 7], [1, 0.84, 1], {
          easing: Easing.inOut(Easing.quad),
          extrapolateRight: "clamp",
        })
      : 1;

  const ringR =
    age >= 0
      ? interpolate(age, [0, CLICK_LEN], [4, 44], {
          easing: Easing.out(Easing.cubic),
          extrapolateRight: "clamp",
        })
      : 0;

  const ringO =
    age >= 0
      ? interpolate(age, [0, CLICK_LEN], [0.55, 0], {
          easing: Easing.out(Easing.quad),
          extrapolateRight: "clamp",
        })
      : 0;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 0,
        height: 0,
        pointerEvents: "none",
        // SOPRA TUTTO. La card in viaggio sta a zIndex 10, e senza questo la
        // mano finiva sotto l'oggetto che stava trascinando: si vedeva la card
        // muoversi da sola e il puntatore ricomparire quando la lasciava.
        zIndex: 20,
      }}
    >
      {age >= 0 ? (
        <svg
          width={110}
          height={110}
          viewBox="-55 -55 110 110"
          style={{ position: "absolute", left: -55, top: -55 }}
        >
          <circle
            cx={0}
            cy={0}
            r={ringR}
            fill="none"
            stroke="#ffffff"
            strokeWidth={2}
            opacity={ringO}
          />
        </svg>
      ) : null}

      <svg
        width={size}
        height={size * 1.5}
        viewBox="0 0 24 36"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: `scale(${press})`,
          transformOrigin: "0px 0px",
          filter: "drop-shadow(0 3px 7px rgba(0,0,0,0.55))",
        }}
      >
        {/* La freccia di macOS: punta in alto a sinistra, coda a destra. */}
        <path
          d="M2,1.6 L2,25.4 L7.6,20.1 L11.5,28.8 L15.6,27 L11.8,18.6 L19,18.2 Z"
          fill="#ffffff"
          stroke="rgba(0,0,0,0.72)"
          strokeWidth={1.3}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
