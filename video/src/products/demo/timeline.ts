import type { Ratio } from "../../kit/stage.ts";
import { chain, handoffAt, insertAt, staggerByDistance } from "../../kit/choreo.ts";
import type { ChainStep, Handoff } from "../../kit/choreo.ts";
import { settleAt, typedAt } from "../../kit/text.ts";
import type { Settle, TypingPlan } from "../../kit/text.ts";
import { arrivalOf, cursorAt } from "../../kit/cursorArc.ts";
import type { ArcMove, CursorTimeline } from "../../kit/cursorArc.ts";
import type { TypeCue } from "../../kit/type.ts";
import { Easing, interpolate } from "remotion";
import { ASSIST_FIELD, LETTER, SEND_BUTTON, sectionRect } from "./geometry.ts";

/**
 * Il film di Registro come dato: cosa succede sulla lastra a ogni fotogramma, e
 * le frasi.
 *
 * Ogni battuta usa una funzione del kit con i numeri degli script (varco 18 frame
 * prima dell'atterraggio, consegna con varco a +30 e volo da +40 a +126, catena a
 * sei frame, scavalco del totale al 2,5%, cancellazione a 1,6 caratteri per frame,
 * attesa di 20 frame prima della pressione). Questo file e' il posto in cui un
 * film nuovo cambia: la lastra e il kit restano quelli.
 *
 * Modulo puro rispetto a React, letto anche da Node.
 */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const inOut = { easing: Easing.inOut(Easing.cubic), ...clamp };

export const FPS = 30;

/* ---------------------------------------------------------------- S1 arrivi */

export const INBOX_ITEMS = [
  { title: "Mail · Studio Neri", note: "Rifacimento vetrina", landAt: 95 },
  { title: "Nota vocale · 0:42", note: "Tempi e budget", landAt: 130 },
  { title: "PDF · capitolato.pdf", note: "12 pagine", landAt: 165 },
] as const;

/* ------------------------------------------------------------- S2 lettura */

export const LETTER_TEXT = [
  "Buongiorno, ci serve il rifacimento della vetrina del negozio",
  "entro fine mese: progetto, allestimento e posa. Budget indicativo",
  "sui settemila euro, sopralluogo possibile anche sabato mattina.",
];

/** Le parole estratte e dove stavano nella lettera, in coordinate della lastra. */
export const CHIPS = [
  { label: "Progetto", x: LETTER.x + 120, y: LETTER.y + 118 },
  { label: "Allestimento e posa", x: LETTER.x + 520, y: LETTER.y + 118 },
  { label: "Budget 7.000 €", x: LETTER.x + 380, y: LETTER.y + 170 },
] as const;

export const READ_FROM = 250;
export const READ_TO = 430;
/** Il punto da cui parte la lettura: le parole piu' lontane si staccano dopo (CHR-02). */
export const READ_ORIGIN = { x: LETTER.x + 60, y: LETTER.y + 60 };
export const CHIP_LIFT_START = 300;

/* ----------------------------------------------------------- S3 struttura */

export const SECTION_NAMES = ["Progetto", "Lavorazioni", "Economico"] as const;

/** CHR-01 per ogni blocco: dalla sua posizione nella lettera alla sua sezione. */
export const handoffs = (): Handoff[] =>
  CHIPS.map((c, i) => ({
    from: { x: c.x, y: c.y, w: 220, h: 44 },
    to: { x: sectionRect(i).x + 24, y: sectionRect(i).y + 20, w: 220, h: 44 },
    start: 430 + i * 6,
  }));

/** CHR-03: le sezioni si confermano a catena, sei frame l'una dall'altra. */
export const SECTION_CHAIN: ChainStep[] = [
  { name: "Progetto", after: 0 },
  { name: "Lavorazioni", after: 6 },
  { name: "Economico", after: 6 },
];
export const SECTION_CAUSE = 560;

/* -------------------------------------------------------------- S4 numero */

export const TOTAL_SETTLE: Settle = { from: 0, to: 7350, start: 700, frames: 72, overshoot: 0.025 };

/* ---------------------------------------------------------- S5 correzione */

