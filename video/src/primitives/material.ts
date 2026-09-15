import type { ShotMaterial } from "../kit/Shot";
import { SLAB_BACKDROP, app, fontStack } from "../theme";

/**
 * L'aspetto della ripresa di Topics: i numeri che le sei scene scrivevano a mano
 * dentro il proprio blocco di ripresa, adesso in un posto solo.
 *
 * I valori sono gli stessi, carattere per carattere: raggi 18, 20 e 22, lo
 * spessore a 30 dietro il piano con 6 px di debordo, il piano attenuato spostato
 * di -180 e -80, girato di 8 e 4 gradi in piu', scalato a 0,92, che segue lo yaw
 * al 60% e lo spostamento al 45%. Cambiarne uno qui cambia tutte le scene, che e'
 * esattamente il punto.
 */
export const TOPICS_SHOT_MATERIAL: ShotMaterial = {
  stage: { background: app.bg, fontFamily: fontStack },
  slab: {
    background: app.bg,
    radius: 18,
    border: `1px solid ${app.borderLight}`,
    shadow:
      "0 80px 160px rgba(0,0,0,0.78), 0 0 0 1px rgba(255,255,255,0.05) inset",
    highlight:
      "linear-gradient(to right, transparent, rgba(255,255,255,0.12) 20%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.12) 80%, transparent)",
  },
  edge: {
    background: "#05060a",
    radius: 22,
    shadow: "0 90px 180px rgba(0,0,0,0.75)",
    depth: 30,
    overhang: 6,
  },
  backdrop: {
    perspective: SLAB_BACKDROP.perspective,
    perspectiveOrigin: SLAB_BACKDROP.perspectiveOrigin,
    opacity: SLAB_BACKDROP.opacity,
    blur: SLAB_BACKDROP.blur,
    offsetX: -180,
    offsetY: -80,
    yawFollow: 0.6,
    slideFollow: 0.45,
    yawOffset: 8,
    pitchOffset: 4,
    scale: 0.92,
    background: app.surface,
    border: `1px solid ${app.border}`,
    radius: 20,
  },
  lighting: {
    vignette:
      "radial-gradient(130% 90% at 50% 52%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.62) 100%)",
    sheen: "linear-gradient(to bottom, rgba(255,255,255,0.04) 0%, transparent 8%)",
  },
};
