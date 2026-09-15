#!/usr/bin/env node
//
// La geometria di slab.ts fotografata in un JSON, per dimostrare che un
// refactor non l'ha toccata.
//
// PERCHE' ESISTE. Spostare la matematica della ripresa in `kit/` doveva lasciare
// le pose di Topics identiche AL BIT, non "uguali a occhio": una posa diversa
// nell'ultima cifra sposta un pixel in un punto qualsiasi del film, e una
// giunta che era esatta smette di esserlo senza che nessuno la tocchi. Il
// confronto e' fra due stringhe, e JSON.stringify scrive ogni numero con le
// cifre che servono a ricostruirlo esattamente, quindi due stringhe uguali
// sono due geometrie uguali.
//
// Uso:
//   node scripts/geometry-snapshot.mjs [percorso/di/slab.ts] > geometria.json
//
// Il percorso serve a fotografare anche la versione di un altro commit, estratta
// con `git worktree add`.
import { resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const target = resolve(
  process.argv[2] ?? `${here}/../video/src/primitives/slab.ts`,
);
const m = await import(pathToFileURL(target).href);

const out = { constants: {}, poses: {}, functions: {} };

for (const [k, v] of Object.entries(m).sort(([a], [b]) => a.localeCompare(b))) {
  if (typeof v === "number") out.constants[k] = v;
  else if (v && typeof v === "object" && "yaw" in v && "pushZ" in v) out.poses[k] = v;
}
out.constants.COLUMNS = m.COLUMNS;

// Punti campione: gli angoli e il centro della lastra, piu' due punti qualsiasi
// non allineati a niente, perche' un errore d'ordine nelle operazioni si vede
// dove i numeri non sono tondi.
const pts = [
  [0, 0],
  [m.SLAB_W, m.SLAB_H],
  [m.SLAB_W / 2, m.SLAB_H / 2],
  [417.3, 918.61],
  [2011.07, 131.9],
];
out.functions.slabPointOnScreen = pts.map(([x, y]) => m.slabPointOnScreen(x, y));
out.functions.centreOn = pts.map(([x, y]) => m.centreOn(x, y));
out.functions.zoomForPush = [0, 48, 96, 1180, 1493.6, -140, -420].map((z) =>
  m.zoomForPush(z),
);
out.functions.pushForZoom = [1, 1.12, 2.35, 0.9].map((k) => m.pushForZoom(k));
out.functions.handoffLandedRect = m.handoffLandedRect();
out.functions.cardY = m.COLUMNS.map((c) =>
  c.cards.map((_, i) => m.cardY(c.cards, i)),
);
out.functions.addCardY = m.COLUMNS.map((c) => m.addCardY(c.cards));

process.stdout.write(JSON.stringify(out, null, 1) + "\n");
