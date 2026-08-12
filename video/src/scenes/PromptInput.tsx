import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Cursor, type Waypoint } from "../primitives/Cursor";
import { typedCount, typingSchedule } from "../primitives/rhythm";
import {
  BACKDROP_OPACITY,
  app,
  fontStack,
  monoStack,
  radius,
} from "../theme";

/**
 * prompt-input: il cursore entra, digita, invia, la risposta arriva in streaming.
 *
 * Grammatica A di Linear (`Introducing Linear Diffs`): una lastra di UI VERA su
 * un piano inclinato, spessore sul bordo, profondita' di campo che stacca il
 * primo piano, camera che scivola senza mai tagliare.
 *
 * Tre decisioni che vengono da errori gia' misurati, non dal gusto.
 *
 * LA LASTRA BORDA FUORI DALL'INQUADRATURA. E' il difetto per cui OrbitLoop non
 * reggeva il confronto: il meccanismo occupava il terzo centrale mentre il
 * riferimento riempie il quadro. La stessa misura era uscita sulle scene della
 * landing, dove tre su cinque stavano sotto il 45% di riempimento e leggevano
 * come scatole vuote. L'unica che funzionava mostrava un pezzo INTERO di UI.
 * Da qui una lastra di 2200 per 1080 dentro un quadro di 1920 per 1080: i bordi
 * laterali escono, e il pannello si legge come una finestra vera continuata
 * oltre lo schermo invece che come un rettangolo che galleggia.
 *
 * IL CURSORE STA SUL PIANO. E' dentro il contenitore trasformato, non sopra,
 * quindi eredita la stessa prospettiva della UI e appoggia sulla lastra. Un
 * cursore disegnato sopra il quadro, dritto, tradisce subito che la lastra e'
 * un'immagine e non una superficie.
 *
 * LA CAMERA NON TAGLIA MAI. I due spot Linear che contano sono 52 e 41 secondi
 * in un'unica inquadratura. Qui rotateY scivola da -15 a -8,5 gradi lungo tutta
 * la scena con un easing in-out: e' un movimento solo, e finisce piu' frontale
 * di come comincia, cosi' la scena successiva puo' entrare da questo stato.
 */

export type PromptInputProps = {
  prompt?: string;
  response?: string;
  branch?: string;
  /** Via di fuga: 0 a 1, per farsi pilotare da una timeline padre. */
  progress?: number;
};

// La lastra e' piu' larga del quadro di proposito. Vedi sopra.
const SLAB_W = 2200;
const SLAB_H = 1080;

const COMPOSER = { x: 372, y: 838, w: 1700, h: 84 };
const SEND = { x: 1988, y: 856, r: 24 };

// I frame della recita. La pausa prima dell'invio e' la parte che la rende
// credibile: senza, l'invio parte insieme all'ultimo tasto e legge come uno
// script che esegue, non come qualcuno che rilegge.
const T = {
  travelStart: 40,
  travelEnd: 78,
  clickField: 80,
  typeStart: 88,
  pauseAfterTyping: 24,
  travelToSend: 32,
  bubble: 14,
  thinking: 26,
} as const;

const DEFAULT_PROMPT = "Refactor the auth flow and open a PR";

const DEFAULT_RESPONSE =
  "Found three call sites in server/auth.ts. Pulling the token refresh into a single guard, then opening the PR on topics/auth-refactor.";

