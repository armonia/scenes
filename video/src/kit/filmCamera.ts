import type { Pose } from "./project.ts";

/**
 * La camera di un film intero: una traccia sola, a chiavi, dal primo all'ultimo
 * fotogramma.
 *
 * PERCHE' NON LE TRACCE DELLE SCENE. Le scene di Topics hanno ognuna la sua
 * curva, con easing inOut ai due capi: ogni giunta e' un punto in cui la camera
 * si ferma. Per sei clip che si agganciano va bene, per un commercial da 45
 * secondi no. Gli script di Cifra e di Zeno chiedono "una sola spinta continua":
 * la camera parte da ferma, non si ferma mai fino alla fine, e non torna
 * indietro su nessun asse. Le pose di passaggio stanno in una tabella per
 * formato (quelle degli script), e fra una chiave e l'altra la curva la calcola
 * questo modulo.
 *
 * LA CURVA E' UNA CUBICA MONOTONA (Fritsch e Carlson), non una spline qualsiasi.
 * Una spline cubica naturale passa per le chiavi ma fra una e l'altra puo'
 * scavalcarle: se yaw va da -13 a -9,5 la spline puo' toccare -8,9 e poi tornare
 * a -9,5, cioe' un'inversione in moto che GIU-04 vieta e che nessuna tabella
 * mostra. La monotona non scavalca mai: dove le chiavi salgono la curva sale,
 * dove sono uguali sta ferma. E ha velocita' continua, quindi le giunte fra
 * scene non si leggono come frenate.
 *
 * VELOCITA' ZERO AI CAPI (GIU-02). Le tangenti al primo e all'ultimo fotogramma
 * valgono zero: il film comincia da fermo e finisce da fermo, e un altro film o
 * un fermo immagine ci si possono attaccare senza stacco.
 *
 * Modulo puro, letto da Node.
 */

/** Una posa in un fotogramma del film. */
export type PoseKey = { at: number; pose: Pose };

const AXES = ["yaw", "pitch", "pushZ", "slideX", "slideY"] as const;
type Axis = (typeof AXES)[number];

/** Le tangenti di una cubica monotona per un asse, con zero ai due capi. */
const tangents = (xs: readonly number[], ys: readonly number[]): number[] => {
  const n = xs.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    d.push(((ys[i + 1] as number) - (ys[i] as number)) / ((xs[i + 1] as number) - (xs[i] as number)));
  }
  const m: number[] = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const a = d[i - 1] as number;
    const b = d[i] as number;
    // Dove la pendenza cambia segno, o una delle due e' zero, la curva deve
    // fermarsi sulla chiave: altrimenti la scavalcherebbe.
    if (a === 0 || b === 0 || Math.sign(a) !== Math.sign(b)) {
      m[i] = 0;
    } else {
      // Media armonica pesata sugli intervalli (Fritsch e Butland): resta fra
      // le due pendenze e non supera mai tre volte la minore, che e' la
      // condizione perche' il segmento non scavalchi.
      const h0 = (xs[i] as number) - (xs[i - 1] as number);
      const h1 = (xs[i + 1] as number) - (xs[i] as number);
      const w1 = 2 * h1 + h0;
      const w2 = h1 + 2 * h0;
      m[i] = (w1 + w2) / (w1 / a + w2 / b);
    }
  }
  return m;
};

/** Le chiavi devono cominciare a 0, finire all'ultimo fotogramma e crescere. */
const validate = (keys: readonly PoseKey[], frames: number): void => {
  if (keys.length < 2) throw new Error("una traccia del film vuole almeno due chiavi");
  if ((keys[0] as PoseKey).at !== 0) throw new Error("la prima chiave deve stare al fotogramma 0");
  if ((keys[keys.length - 1] as PoseKey).at !== frames - 1) {
    throw new Error(`l'ultima chiave deve stare all'ultimo fotogramma (${frames - 1})`);
  }
  for (let i = 1; i < keys.length; i++) {
    if ((keys[i] as PoseKey).at <= (keys[i - 1] as PoseKey).at) {
      throw new Error(`le chiavi devono crescere: f${(keys[i - 1] as PoseKey).at} poi f${(keys[i] as PoseKey).at}`);
    }
  }
};

export type FilmCamera = {
  frames: number;
  keys: readonly PoseKey[];
  /** La posa a un fotogramma qualunque, anche frazionario. */
  poseAt: (frame: number) => Pose;
};

/**
 * La camera di un film da `frames` fotogrammi, dalle chiavi. Le tangenti si
 * calcolano una volta sola, qui, e `poseAt` valuta la cubica di Hermite del
 * segmento in cui cade il fotogramma.
 */
