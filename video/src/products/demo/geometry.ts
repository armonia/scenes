import { STAGES } from "../../kit/stage.ts";
import type { Ratio } from "../../kit/stage.ts";
import { centreOn, pushForZoom } from "../../kit/rig.ts";
import type { Rig, SlabSize } from "../../kit/rig.ts";
import type { Pose } from "../../kit/project.ts";
import type { PoseKey } from "../../kit/filmCamera.ts";

/**
 * Registro, il prodotto inventato del film di esempio.
 *
 * PERCHE' UN PRODOTTO INVENTATO. Il film di esempio deve dimostrare che un
 * commercial si fa con i pezzi del kit, e nel repo pubblico non puo' stare
 * niente dei prodotti veri: ne' il codice di Cifra o di Zeno, ne' Elza Text.
 * Registro e' uno sportello richieste con una colonna di arrivi, un documento,
 * tre sezioni, un totale, un assistente e una colonna di stati: le stesse forme
 * che i due script chiedono, con contenuti di fantasia. E' chiaro, come i
 * pannelli di Cifra e di Zeno, perche' e' su una lastra chiara che la tipografia
 * bianca ha il problema di contrasto da verificare.
 *
 * Tutte le coordinate sono della lastra, aritmetiche: niente altezze naturali,
 * cosi' un banco sa dove sta ogni cosa senza renderizzare.
 *
 * Modulo puro, letto da Node.
 */

export const DEMO_SLAB: SlabSize = { w: 2200, h: 1240 };

export const DEMO_RIG: Rig = { perspective: 2600, originX: 0.5, originY: 0.46, slabScale: 1.04 };

export const HEADER_H = 64;
export const RAIL_W = 300;
export const PANEL_W = 460;
export const GUTTER = 28;

type Rect = { x: number; y: number; w: number; h: number };

/** La colonna degli arrivi, a sinistra. */
export const INBOX: Rect = { x: GUTTER, y: HEADER_H + GUTTER, w: RAIL_W - GUTTER * 1.5, h: 560 };
export const INBOX_ROW_H = 92;
export const INBOX_GAP = 12;
export const inboxRowY = (i: number): number => INBOX.y + 56 + i * (INBOX_ROW_H + INBOX_GAP);

/** Il documento al centro. */
export const DOC: Rect = {
  x: RAIL_W + GUTTER,
  y: HEADER_H + GUTTER,
  w: DEMO_SLAB.w - RAIL_W - PANEL_W - GUTTER * 3,
  h: DEMO_SLAB.h - HEADER_H - GUTTER * 2,
};

/** Il testo della richiesta, in cima al documento. */
export const LETTER: Rect = { x: DOC.x + 40, y: DOC.y + 40, w: DOC.w - 80, h: 250 };

/**
 * Le tre sezioni in cui atterrano i blocchi estratti, il totale sotto, e a destra
 * l'assistente sopra la colonna degli stati.
 *
 * L'ORDINE IN VERTICALE NON E' ESTETICO. La camera del film non torna mai
 * indietro su nessun asse (GIU-04), e le pose centrate seguono il soggetto di
 * ogni tratto: se il totale stesse piu' in basso dell'assistente, la camera
 * scenderebbe sul totale e risalirebbe sull'assistente, e il controllo della
 * traccia lo segnalerebbe come inversione in moto (la prima versione di questo
 * file lo faceva quattro volte). Quindi i soggetti vanno da sinistra a destra e
 * dall'alto in basso: arrivi, testo, sezioni, totale, assistente, stati.
 */
export const SECTION_H = 84;
export const SECTION_GAP = 14;
export const SECTIONS_Y = LETTER.y + LETTER.h + 40;
export const sectionRect = (i: number): Rect => ({
  x: DOC.x + 40,
  y: SECTIONS_Y + i * (SECTION_H + SECTION_GAP),
  w: DOC.w - 80,
  h: SECTION_H,
});

export const TOTAL: Rect = { x: DOC.x + 40, y: SECTIONS_Y + 3 * (SECTION_H + SECTION_GAP) + 10, w: DOC.w - 80, h: 150 };

export const PANEL: Rect = { x: DEMO_SLAB.w - PANEL_W - GUTTER, y: HEADER_H + GUTTER, w: PANEL_W, h: DOC.h };
export const ASSIST_FIELD: Rect = { x: PANEL.x + 24, y: 760, w: PANEL.w - 48, h: 170 };
export const SEND_BUTTON: Rect = { x: PANEL.x + 24, y: 948, w: PANEL.w - 48, h: 72 };
export const STATUS_ROW_H = 56;
export const statusRect = (i: number): Rect => ({ x: PANEL.x + 24, y: 1040 + i * (STATUS_ROW_H + 8), w: PANEL.w - 48, h: STATUS_ROW_H });