export const PromptInput: React.FC<PromptInputProps> = ({
  prompt = DEFAULT_PROMPT,
  response = DEFAULT_RESPONSE,
  branch = "topics/verdant-ether",
  progress,
}) => {
  const localFrame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const frame =
    progress === undefined ? localFrame : progress * (durationInFrames - 1);

  const schedule = typingSchedule({
    text: prompt,
    startFrame: T.typeStart,
    fps,
    cps: 13,
  });

  const typeEnd = schedule[schedule.length - 1] ?? T.typeStart;
  const nTyped = typedCount(schedule, frame);
  const typed = prompt.slice(0, nTyped);

  const sendTravelStart = typeEnd + T.pauseAfterTyping;
  const sendClick = sendTravelStart + T.travelToSend;
  const bubbleAt = sendClick + 4;
  const thinkAt = bubbleAt + T.bubble;
  const streamAt = thinkAt + T.thinking;

  const sent = frame >= sendClick;

  // Lo streaming va a blocchi di parole, non a caratteri. Un LLM non scrive
  // lettera per lettera: arriva a token, e l'occhio lo riconosce.
  const words = response.split(" ");
  const streamed = Math.max(
    0,
    Math.min(
      words.length,
      Math.floor(
        interpolate(frame, [streamAt, durationInFrames - 18], [0, words.length], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      ),
    ),
  );
  const answer = words.slice(0, streamed).join(" ");

  // La camera. Un movimento solo, in-out, per tutta la scena.
  const yaw = interpolate(frame, [0, durationInFrames - 1], [-15, -8.5], {
    easing: Easing.inOut(Easing.quad),
    extrapolateRight: "clamp",
  });
  const push = interpolate(frame, [0, durationInFrames - 1], [0, 62], {
    easing: Easing.inOut(Easing.quad),
    extrapolateRight: "clamp",
  });

  const focused = frame >= T.clickField;
  // Il caret lampeggia a 15 frame, e il calcolo e' sul frame: nessun keyframe CSS.
  const caretOn = focused && !sent && Math.floor(frame / 15) % 2 === 0;

  const path: Waypoint[] = [
    { x: 2540, y: 1290, at: 0 },
    { x: 2540, y: 1290, at: T.travelStart },
    { x: 1500, y: 1010, at: T.travelStart + 22 },
    { x: COMPOSER.x + 96, y: COMPOSER.y + 46, at: T.travelEnd },
    { x: COMPOSER.x + 96, y: COMPOSER.y + 46, at: sendTravelStart },
    { x: SEND.x - 4, y: SEND.y + 4, at: sendClick },
    { x: SEND.x - 4, y: SEND.y + 4, at: durationInFrames },
  ];

  return (
    <AbsoluteFill style={{ background: app.bg, fontFamily: fontStack }}>
      {/* Il piano attenuato dietro. Sta a 0,62 e non a 0,40: sotto quella
          soglia non e' profondita', e' rumore. */}
      <AbsoluteFill
        style={{
          perspective: 3000,
          opacity: BACKDROP_OPACITY,
          filter: "blur(13px)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: -260,
            top: -190,
            width: 1500,
            height: 1000,
            transform: `rotateY(${yaw + 6}deg) rotateX(6deg)`,
            transformOrigin: "50% 50%",
            background: app.surface,
            border: `1px solid ${app.border}`,
            borderRadius: radius.md * 2,
          }}
        >
          <Backdrop />
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          perspective: 2800,
          perspectiveOrigin: "50% 46%",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: (1920 - SLAB_W) / 2,
            top: (1080 - SLAB_H) / 2,
            width: SLAB_W,
            height: SLAB_H,
            transform: `translateZ(${push}px) rotateY(${yaw}deg) rotateX(3.2deg) scale(1.045)`,
            transformOrigin: "50% 50%",
            transformStyle: "preserve-3d",
            background: app.bg,
            borderRadius: 18,
            // Lo spessore sul bordo: un filo chiaro sopra, l'ombra lunga sotto.
            border: `1px solid ${app.borderLight}`,
            boxShadow:
              "0 70px 150px rgba(0,0,0,0.72), 0 0 0 1px rgba(255,255,255,0.04) inset",
            overflow: "hidden",
          }}
        >
          <Chrome />
          <Sidebar />
          <Thread
            branch={branch}
            prompt={prompt}
            sent={sent}
            bubbleAt={bubbleAt}
            thinkAt={thinkAt}
            streamAt={streamAt}
            answer={answer}
            frame={frame}
          />
          <Composer
            typed={typed}
            focused={focused}
            caretOn={caretOn}
            sent={sent}
            frame={frame}
            sendClick={sendClick}
          />

          {/* Il cursore sta DENTRO la lastra, quindi prende la stessa
              prospettiva e appoggia sul piano. */}
          <Cursor path={path} clicks={[T.clickField, sendClick]} />
        </div>
      </AbsoluteFill>

      {/* Vignettatura: chiude gli angoli e tiene l'occhio al centro basso,
          dove succede tutto. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 85% at 50% 52%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.55) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */

const Backdrop: React.FC = () => (
  <div style={{ position: "absolute", inset: 0, padding: 34 }}>
    <div style={{ display: "flex", gap: 22 }}>
      {["Backlog", "In corso", "In review"].map((col) => (
        <div key={col} style={{ flex: 1 }}>
          <div
            style={{
              color: app.textMuted,
              fontSize: 19,
              letterSpacing: 0.4,
              marginBottom: 14,
            }}
          >
            {col}
          </div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 92,
                marginBottom: 14,
                background: app.elevated,
                border: `1px solid ${app.border}`,
                borderRadius: radius.md,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  </div>
);

const Chrome: React.FC = () => (
  <div
    style={{
      height: 66,
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "0 22px",
      background: app.inset,
      borderBottom: `1px solid ${app.border}`,
    }}
  >
    <div style={{ display: "flex", gap: 9, marginRight: 12 }}>
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <div
          key={c}
          style={{ width: 14, height: 14, borderRadius: 7, background: c }}
        />
      ))}
    </div>
    {[
      { name: "Scene motion", active: true },
      { name: "landing", active: false },
      { name: "finance", active: false },
    ].map((t) => (
      <div
        key={t.name}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 42,
          padding: "0 18px",
          fontSize: 20,
          color: t.active ? app.text : app.textMuted,
          background: t.active ? app.elevated : "transparent",
          border: `1px solid ${t.active ? app.border : "transparent"}`,
          borderRadius: radius.sm,
        }}
      >
        <div
          style={{
            width: 9,
            height: 9,
            borderRadius: 5,
            background: t.active ? app.claude : app.textFaint,
          }}
        />
        {t.name}
      </div>
    ))}
    <div
      style={{
        marginLeft: "auto",
        fontFamily: monoStack,
        fontSize: 18,
        color: app.textFaint,
      }}
    >
      Topics
    </div>
  </div>
);

