import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { stageFor } from "./stage";
import type { Ratio, Stage } from "./stage";
import type { Pose } from "./project";
import type { Rig, SlabSize } from "./rig";
import { Shot } from "./Shot";
import type { ScreenLight, ScreenLightMaterial, ShotLayer, ShotMaterial } from "./Shot";
import type { FilmCamera } from "./filmCamera";

/** Quello che una battuta del film sa del momento in cui viene disegnata. */
export type FilmFrame = { frame: number; ratio: Ratio; stage: Stage; pose: Pose };

/** Quello che il prodotto disegna a un fotogramma. */
export type FilmShot = {
  /** Il contenuto della lastra nitida. */
  content: React.ReactNode;
  /** La stessa UI per il piano attenuato dietro (MAT-03). */
  backdrop: React.ReactNode;
  /** CAM-02: strati a profondita' diverse. */
  layers?: ShotLayer[];
  /** MAT-02: colore e intensita' della luce dello schermo sul piano. */
  light?: ScreenLight;
  highlight?: boolean;
};

export type FilmProps = {
  rig: Rig;
  slab: SlabSize;
  material: ShotMaterial;
  screenLight?: ScreenLightMaterial;
  /** La camera per ogni rapporto in cui il film esce. */
  camera: Partial<Record<Ratio, FilmCamera>>;
  /** La lastra a un fotogramma. */
  shot: (f: FilmFrame) => FilmShot;
  /** Quello che sta sopra la ripresa, nello spazio del quadro: tipografia sul vetro, chiusura. */
  overlay?: (f: FilmFrame) => React.ReactNode;
};

/**
 * Un commercial: una ripresa sola dal primo all'ultimo fotogramma.
 *
 * PERCHE' E' COSI' POCO. Il film non ha scene nel senso delle composition di
 * Topics: la camera e' una traccia sola (filmCamera.ts), la lastra e' una sola, e
 * le scene sono tratti di tempo in cui il prodotto fa una cosa. Quindi il
 * componente legge il fotogramma e il rapporto, chiede la posa alla camera di
 * quel rapporto, chiede al prodotto cosa disegnare, e passa tutto a `Shot`.
 * Tutto il resto (quando atterra una card, quando si scrive, quando il cursore
 * esita) lo decide il prodotto con le funzioni del kit, che sono funzioni del
 * fotogramma: il film resta frame-locked per costruzione.
 *
 * UN RAPPORTO SENZA CAMERA NON RIPIEGA SUL 16:9. Le pose di un 9:16 non sono
 * quelle di un 16:9 ristrette: gli script le ricalcolano per formato. Se manca,
 * il film lo dice invece di uscire con l'inquadratura sbagliata.
 */
export const Film: React.FC<FilmProps> = ({ rig, slab, material, screenLight, camera, shot, overlay }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const stage = stageFor(width, height);
  const cam = camera[stage.ratio];
  if (!cam) throw new Error(`il film non ha una camera per ${stage.ratio}`);
  const pose = cam.poseAt(frame);
  const f: FilmFrame = { frame, ratio: stage.ratio, stage, pose };
  const s = shot(f);
  return (
    <AbsoluteFill>
      <Shot
        rig={rig}
        slab={slab}
        material={material}
        pose={pose}
        backdrop={s.backdrop}
        layers={s.layers}
        light={s.light}
        screenLight={screenLight}
        highlight={s.highlight ?? true}
      >
        {s.content}
      </Shot>
      {overlay ? <AbsoluteFill>{overlay(f)}</AbsoluteFill> : null}
    </AbsoluteFill>
  );
};