export const filmCamera = (keys: readonly PoseKey[], frames: number): FilmCamera => {
  validate(keys, frames);
  const xs = keys.map((k) => k.at);
  const series = Object.fromEntries(
    AXES.map((axis) => {
      const ys = keys.map((k) => k.pose[axis]);
      return [axis, { ys, ms: tangents(xs, ys) }];
    }),
  ) as Record<Axis, { ys: number[]; ms: number[] }>;

  const poseAt = (frame: number): Pose => {
    const f = Math.min(Math.max(frame, 0), frames - 1);
    let i = 0;
    while (i < xs.length - 2 && f > (xs[i + 1] as number)) i++;
    const x0 = xs[i] as number;
    const x1 = xs[i + 1] as number;
    const h = x1 - x0;
    const t = (f - x0) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    const out = {} as Pose;
    for (const axis of AXES) {
      const { ys, ms } = series[axis];
      out[axis] =
        h00 * (ys[i] as number) + h10 * h * (ms[i] as number) + h01 * (ys[i + 1] as number) + h11 * h * (ms[i + 1] as number);
    }
    return out;
  };

  return { frames, keys, poseAt };
};

export type CameraFinding = {
  kind: "inversione" | "velocita' ai capi" | "scavalco";
  axis: Axis;
  frame: number;
  detail: string;
};

/**
 * GIU-02 e GIU-04 sull'intera traccia, fotogramma per fotogramma.
 *
 * L'INVERSIONE SI GUARDA SU IMBARDATA, BECCHEGGIO E SPINTA, non sugli
 * spostamenti. La grammatica lo dice cosi': "yaw, pitch e push non invertono
 * mai. L'occhio segue la derivata: un'inversione a una giunzione si legge come
 * uno stacco anche quando i pixel dei due frame combaciano". Una panoramica che
 * torna indietro non e' uno stacco, e' una panoramica: la prima versione di
 * questo controllo la vietava, e il film di un prodotto vero non poteva seguire
 * i suoi soggetti (in Cifra il documento sta a sinistra e la chat a destra).
 *
 * Il resto vale su tutti gli assi: nessuno scavalca le chiavi fra cui sta, e ai
 * due capi la camera e' ferma (GIU-02).
 *
 * `restRatio` e' la frazione della velocita' massima dell'asse sotto cui l'asse
 * si considera fermo: un'inversione fra due tratti fermi non e' un'inversione
 * in moto, come nelle giunte a riposo di Topics.
 */
/** Gli assi su cui un'inversione e' un difetto (GIU-04). */
const INVERSIONE: readonly Axis[] = ["yaw", "pitch", "pushZ"];

export const checkFilmCamera = (cam: FilmCamera, restRatio = 0.02): CameraFinding[] => {
  const findings: CameraFinding[] = [];
  for (const axis of AXES) {
    const v: number[] = [];
    for (let f = 0; f < cam.frames - 1; f++) v.push(cam.poseAt(f + 1)[axis] - cam.poseAt(f)[axis]);
    const vmax = Math.max(...v.map(Math.abs));
    if (vmax === 0) continue;
    const rest = vmax * restRatio;
    let lastSign = 0;
    for (let f = 0; f < v.length; f++) {
      const x = v[f] as number;
      if (Math.abs(x) <= rest) continue;
      const s = Math.sign(x);
      if (lastSign !== 0 && s !== lastSign && INVERSIONE.includes(axis)) {
        findings.push({ kind: "inversione", axis, frame: f, detail: `${axis} cambia verso a f${f} (${x.toFixed(4)} per frame)` });
      }
      lastSign = s;
    }
    const first = Math.abs(v[0] as number);
    const last = Math.abs(v[v.length - 1] as number);
    if (first > rest || last > rest) {
      findings.push({
        kind: "velocita' ai capi",
        axis,
        frame: first > rest ? 0 : cam.frames - 1,
        detail: `${axis} si muove ai capi: ${first.toFixed(4)} all'inizio, ${last.toFixed(4)} alla fine (fermo sotto ${rest.toFixed(4)})`,
      });
    }
    // Fra due chiavi l'asse deve restare nell'intervallo delle due.
    for (let k = 0; k < cam.keys.length - 1; k++) {
      const a = cam.keys[k] as PoseKey;
      const b = cam.keys[k + 1] as PoseKey;
      const lo = Math.min(a.pose[axis], b.pose[axis]) - 1e-9;
      const hi = Math.max(a.pose[axis], b.pose[axis]) + 1e-9;
      for (let f = a.at; f <= b.at; f++) {
        const y = cam.poseAt(f)[axis];
        if (y < lo || y > hi) {
          findings.push({ kind: "scavalco", axis, frame: f, detail: `${axis} esce da [${lo.toFixed(3)}, ${hi.toFixed(3)}] a f${f}: ${y.toFixed(3)}` });
          break;
        }
      }
    }
  }
  return findings;
};