const SIDEBAR_W = 340;

const Sidebar: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: 66,
      bottom: 0,
      width: SIDEBAR_W,
      background: app.surface,
      borderRight: `1px solid ${app.border}`,
      padding: "22px 0",
    }}
  >
    <div
      style={{
        padding: "0 22px 14px",
        fontSize: 16,
        letterSpacing: 1,
        color: app.textFaint,
      }}
    >
      PROGETTI
    </div>
    {[
      { n: "topics-app", d: 0, on: true },
      { n: "client", d: 1, on: false },
      { n: "server", d: 1, on: false },
      { n: "landing", d: 0, on: false },
      { n: "finance", d: 0, on: false },
      { n: "gtm-board", d: 0, on: false },
      { n: "match-compass", d: 0, on: false },
    ].map((r) => (
      <div
        key={r.n + r.d}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          height: 46,
          margin: "0 12px",
          padding: `0 14px 0 ${14 + r.d * 22}px`,
          fontSize: 21,
          color: r.on ? app.text : app.textSecondary,
          background: r.on ? app.hover : "transparent",
          borderRadius: radius.sm,
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: radius.xs,
            background: r.on ? app.primary : app.borderLight,
          }}
        />
        {r.n}
      </div>
    ))}
  </div>
);

type ThreadProps = {
  branch: string;
  prompt: string;
  sent: boolean;
  bubbleAt: number;
  thinkAt: number;
  streamAt: number;
  answer: string;
  frame: number;
};

const Thread: React.FC<ThreadProps> = ({
  branch,
  prompt,
  sent,
  bubbleAt,
  thinkAt,
  streamAt,
  answer,
  frame,
}) => {
  const bubbleIn = interpolate(frame, [bubbleAt, bubbleAt + 12], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // La riga dei tre puntini vive solo fra la spedizione e il primo token.
  const thinking = frame >= thinkAt && frame < streamAt + 2;

  return (
    <div
      style={{
        position: "absolute",
        left: SIDEBAR_W,
        right: 0,
        top: 66,
        bottom: 158,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Intestazione della pane. La riga h-10 del chrome, e il ramo del
          worktree, che si chiama topics/<nome>. */}
      <div
        style={{
          height: 62,
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "0 34px",
          borderBottom: `1px solid ${app.border}`,
        }}
      >
        <div style={{ fontSize: 22, color: app.textHeading }}>Scene motion</div>
        <div
          style={{
            fontFamily: monoStack,
            fontSize: 17,
            color: app.textMuted,
            padding: "5px 12px",
            border: `1px solid ${app.border}`,
            borderRadius: radius.xs,
          }}
        >
          {branch}
        </div>
        <div
          style={{
            marginLeft: "auto",
            fontSize: 17,
            color: app.ok,
          }}
        >
          Opus 5
        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: "26px 34px 0",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: 20,
          overflow: "hidden",
        }}
      >
        <Msg who="user" text="Guarda il render di OrbitLoop accanto al riferimento." />
        <Msg
          who="assistant"
          text="Il meccanismo copre il terzo centrale, il riferimento riempie il quadro. Le etichette a quella scala non si leggono."
        />
        <ToolRow />

        {/* Il messaggio spedito. Compare solo dopo il click su invia. */}
        {sent ? (
          <div
            style={{
              opacity: bubbleIn,
              transform: `translateY(${(1 - bubbleIn) * 14}px)`,
            }}
          >
            <Msg who="user" text={prompt} />
          </div>
        ) : null}

        {thinking ? <Dots frame={frame} /> : null}

        {answer.length > 0 ? <Msg who="assistant" text={answer} streaming /> : null}
      </div>
    </div>
  );
};

