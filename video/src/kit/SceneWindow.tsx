import React from "react";
import { Sequence } from "remotion";
import type { FilmWindow } from "./film";

/**
 * Una scena dentro un film, nella sua finestra.
 *
 * E' una `<Sequence>` e basta, e il motivo per cui basta e' il modo in cui le
 * scene leggono il tempo: `useCurrentFrame()` dentro una sequenza parte da zero
 * all'inizio della finestra, e `useVideoConfig().durationInFrames` restituisce
 * la durata della sequenza e non quella del film (remotion 4,
 * use-unsafe-video-config.js). Quindi `tempo()`, le tracce della camera e la
 * prop `progress` vedono la scena come se fosse una composition da sola, senza
 * che le scene sappiano di stare in un film.
 *
 * Che il fotogramma del film coincida davvero con quello della scena presa da
 * sola non si assume: lo misura `scripts/film-identity.sh`.
 */
export const SceneWindow: React.FC<{
  window: FilmWindow;
  children: React.ReactNode;
}> = ({ window, children }) => (
  <Sequence from={window.start} durationInFrames={window.frames} name={window.id}>
    {children}
  </Sequence>
);
