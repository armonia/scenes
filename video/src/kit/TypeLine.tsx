import React from "react";
import { DEFAULT_TYPE_TIMING, mixColor, wordStates } from "./type";
import type { TypeCue, TypeTiming } from "./type";

export type TypeLineProps = {
  cues: readonly TypeCue[];
  frame: number;
  /** Corpo del testo, in pixel. */
  size: number;
  fontFamily: string;
  color: string;
  accentColor: string;
  weight?: number;
  lineHeight?: number;
  /** Spaziatura fra le lettere, in em (negativa per le frasi grandi). */
  tracking?: number;
  align?: "left" | "center";
  timing?: TypeTiming;
};

/**
 * Una frase del film, con le sue battute.
 *
 * OGNI PAROLA E' UNA CELLA DI GRIGLIA CON DUE COPIE (TYP-04): la parola della
 * frase di prima e quella della frase nuova, sovrapposte nella stessa area. La
 * cella e' larga quanto la piu' larga delle due senza misurare niente in
 * JavaScript, che romperebbe il frame-lock: lo fa la griglia. Lo scambio sposta
 * le due copie in alto sullo stesso tratto, la vecchia esce dal bordo alto e la
 * nuova entra da sotto, con piu' di mezza riga d'aria fra le due.
 *
 * LA MASCHERA E' PIU' ALTA DELLA RIGA (TYP-05), perche' una maschera tagliata
 * all'altezza della riga mangia le discendenti, e la p e la g spariscono prima e
 * leggono come un difetto di rendering. E sporge di 0,08em per lato, compensata
 * con un margine negativo, perche' con la spaziatura stretta l'ultima lettera
 * esce dalla propria scatola.
 *
 * LA PAROLA CHIAVE CRESCE CON UNA SCALA, non con il corpo (TYP-02): il corpo
 * cambia la scatola e la riga si ricompone attorno, la scala no. Cresce dalla
 * linea di base verso l'alto e verso il lato libero della riga, cosi' niente
 * sotto di lei e niente accanto viene toccato.
 */
export const TypeLine: React.FC<TypeLineProps> = ({
  cues,
  frame,
  size,
  fontFamily,
  color,
  accentColor,
  weight = 500,
  lineHeight = 1.08,
  tracking = -0.02,
  align = "center",
  timing = DEFAULT_TYPE_TIMING,
}) => {
  const rows = wordStates(cues, frame, timing);
  const pad = 0.28; // quanto la maschera e' piu' alta della riga, sopra e sotto, in em
  return (
    <div
      style={{
        fontFamily,
        fontSize: size,
        fontWeight: weight,
        lineHeight,
        letterSpacing: `${tracking}em`,
        color,
        textAlign: align,
        display: "flex",
        flexDirection: "column",
        alignItems: align === "center" ? "center" : "flex-start",
      }}
    >
      {rows.map((row, r) => (
        <div key={r} style={{ display: "flex", gap: "0.24em", justifyContent: align === "center" ? "center" : "flex-start" }}>
          {row.map((w, k) => {
            const tint = w.accent > 0 ? mixColor(color, accentColor, w.accent) : color;
            // La parola chiave cresce dalla linea di base verso il lato libero: la
            // prima della riga verso sinistra, l'ultima verso destra, una sola al
            // centro. Cosi' non copre le parole accanto (cueProblems vieta quella in
            // mezzo alla riga).
            const origin = row.length === 1 ? "50% 100%" : k === 0 ? "100% 100%" : "0% 100%";
            return (
              <span
                key={k}
                style={{
                  display: "inline-grid",
                  overflow: "hidden",
                  padding: `${pad}em 0.08em`,
                  margin: `-${pad}em -0.08em`,
                  // La scala della parola chiave sta sulla cella, dalla base.
                  transform: w.scale !== 1 ? `scale(${w.scale})` : undefined,
                  transformOrigin: origin,
                }}
              >
                {w.old !== null ? (
                  <span
                    style={{
                      gridArea: "1 / 1",
                      transform: `translateY(${-w.oldOut * timing.travel * 100}%)`,
                      color,
                    }}
                  >
                    {w.old}
                  </span>
                ) : null}
                <span
                  style={{
                    gridArea: "1 / 1",
                    transform: `translateY(${((1 - w.in) - w.exit) * timing.travel * 100}%)`,
                    color: tint,
                    visibility: w.word === null ? "hidden" : "visible",
                  }}
                >
                  {w.word ?? w.old ?? ""}
                </span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/**
 * TYP-09: il compagno su un altro asse. Ruotato di -90 gradi sul proprio angolo
 * in basso a sinistra, piccolo, con la spaziatura aperta: la stessa frase stesa
 * in orizzontale diventerebbe una didascalia, cioe' una seconda cosa da leggere.
 * Mai sotto i 34 px dal bordo, che e' dove le piattaforme mettono i loro comandi.
 */
export const Companion: React.FC<{
  text: string;
  size: number;
  fontFamily: string;
  color: string;
  opacity: number;
  left: number;
  bottom: number;
}> = ({ text, size, fontFamily, color, opacity, left, bottom }) => (
  <div
    style={{
      position: "absolute",
      left: Math.max(34, left),
      bottom: Math.max(34, bottom),
      transform: "rotate(-90deg)",
      transformOrigin: "0% 100%",
      fontFamily,
      fontSize: size,
      letterSpacing: "0.22em",
      fontVariant: "small-caps",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
      color,
      opacity,
    }}
  >
    {text}
  </div>
);
