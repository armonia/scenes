import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { app, fontStack, monoStack, radius } from "../theme";

/**
 * UIMockup: app window su piano CSS 3D inclinato, con parallasse su camera move.
 *
 * La grammatica e' quella dei Linear Diffs: una lastra di UI VERA che riempie il
 * quadro, entra da fuori frame, e si stabilizza senza mai tagliare. Il "vera"
 * significa token da theme.ts, raggi 8/6/4, font di sistema, non un wireframe.
 *
 * Tre decisioni strutturali:
 *
 * LA LASTRA ENTRA DA FUORI FRAME. La scena comincia con la finestra a destra del
 * quadro e scivola in posizione con un easing in-out. Cosi' il primo frame non e'
 * una composizione statica: c'e' gia' movimento, e il movimento porta l'occhio.
 *
 * IL PIANO HA SPESSORE. `transformStyle: preserve-3d` + un bordo posteriore
 * simulato con un pseudo-bordo assoluto dietro la lastra. Chi ha visto i Linear
 * commercials sa che e' il bordo inferiore che dice "questo e' un oggetto fisico".
 *
 * LA PROFONDITA' DI CAMPO STACCA I PIANI. Il layer di sfondo e' sfocato e
 * attenuato, la lastra principale e' nitida: la differenza di fuoco dice all'occhio
 * qual e' il piano principale, senza mai spiegarlo.
 *
 * Frame-locked: ogni valore deriva da useCurrentFrame(). Nessun CSS keyframe,
 * nessun requestAnimationFrame.
 */

export type UIMockupProps = {
  /** Via di fuga: 0 a 1, per farsi pilotare da una timeline padre. */
  progress?: number;
};

// La lastra e' piu' larga del quadro: i bordi laterali escono.
// 2400x1200 dentro 1920x1080: riempie sempre il quadro inclinato.
const SLAB_W = 2400;
const SLAB_H = 1200;

const SIDEBAR_W = 280;
const HEADER_H = 58;
const PANEL_W = 420;

// Contenuto della kanban board: 3 colonne, card reali con titoli.
const COLUMNS = [
  {
    name: "Backlog",
    cards: [
      { title: "Migrazione schema v3", tag: "chore", age: "5d" },
      { title: "Rate limit su /api/render", tag: "feature", age: "3d" },
      { title: "Retry logic per job falliti", tag: "bugfix", age: "2d" },
    ],
  },
  {
    name: "In corso",
    cards: [
      { title: "UIMockup: piano 3D + parallasse", tag: "feature", age: "1d", active: true },
      { title: "Metriche latenza p99", tag: "chore", age: "12h" },
    ],
  },
  {
    name: "In review",
    cards: [
      { title: "PromptInput: streaming fix", tag: "bugfix", age: "6h", done: true },
      { title: "Docs: regole frame-lock", tag: "chore", age: "2h" },
    ],
  },
] as const;

const TAG_COLORS: Record<string, string> = {
  feature: app.primary,
  bugfix: "#f87171",
  chore: app.textFaint,
};

