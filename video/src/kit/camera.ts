import { Easing, interpolate } from "remotion";
import type { Pose } from "./project.ts";

/**
 * La camera di una scena come dato: una curva per asse.
 *
 * PERCHE' ESISTE. Ogni scena calcolava la propria camera dentro il componente,
 * con cinque `interpolate` scritti a mano. Il render li leggeva, e nessun altro
 * poteva: per sapere la posa al fotogramma 137 bisognava renderizzare. Quindi
 * nessun banco poteva chiedersi se la derivata della camera si inverte a meta'
 * movimento (GIU-04), o se a un certo frame la lastra lascia scoperto un bordo
 * del quadro (CAM-01): erano domande che si potevano fare solo ai pixel, e i
 * pixel, in questo repo, hanno gia' risposto male una volta.
 *
 * Una traccia e' un dato che scene e banchi leggono allo stesso modo. `poseAt`
 * usa `interpolate` e `Easing` di Remotion con gli stessi argomenti che le scene
 * passavano, quindi le pose sono le stesse al bit e i render non cambiano.
 *
 * Modulo puro rispetto a React: lo leggono anche i banchi, da Node.
 */

export type Ease =
  | "linear"
  | "inOutQuad"
  | "inOutCubic"
  | { bezier: [number, number, number, number] };

/** Un asse che si muove da `from` a `to` fra i frame `start` ed `end`, poi resta fermo. */
export type AxisCurve = {
  from: number;
  to: number;
  start: number;
  end: number;
  ease: Ease;
};

/** Un asse e' una curva o un valore fisso. */
export type Track = { [K in keyof Pose]: AxisCurve | number };

const easingOf = (e: Ease): ((t: number) => number) | undefined => {
  if (e === "linear") return undefined;
  if (e === "inOutQuad") return Easing.inOut(Easing.quad);
  if (e === "inOutCubic") return Easing.inOut(Easing.cubic);
  return Easing.bezier(...e.bezier);
};

const axisAt = (c: AxisCurve | number, frame: number): number =>
  typeof c === "number"
    ? c
    : interpolate(frame, [c.start, c.end], [c.from, c.to], {
        easing: easingOf(c.ease),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

export const poseAt = (track: Track, frame: number): Pose => ({
  yaw: axisAt(track.yaw, frame),
  pitch: axisAt(track.pitch, frame),
  pushZ: axisAt(track.pushZ, frame),
  slideX: axisAt(track.slideX, frame),
  slideY: axisAt(track.slideY, frame),
});

/** Tutti gli easing linearizzati: il controllo negativo di checkChain. */
export const linearized = (track: Track): Track => {
  const out = { ...track };
  for (const k of Object.keys(out) as (keyof Pose)[]) {
    const c = out[k];
    if (typeof c !== "number") out[k] = { ...c, ease: "linear" };
  }
  return out;
};

export type ChainScene = { id: string; track: Track; frames: number };

export type ChainFinding = {
  kind: "salto" | "inversione in moto" | "inversione a riposo";
  axis: keyof Pose;
  where: string;
  detail: string;
};

const AXES: (keyof Pose)[] = ["yaw", "pitch", "pushZ", "slideX", "slideY"];

/**
 * GIU-04 sulla catena intera: la camera non torna indietro mentre si muove.
 *
 * Tre controlli, su ogni asse:
 * - dentro una scena, il segno della derivata non si inverte mai;
 * - a una giunta, l'ultima posa di una scena e' la prima della successiva;
 * - a una giunta il verso puo' invertirsi solo se la camera e' ferma da tutte
 *   e due le parti. La velocita' di confine si confronta con la velocita'
 *   massima dello stesso asse nella stessa scena: sotto il 5% e' riposo. Un
 *   inOut arriva ai capi sotto l'1%, un lineare no.
 *
 * Le inversioni a riposo si riportano senza bocciarle: sono quelle che il
 * README racconta per CardRelease e BoardOrbit, e il motivo per cui sono
 * ammesse e' che dove i due lati sono fermi non c'e' una derivata da rovesciare.
 */
export const checkChain = (
  scenes: ChainScene[],
  restRatio = 0.05,
): ChainFinding[] => {
  const findings: ChainFinding[] = [];
  const sampled = scenes.map((s) => ({
    id: s.id,
    poses: Array.from({ length: s.frames }, (_, f) => poseAt(s.track, f)),
  }));

  const sign = (v: number): number => (Math.abs(v) < 1e-9 ? 0 : Math.sign(v));

  for (const axis of AXES) {
    const info = sampled.map(({ id, poses }) => {
      const d = poses.slice(1).map((p, i) => p[axis] - poses[i]![axis]);
      const peak = Math.max(0, ...d.map(Math.abs));
      const nz = d.filter((v) => sign(v) !== 0);
      // Dentro la scena: il primo cambio di segno e' un'inversione in moto.
      for (let i = 1; i < d.length; i++) {
        const prev = d.slice(0, i).reverse().find((v) => sign(v) !== 0);
        if (prev !== undefined && sign(d[i]!) !== 0 && sign(d[i]!) !== sign(prev)) {
          findings.push({
            kind: "inversione in moto",
            axis,
            where: `${id} f${i}`,
            detail: `da ${sign(prev) > 0 ? "crescente" : "calante"} a ${sign(d[i]!) > 0 ? "crescente" : "calante"}`,
          });
          break;
        }
      }
      return {
        id,
        first: poses[0]![axis],
        last: poses[poses.length - 1]![axis],
        dirStart: nz.length ? sign(nz[0]!) : 0,
        dirEnd: nz.length ? sign(nz[nz.length - 1]!) : 0,
        vStart: Math.abs(d[0] ?? 0),
        vEnd: Math.abs(d[d.length - 1] ?? 0),
        peak,
      };
    });

    for (let i = 1; i < info.length; i++) {
      const a = info[i - 1]!;
      const b = info[i]!;
      const where = `${a.id} → ${b.id}`;
      if (Math.abs(a.last - b.first) > 1e-6) {
        findings.push({
          kind: "salto",
          axis,
          where,
          detail: `${a.last} contro ${b.first}`,
        });
      }
      if (a.dirEnd !== 0 && b.dirStart !== 0 && a.dirEnd !== b.dirStart) {
        const restA = a.peak === 0 || a.vEnd <= restRatio * a.peak;
        const restB = b.peak === 0 || b.vStart <= restRatio * b.peak;
        findings.push({
          kind: restA && restB ? "inversione a riposo" : "inversione in moto",
          axis,
          where,
          detail: `velocita' di confine ${(a.vEnd / (a.peak || 1)).toFixed(3)} e ${(b.vStart / (b.peak || 1)).toFixed(3)} del massimo`,
        });
      }
    }
  }
  return findings;
};