export const TYPING: TypingPlan = {
  start: 905,
  fps: FPS,
  steps: [
    { kind: "type", text: "aggiungi il sopralluogo e una penale per rit", seed: 1409 },
    { kind: "pause", frames: 14 },
    { kind: "erase", to: "aggiungi il sopralluogo e " },
    { kind: "type", text: "una verifica a fine lavori", seed: 2711 },
  ],
};

/* ---------------------------------------------------------------- S6 invio */

export const CURSOR: CursorTimeline = {
  from: { x: 2320, y: 1300 },
  moves: [
    { to: { x: ASSIST_FIELD.x + 60, y: ASSIST_FIELD.y + 60 }, start: 820, travel: 70, settle: 12 },
    { to: { x: SEND_BUTTON.x + SEND_BUTTON.w * 0.4, y: SEND_BUTTON.y + SEND_BUTTON.h / 2 }, start: 1020, travel: 76, settle: 12 },
    { to: { x: 2320, y: 1300 }, start: 1150, travel: 60, settle: 8 },
  ],
};
export const FIELD_CLICK = arrivalOf(CURSOR.moves[0] as ArcMove) + 6;
/** CUR-02: la mano arriva sul pulsante e aspetta venti frame prima di premere. */
export const SEND_PRESS = arrivalOf(CURSOR.moves[1] as ArcMove) + 20;

/** CUR-03 e CHR-03: il pulsante risponde, poi gli stati si accendono a catena. */
export const STATUS_STEPS: ChainStep[] = [
  { name: "Inviato", after: 6 },
  { name: "Letto", after: 12 },
  { name: "Approvato", after: 34 },
];

/* ---------------------------------------------------------------- lo stato */

export type DemoState = {
  inbox: { title: string; note: string; enter: number; gap: number }[];
  highlight: number;
  attn: number;
  chips: { label: string; x: number; y: number; lift: number; visible: boolean }[];
  sections: { name: string; filled: number; confirmed: boolean }[];
  total: number;
  typed: string;
  focused: boolean;
  cursor: { x: number; y: number };
  clicks: number[];
  pressed: number;
  statuses: { name: string; on: number }[];
  light: { color: string; opacity: number };
  /** CAM-05 in chiusura: quanto resta della ripresa sotto la frase finale. */
  dim: number;
};

export const stateAt = (frame: number): DemoState => {
  const inbox = INBOX_ITEMS.map((it) => {
    const s = insertAt(frame, it.landAt);
    return { title: it.title, note: it.note, enter: s.enter, gap: s.gap };
  });

  // CHR-02: ogni parola si stacca con un ritardo proporzionale alla distanza.
  const staggered = staggerByDistance(CHIPS, READ_ORIGIN, CHIP_LIFT_START);
  const hs = handoffs();
  const chips = staggered.map((c, i) => {
    const lifted = interpolate(frame, [c.at, c.at + 14], [0, 1], inOut);
    const h = handoffAt(hs[i] as Handoff, frame);
    const flying = h.travel > 0;
    return {
      label: c.label,
      x: flying ? h.x : c.x,
      y: flying ? h.y : c.y - lifted * 10,
      lift: Math.max(lifted * (1 - h.travel), h.lift),
      visible: frame >= c.at,
    };
  });

  const confirmed = chain(SECTION_CAUSE, SECTION_CHAIN);
  const sections = SECTION_NAMES.map((name, i) => ({
    name,
    filled: handoffAt(hs[i] as Handoff, frame).gapOpen,
    confirmed: frame >= (confirmed[i] as { at: number }).at,
  }));

  const statusFrames = chain(SEND_PRESS, STATUS_STEPS);
  const statuses = statusFrames.map((s) => ({ name: s.name, on: interpolate(frame, [s.at, s.at + 10], [0, 1], inOut) }));
  const approved = (statuses[2] as { on: number }).on;

  return {
    inbox,
    highlight: interpolate(frame, [READ_FROM, READ_TO], [0, 1], clamp),
    // CAM-05: mentre la lettera si legge, tutto il resto scende a 0,62.
    attn: interpolate(frame, [READ_FROM - 10, READ_FROM + 20, READ_TO, READ_TO + 30], [1, 0.62, 0.62, 1], inOut),
    chips,
    sections,
    total: settleAt(TOTAL_SETTLE, frame),
    typed: typedAt(TYPING, frame),
    focused: frame >= FIELD_CLICK,
    cursor: cursorAt(CURSOR, frame),
    clicks: [FIELD_CLICK, SEND_PRESS],
    pressed: interpolate(frame, [SEND_PRESS, SEND_PRESS + 4, SEND_PRESS + 12], [0, 1, 0], clamp),
    statuses,
    // MAT-02: la luce dello schermo prende il viola dell'interfaccia, e vira al
    // giallo quando lo stato passa ad Approvato.
    light: {
      color: approved > 0.5 ? "#fff96b" : "#7747ec",
      opacity: 0.72 + 0.26 * approved,
    },
    // Alla chiusura tutta la ripresa scende a 0,42, sotto il pavimento di CAM-05,
    // perche' la frase bianca sopra una lastra chiara regge solo fra 0,40 e 0,45.
    dim: interpolate(frame, [1265, 1295], [1, 0.42], inOut),
  };
};

