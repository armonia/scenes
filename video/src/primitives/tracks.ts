import type { Track } from "../kit/camera.ts";
import {
  BOARD_ORBIT_END_POSE,
  CARD_FOCUS_END_POSE,
  CARD_HANDOFF_END_POSE,
  CARD_RELEASE_END_POSE,
  PROMPT_INPUT_END_POSE,
  UI_MOCKUP_END_POSE,
  UI_MOCKUP_START_POSE,
} from "./slab.ts";
import { tempo } from "./tempo.ts";

/**
 * Le camere delle sei scene di Topics, come tracce.
 *
 * Erano cinque `interpolate` dentro ogni componente. I numeri e le curve sono
 * gli stessi, scena per scena: stesse pose di partenza e d'arrivo da slab.ts,
 * stessi easing, stesse finestre, e dove una finestra dipende dalla durata la
 * scala con lo stesso `tempo()`. Le scene leggono la loro traccia con `poseAt`;
 * chain-check e fill-geom leggono le stesse tracce senza renderizzare.
 *
 * Modulo puro, letto da Node.
 */

/** UIMockup: la lastra entra da destra in 80 frame e la camera si raddrizza per tutta la scena. */
export const UI_MOCKUP_SLIDE_FRAMES = 80;
export const uiMockupTrack = (durationInFrames: number): Track => {
  const last = durationInFrames - 1;
  return {
    yaw: { from: UI_MOCKUP_START_POSE.yaw, to: UI_MOCKUP_END_POSE.yaw, start: 0, end: last, ease: "inOutQuad" },
    pitch: { from: UI_MOCKUP_START_POSE.pitch, to: UI_MOCKUP_END_POSE.pitch, start: 0, end: last, ease: "inOutQuad" },
    pushZ: { from: UI_MOCKUP_START_POSE.pushZ, to: UI_MOCKUP_END_POSE.pushZ, start: 0, end: last, ease: "inOutQuad" },
    slideX: {
      from: UI_MOCKUP_START_POSE.slideX,
      to: UI_MOCKUP_END_POSE.slideX,
      start: 0,
      end: UI_MOCKUP_SLIDE_FRAMES,
      ease: { bezier: [0.16, 1, 0.3, 1] },
    },
    slideY: 0,
  };
};

/** CardHandoff: continua l'arco di UIMockup con la stessa curva, senza spostamenti. */
export const cardHandoffTrack = (durationInFrames: number): Track => {
  const last = durationInFrames - 1;
  return {
    yaw: { from: UI_MOCKUP_END_POSE.yaw, to: CARD_HANDOFF_END_POSE.yaw, start: 0, end: last, ease: "inOutQuad" },
    pitch: { from: UI_MOCKUP_END_POSE.pitch, to: CARD_HANDOFF_END_POSE.pitch, start: 0, end: last, ease: "inOutQuad" },
    pushZ: { from: UI_MOCKUP_END_POSE.pushZ, to: CARD_HANDOFF_END_POSE.pushZ, start: 0, end: last, ease: "inOutQuad" },
    slideX: 0,
    slideY: 0,
  };
};

const fiveAxes = (
  from: { yaw: number; pitch: number; pushZ: number; slideX: number; slideY?: number },
  to: { yaw: number; pitch: number; pushZ: number; slideX: number; slideY?: number },
  end: number,
): Track => ({
  yaw: { from: from.yaw, to: to.yaw, start: 0, end, ease: "inOutCubic" },
  pitch: { from: from.pitch, to: to.pitch, start: 0, end, ease: "inOutCubic" },
  pushZ: { from: from.pushZ, to: to.pushZ, start: 0, end, ease: "inOutCubic" },
  slideX: { from: from.slideX, to: to.slideX, start: 0, end, ease: "inOutCubic" },
  slideY: { from: from.slideY ?? 0, to: to.slideY ?? 0, start: 0, end, ease: "inOutCubic" },
});

/** CardFocus: la discesa al macro sulla card consegnata, per tutta la scena. */
export const cardFocusTrack = (durationInFrames: number): Track =>
  fiveAxes(CARD_HANDOFF_END_POSE, CARD_FOCUS_END_POSE, durationInFrames - 1);

/** CardRelease: la camera lascia la card e torna larga, per tutta la scena. */
export const cardReleaseTrack = (durationInFrames: number): Track =>
  fiveAxes(CARD_FOCUS_END_POSE, CARD_RELEASE_END_POSE, durationInFrames - 1);

/** PromptInput: la camera si posa sul composer in 132 frame (alla durata di riferimento) e poi sta ferma. */
export const PROMPT_INPUT_BASE = 450;
export const PROMPT_INPUT_CAM_SETTLE = 132;
export const promptInputTrack = (durationInFrames: number): Track =>
  fiveAxes(
    CARD_RELEASE_END_POSE,
    PROMPT_INPUT_END_POSE,
    tempo(durationInFrames, PROMPT_INPUT_BASE).at(PROMPT_INPUT_CAM_SETTLE),
  );

/** BoardOrbit: l'orbita arriva a -34 gradi in 118 frame (alla durata di riferimento) e si ferma. */
export const BOARD_ORBIT_BASE = 150;
export const BOARD_ORBIT_SETTLE = 118;
export const boardOrbitTrack = (durationInFrames: number): Track =>
  fiveAxes(
    PROMPT_INPUT_END_POSE,
    BOARD_ORBIT_END_POSE,
    tempo(durationInFrames, BOARD_ORBIT_BASE).at(BOARD_ORBIT_SETTLE),
  );

/** Le tracce per id di composition, nell'ordine in cui le leggono i banchi. */
export const TOPICS_TRACKS: Record<string, (durationInFrames: number) => Track> = {
  UIMockup: uiMockupTrack,
  CardHandoff: cardHandoffTrack,
  CardFocus: cardFocusTrack,
  CardRelease: cardReleaseTrack,
  PromptInput: promptInputTrack,
  BoardOrbit: boardOrbitTrack,
};
