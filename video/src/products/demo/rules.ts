import type { Ratio } from "../../kit/stage.ts";
import { filmCamera, checkFilmCamera } from "../../kit/filmCamera.ts";
import type { PoseKey } from "../../kit/filmCamera.ts";
import { chain, chainProblems, handoffOrder } from "../../kit/choreo.ts";
import type { ChainStep, Handoff } from "../../kit/choreo.ts";
import { arrivalOf, hesitationProblems } from "../../kit/cursorArc.ts";
import type { ArcMove } from "../../kit/cursorArc.ts";
import { cueProblems, dwellProblems } from "../../kit/type.ts";
import type { TypeCue } from "../../kit/type.ts";
import { DEMO_CAMERA_KEYS, DEMO_FRAMES } from "./geometry.ts";
import {
  CURSOR,
  FPS,
  INBOX_ITEMS,
  SECTION_CAUSE,
  SECTION_CHAIN,
  SEND_PRESS,
  STATUS_STEPS,
  cuesFor,
  handoffs,
} from "./timeline.ts";

/**
 * Le regole del film di Registro, controllate senza renderizzare, e le copie
 * guaste che i banchi usano come negativi.
 *
 * I GUASTI SONO DIFETTI VERI, uno per regola: una chiave di camera che torna
 * indietro, una frase che resta troppo poco per leggerla, una frase che esce
 * mentre la successiva entra, un'esitazione di quattro frame, due stati accesi
 * sullo stesso frame, un volo che parte prima che il varco si apra, un cambio di
 * stato con la camera ferma. Ognuno deve far scattare la sua regola
 * (film-rules.py --regola).
 */
export type DemoGuasto =
  | "camera-indietro"
  | "sosta-corta"
  | "battute-sovrapposte"
  | "esitazione-corta"
  | "catena-insieme"
  | "volo-prima-del-varco"
  | "stato-a-camera-ferma";

export const demoRules = (ratio: Ratio, guasto?: string) => {
  let keys: PoseKey[] = DEMO_CAMERA_KEYS[ratio];
  let press = SEND_PRESS;
  let statusSteps: ChainStep[] = STATUS_STEPS;
  let cues = cuesFor(ratio);
  let hs: Handoff[] = handoffs();
  if (guasto === "camera-indietro") {
    // La chiave di f440 torna al yaw di f0: la camera si gira indietro e poi riparte.
    keys = keys.map((k, i) => (i === 2 ? { at: k.at, pose: { ...k.pose, yaw: (keys[0] as PoseKey).pose.yaw } } : k));
  } else if (guasto === "esitazione-corta") {
    press = arrivalOf(CURSOR.moves[1] as ArcMove) + 4;
  } else if (guasto === "catena-insieme") {
    statusSteps = STATUS_STEPS.map((s) => ({ ...s, after: 0 }));
  } else if (guasto === "sosta-corta") {
    // "Il resto lo decidi tu." esce a f975: finisce di entrare a f940, e ventidue
    // caratteri in poco piu' di un secondo non si leggono.
    const glass: TypeCue[] = cues.glass.map((c, i) => (i === 3 ? { ...c, exitAt: 975 } : c));
    cues = { ...cues, glass };
  } else if (guasto === "volo-prima-del-varco") {
    hs = hs.map((h) => ({ ...h, flightFrom: 24 }));
  } else if (guasto === "battute-sovrapposte") {
    const glass: TypeCue[] = cues.glass.map((c, i) => (i === 4 ? { ...c, exitAt: 1266 } : c));
    cues = { ...cues, glass };
  } else if (guasto === "stato-a-camera-ferma") {
    // L'ultima chiave arriva prima e la camera si ferma a f1100: gli stati che si
    // accendono dopo cambiano a camera parcheggiata.
    keys = keys.map((k, i) => (i === keys.length - 2 ? { ...k, at: 1100 } : k));
    const last = keys[keys.length - 1] as PoseKey;
    const before = keys[keys.length - 2] as PoseKey;
    keys = [...keys.slice(0, -1), { at: last.at, pose: { ...before.pose } }];
  } else if (guasto !== undefined) {
    throw new Error(`guasto sconosciuto: ${guasto}`);
  }

  const cam = filmCamera(keys, DEMO_FRAMES);
  const statusFrames = chain(press, statusSteps);
  const events: { name: string; at: number }[] = [
    ...INBOX_ITEMS.map((it) => ({ name: `arrivo ${it.title}`, at: it.landAt })),
    ...chain(SECTION_CAUSE, SECTION_CHAIN).map((e) => ({ name: `sezione ${e.name}`, at: e.at })),
    { name: "pressione", at: press },
    ...statusFrames.map((e) => ({ name: `stato ${e.name}`, at: e.at })),
  ];

  // Nessun cambio di stato con la camera ferma: sarebbe uno stacco con la camera
  // parcheggiata sopra. "Ferma" e' la somma degli spostamenti di un frame sotto
  // un millesimo di pixel e di grado.
  const parked = events.flatMap((e) => {
    const a = cam.poseAt(e.at);
    const b = cam.poseAt(e.at + 1);
    const d =
      Math.abs(b.yaw - a.yaw) + Math.abs(b.pitch - a.pitch) + Math.abs(b.pushZ - a.pushZ) + Math.abs(b.slideX - a.slideX) + Math.abs(b.slideY - a.slideY);
    return d < 1e-3 ? [`${e.name} a f${e.at} cambia con la camera ferma`] : [];
  });

  return {
    camera: checkFilmCamera(cam).map((f) => f.detail),
    dwell: [...dwellProblems(cues.glass, FPS), ...dwellProblems(cues.plane, FPS)],
    cues: [...cueProblems(cues.glass), ...cueProblems(cues.plane)],
    hesitation: hesitationProblems(arrivalOf(CURSOR.moves[1] as ArcMove), press),
    chain: [...chainProblems(SECTION_CHAIN.slice(1)), ...chainProblems(statusSteps)],
    handoff: hs.flatMap(handoffOrder),
    parked,
  };
};
