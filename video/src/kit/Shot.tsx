import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { cssPerspectiveOrigin } from "./rig";
import type { Rig, SlabSize } from "./rig";

/**
 * La ripresa di una lastra: il piano attenuato dietro, lo spessore, la lastra
 * nitida e la luce sul quadro.
 *
 * PERCHE' ESISTE. Fino a settembre 2026 questo blocco stava ricopiato a mano in
 * sei scene: prospettiva 2600, origine "50% 46%", `(1920 - SLAB_W) / 2`,
 * `scale(1.04)`, il piano dietro con i suoi sette numeri di parallasse. Sei
 * copie restano uguali finche' nessuno ne tocca una, e i banchi misuravano su
 * slab.ts mentre il render usava le copie. Adesso c'e' un componente solo, e le
 * scene gli passano la posa e il contenuto.
 *
 * NON CAMBIA UN PIXEL, e il motivo e' scritto nel modo in cui e' fatto: stessi
 * elementi, stesso ordine, stessi numeri calcolati con le stesse operazioni.
 * Dove una scena ometteva uno spostamento, qui vale zero, e sommare zero in
 * virgola mobile non cambia il risultato. `still-identity.sh` lo misura su
 * cinque fotogrammi di ogni scena contro il commit di prima.
 *
 * LO STAGE VIENE DALLA COMPOSITION (`useVideoConfig`), non da 1920 e 1080: la
 * stessa scena girata in 9:16 centra la lastra nel suo quadro.
 *
 * LO SPESSORE E' FRATELLO DELLA LASTRA, non figlio, e non e' un dettaglio: la
 * lastra ritaglia (`overflow: hidden`), e qualunque ritaglio appiattisce
 * `preserve-3d`. Un figlio a translateZ(-30) finirebbe schiacciato sul piano del
 * padre; da fratello, dentro la stessa prospettiva, il suo Z e' vero. (MAT-01)
 */

export type ShotPose = {
  yaw: number;
  pitch: number;
  pushZ: number;
  slideX: number;
  slideY: number;
};

/** L'aspetto della ripresa, separato dalla geometria: ogni prodotto porta il suo. */
export type ShotMaterial = {
  stage: { background: string; fontFamily: string };
  slab: {
    background: string;
    radius: number;
    border: string;
    shadow: string;
    /** Il filo di luce sul bordo basso: dice "oggetto fisico". */
    highlight: string;
  };
  /** MAT-01: stacco dietro il piano e debordo per lato, in pixel della lastra. */
  edge: {
    background: string;
    radius: number;
    shadow: string;
    depth: number;
    overhang: number;
  };
  /**
   * MAT-03: la stessa UI disegnata una seconda volta, sfocata e attenuata.
   * Segue la camera piu' lentamente della lastra (yawFollow, slideFollow), ed e'
   * inclinata di qualche grado in piu', cosi' non si legge come una copia
   * incollata.
   */
  backdrop: {
    perspective: number;
    perspectiveOrigin: string;
    opacity: number;
    blur: number;
    offsetX: number;
    offsetY: number;
    yawFollow: number;
    slideFollow: number;
    yawOffset: number;
    pitchOffset: number;
    scale: number;
    background: string;
    border: string;
    radius: number;
  };
  lighting: { vignette: string; sheen: string };
};

export type ShotProps = {
  rig: Rig;
  slab: SlabSize;
  material: ShotMaterial;
  pose: ShotPose;
  /** Il contenuto della lastra nitida. */
  children: React.ReactNode;
  /** Il contenuto del piano dietro: la stessa UI, di solito in versione attenuata. */
  backdrop: React.ReactNode;
  /** Il filo di luce sul bordo basso della lastra. PromptInput e BoardOrbit non lo hanno. */
  highlight?: boolean;
  /** Opacita' del quadro intero: UIMockup ci entra in dissolvenza. */
  opacity?: number;
};

export const Shot: React.FC<ShotProps> = ({
  rig,
  slab,
  material: m,
  pose,
  children,
  backdrop,
  highlight = true,
  opacity,
}) => {
  const { width, height } = useVideoConfig();
  const { yaw, pitch, pushZ, slideX, slideY } = pose;

  const bgYaw = yaw * m.backdrop.yawFollow;
  const bgSlideX = slideX * m.backdrop.slideFollow;
  const bgSlideY = slideY * m.backdrop.slideFollow;

  const left = (width - slab.w) / 2 + slideX;
  const top = (height - slab.h) / 2 + slideY;

  return (
    <AbsoluteFill
      style={{
        background: m.stage.background,
        fontFamily: m.stage.fontFamily,
        opacity,
      }}
    >
      <AbsoluteFill
        style={{
          perspective: m.backdrop.perspective,
          perspectiveOrigin: m.backdrop.perspectiveOrigin,
          opacity: m.backdrop.opacity,
          filter: `blur(${m.backdrop.blur}px)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: (width - slab.w) / 2 + m.backdrop.offsetX + bgSlideX,
            top: (height - slab.h) / 2 + m.backdrop.offsetY + bgSlideY,
            width: slab.w,
            height: slab.h,
            transform: `rotateY(${bgYaw + m.backdrop.yawOffset}deg) rotateX(${pitch + m.backdrop.pitchOffset}deg) scale(${m.backdrop.scale})`,
            transformOrigin: "50% 50%",
            background: m.backdrop.background,
            border: m.backdrop.border,
            borderRadius: m.backdrop.radius,
            overflow: "hidden",
          }}
        >
          {backdrop}
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          perspective: rig.perspective,
          perspectiveOrigin: cssPerspectiveOrigin(rig),
        }}
      >
        <div
          style={{
            position: "absolute",
            left: left - m.edge.overhang,
            top: top - m.edge.overhang,
            width: slab.w + m.edge.overhang * 2,
            height: slab.h + m.edge.overhang * 2,
            transform: `translateZ(${pushZ - m.edge.depth}px) rotateY(${yaw}deg) rotateX(${pitch}deg) scale(${rig.slabScale})`,
            transformOrigin: "50% 50%",
            background: m.edge.background,
            borderRadius: m.edge.radius,
            boxShadow: m.edge.shadow,
          }}
        />
        <div
          style={{
            position: "absolute",
            left,
            top,
            width: slab.w,
            height: slab.h,
            transform: `translateZ(${pushZ}px) rotateY(${yaw}deg) rotateX(${pitch}deg) scale(${rig.slabScale})`,
            transformOrigin: "50% 50%",
            transformStyle: "preserve-3d",
            background: m.slab.background,
            borderRadius: m.slab.radius,
            border: m.slab.border,
            boxShadow: m.slab.shadow,
            overflow: "hidden",
          }}
        >
          {children}

          {highlight ? (
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 3,
                background: m.slab.highlight,
              }}
            />
          ) : null}
        </div>
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: m.lighting.vignette,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: m.lighting.sheen,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
