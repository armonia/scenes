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
 * IL VERDETTO, che il documento lasciava aperto. Misurato con
 * `scripts/framelocked-verdict.sh` su Remotion 4.0.508, gsap 3.15.0, rspack.
 *
 * Il §8 chiamava `gsap.ticker.remove(gsap.updateRoot)` «il pezzo che si
 * dimentica», perche' senza in headless GSAP continuerebbe ad avanzare da solo
 * e i frame ballerebbero. NON e' stato riprodotto. Con la riga e senza, lo
 * stesso frame renderizzato in due invocazioni separate esce identico, e due
 * render di sequenza da 120 frame danno file byte per byte uguali. La riga
 * resta accesa di default perche' non costa niente, ma ora e' un'opzione con
 * una misura dietro, non un rito.
 *
 * Il difetto vero stava altrove, ed e' descritto sotto: il seek nel corpo del
 * componente. Vale la pena notarlo come metodo. La previsione del §8 era su una
 * riga che non serviva, mentre il guasto stava in una riga che sembrava ovvia.
 * E' il motivo per cui «non validato» andava preso sul serio.
 *
 * Portata della prova: una timeline con due tween semplici. Non dice niente su
 * ScrollTrigger, sui plugin di fisica, o su qualunque cosa dentro GSAP tenga
 * uno stato proprio fra un seek e l'altro.
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

  /*
   * IL SEEK STA IN UN EFFETTO, e questo e' il punto in cui il §8 sbagliava.
   *
   * Il §8 lo faceva nel corpo del componente, cosi':
   *
   *     tl.current?.seek(frame / fps, false);
   *     return <div ref={root} />;
   *
   * Sembra giusto e non lo e'. Al primo render `tl.current` e' ancora null,
   * perche' l'effetto che costruisce la timeline non e' partito: quel seek non
   * fa niente. Poi parte l'effetto, la timeline nasce in pausa a zero, e non
   * c'e' nessun render successivo che rimedi. Su una still, dove il componente
   * si monta da zero per ogni fotogramma, il risultato e' che la timeline resta
   * SEMPRE a zero e ogni frame esce identico.
   *
   * E' un guasto che si traveste da successo. Renderizzando lo stesso frame due
   * volte gli hash coincidevano, quindi il test di determinismo passava: solo
   * che passava perche' non si muoveva niente. Il verdetto lo becca solo se,
   * oltre a confrontare due passate dello stesso frame, si controlla anche che
   * frame DIVERSI diano immagini diverse.
   *
   * Un effetto senza array di dipendenze gira dopo ogni render, e dopo quello
   * che costruisce la timeline. Quindi al primo montaggio la timeline esiste
   * gia' quando si fa il seek, e il DOM e' al tempo giusto prima del paint.
   */
  useLayoutEffect(() => {
    // suppressEvents a true: i callback della timeline non devono sparare a
    // ogni seek, o il render smette di essere una funzione pura del frame.
    tl.current?.seek(frame / fps, true);
  });

  return (
    <div ref={root} style={style}>
      {children}
    </div>
  );
};
