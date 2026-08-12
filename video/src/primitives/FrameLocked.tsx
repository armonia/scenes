import React, { useLayoutEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import gsap from "gsap";

/**
 * Pilota una timeline GSAP dal clock di Remotion, invece che dall'orologio a muro.
 *
 * Serve a portare dentro le demo che esistono gia' fuori da Remotion. La
 * maggior parte di quelle che valgono la pena e' pilotata dallo scroll o da una
 * timeline GSAP con durate esplicite: in tutt'e due i casi il tempo e'
 * interrogabile, quindi basta sostituire l'input. Quelle a requestAnimationFrame
 * invece vanno riscritte, perche' non hanno un tempo da interrogare.
 *
 * `detachTicker` esiste per la prova, non per l'uso. Il §8 del documento diceva
 * che senza `gsap.ticker.remove(gsap.updateRoot)` in headless GSAP continua ad
 * avanzare da solo e i frame ballano, ma quel wrapper non era mai passato per un
 * render. Tenere il ramo commutabile permette di renderizzare lo stesso frame
 * nelle due configurazioni e confrontare gli hash, che e' l'unico modo di
 * rispondere con un numero invece che con una convinzione.
 */

export type FrameLockedProps = {
  /** Costruisce la timeline dentro `root`. Deve essere stabile fra i render. */
  build: (root: HTMLDivElement) => gsap.core.Timeline;
  /** Stacca GSAP dall'orologio a muro. Falso solo per la prova. */
  detachTicker?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

export const FrameLocked: React.FC<FrameLockedProps> = ({
  build,
  detachTicker = true,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const root = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    if (detachTicker) gsap.ticker.remove(gsap.updateRoot);
    tl.current = build(el).pause();
    return () => {
      tl.current?.kill();
      tl.current = null;
    };
  }, [build, detachTicker]);

  // suppressEvents a true: i callback della timeline non devono sparare a ogni
  // seek, o il render smette di essere una funzione pura del frame.
  tl.current?.seek(frame / fps, true);

  return (
    <div ref={root} style={style}>
      {children}
    </div>
  );
};
