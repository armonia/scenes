import React from "react";
import {
  PROBE_ANCHORS,
  PROBE_HEADER_H,
  PROBE_PAD,
  PROBE_ROW_GAP,
  PROBE_ROW_H,
  PROBE_SLAB,
} from "./geometry";

/**
 * Il contenuto della lastra sonda: una lista generica su fondo chiaro.
 *
 * Abbastanza ricca da avere testo, fili e superfici diverse, cioe' le cose su
 * cui un banco puo' sbagliarsi, e abbastanza anonima da non somigliare a un
 * prodotto. Il font e' quello di sistema, come nelle scene di Topics.
 */

export const probeTokens = {
  bg: "#f4f3ef",
  surface: "#ffffff",
  line: "#dedbd3",
  text: "#1d1d22",
  muted: "#77757d",
  faint: "#b9b6ae",
  accent: "#2f6fdb",
} as const;

const fontStack =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif';

const ROWS = [
  "Rinnovo contratto fornitori",
  "Revisione listino autunno",
  "Onboarding nuovo cliente",
  "Report trimestrale",
  "Aggiornamento policy dati",
  "Pianificazione ferie team",
  "Migrazione archivio",
  "Verifica fatture aperte",
  "Presentazione board",
  "Chiusura progetto pilota",
  "Formazione sicurezza",
];

export const ProbeSlab: React.FC<{ marker?: boolean }> = ({ marker = false }) => {
  const t = PROBE_ANCHORS.target;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: probeTokens.bg,
        fontFamily: fontStack,
        color: probeTokens.text,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          right: 0,
          height: PROBE_HEADER_H,
          borderBottom: `1px solid ${probeTokens.line}`,
          background: probeTokens.surface,
          display: "flex",
          alignItems: "center",
          padding: `0 ${PROBE_PAD}px`,
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: -0.3,
        }}
      >
        Attività
        <span
          style={{
            marginLeft: "auto",
            fontSize: 22,
            fontWeight: 500,
            color: probeTokens.muted,
          }}
        >
          11 aperte
        </span>
      </div>

      {ROWS.map((label, i) => {
        const y = PROBE_HEADER_H + PROBE_PAD + i * (PROBE_ROW_H + PROBE_ROW_GAP);
        return (
          <div
            key={label}
            style={{
              position: "absolute",
              left: PROBE_PAD,
              top: y,
              width: PROBE_SLAB.w - PROBE_PAD * 2,
              height: PROBE_ROW_H,
              background: probeTokens.surface,
              border: `1px solid ${probeTokens.line}`,
              borderRadius: 8,
              padding: "0 28px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 20, color: probeTokens.muted }}>
              {`${3 + ((i * 5) % 9)} voci · aggiornata ${1 + ((i * 7) % 12)}h fa`}
            </div>
          </div>
        );
      })}

      {/* Il bersaglio: una card accentata esattamente sull'ancora. */}
      <div
        style={{
          position: "absolute",
          left: t.x,
          top: t.y,
          width: t.w,
          height: t.h,
          background: probeTokens.surface,
          border: `3px solid ${probeTokens.accent}`,
          borderRadius: 10,
          boxShadow: "0 18px 40px rgba(30,30,40,0.18)",
          padding: "26px 30px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 700 }}>Card bersaglio</div>
        <div style={{ fontSize: 22, color: probeTokens.muted, marginTop: 10 }}>
          ancora `target` · 520 x 220
        </div>
      </div>

      {marker ? <AnchorMarker x={t.x + t.w / 2} y={t.y + t.h / 2} /> : null}
    </div>
  );
};

/**
 * Il segno che i banchi cercano nei pixel: un anello magenta pieno centrato sul
 * punto. Magenta perche' non compare in nessuna delle due lastre, quindi la
 * maschera prende solo lui; un anello e non un punto perche' resta simmetrico
 * anche quando la spinta lo ingrandisce, e il suo baricentro e' il centro.
 *
 * Sta sopra tutto (zIndex): sulla board di Topics la card in viaggio vive a
 * zIndex 10, e il primo render di questo specimen aveva il segno nascosto
 * proprio sotto la card che doveva marcare.
 */
export const AnchorMarker: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <div
    style={{
      position: "absolute",
      left: x - 18,
      top: y - 18,
      width: 36,
      height: 36,
      borderRadius: 18,
      border: "8px solid #ff00ff",
      boxSizing: "border-box",
      zIndex: 1000,
    }}
  />
);
