import React from "react";
import { app, fontStack, monoStack, radius } from "../theme";
import {
  BOARD_TOP,
  COL_HEADER_H,
  COL_W,
  Card,
  Column,
  HEADER_H,
  PANEL_W,
  SIDEBAR_W,
  SLAB_H,
  SLAB_W,
  cardHeight,
  columnX,
} from "./slab";

/**
 * Il contenuto della lastra, disegnato una volta sola per tutte le scene.
 *
 * Prima queste parti stavano dentro `UIMockup.tsx`. Una seconda scena sulla
 * stessa app avrebbe dovuto ricopiarle, e da quel momento la giunta fra le due
 * sarebbe stata vera solo finche' qualcuno teneva sincronizzate a mano due copie
 * di una sidebar. La regola "niente tagli" non sopravvive a un copia-incolla:
 * o le due scene disegnano LO STESSO componente, o l'aggancio e' una speranza.
 *
 * LE CARD SONO POSIZIONATE IN ASSOLUTO, non impilate da un flex. Costa il
 * calcolo di `cardY`, e in cambio una card puo' staccarsi dalla colonna e volare
 * altrove senza che il resto del layout se ne accorga: e' esattamente cio' che
 * fa la scena `CardHandoff`. Con un flex, togliere una card fa collassare la
 * colonna nello stesso frame, che e' un taglio travestito da animazione.
 */

const TAG_COLORS: Record<string, string> = {
  feature: app.primary,
  bugfix: "#f87171",
  chore: app.textFaint,
};

export const AppChrome: React.FC = () => (
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
    <div style={{ display: "flex", gap: 8, marginRight: 10 }}>
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <div
          key={c}
          style={{ width: 13, height: 13, borderRadius: 7, background: c }}
        />
      ))}
    </div>

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

