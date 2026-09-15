import React from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { Film } from "../../kit/FilmView";
import type { FilmFrame } from "../../kit/FilmView";
import { filmCamera } from "../../kit/filmCamera";
import { useFontFile } from "../../kit/font";
import type { ShotLayer, ShotMaterial } from "../../kit/Shot";
import { Companion, Lockup, TypeLine } from "../../kit/TypeLine";
import {
  DEMO_CAMERA_KEYS,
  DEMO_FRAMES,
  DEMO_RIG,
  DEMO_SLAB,
  DOC,
  HEADER_H,
  INBOX,
  PANEL,
} from "./geometry";
import { DEMO, DEMO_FONT, DemoFlat, DemoPart } from "./Slab";
import { COMPANION, LOCKUP, LOCKUP_LIFT_AT, cuesFor, stateAt } from "./timeline";

/** Il formato casa: fondo nero, testo bianco, accento giallo su una parola. */
const INK = { bg: "#000000", text: "#ffffff", accent: "#fff96b" };

const MATERIAL: ShotMaterial = {
  stage: { background: INK.bg, fontFamily: DEMO.font },
  slab: {
    background: DEMO.bg,
    radius: 22,
    border: "1px solid rgba(255,255,255,0.18)",
    shadow: "0 80px 160px rgba(0,0,0,0.78)",
    highlight:
      "linear-gradient(to right, transparent, rgba(255,255,255,0.35) 50%, transparent)",
  },
  // MAT-01: spessore 30 dietro il piano, 6 px di sporgenza, ombra di contatto 90/180 al 75%.
  edge: {
    background: "#0b0b10",
    radius: 26,
    shadow: "0 90px 180px rgba(0,0,0,0.75)",
    depth: 30,
    overhang: 6,
  },
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
    vignette:
      "radial-gradient(130% 90% at 50% 52%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)",
    sheen:
      "linear-gradient(to bottom, rgba(255,255,255,0.03) 0%, transparent 8%)",
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
export type DemoFilmProps = {
  /**
   * Solo uno strato della tipografia, bianco pieno sul nero: e' la maschera con
   * cui film-type.py sa dove sono le lettere nel render completo. Uno strato alla
   * volta, perche' ognuno ha la sua soglia e il suo fondo.
   */
  solo?: "piano" | "vetro" | "compagno" | "marchio";
  /**
   * La copia guasta per i negativi di film-type.py: "tipo-grande" raddoppia il
   * corpo delle frasi (escono dal quadro), "senza-fondo" toglie il fondo scuro
   * sotto le frasi sul vetro (il bianco resta sulla lastra chiara),
   * "maschera-con-lastra" rende la lastra anche nella passata della maschera,
   * che e' l'errore di un film che non passa `solo` a `Film`: lo strumento deve
   * accorgersi che non sta misurando lettere.
   */
  guasto?: "tipo-grande" | "senza-fondo" | "maschera-con-lastra";
};

export const DemoFilm: React.FC<DemoFilmProps> = ({ solo, guasto }) => {
  useFontFile(DEMO_FONT);
  return (
    <Film
      rig={DEMO_RIG}
      slab={DEMO_SLAB}
      material={MATERIAL}
      screenLight={{ angle: 76, length: 520, blur: 22 }}
      solo={solo !== undefined && guasto !== "maschera-con-lastra"}
      camera={CAMERA}
      shot={({ frame, ratio }: FilmFrame) => {
        const state = stateAt(frame);
        const cues = cuesFor(ratio);
        // TYP-10: la prima frase vive sul piano della lastra, sopra il bordo alto,
        // dove sotto c'e' il nero del fondo e non la UI chiara. Lo strato non si
        // ritaglia: una frase troppo grande deve uscire dal quadro, dove
        // film-type.py la vede, e non perdere lettere dentro il suo rettangolo.
        const planeType = (accentColor: string): ShotLayer => ({
          depth: 0,
          rect: { x: 0, y: -360, w: DEMO_SLAB.w, h: 340 },
          clip: false,
          content: (
            <div
              style={{
                position: "absolute",
                left: DOC.x,
                right: 0,
                bottom: 40,
              }}
            >
              <TypeLine
                cues={cues.plane}
                frame={frame}
                size={
                  (ratio === "16x9" ? 96 : 52) *
                  (guasto === "tipo-grande" ? 2 : 1)
                }
                fontFamily={DEMO.font}
                color={INK.text}
                accentColor={accentColor}
                align="left"
              />
            </div>
          ),
        });
        if (solo) {
          // La passata della maschera: al piu' la frase sul piano, nella stessa
          // prospettiva. Il resto lo toglie `Film`.
          return {
            content: null,
            backdrop: null,
            layers: solo === "piano" ? [planeType(INK.text)] : [],
          };
        }
        return {
          content: (
            <div
              style={{ position: "absolute", inset: 0, background: DEMO.bg }}
            />
          ),
          backdrop: <DemoFlat state={state} frame={frame} />,
          light: state.light,
          dim: state.dim,
          // CAM-02: le parti della UI a profondita' diverse, come negli script:
          // header 6, colonna 10, pannello 18, documento 26, blocco attivo 40.
          layers: [
            {
              depth: 6,
              rect: { x: 0, y: 0, w: DEMO_SLAB.w, h: HEADER_H },
              content: <DemoPart part="header" state={state} frame={frame} />,
            },
            {
              depth: 10,
              rect: INBOX,
              content: (
                <DemoPart
                  part="rail"
                  state={state}
                  frame={frame}
                  offset={INBOX}
                />
              ),
            },
            {
              depth: 18,
              rect: PANEL,
              content: (
                <DemoPart
                  part="panel"
                  state={state}
                  frame={frame}
                  offset={PANEL}
                />
              ),
              radius: 18,
            },
            {
              depth: 26,
              rect: DOC,
              content: (
                <DemoPart part="doc" state={state} frame={frame} offset={DOC} />
              ),
              radius: 18,
            },
            {
              depth: 40,
              rect: { x: 0, y: 0, w: DEMO_SLAB.w, h: DEMO_SLAB.h },
              content: <DemoPart part="active" state={state} frame={frame} />,
            },
            planeType(INK.accent),
          ],
        };
      }}
      overlay={({ frame, ratio, stage }: FilmFrame) => {
        const cues = cuesFor(ratio);
        const size =
          (ratio === "16x9" ? stage.w * 0.074 : stage.w * 0.11) *
          (guasto === "tipo-grande" ? 2 : 1);
        // In 9:16 la frase sta piu' in alto (sotto ci sono i comandi delle
        // piattaforme): il fondo scuro sale con lei. Tarato sul 16:9, in verticale
        // lasciava la frase a 2,8:1 (film-type.py).
        const base = ratio === "9x16" ? 0.22 : 0.12;
        // Nella chiusura la frase sale di un blocco per lasciare il posto al
        // marchio, che prende la fascia che era sua.
        const lift = frame >= LOCKUP_LIFT_AT ? base + 0.13 : base;
        const ground = interpolate(
          frame,
          [440, 470, 1040, 1060, 1140, 1160],
          [0, 1, 1, 0, 0, 1],
          {
            easing: Easing.inOut(Easing.cubic),
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        );
        return (
          <>
            {/* Sotto la frase sul vetro, un fondo scuro che le da' contrasto sulla lastra chiara. */}
            {solo || guasto === "senza-fondo" ? null : (
              <AbsoluteFill
                style={{
                  background: `linear-gradient(to top, rgba(0,0,0,0.82), rgba(0,0,0,0.7) ${(base + 0.1) * 100}%, rgba(0,0,0,0) ${(lift + 0.48) * 100}%)`,
                  opacity: ground,
                }}
              />
            )}
            {solo && solo !== "vetro" ? null : (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: stage.h * lift,
                }}
              >
                <TypeLine
                  cues={cues.glass}
                  frame={frame}
                  size={size}
                  fontFamily={DEMO.font}
                  color={INK.text}
                  accentColor={solo ? INK.text : INK.accent}
                  weight={600}
                />
              </div>
            )}
            {/* La chiusura col marchio: il prodotto porta il suo, qui scritto in DOM. */}
            {(solo && solo !== "marchio") || frame < LOCKUP.at ? null : (
              <div style={{ position: "absolute", left: 0, right: 0, bottom: stage.h * base }}>
                <Lockup
                  at={LOCKUP.at}
                  frame={frame}
                  size={stage.w * (ratio === "16x9" ? 0.016 : 0.026)}
                  fontFamily={DEMO.font}
                  color={INK.text}
                  lines={LOCKUP.lines}
                  wordmark={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.42em", fontSize: "1.7em", fontWeight: 650, letterSpacing: "-0.02em" }}>
                      {/* Il segno del marchio non e' una lettera: fuori dalla maschera, o film-type.py misurerebbe il viola del marchio come tipografia. */}
                      <span style={{ width: "0.72em", height: "0.72em", borderRadius: "0.2em", background: solo ? "transparent" : DEMO.ui }} />
                      Registro
                    </span>
                  }
                />
              </div>
            )}
            {/* TYP-09: il compagno su un altro asse, nella chiusura. */}
            {solo && solo !== "compagno" ? null : (
              <Companion
                text={COMPANION.text}
                // Gli script: 1,5cqw in basso a sinistra nel 16:9; 2,4cqw a x 40,
                // ancorato in alto, nei verticali.
                size={stage.w * (ratio === "16x9" ? 0.015 : 0.024)}
                fontFamily={DEMO.font}
                color={INK.text}
                opacity={interpolate(frame, [COMPANION.from, COMPANION.to], [0, solo ? 1 : COMPANION.opacity], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })}
                left={ratio === "16x9" ? stage.w * 0.05 : 40}
                edge={stage.h * (ratio === "16x9" ? 0.08 : 0.1)}
                anchor={ratio === "16x9" ? "bottom" : "top"}
              />
            )}
          </>
        );
      }}
    />
  );
};
