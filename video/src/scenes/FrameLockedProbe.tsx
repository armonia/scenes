import React, { useCallback, useRef } from "react";
import { AbsoluteFill } from "remotion";
import gsap from "gsap";
import { FrameLocked } from "../primitives/FrameLocked";
import { app, fontStack, monoStack, radius } from "../products/topics/tokens";

/**
 * Il banco di prova di FrameLocked, non una scena.
 *
 * Deve rendere VISIBILE un eventuale scarto di un frame, quindi tutto qui e'
 * scelto per amplificare: una barra che attraversa il quadro in quattro secondi
 * e un quadrato che ruota di due giri. Se GSAP avanza di suo fra il seek e lo
 * scatto, due render dello stesso frame danno larghezze diverse, e la differenza
 * si vede negli hash dei PNG anche quando l'occhio non la coglie.
 *
 * Come si legge il verdetto: `scripts/framelocked-verdict.sh`.
 *
 * `jitter` E' IL CONTROLLO NEGATIVO DEL BANCO, non una variante da usare. Sposta
 * il quadrato di una quantita' presa da Math.random, cioe' esattamente il guasto
 * che il banco esiste per trovare: il video esce lo stesso, e due render dello
 * stesso frame danno pixel diversi. Senza una sonda che il banco deve bocciare,
 * il suo verde vorrebbe dire soltanto che e' arrivato in fondo.
 */

export const FrameLockedProbe: React.FC<{
  detachTicker?: boolean;
  jitter?: boolean;
}> = ({ detachTicker = true, jitter = false }) => {
  const bar = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);

  const build = useCallback((): gsap.core.Timeline => {
    const tl = gsap.timeline();
    if (bar.current) {
      tl.fromTo(
        bar.current,
        { width: 0 },
        { width: 1600, duration: 4, ease: "none" },
        0,
      );
    }
    if (box.current) {
      tl.fromTo(
        box.current,
        { rotation: 0 },
        { rotation: 720, duration: 4, ease: "none" },
        0,
      );
    }
    return tl;
  }, []);

  // Il guasto voluto, vedi sopra: fuori dalla sonda negativa vale zero.
  // L'INTERVALLO E' LARGO APPOSTA. Chrome allinea la posizione al pixel intero,
  // quindi con 40 px due render avevano una probabilita' su 40 di finire nello
  // stesso punto, e su un Mac e' successo al primo tentativo. Con 400 i tre
  // frame del banco coincidono per caso una volta su 64 milioni.
  // eslint-disable-next-line @remotion/deterministic-randomness
  const offset = jitter ? Math.random() * 400 : 0;

  return (
    <AbsoluteFill style={{ background: app.bg, fontFamily: fontStack }}>
      <FrameLocked
        build={build}
        detachTicker={detachTicker}
        style={{ position: "absolute", inset: 0 }}
      >
        <div
          style={{
            position: "absolute",
            left: 160,
            top: 300,
            color: app.textSecondary,
            fontSize: 26,
            fontFamily: monoStack,
          }}
        >
          detachTicker={String(detachTicker)}
        </div>
        <div
          ref={bar}
          style={{
            position: "absolute",
            left: 160,
            top: 380,
            height: 90,
            background: app.primary,
            borderRadius: radius.md,
          }}
        />
        <div
          ref={box}
          style={{
            position: "absolute",
            left: 880 + offset,
            top: 620,
            width: 160,
            height: 160,
            background: app.claude,
            borderRadius: radius.md,
          }}
        />
      </FrameLocked>
    </AbsoluteFill>
  );
};
