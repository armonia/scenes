import { STAGES } from "../../../kit/stage.ts";
import type { Ratio } from "../../../kit/stage.ts";
import { project } from "../../../kit/project.ts";
import { poseAt } from "../../../kit/camera.ts";
import { tempo } from "../../../primitives/tempo.ts";
import {
  BOARD_LEFT,
  BOARD_TOP,
  BOARD_W,
  COL_HEADER_H,
  HANDOFF_FROM_COL,
  HANDOFF_TO_COL,
  THREAD_TOP,
  TOPICS_RIG,
  TOPICS_SLAB,
  columnX,
} from "../geometry.ts";
import { CARD_HANDOFF_BASE, CARD_HANDOFF_DRAG_START, LAG, RELEASE } from "../handoff.ts";
import { cardHandoffTrack } from "../tracks.ts";

type Catalog = {
  scenes: { id: string; durationInFrames: number; fps: number }[];
  tempoFixtures: { id: string; scene: string; durationInFrames: number }[];
};

/** La scala dell'immagine della lastra raddrizzata: 2400x1200 diventa 960x480. */
const SCALE = 0.4;
const SAMPLES = 7;

/**
 * handoff-travel.py: in che fotogrammi guardare il trascinamento di CardHandoff, e
 * come riportare ognuno di quei fotogrammi sulla lastra.
 *
 * PERCHE' SULLA LASTRA. In 9:16 e 4:5 la camera segue la card mentre la mano la
 * trascina: sullo schermo la card si sposta di poche decine di pixel e tutta la
 * board le scorre sotto. Una differenza fra due fotogrammi dello schermo misura
 * la panoramica, non il gesto. Il banco invece raddrizza ogni fotogramma sulla
 * lastra con la trasformazione prospettica della camera a quel frame, e li' la
 * board sta ferma e si muove solo quello che si muove davvero: la card, la mano,
 * la colonna che si richiude. Per farlo gli servono i quattro angoli della
 * lastra proiettati a ogni campione, e il modulo glieli da'. Dove sta la card no:
 * quella la trova il banco nei pixel.
 *
 * I CAMPIONI STANNO DENTRO IL TRASCINAMENTO, dalla partenza della mano (piu' il
 * ritardo della card) al rilascio. Prima prendevano anche il tratto prima della
 * presa, dove camera e cursore si muovono gia', e un taglio secco a meta' scena
 * passava con quattro campioni buoni.
 *
 * LE INTESTAZIONI DELLE COLONNE NON SI MUOVONO durante il trascinamento (i
 * contatori cambiano dopo il rilascio), e sono il controllo del raddrizzamento:
 * se il render segue davvero la camera del rapporto, sulla lastra restano
 * identiche; se no (un fermo immagine, un render al contrario o tagliato, la
 * posa di un altro rapporto) si spostano, perche' raddrizzare la stessa immagine
 * con due camere diverse la fa scorrere. La prima versione di questo banco non
 * lo controllava, e in 9:16 un fermo immagine attraversava 208 px.
 *
 * LA SOGLIA E' META' DELLA DISTANZA FRA LE DUE COLONNE, sulla lastra: una card
 * che non arriva almeno a meta' strada non ha cambiato posto. E' una distanza fra
 * slot, uguale in ogni rapporto, e non la posizione della card.
 */
export const geometry = (ratio: Ratio, { catalog }: { catalog: Catalog }) => {
  const stage = STAGES[ratio];
  const scene = catalog.scenes.find((s) => s.id === "CardHandoff");
  if (!scene) throw new Error("catalog.json: manca CardHandoff");
  const W = TOPICS_SLAB.w;
  const H = TOPICS_SLAB.h;
  const variants = [
    { id: "CardHandoff", durationInFrames: scene.durationInFrames },
    ...catalog.tempoFixtures
      .filter((f) => f.scene === "CardHandoff")
      .map((f) => ({ id: f.id, durationInFrames: f.durationInFrames })),
  ].map((v) => {
    const T = tempo(v.durationInFrames, CARD_HANDOFF_BASE);
    const from = Math.ceil(T.at(CARD_HANDOFF_DRAG_START) + LAG);
    const to = Math.floor(T.at(RELEASE));
    const frames = Array.from({ length: SAMPLES }, (_, i) => Math.round(from + ((to - from) * i) / (SAMPLES - 1)));
    const track = cardHandoffTrack(v.durationInFrames, ratio);
    const samples = frames.map((f) => {
      const pose = poseAt(track, f);
      const corners = [
        [0, 0],
        [W, 0],
        [W, H],
        [0, H],
      ].map(([x, y]) => {
        const p = project(stage, TOPICS_RIG, TOPICS_SLAB, pose, { x: x as number, y: y as number });
        return { sx: Number(p.x.toFixed(3)), sy: Number(p.y.toFixed(3)), x: (x as number) * SCALE, y: (y as number) * SCALE };
      });
      return { frame: f, corners };
    });
    return { id: v.id, durationInFrames: v.durationInFrames, samples };
  });
  const s = (n: number) => Math.round(n * SCALE);
  return {
    stage: { w: stage.w, h: stage.h },
    slab: { w: s(W), h: s(H) },
    // La meta' alta della board, sulla lastra raddrizzata: sotto c'e' il thread,
    // che non partecipa al gesto.
    board: { x: s(BOARD_LEFT), y: s(BOARD_TOP), w: s(BOARD_W), h: s(THREAD_TOP - 16 - BOARD_TOP) },
    // Le righe della zona board che non devono cambiare: le intestazioni.
    stillRows: s(COL_HEADER_H),
    minTravel: Number((((columnX(HANDOFF_TO_COL) - columnX(HANDOFF_FROM_COL)) * SCALE) / 2).toFixed(1)),
    variants,
  };
};
