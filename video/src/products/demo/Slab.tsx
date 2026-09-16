import React from "react";
import { Cursor } from "../../primitives/Cursor";
import {
  ASSIST_FIELD,
  DEMO_SLAB,
  DOC,
  HEADER_H,
  INBOX,
  INBOX_ROW_H,
  LETTER,
  PANEL,
  RAIL_W,
  SEND_BUTTON,
  STATUS_ROW_H,
  TOTAL,
  inboxRowY,
  sectionRect,
  statusRect,
} from "./geometry";
import { LETTER_TEXT } from "./timeline";
import type { DemoState } from "./timeline";

/**
 * Il carattere di Registro: Inter 4.001, da file (video/public/fonts, licenza OFL
 * nella stessa cartella). Da file e non di sistema perche' il film deve avere le
 * stesse righe sul Mac e in CI: film-type.py misura quanto le frasi stanno dal
 * bordo. Lo carica DemoFilm con useFontFile.
 */
export const DEMO_FONT = { family: "InterVariable", file: "fonts/InterVariable.woff2" };

/** La palette di Registro: chiara, con un viola d'interfaccia. Inventata. */
export const DEMO = {
  bg: "#f5f4f1",
  surface: "#ffffff",
  line: "#e4e1dc",
  text: "#1c1b22",
  muted: "#77737f",
  ui: "#6d5ae6",
  uiSoft: "#ece9fd",
  ok: "#1f9d6b",
  font: `${DEMO_FONT.family}, sans-serif`,
};

type Part = "header" | "rail" | "doc" | "panel" | "active";

const box = (r: { x: number; y: number; w: number; h: number }): React.CSSProperties => ({
  position: "absolute",
  left: r.x,
  top: r.y,
  width: r.w,
  height: r.h,
});

/**
 * La UI di Registro a un fotogramma, divisa in parti.
 *
 * DIVISA IN PARTI PER LA PARALLASSE (CAM-02). Il film mette header, colonna degli
 * arrivi, documento, pannello e blocco attivo su strati a profondita' diverse, e
 * ogni strato disegna solo la sua parte. Le coordinate restano quelle della
 * lastra: uno strato e' ritagliato sul suo rettangolo, e il contenuto dentro si
 * sposta del rettangolo per restare dov'era.
 */
