import React from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { Film } from "../../kit/FilmView";
import type { FilmFrame } from "../../kit/FilmView";
import { filmCamera } from "../../kit/filmCamera";
import type { ShotMaterial } from "../../kit/Shot";
import { TypeLine, Companion } from "../../kit/TypeLine";
import { DEMO_CAMERA_KEYS, DEMO_FRAMES, DEMO_RIG, DEMO_SLAB, DOC, HEADER_H, INBOX, PANEL } from "./geometry";
import { DEMO, DemoFlat, DemoPart } from "./Slab";
import { cuesFor, stateAt } from "./timeline";

/** Il formato casa: fondo nero, testo bianco, accento giallo su una parola. */
const INK = { bg: "#000000", text: "#ffffff", accent: "#fff96b" };

const MATERIAL: ShotMaterial = {
  stage: { background: INK.bg, fontFamily: DEMO.font },
  slab: {
    background: DEMO.bg,
    radius: 22,
    border: "1px solid rgba(255,255,255,0.18)",
    shadow: "0 80px 160px rgba(0,0,0,0.78)",
    highlight: "linear-gradient(to right, transparent, rgba(255,255,255,0.35) 50%, transparent)",
  },
  // MAT-01: spessore 30 dietro il piano, 6 px di sporgenza, ombra di contatto 90/180 al 75%.
  edge: { background: "#0b0b10", radius: 26, shadow: "0 90px 180px rgba(0,0,0,0.75)", depth: 30, overhang: 6 },
  // MAT-03: la copia attenuata a 0,45 con blur 14, 60 indietro, 8 gradi di yaw in piu'.
  backdrop: {
    perspective: 2600,
    perspectiveOrigin: "50% 46%",
    opacity: 0.45,
    blur: 14,
    offsetX: -180,
    offsetY: -60,
    yawFollow: 0.6,
    slideFollow: 0.45,
    yawOffset: 8,
    pitchOffset: 4,
    scale: 0.92,
    background: DEMO.bg,
    border: "1px solid rgba(255,255,255,0.1)",
    radius: 22,
  },
  lighting: {
    vignette: "radial-gradient(130% 90% at 50% 52%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)",
    sheen: "linear-gradient(to bottom, rgba(255,255,255,0.03) 0%, transparent 8%)",
  },
};

const CAMERA = {
  "16x9": filmCamera(DEMO_CAMERA_KEYS["16x9"], DEMO_FRAMES),
  "9x16": filmCamera(DEMO_CAMERA_KEYS["9x16"], DEMO_FRAMES),
  "4x5": filmCamera(DEMO_CAMERA_KEYS["4x5"], DEMO_FRAMES),
};

/**
 * Il film di esempio: Registro, 45 secondi, un'inquadratura sola.
 *
 * E' la ricetta di un commercial in un file: la camera per formato
 * (geometry.ts), cosa succede sulla lastra (timeline.ts), la UI (Slab.tsx), e
 * qui il montaggio di tutto sul componente `Film` del kit. Un film nuovo cambia
 * quei tre file e questo; il kit resta quello.
 */
export const DemoFilm: React.FC = () => (
  <Film
    rig={DEMO_RIG}
    slab={DEMO_SLAB}
    material={MATERIAL}
    screenLight={{ angle: 76, length: 520, blur: 22 }}
    camera={CAMERA}
    shot={({ frame, ratio }: FilmFrame) => {
      const state = stateAt(frame);
      const cues = cuesFor(ratio);
      return {
        content: <div style={{ position: "absolute", inset: 0, background: DEMO.bg }} />,
        backdrop: <DemoFlat state={state} frame={frame} />,
        light: state.light,
        // CAM-02: le parti della UI a profondita' diverse, come negli script:
        // header 6, colonna 10, pannello 18, documento 26, blocco attivo 40.
        layers: [
          { depth: 6, rect: { x: 0, y: 0, w: DEMO_SLAB.w, h: HEADER_H }, content: <DemoPart part="header" state={state} frame={frame} /> },
          { depth: 10, rect: INBOX, content: <DemoPart part="rail" state={state} frame={frame} offset={INBOX} /> },
          { depth: 18, rect: PANEL, content: <DemoPart part="panel" state={state} frame={frame} offset={PANEL} />, radius: 18 },
          { depth: 26, rect: DOC, content: <DemoPart part="doc" state={state} frame={frame} offset={DOC} />, radius: 18 },
          {
            depth: 40,
            rect: { x: 0, y: 0, w: DEMO_SLAB.w, h: DEMO_SLAB.h },
            content: <DemoPart part="active" state={state} frame={frame} />,
          },
          // TYP-10: la prima frase vive sul piano della lastra, sopra il bordo alto,
          // dove sotto c'e' il nero del fondo e non la UI chiara.
          {
            depth: 0,
            rect: { x: 0, y: -360, w: DEMO_SLAB.w, h: 340 },
            content: (
              <div style={{ position: "absolute", left: DOC.x, right: 0, bottom: 40 }}>
                <TypeLine cues={cues.plane} frame={frame} size={96} fontFamily={DEMO.font} color={INK.text} accentColor={INK.accent} align="left" />
              </div>
            ),
          },
        ],
      };
    }}
    overlay={({ frame, ratio, stage }: FilmFrame) => {
      const cues = cuesFor(ratio);
      const size = ratio === "16x9" ? stage.w * 0.074 : stage.w * 0.11;
      const ground = interpolate(frame, [440, 470, 1040, 1060, 1200, 1215], [0, 1, 1, 0, 0, 1], {
        easing: Easing.inOut(Easing.cubic),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return (
        <>
          {/* Sotto la frase sul vetro, un fondo scuro che le da' contrasto sulla lastra chiara. */}
          <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0) 55%)", opacity: ground }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: stage.h * (ratio === "9x16" ? 0.22 : 0.12) }}>
            <TypeLine cues={cues.glass} frame={frame} size={size} fontFamily={DEMO.font} color={INK.text} accentColor={INK.accent} weight={600} />
          </div>
          {/* TYP-09: il compagno su un altro asse, nella chiusura. */}
          <Companion
            text="Registro · RQ-2026-014"
            size={stage.w * 0.015}
            fontFamily={DEMO.font}
            color={INK.text}
            opacity={interpolate(frame, [1290, 1310], [0, 0.7], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
            left={stage.w * 0.05}
            bottom={stage.h * 0.08}
          />
        </>
      );
    }}
  />
);
