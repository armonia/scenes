import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SLAB_BACKDROP, app, fontStack } from "../theme";
import {
  CARD_HANDOFF_END_POSE,
  CARD_H,
  COLUMNS,
  COL_W,
  SLAB_H,
  SLAB_W,
  UI_MOCKUP_END_POSE,
  HANDOFF_FROM_COL,
  HANDOFF_FROM_IDX,
  HANDOFF_TO_COL,
  cardY,
  columnX,
  handoffCard,
  handoffTargetCards,
} from "../primitives/slab";
import { SlabEdge, SlabLighting } from "../primitives/SlabChrome";
import { Board } from "../primitives/Board";
import { Cursor, pointOnPath, type Waypoint } from "../primitives/Cursor";

/**
 * CardHandoff: la terza scena, e quella che rende dimostrabile la regola
 * "niente tagli".
 *
 * Con due scene la regola resta un'affermazione. Due clip che iniziano e
 * finiscono entrambe da ferme si possono mettere in fila in qualsiasi ordine e
 * nessuno vede il taglio, perche' non c'e' movimento da spezzare. Serve una
 * scena che NON parta da ferma: che nasca gia' nella posa in cui la precedente
 * si e' fermata, e che continui il gesto invece di ricominciarlo.
 *
 * IL PRIMO FRAME DI QUESTA E' L'ULTIMO FRAME DI UIMOCKUP. Non "molto simile":
 * identico, perche' entrambe leggono `UI_MOCKUP_END_POSE` dallo stesso modulo e
 * disegnano gli stessi componenti. Ed e' verificabile senza fidarsi: `seam.sh`
 * estrae i due fotogrammi e li confronta pixel per pixel. Se qualcuno cambia la
 * posa in una sola delle due, la misura lo dice.
 *
 * LA CARD VIAGGIA, LA COLONNA NON COLLASSA NELLO STESSO ISTANTE. Il gesto e'
 * quello vero di una board: la card si alza, attraversa, si posa, e solo mentre
 * si posa le card sotto risalgono a chiudere il vuoto. Farle risalire di scatto
 * nel frame dello stacco sarebbe un taglio travestito da animazione, e si vede
 * come un lampo.
 *
 * LA CAMERA CONTINUA IL SUO ARCO. UIMockup va da yaw -18 a -9; questa prosegue
 * da -9 verso -4, cioe' nella stessa direzione e con la stessa curva. Invertire
 * il verso qui leggerebbe come uno stacco anche a giunta perfetta, perche'
 * l'occhio segue la derivata del movimento, non solo la posizione.
 *
 * Frame-locked: ogni valore viene da useCurrentFrame().
 */

export type CardHandoffProps = {
  progress?: number;
};

// I tempi. La card non parte al frame 0: prima l'occhio deve riconoscere la
// board come la stessa di prima, poi deve arrivare la mano. Se si muovesse
// subito la giunta sarebbe corretta e illeggibile.
//
// LA MANO C'E' PERCHE' SENZA NON E' UN PRODOTTO. Una card che attraversa da
// sola e' un'animazione; una card che qualcuno prende e sposta e' un software
// che si usa. Erano due voci del catalogo che nessuna scena implementava, CUR-01
// per l'arrivo in arco e CUR-04 per il peso del trascinamento, e stavano ferme
// li' mentre la scena faceva volare la card con una interpolazione.
const GRAB = 78;
const DRAG_START = 84;
const DRAG_END = 176;
const RELEASE = 178;
const SETTLE_END = 196;
/** Di quanti frame la card resta indietro rispetto alla mano. */
const LAG = 3;
/** Gradi di inclinazione per pixel di velocita'. */
const TILT_PER_PX = 0.11;

/**
 * CHR-03, la catena di conseguenze, e i due ritardi che la rendono una catena.
 *
 * La card si posa, POI il contatore della colonna recepisce, POI la card si
 * riscrive l'eta': "12h" diventa "ora", che e' quello che fa una board vera
 * quando qualcosa si sposta. Prima i due anelli scattavano tutti e due a meta'
 * tragitto, sullo stesso frame: tre cose che cambiano insieme non leggono come
 * una causa, leggono come tre cose scollegate che si sono mosse per caso. Il
 * ritardo e' l'unica cosa che dice all'occhio quale evento ha provocato
 * l'altro, e cinque o sei frame bastano - sotto due spariscono, sopra venti
 * diventano lentezza.
 *
 * IL TERZO ANELLO NON E' IL PANNELLO, ed e' una correzione fatta guardando il
 * render. Il catalogo diceva "il pannello cambia stato sei frame dopo", ma a
 * questa posa la camera e' gia' abbastanza dentro che il pannello dei dettagli
 * esce dal bordo destro: si leggono le etichette e non i valori. Un anello
 * della catena fuori quadro non e' un anello. L'eta' della card sta al centro
 * dell'inquadratura, e cambia per lo stesso motivo per cui cambierebbe il
 * pannello.
 */