const Msg: React.FC<{
  who: "user" | "assistant";
  text: string;
  streaming?: boolean;
}> = ({ who, text, streaming }) => {
  const isUser = who === "user";
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div
        style={{
          width: 30,
          height: 30,
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
          padding: isUser ? "14px 20px" : "14px 0",
          fontSize: 24,
          lineHeight: 1.45,
          color: isUser ? app.text : app.textSecondary,
          maxWidth: 1240,
        }}
      >
        {text}
        {streaming ? (
          <span
            style={{
              display: "inline-block",
              width: 11,
              height: 24,
              marginLeft: 5,
              verticalAlign: "-4px",
              background: app.textSecondary,
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

const ToolRow: React.FC = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 14,
      marginLeft: 46,
      padding: "12px 18px",
      background: app.inset,
      border: `1px solid ${app.border}`,
      borderRadius: radius.sm,
      maxWidth: 900,
    }}
  >
    <div
      style={{ width: 8, height: 8, borderRadius: 4, background: app.ok, flex: "none" }}
    />
    <div style={{ fontFamily: monoStack, fontSize: 19, color: app.primary }}>
      Read
    </div>
    <div style={{ fontSize: 19, color: app.textMuted }}>ref/sheet_7gZBxBTapDQ.jpg</div>
  </div>
);

const Dots: React.FC<{ frame: number }> = ({ frame }) => (
  <div style={{ display: "flex", gap: 10, marginLeft: 46, height: 30, alignItems: "center" }}>
    {[0, 1, 2].map((i) => {
      // Il ciclo si calcola dal frame. Nessun @keyframes, nessun rAF.
      const phase = ((frame - i * 5) % 30) / 30;
      const o = 0.25 + 0.75 * (0.5 - 0.5 * Math.cos(phase * Math.PI * 2));
      return (
        <div
          key={i}
          style={{
            width: 11,
            height: 11,
            borderRadius: 6,
            background: app.textSecondary,
            opacity: o,
          }}
        />
      );
    })}
  </div>
);

const Composer: React.FC<{
  typed: string;
  focused: boolean;
  caretOn: boolean;
  sent: boolean;
  frame: number;
  sendClick: number;
}> = ({ typed, focused, caretOn, sent, frame, sendClick }) => {
  const armed = typed.length > 0 && !sent;

  const press = interpolate(frame, [sendClick, sendClick + 5, sendClick + 12], [1, 0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: COMPOSER.x,
        top: COMPOSER.y,
        width: COMPOSER.w,
        height: COMPOSER.h,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "0 18px 0 26px",
        background: app.elevated,
        // Il campo che prende il fuoco: il bordo cambia, e basta quello.
        border: `1px solid ${focused && !sent ? app.primary : app.border}`,
        borderRadius: radius.md,
        boxShadow:
          focused && !sent ? `0 0 0 3px rgba(77,148,255,0.16)` : "none",
      }}
    >
      <div
        style={{
          flex: 1,
          fontSize: 26,
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
              height: 30,
              marginLeft: 2,
              verticalAlign: "-6px",
              background: app.primary,
            }}
          />
        ) : null}
      </div>

      <div
        style={{
          width: 48,
          height: 48,
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius.sm,
          background: armed ? app.primary : app.hover,
          transform: `scale(${press})`,
        }}
      >
        <svg width={22} height={22} viewBox="0 0 24 24">
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
  );
};