export const AppSidebar: React.FC<{ activeIdx: number }> = ({ activeIdx }) => {
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

/**
 * Una card. `lifted` la stacca dal piano: ombra piu' profonda, bordo acceso,
 * scala appena maggiore. E' il vocabolario di "questo oggetto e' in mano a
 * qualcuno" che ogni board usa, e la scena 3 lo accende mentre la card viaggia.
 */
export const CardBox: React.FC<{
  card: Card;
  lifted?: number;
  style?: React.CSSProperties;
}> = ({ card, lifted = 0, style }) => (
  <div
    style={{
      height: cardHeight(card),
      background: card.active || lifted > 0 ? app.elevated : app.surface,
      border: `1px solid ${
        lifted > 0
          ? app.primary
          : card.active
            ? app.borderLight
            : app.border
      }`,
      borderRadius: radius.md,
      padding: "16px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      boxShadow:
        lifted > 0
          ? `0 ${18 + lifted * 26}px ${30 + lifted * 44}px rgba(0,0,0,${0.34 + lifted * 0.3})`
          : card.active
            ? "0 4px 20px rgba(0,0,0,0.32)"
            : "none",
      boxSizing: "border-box",
      ...style,
    }}
  >
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
      <span style={{ marginLeft: "auto", fontSize: 14, color: app.textFaint }}>
        {card.age}
      </span>
    </div>

    <div
      style={{
        fontSize: 19,
        lineHeight: 1.4,
        color: card.done ? app.textMuted : app.text,
        textDecoration: card.done ? "line-through" : "none",
      }}
    >
      {card.title}
    </div>

    {card.active && (
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

export const ColumnHeader: React.FC<{
  name: string;
  count: number;
  colIdx: number;
  highlight?: number;
}> = ({ name, count, colIdx, highlight = 0 }) => (
  <div
    style={{
      position: "absolute",
      left: columnX(colIdx),
      top: BOARD_TOP,
      width: COL_W,
      height: COL_HEADER_H,
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      borderBottom: `1px solid ${
        highlight > 0 ? app.primary : app.border
      }`,
      boxSizing: "border-box",
    }}
  >
    <span style={{ fontSize: 18, color: app.textMuted, letterSpacing: 0.3 }}>
      {name}
    </span>
    <span
      style={{
        fontSize: 14,
        color: highlight > 0 ? app.primary : app.textFaint,
        background: app.elevated,
        border: `1px solid ${highlight > 0 ? app.primary : app.border}`,
        borderRadius: 10,
        padding: "2px 9px",
      }}
    >
      {count}
    </span>
  </div>
);

/** Lo slot vuoto tratteggiato in fondo alla colonna. */
export const AddCard: React.FC<{
  colIdx: number;
  y: number;
  dimmed?: boolean;
}> = ({ colIdx, y, dimmed = false }) => (
  <div
    style={{
      position: "absolute",
      left: columnX(colIdx),
      top: y,
      width: COL_W,
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
      boxSizing: "border-box",
    }}
  >
    <span style={{ fontSize: 20, lineHeight: 1 }}>+</span>
    Add card
  </div>
);

export const DetailPanel: React.FC<{
  title?: string;
  rows?: { label: string; value: string }[];
  description?: string;
}> = ({
  title = "UIMockup",
  rows = [
    { label: "Status", value: "In corso" },
    { label: "Priority", value: "P0" },
    { label: "Branch", value: "topics/ui-mockup" },
    { label: "Assignee", value: "Agent" },
  ],
  description = "Piano CSS 3D con spessore sul bordo, camera slide da fuori frame, token da theme.ts. Misure: fill-measure 85%+, framelocked-verdict OK.",
}) => (
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
        style={{ width: 10, height: 10, borderRadius: 5, background: app.primary }}
      />
      <div style={{ fontSize: 18, color: app.text }}>{title}</div>
    </div>

    {rows.map((row) => (
      <div
        key={row.label}
        style={{ display: "flex", gap: 12, fontSize: 17, alignItems: "flex-start" }}
      >
        <span
          style={{ color: app.textFaint, flex: "none", width: 90, paddingTop: 2 }}
        >
          {row.label}
        </span>
        <span
          style={{
            color: row.label === "Branch" ? app.primary : app.textSecondary,
            fontFamily: row.label === "Branch" ? monoStack : fontStack,
            fontSize: row.label === "Branch" ? 15 : 17,
            background: row.label === "Branch" ? app.inset : "transparent",
            padding: row.label === "Branch" ? "4px 10px" : "0",
            borderRadius: row.label === "Branch" ? radius.xs : 0,
            border: row.label === "Branch" ? `1px solid ${app.border}` : "none",
          }}
        >
          {row.value}
        </span>
      </div>
    ))}

    <div style={{ height: 1, background: app.border }} />

    <div style={{ fontSize: 17, lineHeight: 1.6, color: app.textSecondary }}>
      {description}
    </div>

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
            <span style={{ color: app.textSecondary }}>{a.who}</span> {a.msg}
          </div>
          <span style={{ marginLeft: "auto", flex: "none" }}>{a.t}</span>
        </div>
      ))}
    </div>
  </div>
);

/** Vignettatura + riflesso: la stessa luce in tutte le scene. */
/**
 * Lo spessore della lastra: il piano dietro il piano.
 *
 * PERCHE' ESISTE. Frontale non si vede, ed e' il motivo per cui e' mancato
 * finora: a yaw piccoli sta esattamente dietro la lastra e non sporge da
 * nessuna parte. Si vede quando la camera gira, ed e' li' che decide se quello
 * che si sta guardando e' un OGGETTO o una carta da parati incollata sul fondo.
 * Senza, un'orbita mostra un rettangolo che ruota; con, mostra una cosa che ha
 * un dietro.
 *
 * E' UN FRATELLO DELLA LASTRA, non un suo figlio, e non e' un dettaglio: la
 * lastra ritaglia (`overflow: hidden`, per via degli angoli arrotondati e del
 * contenuto che deborda) e QUALUNQUE ritaglio appiattisce `preserve-3d`. Un
 * figlio a translateZ(-30) verrebbe schiacciato sul piano del padre e non
 * sporgerebbe mai. Da fratello, dentro la stessa prospettiva, il suo Z e' vero.
 *
 * I 30 di stacco e i 6 px di debordo per lato sono la stessa coppia di numeri
 * che il catalogo dichiara in MAT-01.
 */
export const SlabEdge: React.FC<{
  left: number;
  top: number;
  pushZ: number;
  yaw: number;
  pitch: number;
}> = ({ left, top, pushZ, yaw, pitch }) => (
  <div
    style={{
      position: "absolute",
      left: left - 6,
      top: top - 6,
      width: SLAB_W + 12,
      height: SLAB_H + 12,
      transform: `translateZ(${pushZ - 30}px) rotateY(${yaw}deg) rotateX(${pitch}deg) scale(1.04)`,
      transformOrigin: "50% 50%",
      background: "#05060a",
      borderRadius: 22,
      boxShadow: "0 90px 180px rgba(0,0,0,0.75)",
    }}
  />
);

export const SlabLighting: React.FC = () => (
  <>
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(130% 90% at 50% 52%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.62) 100%)",
        pointerEvents: "none",
      }}
    />
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(to bottom, rgba(255,255,255,0.04) 0%, transparent 8%)",
        pointerEvents: "none",
      }}
    />
  </>
);

export type { Card, Column };
