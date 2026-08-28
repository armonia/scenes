/**
 * La geometria della lastra, e il motivo per cui e' un modulo e non tre numeri
 * ripetuti in due scene.
 *
 * La regola "niente tagli" dice che una scena deve poter entrare dallo stato
 * finale della precedente. Finche' ogni scena si disegna il proprio layout, quel
 * vincolo si rispetta a occhio: due file che dicono `left: 280` restano uguali
 * solo finche' nessuno tocca uno dei due. Qui la posa di camera e le coordinate
 * delle card vengono da una sola sorgente, quindi la giunta e' esatta per
 * costruzione e `seam.sh` la misura invece di sorvegliarla.
 *
 * LE ALTEZZE DELLE CARD SONO ESPLICITE, e questa e' la decisione che rende
 * possibile la scena 3. Con altezze naturali una card sa dove sta solo dopo il
 * layout, cioe' a runtime: per far volare una card da una colonna all'altra
 * servirebbe misurare il DOM, e misurare il DOM rompe il frame-lock perche' la
 * misura non e' una funzione del frame. Fissandole, la posizione di ogni slot e'
 * aritmetica pura e la si puo' interpolare.
 */

export const SLAB_W = 2400;
export const SLAB_H = 1200;

export const SIDEBAR_W = 280;
export const HEADER_H = 58;
export const PANEL_W = 420;

/** Padding della board, gap fra colonne, gap fra card. */
export const BOARD_PAD_X = 24;
export const BOARD_PAD_Y = 28;
export const COL_GAP = 20;
export const CARD_GAP = 12;

/**
 * Intestazione di colonna: riga di testo a 18px (line-height 1.55 -> 28) piu'
 * 14 di padding sotto piu' il filo del bordo.
 */
export const COL_HEADER_H = 28 + 14 + 1;

/** Altezza di una card, e di quella attiva che porta in piu' la barra. */
export const CARD_H = 96;
export const ACTIVE_CARD_H = CARD_H + 15;

export const BOARD_LEFT = SIDEBAR_W + BOARD_PAD_X;
export const BOARD_TOP = HEADER_H + BOARD_PAD_Y;
export const BOARD_W = SLAB_W - SIDEBAR_W - PANEL_W - BOARD_PAD_X * 2;
export const COL_W = (BOARD_W - COL_GAP * 2) / 3;

export const columnX = (colIdx: number): number =>
  BOARD_LEFT + colIdx * (COL_W + COL_GAP);

export type Card = {
  title: string;
  tag: "feature" | "bugfix" | "chore";
  age: string;
  active?: boolean;
  done?: boolean;
};

export type Column = { name: string; cards: Card[] };

export const cardHeight = (card: Card): number =>
  card.active ? ACTIVE_CARD_H : CARD_H;

/**
 * La y del bordo alto della card `cardIdx`, dato l'elenco di card che le stanno
 * sopra nella stessa colonna. Somma di altezze e gap: nessuna misura, nessun
 * layout, solo aritmetica, quindi vale identica in ogni frame e in ogni scena.
 */
export const cardY = (cards: Card[], cardIdx: number): number => {
  let y = BOARD_TOP + COL_HEADER_H + CARD_GAP;
  for (let i = 0; i < cardIdx; i++) {
    y += cardHeight(cards[i] as Card) + CARD_GAP;
  }
  return y;
};

/**
 * La y del "+ Add card": lo slot subito sotto l'ultima card, cioe' la stessa
 * formula di `cardY` valutata un posto oltre la fine.
 */
export const addCardY = (cards: Card[]): number => cardY(cards, cards.length);

/** Lo stato della board come lo lascia UIMockup, e da cui parte la scena dopo. */
export const COLUMNS: Column[] = [
  {
    name: "Backlog",
    cards: [
      { title: "Migrazione schema v3", tag: "chore", age: "5d" },
      { title: "Rate limit su /api/render", tag: "feature", age: "3d" },
      { title: "Retry logic per job falliti", tag: "bugfix", age: "2d" },
    ],
  },
  {
    name: "In corso",
    cards: [
      { title: "UIMockup: piano 3D + parallasse", tag: "feature", age: "1d", active: true },
      { title: "Metriche latenza p99", tag: "chore", age: "12h" },
    ],
  },
  {
    name: "In review",
    cards: [
      { title: "PromptInput: streaming fix", tag: "bugfix", age: "6h", done: true },
      { title: "Docs: regole frame-lock", tag: "chore", age: "2h" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* La camera                                                            */
/* ------------------------------------------------------------------ */

export type CameraPose = {
  yaw: number;
  pitch: number;
  pushZ: number;
  slideX: number;
};

/**
 * La posa in cui UIMockup lascia la lastra: piu' frontale di come l'ha presa,
 * ferma al centro. E' l'unico punto in cui la scena successiva puo' agganciarsi
 * senza che si veda un salto, quindi vive qui e non dentro una delle due scene.
 */
export const UI_MOCKUP_END_POSE: CameraPose = {
  yaw: -9,
  pitch: 2.5,
  pushZ: 48,
  slideX: 0,
};

export const UI_MOCKUP_START_POSE: CameraPose = {
  yaw: -18,
  pitch: 5,
  pushZ: 0,
  slideX: 900,
};
