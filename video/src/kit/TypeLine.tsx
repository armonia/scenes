import React from "react";
import { DEFAULT_TYPE_TIMING, cueAt, mixColor, wordStates } from "./type";
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
 * OGNI PAROLA E' UNA CELLA CON DUE COPIE (TYP-04): la parola della frase di
 * prima e quella della frase nuova, sovrapposte. Lo scambio sposta le due copie
 * in alto sullo stesso tratto, la vecchia esce dal bordo alto e la nuova entra da
 * sotto, con piu' di mezza riga d'aria fra le due.
 *
 * LA CELLA PASSA DALLA LARGHEZZA DELLA VECCHIA A QUELLA DELLA NUOVA, senza
 * misurare niente in JavaScript. La larghezza la danno due copie invisibili
 * affiancate, la vecchia che scende di corpo da `size` a zero e la nuova che sale
 * da zero a `size`: la larghezza di un testo e' proporzionale al corpo, quindi la
 * cella e' esattamente la media pesata delle due. La prima versione era una
 * griglia con le due copie nella stessa area, larga quanto la piu' larga: finito
 * lo scambio "una" -> "un", fra "un" e "lavoro." restava il buco di una lettera.
 *
 * LA MASCHERA E' PIU' ALTA DELLA RIGA (TYP-05), perche' una maschera tagliata
 * all'altezza della riga mangia le discendenti, e la p e la g spariscono prima e
 * leggono come un difetto di rendering. Sporge di 0,28em sopra la prima riga e
 * sotto l'ultima, ma solo di 0,06em fra due righe: con 0,28em anche li', la
 * parola che usciva dalla seconda riga passava sopra la base della prima
 * ("una richiesta." su "Arriva", nel 4:5). 0,06em basta alle discendenti di un
 * carattere normale, che a interlinea 1,08 escono dalla riga di circa 0,04em. E
 * sporge di 0,08em per lato, compensata con un margine negativo, perche' con la
 * spaziatura stretta l'ultima lettera esce dalla propria scatola.
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
  const pad = 0.28; // quanto la maschera sporge sopra la prima riga e sotto l'ultima, in em
  const inner = 0.06; // quanto sporge fra due righe, in em
  const gap = 0.24; // lo spazio fra due parole, in em
  // La riga con la parola chiave tiene libero sopra di se' lo spazio in cui la
  // parola crescera', fin dal primo fotogramma della frase: la parola cresce verso
  // l'alto, e senza questa riserva coprirebbe la riga sopra. La riserva viene
  // dalla definizione della battuta, non dalla scala del momento, quindi la
  // composizione non si muove mentre la parola cresce.
  const { cue } = cueAt(cues, frame);
  const reserve = (r: number): number =>
    cue?.key && cue.key.word[0] === r && r > 0 ? (cue.key.scale - 1) * lineHeight : 0;
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
        <div
          key={r}
          style={{
            display: "flex",
            justifyContent: align === "center" ? "center" : "flex-start",
            marginTop: `${reserve(r)}em`,
          }}
        >
          {row.map((w, k) => {
            const tint = w.accent > 0 ? mixColor(color, accentColor, w.accent) : color;
            // La parola chiave cresce dalla linea di base verso il lato libero: la
            // prima della riga verso sinistra, l'ultima verso destra, una sola al
            // centro. Cosi' non copre le parole accanto (cueProblems vieta quella in
            // mezzo alla riga).
            const origin = row.length === 1 ? "50% 100%" : k === 0 ? "100% 100%" : "0% 100%";
            // Quanto della parola occupa spazio nella riga: una parola che compare
            // dove prima non c'era niente si fa spazio con lo scambio, e lascia
            // lo spazio una che sparisce. Anche lo spazio fra le parole.
            const presence = (w.old !== null ? 1 - w.mix : 0) + (w.word !== null ? w.mix : 0);
            const padTop = r === 0 ? pad : inner;
            const padBottom = r === rows.length - 1 ? pad : inner;
            const copy: React.CSSProperties = { position: "absolute", left: "0.08em", top: `${padTop}em`, whiteSpace: "pre" };
            const donor: React.CSSProperties = { visibility: "hidden", whiteSpace: "pre", letterSpacing: `${tracking}em` };
            return (
              <span
                key={k}
                style={{
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "flex-start",
                  // L'altezza e' quella della riga, e il padding della maschera sta
                  // fuori: dichiarato, perche' con border-box la cella si
                  // accorciava della maschera e le righe si sovrapponevano.
                  boxSizing: "content-box",
                  height: `${lineHeight}em`,
                  overflow: "hidden",
                  padding: `${padTop}em 0.08em ${padBottom}em`,
                  marginTop: `-${padTop}em`,
                  marginBottom: `-${padBottom}em`,
                  marginLeft: `${(k === 0 ? 0 : gap * presence) - 0.08}em`,
                  marginRight: "-0.08em",
                  // La scala della parola chiave sta sulla cella, dalla base.
                  transform: w.scale !== 1 ? `scale(${w.scale})` : undefined,
                  transformOrigin: origin,
                }}
              >
                {/*
                  Le due copie che danno la larghezza. Il corpo in pixel, perche' un
                  corpo relativo sotto i 6 px il browser puo' alzarlo; la spaziatura
                  ridichiarata in em, perche' ereditata sarebbe gia' in pixel, quelli
                  del corpo pieno, e la larghezza non scenderebbe con il corpo.
                */}
                {w.old !== null && w.mix < 1 ? (
                  <span aria-hidden style={{ ...donor, fontSize: size * (1 - w.mix) }}>
                    {w.old}
                  </span>
                ) : null}
                {w.word !== null && w.mix > 0 ? (
                  <span aria-hidden style={{ ...donor, fontSize: size * w.mix }}>
                    {w.word}
                  </span>
                ) : null}
                {w.old !== null && w.oldOut < 1 ? (
                  <span style={{ ...copy, transform: `translateY(${-w.oldOut * timing.travel * 100}%)`, color }}>{w.old}</span>
                ) : null}
                {w.word !== null ? (
                  <span style={{ ...copy, transform: `translateY(${((1 - w.in) - w.exit) * timing.travel * 100}%)`, color: tint }}>
                    {w.word}
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/**
 * TYP-09: il compagno su un altro asse. Letto dal basso verso l'alto, piccolo,
 * con la spaziatura aperta: la stessa frase stesa in orizzontale diventerebbe una
 * didascalia, cioe' una seconda cosa da leggere. Mai sotto i 34 px dal bordo, che
 * e' dove le piattaforme mettono i loro comandi.
 *
 * ANCORATO IN BASSO O IN ALTO. Gli script lo mettono in basso a sinistra nel
 * 16:9 e ancorato in alto nei verticali, dove in basso ci sono i comandi. La
 * versione ruotata di -90 gradi sul suo angolo poteva solo partire dal basso:
 * per ancorarla in alto serviva sapere quanto e' lunga la scritta, cioe'
 * misurarla. Con la scrittura verticale girata di 180 gradi la scatola e' gia'
 * verticale, e `top` e `bottom` funzionano come per qualunque elemento.
 */
export const Companion: React.FC<{
  text: string;
  size: number;
  fontFamily: string;
  color: string;
  opacity: number;
  left: number;
  /** La distanza dal bordo a cui e' ancorato, in basso o in alto. */
  edge: number;
  anchor?: "bottom" | "top";
}> = ({ text, size, fontFamily, color, opacity, left, edge, anchor = "bottom" }) => (
  <div
    style={{
      position: "absolute",
      left: Math.max(34, left),
      ...(anchor === "bottom" ? { bottom: Math.max(34, edge) } : { top: Math.max(34, edge) }),
      writingMode: "vertical-rl",
      transform: "rotate(180deg)",
      fontFamily,
      fontSize: size,
      lineHeight: 1,
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
