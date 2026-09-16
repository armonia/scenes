import { Easing, interpolate } from "remotion";
import {
  CARD_H,
  COLUMNS,
  COL_W,
  HANDOFF_FROM_COL,
  HANDOFF_FROM_IDX,
  HANDOFF_TO_COL,
  cardY,
  columnX,
  handoffTargetCards,
} from "./geometry.ts";
import { pointOnPath } from "../../primitives/path.ts";
import type { Waypoint } from "../../primitives/path.ts";
import { tempo } from "../../primitives/tempo.ts";

/**
 * Il gesto di CardHandoff come dato: i tempi, il percorso della mano e dove sta
 * la card a ogni frame.
 *
 * Stava dentro CardHandoff.tsx. E' qui, in un modulo puro, perche' nei rapporti
 * verticali la camera segue la card durante il trascinamento (tracks.ts) e
 * handoff-travel.py deve sapere dove la card si trova sulla lastra per
 * separare il suo moto da quello della camera. Una seconda copia del percorso
 * dentro un banco resterebbe uguale a questa finche' nessuno tocca una delle due.
 *
 * Modulo puro, letto da Node.
 */

/**
 * La durata di riferimento a cui sono scritti i tempi qui sotto. Cambiare
 * `durationInFrames` in catalog.json li scala tutti insieme: e' cosi' che si
 * cambia la velocita' della scena senza riscriverne nessuno.
 */
// I tempi. La card non parte al frame 0: prima l'occhio deve riconoscere la
// board come la stessa di prima, poi deve arrivare la mano. Se si muovesse
// subito la giunta sarebbe corretta e illeggibile.
//
// LA MANO C'E' PERCHE' SENZA NON E' UN PRODOTTO. Una card che attraversa da
// sola e' un'animazione; una card che qualcuno prende e sposta e' un software
// che si usa. Erano due voci del catalogo che nessuna scena implementava, CUR-01
// per l'arrivo in arco e CUR-04 per il peso del trascinamento, e stavano ferme
// li' mentre la scena faceva volare la card con una interpolazione.
export const CARD_HANDOFF_BASE = 240;

export const GRAB = 78;
export const CARD_HANDOFF_DRAG_START = 84;
export const CARD_HANDOFF_DRAG_END = 176;
export const RELEASE = 178;
export const SETTLE_END = 196;

/**
 * NON SI SCALANO, e i motivi sono diversi fra loro.
 *
 * LAG e' il peso dell'oggetto: la card sta dove stava la mano tre frame fa
 * perche' e' una cosa che ha inerzia, non perche' il montaggio ha quel ritmo.
 * A velocita' doppia diventerebbe un frame e mezzo, cioe' la card tornerebbe
 * saldata al puntatore, che e' esattamente il difetto che CUR-04 descrive.
 *
 * TILT_PER_PX non e' nemmeno un tempo: e' gradi per pixel di velocita'. Scala
 * da se' quando la corsa si accorcia, perche' la velocita' cresce.
 */
export const LAG = 3;
export const TILT_PER_PX = 0.11;

/**
 * CHR-03, la catena di conseguenze, e i due ritardi che la rendono una catena.
 *
 * La card si posa, POI il contatore della colonna recepisce, POI la card si
 * riscrive l'eta': "12h" diventa "ora", che e' quello che fa una board vera
 * quando qualcosa si sposta. Prima i due anelli scattavano tutti e due a meta'
 * tragitto, sullo stesso frame: tre cose che cambiano insieme non leggono come
 * una causa, leggono come tre cose scollegate che si sono mosse per caso. Il
 * ritardo e' l'unica cosa che dice all'occhio quale evento ha provocato
 * l'altro, e cinque o sei frame bastano - sotto due spariscono, sopra venti
 * diventano lentezza.
 *
 * IL TERZO ANELLO NON E' IL PANNELLO, ed e' una correzione fatta guardando il
 * render. Il catalogo diceva "il pannello cambia stato sei frame dopo", ma a
 * questa posa la camera e' gia' abbastanza dentro che il pannello dei dettagli
 * esce dal bordo destro: si leggono le etichette e non i valori. Un anello
 * della catena fuori quadro non e' un anello. L'eta' della card sta al centro
 * dell'inquadratura, e cambia per lo stesso motivo per cui cambierebbe il
 * pannello.
 */
export const COUNT_AT = RELEASE + 5;
export const PANEL_AT = RELEASE + 11;