export const DemoPart: React.FC<{ part: Part; state: DemoState; frame: number; offset?: { x: number; y: number } }> = ({
  part,
  state,
  frame,
  offset = { x: 0, y: 0 },
}) => {
  const shift = (r: { x: number; y: number; w: number; h: number }) => box({ ...r, x: r.x - offset.x, y: r.y - offset.y });
  const dim = state.attn;
  if (part === "header") {
    return (
      <div style={{ ...shift({ x: 0, y: 0, w: DEMO_SLAB.w, h: HEADER_H }), display: "flex", alignItems: "center", padding: "0 28px", gap: 18, fontFamily: DEMO.font, opacity: dim }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: DEMO.ui }} />
        <div style={{ fontSize: 22, fontWeight: 600, color: DEMO.text }}>Registro</div>
        <div style={{ fontSize: 18, color: DEMO.muted }}>Richieste · Studio Neri</div>
      </div>
    );
  }
  if (part === "rail") {
    return (
      <div style={{ ...shift(INBOX), fontFamily: DEMO.font, opacity: dim }}>
        <div style={{ position: "absolute", left: 0, top: 8, fontSize: 17, fontWeight: 600, color: DEMO.muted, letterSpacing: "0.04em" }}>ARRIVI</div>
        {state.inbox.map((it, i) => {
          // TXT-04: le righe sotto scendono del varco prima che la nuova atterri.
          const y = inboxRowY(i) - INBOX.y;
          return (
            <div
              key={it.title}
              style={{
                position: "absolute",
                left: 0,
                top: y + (1 - it.enter) * 30,
                width: INBOX.w,
                height: INBOX_ROW_H,
                borderRadius: 14,
                background: DEMO.surface,
                border: `1px solid ${DEMO.line}`,
                padding: "16px 18px",
                boxSizing: "border-box",
                opacity: it.enter,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 600, color: DEMO.text }}>{it.title}</div>
              <div style={{ fontSize: 16, color: DEMO.muted, marginTop: 6 }}>{it.note}</div>
            </div>
          );
        })}
      </div>
    );
  }
  if (part === "doc") {
    return (
      <div style={{ ...shift(DOC), background: DEMO.surface, borderRadius: 18, border: `1px solid ${DEMO.line}`, fontFamily: DEMO.font }}>
        <div style={{ ...box({ x: LETTER.x - DOC.x, y: LETTER.y - DOC.y, w: LETTER.w, h: LETTER.h }) }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: DEMO.muted, letterSpacing: "0.04em" }}>RICHIESTA</div>
          {LETTER_TEXT.map((line, i) => {
            // La lettura: una fascia che passa riga per riga.
            const lineProgress = Math.max(0, Math.min(1, state.highlight * LETTER_TEXT.length - i));
            return (
              <div key={i} style={{ position: "relative", fontSize: 26, lineHeight: "52px", color: DEMO.text, marginTop: i === 0 ? 18 : 0 }}>
                <div style={{ position: "absolute", left: -8, top: 8, height: 36, width: `${lineProgress * 100}%`, background: DEMO.uiSoft, borderRadius: 6 }} />
                <span style={{ position: "relative" }}>{line}</span>
              </div>
            );
          })}
        </div>
        {state.sections.map((s, i) => {
          const r = sectionRect(i);
          return (
            <div
              key={s.name}
              style={{
                ...box({ x: r.x - DOC.x, y: r.y - DOC.y, w: r.w, h: r.h }),
                borderRadius: 14,
                border: `1px solid ${s.confirmed ? DEMO.ui : DEMO.line}`,
                background: s.confirmed ? DEMO.uiSoft : "transparent",
                display: "flex",
                alignItems: "center",
                padding: "0 24px",
                boxSizing: "border-box",
                gap: 16,
                opacity: state.attn,
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 600, color: DEMO.text, width: 180 }}>{s.name}</div>
              <div style={{ flex: 1, height: 12, borderRadius: 6, background: DEMO.line, transform: `scaleX(${0.35 + 0.65 * s.filled})`, transformOrigin: "0 50%" }} />
            </div>
          );
        })}
        <div
          style={{
            ...box({ x: TOTAL.x - DOC.x, y: TOTAL.y - DOC.y, w: TOTAL.w, h: TOTAL.h }),
            borderRadius: 16,
            background: DEMO.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 32px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ fontSize: 22, color: DEMO.muted }}>Totale stimato</div>
          {/* TXT-03: cifre a larghezza fissa, cosi' il numero non cambia larghezza mentre sale. */}
          <div style={{ fontSize: 64, fontWeight: 650, color: DEMO.text, fontVariantNumeric: "tabular-nums" }}>
            € {String(Math.round(state.total)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
          </div>
        </div>
      </div>
    );
  }
  if (part === "panel") {
    return (
      <div style={{ ...shift(PANEL), background: DEMO.surface, borderRadius: 18, border: `1px solid ${DEMO.line}`, fontFamily: DEMO.font }}>
        <div style={{ position: "absolute", left: 24, top: ASSIST_FIELD.y - PANEL.y - 44, fontSize: 17, fontWeight: 600, color: DEMO.muted, letterSpacing: "0.04em" }}>ASSISTENTE</div>
        <div
          style={{
            ...box({ x: ASSIST_FIELD.x - PANEL.x, y: ASSIST_FIELD.y - PANEL.y, w: ASSIST_FIELD.w, h: ASSIST_FIELD.h }),
            borderRadius: 14,
            border: `2px solid ${state.focused ? DEMO.ui : DEMO.line}`,
            padding: 18,
            boxSizing: "border-box",
            fontSize: 22,
            lineHeight: 1.4,
            color: state.typed ? DEMO.text : DEMO.muted,
          }}
        >
          {state.typed || "Chiedi una modifica"}
          {state.focused && Math.floor(frame / 15) % 2 === 0 ? (
            <span style={{ display: "inline-block", width: 2, height: 24, marginLeft: 2, verticalAlign: "-4px", background: DEMO.text }} />
          ) : null}
        </div>
        <div
          style={{
            ...box({ x: SEND_BUTTON.x - PANEL.x, y: SEND_BUTTON.y - PANEL.y, w: SEND_BUTTON.w, h: SEND_BUTTON.h }),
            borderRadius: 14,
            background: DEMO.ui,
            color: "#fff",
            fontSize: 22,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            // CUR-03: il pulsante risponde alla pressione, prima delle conseguenze.
            transform: `scale(${1 - 0.05 * state.pressed})`,
          }}
        >
          Invia per approvazione
        </div>
        {state.statuses.map((s, i) => {
          const r = statusRect(i);
          return (
            <div
              key={s.name}
              style={{
                ...box({ x: r.x - PANEL.x, y: r.y - PANEL.y, w: r.w, h: STATUS_ROW_H }),
                display: "flex",
                alignItems: "center",
                gap: 14,
                fontSize: 20,
                color: s.on > 0.5 ? DEMO.text : DEMO.muted,
              }}
            >
              <div style={{ width: 18, height: 18, borderRadius: 9, border: `2px solid ${DEMO.ok}`, background: s.on > 0.5 ? DEMO.ok : "transparent" }} />
              {s.name}
            </div>
          );
        })}
      </div>
    );
  }
  // Il blocco attivo: le parole estratte in volo e la mano, sopra tutto.
  return (
    <>
      {state.chips.map((c) =>
        c.visible ? (
          <div
            key={c.label}
            style={{
              position: "absolute",
              left: c.x - offset.x,
              top: c.y - offset.y,
              padding: "8px 16px",
              borderRadius: 10,
              background: DEMO.ui,
              color: "#fff",
              fontFamily: DEMO.font,
              fontSize: 20,
              fontWeight: 600,
              boxShadow: `0 ${6 + c.lift * 18}px ${14 + c.lift * 30}px rgba(40, 20, 120, ${0.18 + c.lift * 0.2})`,
              whiteSpace: "nowrap",
            }}
          >
            {c.label}
          </div>
        ) : null,
      )}
      <Cursor at={() => ({ x: state.cursor.x - offset.x, y: state.cursor.y - offset.y })} clicks={state.clicks} frame={frame} ringColor={DEMO.ui} />
    </>
  );
};

/** Tutta la lastra in un piano solo: e' la copia che va dietro, attenuata (MAT-03). */
export const DemoFlat: React.FC<{ state: DemoState; frame: number }> = ({ state, frame }) => (
  <div style={{ position: "absolute", inset: 0, background: DEMO.bg }}>
    {(["header", "rail", "doc", "panel"] as const).map((p) => (
      <DemoPart key={p} part={p} state={state} frame={frame} />
    ))}
  </div>
);

export { RAIL_W };
