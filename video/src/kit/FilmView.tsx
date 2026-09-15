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
  /**
   * CAM-05: quanto resta della ripresa sotto la tipografia, da 1 (tutta) in giu'.
   * La ripresa si ritira verso il colore del fondo con un velo fra la ripresa e
   * `overlay`, quindi la tipografia non si attenua. Gli script chiudono a 0,42:
   * una frase bianca sopra una lastra chiara regge fra 0,40 e 0,45. Abbassare
   * l'opacita' delle parti della UI non basta, perche' il fondo della lastra
   * resta chiaro (film-type.py lo misurava a 1,5:1 sotto la frase di chiusura).
   */
  dim?: number;
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
  /**
   * La passata della sola tipografia, che film-type.py usa come maschera delle
   * lettere: fondo nero, e della ripresa restano solo gli strati (`layers`), con
   * la stessa camera. Lastra, bordo, copia dietro, luce e velo spariscono qui, e
   * `content` e `backdrop` non si disegnano: il film decide solo quale tipografia
   * mostrare. La prima volta lo faceva ogni film col suo materiale trasparente, e
   * il primo film scritto fuori da questo repo lo ha dimenticato: la maschera
   * conteneva tutta la lastra.
   */
  solo?: boolean;
};

const soloMaterial = (m: ShotMaterial): ShotMaterial => ({
  stage: { ...m.stage, background: "#000000" },
  slab: { background: "transparent", radius: 0, border: "none", shadow: "none", highlight: "none" },
  edge: { ...m.edge, background: "transparent", shadow: "none" },
  backdrop: { ...m.backdrop, opacity: 0 },
  lighting: { vignette: "none", sheen: "none" },
});

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
export const Film: React.FC<FilmProps> = ({ rig, slab, material, screenLight, camera, shot, overlay, solo = false }) => {
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
        material={solo ? soloMaterial(material) : material}
        pose={pose}
        backdrop={solo ? null : s.backdrop}
        layers={s.layers}
        light={solo ? undefined : s.light}
        screenLight={solo ? undefined : screenLight}
        highlight={solo ? false : (s.highlight ?? true)}
      >
        {solo ? null : s.content}
      </Shot>
      {!solo && s.dim !== undefined && s.dim < 1 ? (
        <AbsoluteFill style={{ background: material.stage.background, opacity: 1 - Math.max(0, s.dim) }} />
      ) : null}
      {overlay ? <AbsoluteFill>{overlay(f)}</AbsoluteFill> : null}
    </AbsoluteFill>
  );
};