/** Le due posizioni di slot fra cui la card vola, e dove la mano la afferra. */
const slots = () => {
  // La colonna di arrivo con la card in coda: e' l'elenco da cui si calcola lo
  // slot d'arrivo.
  const toWith = handoffTargetCards();

  const x0 = columnX(HANDOFF_FROM_COL);
  const y0 = cardY(COLUMNS[HANDOFF_FROM_COL]!.cards, HANDOFF_FROM_IDX);
  const x1 = columnX(HANDOFF_TO_COL);
  const y1 = cardY(toWith, toWith.length - 1);

  // Dove la mano afferra la card: non al centro esatto, che legge come un
  // bersaglio calcolato, ma sul corpo della card poco sopra la meta'.
  const gdx = COL_W * 0.38;
  const gdy = CARD_H * 0.42;

  return { x0, y0, x1, y1, gdx, gdy };
};

/** Il percorso della mano, per una durata. */
export const cardHandoffPath = (durationInFrames: number): Waypoint[] => {
  const T = tempo(durationInFrames, CARD_HANDOFF_BASE);
  const last = durationInFrames - 1;
  const { x0, y0, x1, y1, gdx, gdy } = slots();
  // Il percorso della mano. CUR-01 e' tutto qui dentro: entra da fuori lastra,
  // curva - il waypoint di meta' strada sta fuori dall'asse, che e' cio' che
  // rende l'arrivo un arco e non una diagonale - supera di poco il bersaglio e
  // ci si posa. L'overshoot e' 26 px su 1130 di corsa.
  return [
    { x: 2620, y: 1330, at: 0 },
    { x: 2620, y: 1330, at: T.at(14) },
    { x: 1580, y: 700, at: T.at(46) },
    { x: x0 + gdx + 26, y: y0 + gdy - 18, at: T.at(66) },
    { x: x0 + gdx, y: y0 + gdy, at: T.at(76) },
    { x: x0 + gdx, y: y0 + gdy, at: T.at(CARD_HANDOFF_DRAG_START) },
    { x: (x0 + x1) / 2 + gdx, y: Math.min(y0, y1) + gdy - 96, at: T.at(130) },
    { x: x1 + gdx, y: y1 + gdy, at: T.at(CARD_HANDOFF_DRAG_END) },
    { x: x1 + gdx, y: y1 + gdy, at: T.at(186) },
    // La mano se ne va prima della fine, e non e' una gentilezza: la scena dopo
    // non ha nessun cursore, quindi se restasse in quadro all'ultimo frame la
    // giunta con CardFocus mostrerebbe una freccia che sparisce.
    { x: 2620, y: 1330, at: T.at(216) },
    { x: 2620, y: 1330, at: last },
  ];
};

/** Dove sta la card, e in che stato e' il gesto, al frame `frame`. */
export const cardHandoffMotion = (durationInFrames: number, frame: number) => {
  const T = tempo(durationInFrames, CARD_HANDOFF_BASE);
  const { x0, y0, x1, y1, gdx, gdy } = slots();
  const path = cardHandoffPath(durationInFrames);

  // CUR-04: la card sta dove stava la mano tre frame fa, e l'inclinazione esce
  // dalla differenza fra due campioni. Senza il ritardo la card sembra saldata
  // al puntatore; senza l'inclinazione sembra trascinata su un tavolo.
  const heldFrame = Math.min(frame, T.at(RELEASE)) - LAG;
  const lagged = pointOnPath(path, heldFrame);
  const before = pointOnPath(path, heldFrame - 3);
  const held = frame >= T.at(GRAB);

  // Dopo il rilascio la card scivola nello slot: la correzione e' piccola,
  // perche' la mano ha gia' dimorato sul punto d'arrivo.
  const settle = interpolate(frame, [T.at(RELEASE), T.at(SETTLE_END)], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const lift = interpolate(
    frame,
    [T.at(GRAB), T.at(GRAB + 12), T.at(RELEASE), T.at(SETTLE_END)],
    [0, 1, 1, 0],
    {
    easing: Easing.inOut(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const dragX = lagged.x - gdx;
  const dragY = lagged.y - gdy;
  const cardX = !held ? x0 : dragX + (x1 - dragX) * settle;
  const cardY_ = !held ? y0 : dragY + (y1 - dragY) * settle;
  const tilt = held ? (lagged.x - before.x) * TILT_PER_PX * (1 - settle) : 0;


  // Quanto del tragitto e' fatto: e' da qui che la board sa quando aggiornare i
  // contatori e quando aprire lo slot di destinazione.
  const travel = Math.max(0, Math.min(1, (cardX - x0) / (x1 - x0)));

  // Le card sotto risalgono mentre quella sopra si sta gia' posando, non prima.
  const closeGap = interpolate(frame, [T.at(CARD_HANDOFF_DRAG_END - 22), T.at(SETTLE_END)], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });


  return {
    T,
    path,
    x0,
    y0,
    x1,
    y1,
    cardX,
    cardY: cardY_,
    tilt,
    lift,
    travel,
    closeGap,
    held,
    /** Il contatore della colonna ha recepito la consegna. */
    handed: frame >= T.at(COUNT_AT),
    /** La card si e' riscritta l'eta'. */
    aged: frame >= T.at(PANEL_AT),
  };
};
