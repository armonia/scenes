import React, { useCallback, useRef } from "react";
import { AbsoluteFill } from "remotion";
import gsap from "gsap";
import { FrameLocked } from "../primitives/FrameLocked";
import { app, fontStack, monoStack, radius } from "../theme";

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
 */

export const FrameLockedProbe: React.FC<{ detachTicker?: boolean }> = ({
  detachTicker = true,
}) => {
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
            left: 880,
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