export const UIMockup: React.FC<UIMockupProps> = ({ progress }) => {
  const localFrame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const frame =
    progress === undefined ? localFrame : progress * (durationInFrames - 1);

  // Entrata: la lastra scivola da destra dentro il quadro.
  // Inizia fuori frame (translateX +900) e arriva a riposo (translateX 0).
  const slideProgress = interpolate(frame, [0, 80], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const slideX = interpolate(slideProgress, [0, 1], [900, 0]);

  // La camera ruota lentamente durante la scena: da piu' inclinata a piu' frontale.
  // Finisce piu' frontale cosi' la scena successiva puo' partire da qui.
  const yaw = interpolate(frame, [0, durationInFrames - 1], [-18, -9], {
    easing: Easing.inOut(Easing.quad),
    extrapolateRight: "clamp",
  });
  const pitch = interpolate(frame, [0, durationInFrames - 1], [5, 2.5], {
    easing: Easing.inOut(Easing.quad),
    extrapolateRight: "clamp",
  });

  // Leggero push in avanti: la lastra si avvicina mentre la camera la inquadra.
  const pushZ = interpolate(frame, [0, durationInFrames - 1], [0, 48], {
    easing: Easing.inOut(Easing.quad),
    extrapolateRight: "clamp",
  });

  // Fade-in globale nei primi 20 frame.
  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Il layer di sfondo ha un parallasse piu' lento: si muove meno della lastra.
  const bgYaw = yaw * 0.6;
  const bgSlideX = slideX * 0.45;

  // Animazione delle card: entrano con stagger dopo che la lastra e' in posizione.
  const cardRevealStart = 75;

  return (
    <AbsoluteFill
      style={{ background: app.bg, fontFamily: fontStack, opacity: fadeIn }}
    >
      {/* Layer di sfondo: un'altra istanza della stessa UI, sfocata e attenuata.
          Da' la sensazione di profondita' di campo senza postproduzione. */}
      <AbsoluteFill
        style={{
          perspective: 3200,
          perspectiveOrigin: "50% 46%",
          opacity: 0.45,
          filter: "blur(14px)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: (1920 - SLAB_W) / 2 - 180 + bgSlideX,
            top: (1080 - SLAB_H) / 2 - 80,
            width: SLAB_W,
            height: SLAB_H,
            transform: `rotateY(${bgYaw + 8}deg) rotateX(${pitch + 4}deg) scale(0.92)`,
            transformOrigin: "50% 50%",
            background: app.surface,
            border: `1px solid ${app.border}`,
            borderRadius: 20,
            overflow: "hidden",
          }}
        >
          <AppChrome />
          <AppSidebar activeIdx={1} />
          <BoardContent frame={frame} cardRevealStart={cardRevealStart} dimmed />
          <DetailPanel />
        </div>
      </AbsoluteFill>

      {/* La lastra principale: nitida, frontale, e' il soggetto della scena. */}
      <AbsoluteFill
        style={{
          perspective: 2600,
          perspectiveOrigin: "50% 46%",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: (1920 - SLAB_W) / 2 + slideX,
            top: (1080 - SLAB_H) / 2,
            width: SLAB_W,
            height: SLAB_H,
            transform: `translateZ(${pushZ}px) rotateY(${yaw}deg) rotateX(${pitch}deg) scale(1.04)`,
            transformOrigin: "50% 50%",
            transformStyle: "preserve-3d",
            background: app.bg,
            borderRadius: 18,
            border: `1px solid ${app.borderLight}`,
            boxShadow:
              "0 80px 160px rgba(0,0,0,0.78), 0 0 0 1px rgba(255,255,255,0.05) inset",
            overflow: "hidden",
          }}
        >
          <AppChrome />
          <AppSidebar activeIdx={1} />
          <BoardContent frame={frame} cardRevealStart={cardRevealStart} />
          <DetailPanel />

          {/* Spessore sul bordo inferiore: un filo piu' chiaro che dice
              "questo e' un oggetto fisico con uno spessore". */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 3,
              background:
                "linear-gradient(to right, transparent, rgba(255,255,255,0.12) 20%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.12) 80%, transparent)",
            }}
          />
        </div>
      </AbsoluteFill>

      {/* Vignettatura: chiude gli angoli, tiene l'attenzione al centro. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(130% 90% at 50% 52%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.62) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Riflessione sul bordo superiore: il bagliore che separa la lastra
          dallo sfondo senza bisogno di luce separata. */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0.04) 0%, transparent 8%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Sottocomponenti della finestra                                       */
/* ------------------------------------------------------------------ */

const AppChrome: React.FC = () => (
  <div
    style={{
      height: HEADER_H,
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "0 20px",
      background: app.inset,
      borderBottom: `1px solid ${app.border}`,
    }}
  >
    {/* Semafori macOS */}
    <div style={{ display: "flex", gap: 8, marginRight: 10 }}>
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <div
          key={c}
          style={{ width: 13, height: 13, borderRadius: 7, background: c }}
        />
      ))}
    </div>

    {/* Tab bar */}
    {[
      { name: "Kanban", active: true },
      { name: "Timeline", active: false },
      { name: "Docs", active: false },
    ].map((t) => (
      <div
        key={t.name}
        style={{
          display: "flex",
          alignItems: "center",
          height: 38,
          padding: "0 16px",
          fontSize: 18,
          color: t.active ? app.text : app.textMuted,
          background: t.active ? app.elevated : "transparent",
          border: `1px solid ${t.active ? app.border : "transparent"}`,
          borderRadius: radius.sm,
        }}
      >
        {t.name}
      </div>
    ))}

    {/* Wordmark a destra */}
    <div
      style={{
        marginLeft: "auto",
        fontFamily: monoStack,
        fontSize: 17,
        color: app.textFaint,
        letterSpacing: 0.5,
      }}
    >
      Topics
    </div>
  </div>
);

