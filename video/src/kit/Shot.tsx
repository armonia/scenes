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

/**
 * MAT-02: la luce dello schermo sul piano sotto la lastra. E' un piano che parte
 * dal bordo basso della lastra e si stende all'indietro, sfocato, del colore del
 * contenuto attivo: quando lo stato cambia, il colore cambia. Il materiale ne dice
 * la forma, la scena ne dice il colore e l'intensita' a ogni frame.
 */
export type ScreenLightMaterial = {
  /** Angolo del piano rispetto alla lastra, in gradi: 90 e' perpendicolare. */
  angle: number;
  /** Profondita' del piano, in pixel della lastra. */
  length: number;
  blur: number;
};
export type ScreenLight = { color: string; opacity: number };

/**
 * CAM-02: uno strato della lastra a una profondita' sua. Il rettangolo e' in
 * coordinate della lastra; `depth` in pixel verso la camera. Gli strati sono
 * piani fratelli della lastra, non figli: la lastra ritaglia (`overflow:
 * hidden`) e un ritaglio appiattisce la terza dimensione dei figli, quindi uno
 * strato dentro la lastra resterebbe sul suo piano e la parallasse non ci
 * sarebbe. Ognuno si ritaglia da se' sul suo rettangolo.
 */
export type ShotLayer = {
  depth: number;
  rect: { x: number; y: number; w: number; h: number };
  content: React.ReactNode;
  radius?: number;
  background?: string;
  /**
   * Se lo strato si ritaglia sul suo rettangolo (di default si'). Uno strato di
   * tipografia non deve: una frase ritagliata dal suo strato perde lettere in
   * silenzio, mentre una che esce dal quadro la vede film-type.py.
   */
  clip?: boolean;
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
  /** CAM-02: strati a profondita' diverse davanti alla lastra. Senza, la lastra e' un piano solo. */
  layers?: ShotLayer[];
  /** MAT-02: la luce dello schermo sul piano sotto. Serve anche `material.screenLight`. */
  light?: ScreenLight;
  screenLight?: ScreenLightMaterial;
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
  layers,
  light,
  screenLight,
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
        {light && screenLight ? (
          <div
            style={{
              position: "absolute",
              left,
              top: top + slab.h,
              width: slab.w,
              height: screenLight.length,
              // Lo stesso impianto della lastra, col perno sul centro della lastra
              // (mezza altezza sopra questo piano), poi la piega attorno al bordo
              // alto del piano, che coincide col bordo basso della lastra. In CSS
              // la trasformazione piu' a destra si applica per prima.
              transform: `translateZ(${pushZ}px) rotateY(${yaw}deg) rotateX(${pitch}deg) scale(${rig.slabScale}) translateY(${slab.h / 2}px) rotateX(${screenLight.angle}deg) translateY(${-slab.h / 2}px)`,
              transformOrigin: `50% ${-slab.h / 2}px`,
              background: `linear-gradient(to bottom, ${light.color}, transparent)`,
              opacity: light.opacity,
              filter: `blur(${screenLight.blur}px)`,
            }}
          />
        ) : null}
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
        {(layers ?? []).map((layer, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left,
              top,
              width: slab.w,
              height: slab.h,
              // La stessa trasformazione della lastra, e in fondo lo spostamento
              // verso la camera nel sistema della lastra: lo strato resta parallelo
              // alla lastra, `depth` pixel davanti.
              transform: `translateZ(${pushZ}px) rotateY(${yaw}deg) rotateX(${pitch}deg) scale(${rig.slabScale}) translateZ(${layer.depth}px)`,
              transformOrigin: "50% 50%",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: layer.rect.x,
                top: layer.rect.y,
                width: layer.rect.w,
                height: layer.rect.h,
                overflow: layer.clip === false ? "visible" : "hidden",
                borderRadius: layer.radius,
                background: layer.background,
              }}
            >
              {layer.content}
            </div>
          </div>
        ))}
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
