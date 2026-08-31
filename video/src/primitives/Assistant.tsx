import React from "react";
import { Easing, interpolate } from "remotion";
import {
  COMPOSER_H,
  COMPOSER_W,
  COMPOSER_X,
  COMPOSER_Y,
  SEND_H,
  SEND_W,
  SIDEBAR_W,
  THREAD_PAD_BOTTOM,
  THREAD_TOP,
} from "./slab";
import { app, monoStack, radius } from "../theme";

/**
 * Il thread dell'assistente e il composer, nella meta' bassa della lastra.
 *
 * STA IN UN PRIMITIVO E NON DENTRO UNA SCENA perche' lo disegnano tutte e
 * cinque. Se lo disegnasse solo la scena che lo usa, la giunta con quella prima
 * mostrerebbe meta' schermo che compare dal niente, e `seam.sh` la leggerebbe
 * come un taglio - che e' esattamente quello che era: PromptInput aveva una
 * lastra sua, larga 2200 invece di 2400 e a prospettiva 2800 invece di 2600,
 * quindi non poteva agganciarsi a nessuna delle altre e restava fuori catena.
 *
 * A RIPOSO il pannello mostra lo scambio precedente e il campo vuoto: e' lo
 * stato in cui le quattro scene della board lo trovano. La recita - il testo
 * che si scrive, l'invio, la risposta che arriva - e' tutta nelle prop, quindi
 * questo componente non sa niente del tempo tranne quello che gli si passa.
 */

export type AssistantProps = {
  /** Quello che c'e' scritto nel campo. Vuoto = segnaposto. */
  typed?: string;
  /** Il campo ha il fuoco: cambia il bordo, e basta quello. */
  focused?: boolean;
  caretOn?: boolean;
  /** Il prompt e' partito: il campo si svuota e la bolla sale nel thread. */
  sent?: boolean;
  sentPrompt?: string;
  bubbleIn?: number;
  thinking?: boolean;
  answer?: string;
  /** Scala del pulsante invia, per la pressione. */
  press?: number;
  /** Serve solo ai tre puntini, che si calcolano dal frame. */
  frame?: number;
  branch?: string;
  dimmed?: boolean;
};