const AppSidebar: React.FC<{ activeIdx: number }> = ({ activeIdx }) => {
  const items = [
    { label: "Dashboard", icon: "⬡" },
    { label: "Projects", icon: "◫" },
    { label: "Board", icon: "▤" },
    { label: "Agents", icon: "◎" },
    { label: "Settings", icon: "⊙" },
  ];

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: HEADER_H,
        bottom: 0,
        width: SIDEBAR_W,
        background: app.surface,
        borderRight: `1px solid ${app.border}`,
        padding: "20px 0",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      {/* Workspace header */}
      <div
        style={{
          padding: "0 18px 16px",
          fontSize: 14,
          letterSpacing: 1.2,
          color: app.textFaint,
          borderBottom: `1px solid ${app.border}`,
          marginBottom: 8,
        }}
      >
        ACME CORP
      </div>

      {items.map((item, i) => (
        <div
          key={item.label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            height: 44,
            margin: "0 10px",
            padding: "0 14px",
            fontSize: 20,
            color: i === activeIdx ? app.text : app.textSecondary,
            background: i === activeIdx ? app.hover : "transparent",
            borderRadius: radius.sm,
          }}
        >
          <span style={{ fontSize: 16, opacity: 0.7 }}>{item.icon}</span>
          {item.label}
          {i === activeIdx && (
            <div
              style={{
                marginLeft: "auto",
                width: 7,
                height: 7,
                borderRadius: 4,
                background: app.primary,
              }}
            />
          )}
        </div>
      ))}

      {/* Separatore + projects list */}
      <div
        style={{
          padding: "16px 18px 8px",
          fontSize: 13,
          letterSpacing: 1.1,
          color: app.textFaint,
          marginTop: 12,
        }}
      >
        RECENT
      </div>
      {["acme-app", "server", "landing"].map((p, i) => (
        <div
          key={p}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            height: 40,
            margin: "0 10px",
            padding: "0 14px",
            fontSize: 18,
            color: app.textSecondary,
            borderRadius: radius.sm,
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: radius.xs,
              background: i === 0 ? app.primary : app.borderLight,
            }}
          />
          {p}
        </div>
      ))}
    </div>
  );
};

type BoardContentProps = {
  frame: number;
  cardRevealStart: number;
  dimmed?: boolean;
};

const BoardContent: React.FC<BoardContentProps> = ({
  frame,
  cardRevealStart,
  dimmed = false,
}) => (
  <div
    style={{
      position: "absolute",
      left: SIDEBAR_W,
      right: PANEL_W,
      top: HEADER_H,
      bottom: 0,
      padding: "28px 24px",
      display: "flex",
      gap: 20,
      overflow: "hidden",
    }}
  >
    {COLUMNS.map((col, colIdx) => (
      <Column
        key={col.name}
        col={col}
        colIdx={colIdx}
        frame={frame}
        cardRevealStart={cardRevealStart}
        dimmed={dimmed}
      />
    ))}
  </div>
);

type ColData = (typeof COLUMNS)[number];

const Column: React.FC<{
  col: ColData;
  colIdx: number;
  frame: number;
  cardRevealStart: number;
  dimmed: boolean;
}> = ({ col, colIdx, frame, cardRevealStart, dimmed }) => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
    {/* Intestazione colonna */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        paddingBottom: 14,
        borderBottom: `1px solid ${app.border}`,
      }}
    >
      <span style={{ fontSize: 18, color: app.textMuted, letterSpacing: 0.3 }}>
        {col.name}
      </span>
      <span
        style={{
          fontSize: 14,
          color: app.textFaint,
          background: app.elevated,
          border: `1px solid ${app.border}`,
          borderRadius: 10,
          padding: "2px 9px",
        }}
      >
        {col.cards.length}
      </span>
    </div>

    {/* Card con stagger: ogni colonna entra con 12 frame di ritardo,
        ogni card con 8 frame di ritardo dentro la colonna. */}
    {col.cards.map((card, cardIdx) => {
      const cardStart = cardRevealStart + colIdx * 12 + cardIdx * 8;
      const cardProgress = interpolate(frame, [cardStart, cardStart + 22], [0, 1], {
        easing: Easing.out(Easing.cubic),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      const opacity = dimmed ? cardProgress * 0.5 : cardProgress;
      const translateY = (1 - cardProgress) * 20;

      return (
        <div
          key={card.title}
          style={{
            opacity,
            transform: `translateY(${translateY}px)`,
            background:
              "active" in card && card.active ? app.elevated : app.surface,
            border: `1px solid ${
              "active" in card && card.active ? app.borderLight : app.border
            }`,
            borderRadius: radius.md,
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            boxShadow:
              "active" in card && card.active
                ? "0 4px 20px rgba(0,0,0,0.32)"
                : "none",
          }}
        >
          {/* Tag + age */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                height: 22,
                padding: "0 10px",
                borderRadius: 11,
                background: TAG_COLORS[card.tag] + "22",
                border: `1px solid ${TAG_COLORS[card.tag]}44`,
                fontSize: 13,
                color: TAG_COLORS[card.tag],
                display: "flex",
                alignItems: "center",
                letterSpacing: 0.3,
              }}
            >
              {card.tag}
            </div>
            <span
              style={{ marginLeft: "auto", fontSize: 14, color: app.textFaint }}
            >
              {card.age}
            </span>
          </div>

          {/* Titolo */}
          <div
            style={{
              fontSize: 19,
              lineHeight: 1.4,
              color:
                "done" in card && card.done ? app.textMuted : app.text,
              textDecoration:
                "done" in card && card.done ? "line-through" : "none",
            }}
          >
            {card.title}
          </div>

          {/* Barra di avanzamento (solo per la card attiva) */}
          {"active" in card && card.active && (
            <div
              style={{
                height: 3,
                background: app.border,
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: "62%",
                  background: app.primary,
                  borderRadius: 2,
                }}
              />
            </div>
          )}
        </div>
      );
    })}

    {/* Pulsante + aggiungi card */}
    <div
      style={{
        height: 42,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 14px",
        borderRadius: radius.sm,
        border: `1px dashed ${app.border}`,
        fontSize: 17,
        color: app.textFaint,
        opacity: dimmed ? 0.4 : 0.7,
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1 }}>+</span>
      Add card
    </div>
  </div>
);

