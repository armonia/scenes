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
/* La zona assistente                                                   */
/* ------------------------------------------------------------------ */

/**
 * Sta nella meta' bassa della lastra, che il kanban non usa.
 *
 * DUE MOTIVI, e nessuno dei due e' decorativo. Il primo: nei render delle
 * prime quattro scene quello spazio era vuoto, e una lastra con un buco in
 * mezzo legge come un mockup e non come uno schermo in uso. Il secondo, che
 * conta di piu': il film ha bisogno che la board e il composer siano LO STESSO
 * schermo. Finche' erano due schermi diversi - ed e' cosi' che PromptInput era
 * scritta, su una lastra sua da 2200 a prospettiva 2800 - passare dall'uno
 * all'altro era per forza uno stacco, e la regola dice che stacchi non ce ne
 * sono. Con una lastra sola il passaggio e' una camera che scende, che e'
 * esattamente il movimento che il catalogo chiama CAM-04.
 */
export const COMPOSER_H = 96;
export const COMPOSER_GAP_BOTTOM = 36;
export const COMPOSER_X = BOARD_LEFT;
export const COMPOSER_W = SLAB_W - PANEL_W - BOARD_PAD_X - COMPOSER_X;
export const COMPOSER_Y = SLAB_H - COMPOSER_GAP_BOTTOM - COMPOSER_H;

export const SEND_W = 116;
export const SEND_H = 52;
export const SEND_X = COMPOSER_X + COMPOSER_W - 18 - SEND_W;
export const SEND_Y = COMPOSER_Y + (COMPOSER_H - SEND_H) / 2;

/** Dove comincia il thread: sotto le colonne, sopra il composer. */
export const THREAD_TOP = 616;

/**
 * Quanto il thread si tiene alla larga dal composer.
 *
 * DERIVATO, non scritto a mano, e il motivo e' un difetto gia' pagato: il
 * composer e' opaco e disegnato dopo, i messaggi sono ancorati in basso, e con
 * un margine costante l'ultimo messaggio finiva sotto di lui. La scena
 * prometteva quattro tempi e ne mostrava tre, con tutti i type check verdi.
 * L'ha trovato beats.sh. Un numero costante tornerebbe sbagliato al primo
 * ritocco del layout, quindi questo segue il composer.
 */
export const THREAD_PAD_BOTTOM = SLAB_H - COMPOSER_Y + 24;

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

/** Quanto stringe la discesa sul composer. Oltre 1,2 il pulsante invia esce dal quadro. */
export const PROMPT_INPUT_ZOOM = 1.12;

/**
 * La posa in cui PromptInput si ferma: addosso al composer, frontale.
 *
 * Il centro ORIZZONTALE e' il composer. Quello VERTICALE non e': e' il punto
 * che porta il bordo basso della lastra sul bordo basso del quadro, cosi' sotto
 * il composer non si apre fondo. Con l'origine della prospettiva al 46%
 * l'altezza visibile si spartisce 0,46 sopra e 0,54 sotto, e il conto lo fa
 * questo blocco invece di uno che sposta numeri finche' sembra giusto.
 *
 * Resta a yaw e pitch zero come CARD_FOCUS_END_POSE, e per la stessa ragione:
 * centreOn calcola dove cade un punto con gli angoli a zero, quindi una posa
 * finale inclinata renderebbe il centraggio approssimato invece che esatto.
 */
export const PROMPT_INPUT_END_POSE: CameraPose = (() => {
  const k = PROMPT_INPUT_ZOOM;
  const visibleH = COMP_H / (k * SLAB_SCALE);
  const cy = SLAB_H - visibleH * (1 - PERSPECTIVE_ORIGIN_Y);
  const c = centreOn(COMPOSER_X + COMPOSER_W / 2, cy);
  return {
    yaw: 0,
    pitch: 0,
    pushZ: pushForZoom(k),
    slideX: c.slideX,
    slideY: c.slideY,
  };
})();

/**
 * La posa in cui il film finisce davvero: di tre quarti, indietro abbastanza da
 * vedere i due bordi verticali della lastra.
 *
 * LO YAW E' UN LIMITE MISURATO e non un gusto. Oltre i quaranta gradi la board
 * scorcia sotto il sessanta per cento della sua larghezza e i titoli smettono
 * di essere titoli; trentaquattro sta appena sotto, che e' il punto in cui
 * l'oggetto si legge come oggetto e il contenuto si legge ancora.
 *
 * LA SPINTA VA INDIETRO, e serve. L'orbita deve mostrare il BORDO, e il bordo
 * sta al confine della lastra: finche' la lastra deborda dal quadro il suo
 * confine e' fuori inquadratura e non c'e' niente da far vedere. A -420 la
 * lastra scorciata misura 1874 px di larghezza proiettata, quindi i due bordi
 * verticali stanno dentro i 1920 con un margine, mentre in verticale continua
 * a debordare.
 *
 * E' LA SECONDA POSA DELLA CATENA CHE INVERTE LA SPINTA, dopo CardRelease, e
 * vale la stessa ragione: PromptInput finisce a derivata nulla, questa parte da
 * derivata nulla, e dove i due lati della giunta sono fermi non c'e' nessuna
 * derivata da rovesciare.
 */
export const BOARD_ORBIT_END_POSE: CameraPose = {
  yaw: -34,
  pitch: 3.2,
  pushZ: -420,
  slideX: 0,
  slideY: 0,
};

/**
 * La posa in cui il film si ferma: larga, frontale, la board di nuovo leggibile.
 *
 * E' l'unica posa della catena che INVERTE il verso della spinta, e va detto
 * perche' altrove questo documento sostiene il contrario. La monotonia serve
 * dove la giunta e' in movimento: li' l'occhio segue la derivata e
 * un'inversione la legge come stacco. Qui i due lati della giunta sono FERMI,
 * CardFocus finisce a derivata nulla e CardRelease parte a derivata nulla,
 * quindi non c'e' nessuna derivata da rovesciare. E' la stessa proprieta' per
 * cui due scene ferme agli estremi si possono mettere in qualsiasi ordine.
 */
export const CARD_RELEASE_END_POSE: CameraPose = {
  yaw: 0,
  pitch: 0,
  pushZ: -140,
  slideX: 0,
  slideY: 0,
};