export const Assistant: React.FC<AssistantProps> = ({
  typed = "",
  focused = false,
  caretOn = false,
  sent = false,
  sentPrompt = "",
  bubbleIn = 1,
  thinking = false,
  answer = "",
  press = 1,
  frame = 0,
  branch = "topics/verdant-ether",
  dimmed = false,
}) => {
  const armed = typed.length > 0 && !sent;

  return (
    <div
      style={{
        position: "absolute",
        left: SIDEBAR_W,
        right: 0,
        top: THREAD_TOP,
        bottom: 0,
        opacity: dimmed ? 0.5 : 1,
        borderTop: `1px solid ${app.border}`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: 52,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 26px",
          borderBottom: `1px solid ${app.border}`,
        }}
      >
        <div style={{ fontSize: 19, color: app.textHeading }}>Scene motion</div>
        <div
          style={{
            fontFamily: monoStack,
            fontSize: 15,
            color: app.textMuted,
            padding: "4px 10px",
            border: `1px solid ${app.border}`,
            borderRadius: radius.xs,
          }}
        >
          {branch}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 15, color: app.ok }}>Opus 5</div>
      </div>

      {/* Il thread e' ancorato in basso e quello che esce dal bordo alto e'
          tagliato dall'overflow, che e' come si legge una conversazione gia'
          scorsa. Ancorarlo in alto lo farebbe galleggiare sul vuoto e
          leggerebbe come una scatola invece che come un'app in uso. */}
      <div
        style={{
          flex: 1,
          padding: `20px 26px ${THREAD_PAD_BOTTOM}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: 16,
          overflow: "hidden",
        }}
      >
        <Msg who="user" text="Prendi i quattro commercial e dimmi cosa fanno davvero." />
        <Msg
          who="assistant"
          text="Su quattro, solo i due Linear sono motion graphics. Cursor e Raycast sono girati con una camera: attore, luce calda, mani vere. Quelli non si replicano in codice."
        />
        <ToolRow file="ref/sheet_ovxL42LkKNg.jpg" />
        <Msg who="user" text="Fammi vedere la board con la card attiva." />
        <Msg
          who="assistant"
          text="Fatto. Kanban aperto, la card attiva e' UIMockup: piano 3D piu' parallasse, e il pannello mostra branch e assegnatario."
        />

        {sent ? (
          <div
            style={{
              opacity: bubbleIn,
              transform: `translateY(${(1 - bubbleIn) * 14}px)`,
            }}
          >
            <Msg who="user" text={sentPrompt} />
          </div>
        ) : null}

        {thinking ? <Dots frame={frame} /> : null}

        {answer.length > 0 ? <Msg who="assistant" text={answer} streaming /> : null}
      </div>

      <div
        style={{
          position: "absolute",
          left: COMPOSER_X - SIDEBAR_W,
          top: COMPOSER_Y - THREAD_TOP,
          width: COMPOSER_W,
          height: COMPOSER_H,
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "0 18px 0 24px",
          background: app.elevated,
          border: `1px solid ${focused && !sent ? app.primary : app.border}`,
          borderRadius: radius.md,
          boxShadow: focused && !sent ? "0 0 0 3px rgba(77,148,255,0.16)" : "none",
        }}
      >
        <div
          style={{
            flex: 1,
            fontSize: 25,
            color: sent || typed.length === 0 ? app.textFaint : app.text,
            whiteSpace: "pre",
            overflow: "hidden",
          }}
        >
          {sent || typed.length === 0 ? "Chiedi qualcosa" : typed}
          {caretOn ? (
            <span
              style={{
                display: "inline-block",
                width: 2,
                height: 29,
                marginLeft: 2,
                verticalAlign: "-6px",
                background: app.primary,
              }}
            />
          ) : null}
        </div>

        <div
          style={{
            width: SEND_W,
            height: SEND_H,
            flex: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            borderRadius: radius.sm,
            background: armed ? app.primary : app.hover,
            color: armed ? "#0b1220" : app.textFaint,
            fontSize: 19,
            transform: `scale(${press})`,
          }}
        >
          Invia
          <svg width={19} height={19} viewBox="0 0 24 24">
            <path
              d="M12 19V5 M5 12l7-7 7 7"
              fill="none"
              stroke={armed ? "#0b1220" : app.textFaint}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */

const Msg: React.FC<{
  who: "user" | "assistant";
  text: string;
  streaming?: boolean;
}> = ({ who, text, streaming }) => {
  const isUser = who === "user";
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div
        style={{
          width: 26,
          height: 26,
          marginTop: 4,
          flex: "none",
          borderRadius: radius.xs,
          background: isUser ? app.borderLight : app.claude,
        }}
      />
      <div
        style={{
          // La bolla dell'utente e' NEUTRA, non blu. Nel prodotto e' cosi', e
          // una bolla blu qui sarebbe un disegno DELLA app, non la app.
          background: isUser ? app.elevated : "transparent",
          border: isUser ? `1px solid ${app.border}` : "1px solid transparent",
          borderRadius: radius.md,
          padding: isUser ? "12px 18px" : "12px 0",
          fontSize: 21,
          lineHeight: 1.45,
          color: isUser ? app.text : app.textSecondary,
          maxWidth: 1180,
        }}
      >
        {text}
        {streaming ? (
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 21,
              marginLeft: 5,
              verticalAlign: "-3px",
              background: app.textSecondary,
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

const ToolRow: React.FC<{ file: string }> = ({ file }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginLeft: 40,
      padding: "10px 16px",
      background: app.inset,
      border: `1px solid ${app.border}`,
      borderRadius: radius.sm,
      maxWidth: 820,
    }}
  >
    <div style={{ width: 8, height: 8, borderRadius: 4, background: app.ok, flex: "none" }} />
    <div style={{ fontFamily: monoStack, fontSize: 17, color: app.primary }}>Read</div>
    <div style={{ fontSize: 17, color: app.textMuted }}>{file}</div>
  </div>
);

const Dots: React.FC<{ frame: number }> = ({ frame }) => (
  <div style={{ display: "flex", gap: 9, marginLeft: 40, height: 26, alignItems: "center" }}>
    {[0, 1, 2].map((i) => {
      // Il ciclo si calcola dal frame. Nessun @keyframes, nessun rAF.
      const phase = ((frame - i * 5) % 30) / 30;
      const o = 0.25 + 0.75 * (0.5 - 0.5 * Math.cos(phase * Math.PI * 2));
      return (
        <div
          key={i}
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            background: app.textSecondary,
            opacity: o,
          }}
        />
      );
    })}
  </div>
);

/** La comparsa della bolla spedita, come curva: la usa la scena, non il thread. */
export const bubbleCurve = (frame: number, at: number): number =>
  interpolate(frame, [at, at + 12], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