const COUNT_AT = RELEASE + 5;
const PANEL_AT = RELEASE + 11;

export const CardHandoff: React.FC<CardHandoffProps> = ({ progress }) => {
  const localFrame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const frame =
    progress === undefined ? localFrame : progress * (durationInFrames - 1);
  const last = durationInFrames - 1;

  // La camera continua l'arco di UIMockup: stessa direzione, stessa curva.
  const yaw = interpolate(frame, [0, last], [UI_MOCKUP_END_POSE.yaw, CARD_HANDOFF_END_POSE.yaw], {
    easing: Easing.inOut(Easing.quad),
    extrapolateRight: "clamp",
  });
  const pitch = interpolate(frame, [0, last], [UI_MOCKUP_END_POSE.pitch, CARD_HANDOFF_END_POSE.pitch], {
    easing: Easing.inOut(Easing.quad),
    extrapolateRight: "clamp",
  });
  const pushZ = interpolate(frame, [0, last], [UI_MOCKUP_END_POSE.pushZ, CARD_HANDOFF_END_POSE.pushZ], {
    easing: Easing.inOut(Easing.quad),
    extrapolateRight: "clamp",
  });

  // NESSUN fade-in. Un fade da nero all'inizio sarebbe un taglio con le buone
  // maniere: il primo frame deve essere gia' pieno, identico all'ultimo di prima.
  const bgYaw = yaw * 0.6;

  const moving = handoffCard();

  // Colonna di partenza senza la card che vola, colonna di arrivo con la card
  // in coda: sono gli elenchi da cui si calcolano le due posizioni di slot.
  const fromRest = COLUMNS[HANDOFF_FROM_COL]!.cards.filter((_, i) => i !== HANDOFF_FROM_IDX);
  const toWith = handoffTargetCards();

  const x0 = columnX(HANDOFF_FROM_COL);
  const y0 = cardY(COLUMNS[HANDOFF_FROM_COL]!.cards, HANDOFF_FROM_IDX);
  const x1 = columnX(HANDOFF_TO_COL);
  const y1 = cardY(toWith, toWith.length - 1);

  // Dove la mano afferra la card: non al centro esatto, che legge come un
  // bersaglio calcolato, ma sul corpo della card poco sopra la meta'.
  const gdx = COL_W * 0.38;
  const gdy = CARD_H * 0.42;

  // Il percorso della mano. CUR-01 e' tutto qui dentro: entra da fuori lastra,
  // curva - il waypoint di meta' strada sta fuori dall'asse, che e' cio' che
  // rende l'arrivo un arco e non una diagonale - supera di poco il bersaglio e
  // ci si posa. L'overshoot e' 26 px su 1130 di corsa.
  const path: Waypoint[] = [
    { x: 2620, y: 1330, at: 0 },
    { x: 2620, y: 1330, at: 14 },
    { x: 1580, y: 700, at: 46 },
    { x: x0 + gdx + 26, y: y0 + gdy - 18, at: 66 },
    { x: x0 + gdx, y: y0 + gdy, at: 76 },
    { x: x0 + gdx, y: y0 + gdy, at: DRAG_START },
    { x: (x0 + x1) / 2 + gdx, y: Math.min(y0, y1) + gdy - 96, at: 130 },
    { x: x1 + gdx, y: y1 + gdy, at: DRAG_END },
    { x: x1 + gdx, y: y1 + gdy, at: 186 },
    // La mano se ne va prima della fine, e non e' una gentilezza: la scena dopo
    // non ha nessun cursore, quindi se restasse in quadro all'ultimo frame la
    // giunta con CardFocus mostrerebbe una freccia che sparisce.
    { x: 2620, y: 1330, at: 216 },
    { x: 2620, y: 1330, at: last },
  ];

  // CUR-04: la card sta dove stava la mano tre frame fa, e l'inclinazione esce
  // dalla differenza fra due campioni. Senza il ritardo la card sembra saldata
  // al puntatore; senza l'inclinazione sembra trascinata su un tavolo.
  const heldFrame = Math.min(frame, RELEASE) - LAG;
  const lagged = pointOnPath(path, heldFrame);
  const before = pointOnPath(path, heldFrame - 3);
  const held = frame >= GRAB;

  // Dopo il rilascio la card scivola nello slot: la correzione e' piccola,
  // perche' la mano ha gia' dimorato sul punto d'arrivo.
  const settle = interpolate(frame, [RELEASE, SETTLE_END], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const lift = interpolate(frame, [GRAB, GRAB + 12, RELEASE, SETTLE_END], [0, 1, 1, 0], {
    easing: Easing.inOut(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const dragX = lagged.x - gdx;
  const dragY = lagged.y - gdy;
  const cardX = !held ? x0 : dragX + (x1 - dragX) * settle;
  const cardY_ = !held ? y0 : dragY + (y1 - dragY) * settle;
  const tilt = held ? (lagged.x - before.x) * TILT_PER_PX * (1 - settle) : 0;

  // Il terzo anello della catena: la card si riscrive l'eta'.
  const movingNow = frame >= PANEL_AT ? { ...moving, age: "ora" } : moving;

  // Quanto del tragitto e' fatto: e' da qui che la board sa quando aggiornare i
  // contatori e quando aprire lo slot di destinazione.
  const travel = Math.max(0, Math.min(1, (cardX - x0) / (x1 - x0)));

  // Le card sotto risalgono mentre quella sopra si sta gia' posando, non prima.
  const closeGap = interpolate(frame, [DRAG_END - 22, SETTLE_END], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: app.bg, fontFamily: fontStack }}>
      <AbsoluteFill
        style={{
          perspective: SLAB_BACKDROP.perspective,
          perspectiveOrigin: SLAB_BACKDROP.perspectiveOrigin,
          opacity: SLAB_BACKDROP.opacity,
          filter: `blur(${SLAB_BACKDROP.blur}px)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: (1920 - SLAB_W) / 2 - 180,
            top: (1080 - SLAB_H) / 2 - 80,
            width: SLAB_W,
            height: SLAB_H,
            transform: `rotateY(${bgYaw + 8}deg) rotateX(${pitch + 4}deg) scale(0.92)`,
            transformOrigin: "50% 50%",
            background: app.surface,
            border: `1px solid ${app.border}`,
            borderRadius: 20,
            overflow: "hidden",
          }}
        >
          <Board
            closeGap={closeGap}
            travel={travel}
            lift={lift}
            cardX={cardX}
            cardY={cardY_}
            moving={movingNow}
            fromRest={fromRest}
            tilt={tilt}
            handed={frame >= COUNT_AT ? 1 : 0}
            statusChanged={frame >= PANEL_AT ? 1 : 0}
            dimmed
          />
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ perspective: 2600, perspectiveOrigin: "50% 46%" }}>
        {/* Lo spessore, dietro. Fratello e non figlio: la lastra ritaglia, e
            qualunque ritaglio appiattisce il 3D dei suoi figli. */}
        <SlabEdge
          left={(1920 - SLAB_W) / 2}
          top={(1080 - SLAB_H) / 2}
          pushZ={pushZ}
          yaw={yaw}
          pitch={pitch}
        />
        <div
          style={{
            position: "absolute",
            left: (1920 - SLAB_W) / 2,
            top: (1080 - SLAB_H) / 2,
            width: SLAB_W,
            height: SLAB_H,
            transform: `translateZ(${pushZ}px) rotateY(${yaw}deg) rotateX(${pitch}deg) scale(1.04)`,
            transformOrigin: "50% 50%",
            transformStyle: "preserve-3d",
            background: app.bg,
            borderRadius: 18,
            border: `1px solid ${app.borderLight}`,
            boxShadow:
              "0 80px 160px rgba(0,0,0,0.78), 0 0 0 1px rgba(255,255,255,0.05) inset",
            overflow: "hidden",
          }}
        >
          <Board
            closeGap={closeGap}
            travel={travel}
            lift={lift}
            cardX={cardX}
            cardY={cardY_}
            moving={movingNow}
            fromRest={fromRest}
            tilt={tilt}
            handed={frame >= COUNT_AT ? 1 : 0}
            statusChanged={frame >= PANEL_AT ? 1 : 0}
          />

          {/* La mano sta DENTRO la lastra, quindi prende la stessa prospettiva
              e appoggia sul piano. Al primo e all'ultimo frame sta fuori dai
              2400x1200 e l'overflow la taglia: e' cosi' che le due giunte
              restano identiche a scene che un cursore non ce l'hanno. */}
          <Cursor path={path} clicks={[GRAB, RELEASE]} />

          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 3,
              background:
                "linear-gradient(to right, transparent, rgba(255,255,255,0.12) 20%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.12) 80%, transparent)",
            }}
          />
        </div>
      </AbsoluteFill>

      <SlabLighting />
    </AbsoluteFill>
  );
};

