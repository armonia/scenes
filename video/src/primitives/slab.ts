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
  /** Opzionale: finora nessuna scena si spostava in verticale, CardFocus si'. */
  slideY?: number;
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

/**
 * La posa in cui CardHandoff si ferma.
 *
 * Stava scritta come tre numeri letterali dentro `CardHandoff.tsx`, il che
 * andava bene finche' nessuna scena doveva agganciarsi dopo. Dal momento in cui
 * ce n'e' una, quei numeri sono un punto di giunzione, e un punto di giunzione
 * copiato in due file resta esatto solo finche' nessuno tocca una delle copie.
 * E' lo stesso ragionamento per cui UI_MOCKUP_END_POSE e' qui e non dentro
 * UIMockup: `seam.sh` misura la giunta, ma non puo' misurare l'intenzione.
 */
export const CARD_HANDOFF_END_POSE: CameraPose = {
  yaw: -4,
  pitch: 1.2,
  pushZ: 96,
  slideX: 0,
};

/* ------------------------------------------------------------------ */
/* Chi consegna cosa, e dove finisce                                    */
/* ------------------------------------------------------------------ */

/** La card che CardHandoff sposta, e le due colonne fra cui la sposta. */
export const HANDOFF_FROM_COL = 1;
export const HANDOFF_FROM_IDX = 1;
export const HANDOFF_TO_COL = 2;

export const handoffCard = (): Card =>
  COLUMNS[HANDOFF_FROM_COL]!.cards[HANDOFF_FROM_IDX] as Card;

/** La colonna di arrivo come resta dopo la consegna: le sue card piu' quella. */
export const handoffTargetCards = (): Card[] => [
  ...COLUMNS[HANDOFF_TO_COL]!.cards,
  handoffCard(),
];

/**
 * Il rettangolo in cui la card si posa, in coordinate lastra. Una scena che
 * deve inquadrarla lo chiede qui invece di rifare la somma delle altezze: la
 * somma e' gia' `cardY`, e rifarla e' il modo in cui due file smettono di
 * essere d'accordo.
 */
export const handoffLandedRect = (): {
  x: number;
  y: number;
  w: number;
  h: number;
} => {
  const cards = handoffTargetCards();
  const idx = cards.length - 1;
  return {
    x: columnX(HANDOFF_TO_COL),
    y: cardY(cards, idx),
    w: COL_W,
    h: cardHeight(cards[idx] as Card),
  };
};

/* ------------------------------------------------------------------ */
/* Come la lastra finisce sullo schermo                                 */
/* ------------------------------------------------------------------ */

/**
 * L'impianto di ripresa, che finora stava ricopiato dentro ogni scena: la
 * composizione, la scala della lastra, la prospettiva e la sua origine.
 *
 * Serve qui perche' una scena che deve centrare un elemento preciso ha bisogno
 * di sapere dove quell'elemento finisce sullo schermo, e quel calcolo non si fa
 * a occhio spostando numeri finche' sembra giusto: si fa una volta e si
 * verifica sul render.
 */
export const COMP_W = 1920;
export const COMP_H = 1080;
export const SLAB_SCALE = 1.04;
export const PERSPECTIVE = 2600;
export const PERSPECTIVE_ORIGIN_Y = 0.46;

/** Dove cade un punto della lastra, con yaw e pitch a zero e prima della spinta in Z. */
export const slabPointOnScreen = (
  x: number,
  y: number,
): { x: number; y: number } => ({
  x: (COMP_W - SLAB_W) / 2 + SLAB_W / 2 + (x - SLAB_W / 2) * SLAB_SCALE,
  y: (COMP_H - SLAB_H) / 2 + SLAB_H / 2 + (y - SLAB_H / 2) * SLAB_SCALE,
});

/**
 * Lo scostamento che porta quel punto sull'origine della prospettiva.
 *
 * Serve perche' l'origine della prospettiva e' l'unico punto del quadro che non
 * si sposta mentre la camera avanza in Z: qualsiasi altro punto scappa verso il
 * bordo. Centrare li' l'oggetto e' la condizione perche' una discesa al macro
 * resti puntata su di lui invece di scivolargli accanto.
 */
export const centreOn = (
  x: number,
  y: number,
): { slideX: number; slideY: number } => {
  const p = slabPointOnScreen(x, y);
  return {
    slideX: COMP_W / 2 - p.x,
    slideY: COMP_H * PERSPECTIVE_ORIGIN_Y - p.y,
  };
};

/** L'ingrandimento che produce una spinta in Z, e la spinta che serve per un ingrandimento. */
export const zoomForPush = (z: number): number => PERSPECTIVE / (PERSPECTIVE - z);
export const pushForZoom = (k: number): number => PERSPECTIVE * (1 - 1 / k);

/** Quanto ingrandisce la discesa di CardFocus. Oltre 2,6 la card esce dal quadro. */
export const CARD_FOCUS_ZOOM = 2.35;

/**
 * La posa in cui CardFocus si ferma: addosso alla card consegnata, frontale.
 * Nessun numero scritto a mano, sono tutti derivati dalla geometria sopra.
 */
export const CARD_FOCUS_END_POSE: CameraPose = (() => {
  const r = handoffLandedRect();
  const c = centreOn(r.x + r.w / 2, r.y + r.h / 2);
  return {
    yaw: 0,
    pitch: 0,
    pushZ: pushForZoom(CARD_FOCUS_ZOOM),
    slideX: c.slideX,
    slideY: c.slideY,
  };
})();