const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** I soggetti della camera, uno per scena, nell'ordine del film. */
export const SUBJECTS = {
  arrivi: { x: RAIL_W + 120, y: LETTER.y + 110 },
  lettura: { x: centre(LETTER).x - 120, y: LETTER.y + 150 },
  struttura: { x: centre(DOC).x, y: sectionRect(1).y + SECTION_H / 2 },
  numero: centre(TOTAL),
  correzione: { x: ASSIST_FIELD.x + ASSIST_FIELD.w / 2 - 80, y: ASSIST_FIELD.y + ASSIST_FIELD.h / 2 + 20 },
  firma: { x: centre(PANEL).x, y: statusRect(1).y + STATUS_ROW_H / 2 },
};

/**
 * Le chiavi della camera, per formato.
 *
 * Il 16:9 e' la tabella di un master: ingresso da fuori quadro, poi una spinta
 * sola fino al macro sugli stati, senza tornare indietro. Le pose centrate si
 * calcolano con `centreOn` del kit sul soggetto di ogni tratto, non si scrivono a
 * occhio (CAM-06). L'ingresso parte alla stessa altezza del primo soggetto e da
 * destra, cosi' nessuno spostamento cambia verso.
 *
 * Il 9:16 cambia soggetto, come chiede la derivazione verticale degli script: piu'
 * pitch e meno yaw (la camera guarda giu' per il documento), e ingrandimenti piu'
 * alti perche' il quadro e' stretto. Il 4:5 sta in mezzo.
 */
const PLAN: Record<Ratio, { enter: { yaw: number; pitch: number; slide: number }; beats: [number, number, number][] }> = {
  // [zoom, yaw, pitch] per le sei scene.
  "16x9": { enter: { yaw: -18, pitch: 5, slide: 900 }, beats: [[1.02, -13, 3.8], [1.06, -9.5, 3.0], [1.14, -6.5, 2.2], [1.45, -4.5, 1.6], [1.6, -2.5, 0.9], [2.1, -0.5, 0.2]] },
  "9x16": { enter: { yaw: -11, pitch: 8, slide: 420 }, beats: [[1.62, -8, 6.2], [1.66, -6, 4.8], [1.72, -4, 3.4], [1.95, -2.8, 2.4], [2.05, -1.5, 1.4], [2.3, -0.4, 0.4]] },
  "4x5": { enter: { yaw: -14, pitch: 6.5, slide: 640 }, beats: [[1.22, -10.5, 5.0], [1.26, -7.8, 3.9], [1.32, -5.3, 2.8], [1.62, -3.6, 2.0], [1.78, -2.0, 1.1], [2.2, -0.45, 0.3]] },
};

/** I fotogrammi in cui finisce ogni scena (gli stessi del master di un film da 45 secondi). */
export const SCENE_ENDS = [215, 440, 680, 860, 1060, 1265] as const;

const keysFor = (ratio: Ratio): PoseKey[] => {
  const stage = STAGES[ratio];
  const plan = PLAN[ratio];
  const subjects = [SUBJECTS.arrivi, SUBJECTS.lettura, SUBJECTS.struttura, SUBJECTS.numero, SUBJECTS.correzione, SUBJECTS.firma];
  const poses: Pose[] = subjects.map((sub, i) => {
    const [zoom, yaw, pitch] = plan.beats[i] as [number, number, number];
    const c = centreOn(stage, DEMO_RIG, DEMO_SLAB, sub);
    return { yaw, pitch, pushZ: pushForZoom(DEMO_RIG, zoom), slideX: c.slideX, slideY: c.slideY };
  });
  const first = poses[0] as Pose;
  const last = poses[poses.length - 1] as Pose;
  return [
    {
      at: 0,
      pose: { yaw: plan.enter.yaw, pitch: plan.enter.pitch, pushZ: 0, slideX: first.slideX + plan.enter.slide, slideY: first.slideY },
    },
    ...poses.map((pose, i) => ({ at: SCENE_ENDS[i] as number, pose })),
    { at: 1349, pose: { ...last, yaw: 0, pitch: 0 } },
  ];
};

export const DEMO_FRAMES = 1350;
export const DEMO_CAMERA_KEYS: Record<Ratio, PoseKey[]> = {
  "16x9": keysFor("16x9"),
  "9x16": keysFor("9x16"),
  "4x5": keysFor("4x5"),
};