const DetailPanel: React.FC = () => (
  <div
    style={{
      position: "absolute",
      right: 0,
      top: HEADER_H,
      bottom: 0,
      width: PANEL_W,
      background: app.surface,
      borderLeft: `1px solid ${app.border}`,
      padding: "24px 22px",
      display: "flex",
      flexDirection: "column",
      gap: 18,
      overflow: "hidden",
    }}
  >
    {/* Intestazione panel */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        paddingBottom: 16,
        borderBottom: `1px solid ${app.border}`,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          background: app.primary,
        }}
      />
      <div style={{ fontSize: 18, color: app.text }}>UIMockup</div>
    </div>

    {/* Metadata rows */}
    {[
      { label: "Status", value: "In corso" },
      { label: "Priority", value: "P0" },
      { label: "Branch", value: "topics/ui-mockup" },
      { label: "Assignee", value: "Agent" },
    ].map((row) => (
      <div
        key={row.label}
        style={{
          display: "flex",
          gap: 12,
          fontSize: 17,
          alignItems: "flex-start",
        }}
      >
        <span
          style={{ color: app.textFaint, flex: "none", width: 90, paddingTop: 2 }}
        >
          {row.label}
        </span>
        <span
          style={{
            color:
              row.label === "Branch" ? app.primary : app.textSecondary,
            fontFamily: row.label === "Branch" ? monoStack : fontStack,
            fontSize: row.label === "Branch" ? 15 : 17,
            background: row.label === "Branch" ? app.inset : "transparent",
            padding: row.label === "Branch" ? "4px 10px" : "0",
            borderRadius: row.label === "Branch" ? radius.xs : 0,
            border:
              row.label === "Branch"
                ? `1px solid ${app.border}`
                : "none",
          }}
        >
          {row.value}
        </span>
      </div>
    ))}

    {/* Separatore */}
    <div style={{ height: 1, background: app.border }} />

    {/* Descrizione */}
    <div style={{ fontSize: 17, lineHeight: 1.6, color: app.textSecondary }}>
      Piano CSS 3D con spessore sul bordo, camera slide da fuori frame, token
      da theme.ts. Misure: fill-measure 85%+, framelocked-verdict OK.
    </div>

    {/* Activity stub */}
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        marginTop: "auto",
        paddingTop: 16,
        borderTop: `1px solid ${app.border}`,
      }}
    >
      <div style={{ fontSize: 14, color: app.textFaint, letterSpacing: 0.8 }}>
        ACTIVITY
      </div>
      {[
        { who: "Agent", msg: "started work on branch", t: "1h fa" },
        { who: "User", msg: "moved to In corso", t: "2h fa" },
      ].map((a, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            fontSize: 15,
            color: app.textMuted,
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: radius.xs,
              background: a.who === "Agent" ? app.claude : app.borderLight,
              flex: "none",
            }}
          />
          <div>
            <span style={{ color: app.textSecondary }}>{a.who}</span>
            {" "}
            {a.msg}
          </div>
          <span style={{ marginLeft: "auto", flex: "none" }}>{a.t}</span>
        </div>
      ))}
    </div>
  </div>
);