/* ------------------------------------------------------------- le frasi */

/**
 * TYP-09: il compagno della chiusura, su un altro asse. Entra in dissolvenza e
 * resta bianco pieno: e' piccolo, e la gerarchia con la frase la fa il corpo.
 * Era al 70%, e la sua coda passa sopra la lastra (nel 16:9 in basso, nei
 * verticali in alto): anche velata a 0,42 la lastra lasciava un bianco al 70% a
 * 1,03:1 nel riquadro peggiore, e al 90% il 4:5 stava a 4,6:1, a un soffio dal
 * 4,5:1 del testo piccolo. Sta qui e non nel componente perche' film-type.py
 * deve sapere quando guardarlo.
 */
export const COMPANION = { text: "Registro · RQ-2026-014", from: 1290, to: 1310, opacity: 1 } as const;

/**
 * Le battute per formato. Le frasi e i frame sono gli stessi; cambia dove si va a
 * capo, perche' la stessa frase su tre larghezze ha tre righe diverse.
 */
export const cuesFor = (ratio: Ratio): { plane: TypeCue[]; glass: TypeCue[] } => {
  const narrow = ratio !== "16x9";
  return {
    // TYP-10, sul piano della lastra: entra con la maschera, poi cambiano solo le
    // parole che cambiano (TYP-04), e l'accento si mescola (TYP-03).
    plane: [
      { at: 120, rows: narrow ? [["Arriva"], ["una", "richiesta."]] : [["Arriva", "una", "richiesta."]] },
      { at: 215, rows: narrow ? [["Arriva"], ["un", "lavoro."]] : [["Arriva", "un", "lavoro."]], accent: narrow ? [1, 1] : [0, 2], exitAt: 400 },
    ],
    // Sul vetro: le tre parole della struttura (TYP-02), la seconda persona, la
    // chiusura.
    glass: [
      { at: 465, rows: [["Legge."]], key: { word: [0, 0], scale: 1.6 } },
      { at: 545, rows: [["Ordina."]], key: { word: [0, 0], scale: 1.6 } },
      { at: 625, rows: [["Stima."]], key: { word: [0, 0], scale: 1.6 }, exitAt: 760 },
      { at: 900, rows: narrow ? [["Il", "resto"], ["lo", "decidi", "tu."]] : [["Il", "resto", "lo", "decidi", "tu."]], accent: narrow ? [1, 2] : [0, 4], exitAt: 1050 },
      { at: 1190, rows: [["Approvato."]], exitAt: 1244 },
      // La parola chiave sta da sola sulla sua riga, in ogni formato: cresce dal
      // centro, e la riga le tiene libero lo spazio sopra. In fondo a una riga
      // lunga cresceva verso destra e usciva dal quadro del 16:9.
      { at: 1270, rows: [["Richieste", "che"], ["chiudono."]], key: { word: [1, 0], scale: 1.4 }, accent: [1, 0] },
    ],
  };
};
