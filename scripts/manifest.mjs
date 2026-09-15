#!/usr/bin/env node
//
// Il manifest dei banchi: cosa renderizzare e cosa deve risultare sul render,
// calcolato dai moduli puri del kit e non riscritto dentro gli script.
//
// PERCHE' ESISTE. I banchi di questo repo leggevano la geometria importando
// slab.ts, cioe' le costanti di Topics: su un'altra lastra o in un altro
// rapporto non misuravano niente, e nessuno se ne sarebbe accorto perche' non
// fallivano. Qui un banco chiede "cosa devo trovare, e dove" per ogni variante,
// e la risposta viene dallo stesso codice che produce il render.
//
// Uso:
//   node scripts/manifest.mjs cam06     le varianti dello specimen CAM-06, in JSON
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (rel) => import(pathToFileURL(join(root, rel)).href);

const commands = {
  // La geometria che i banchi delle scene di Topics chiedevano a slab.ts con
  // uno script node scritto dentro di se'. Stesso formato di uscita di prima,
  // cosi' i banchi leggono con lo stesso `read`.
  "handoff-band": async () => {
    const t = await load("video/src/manifest/topics.ts");
    return t.handoffBand();
  },
  "focus-sharpness": async () => {
    const g = (await load("video/src/manifest/topics.ts")).cardFocusGeometry();
    return [g.cw, g.ch, g.cx, g.cy, g.zoom, g.wx, g.wy, g.k].join(" ");
  },
  "fixture-screenshot": async () => {
    const g = (await load("video/src/manifest/topics.ts")).cardFocusGeometry();
    return [g.cx, g.cy, g.wx, g.wy, g.k].join(" ");
  },
  // Su una riga: contrast-floor.py legge l'ultima riga dell'uscita.
  "contrast-crop": async () => {
    const t = await load("video/src/manifest/topics.ts");
    return JSON.stringify(t.contrastCrop());
  },

  // I casi su cui project-check.py confronta la proiezione con il DOM: due
  // lastre, tre stage, le sei pose della catena di Topics, cinque punti ciascuno
  // messi apposta lontano dal centro e fuori dagli assi.
  "project-cases": async () => {
    const { STAGES, RATIOS } = await load("video/src/kit/stage.ts");
    const { cssPerspectiveOrigin } = await load("video/src/kit/rig.ts");
    const { project } = await load("video/src/kit/project.ts");
    const slab = await load("video/src/primitives/slab.ts");
    const probe = await load("video/src/products/probe/geometry.ts");
    const slabs = {
      topics: { rig: slab.TOPICS_RIG, size: slab.TOPICS_SLAB },
      probe: { rig: probe.PROBE_RIG, size: probe.PROBE_SLAB },
    };
    const poses = [
      "UI_MOCKUP_START_POSE",
      "UI_MOCKUP_END_POSE",
      "CARD_HANDOFF_END_POSE",
      "CARD_FOCUS_END_POSE",
      "PROMPT_INPUT_END_POSE",
      "BOARD_ORBIT_END_POSE",
    ];
    const frac = [
      [0.1, 0.1],
      [0.9, 0.1],
      [0.5, 0.5],
      [0.1, 0.9],
      [0.83, 0.37],
    ];
    const cases = [];
    for (const ratio of RATIOS) {
      const stage = STAGES[ratio];
      for (const [name, { rig, size }] of Object.entries(slabs)) {
        for (const poseName of poses) {
          const p = slab[poseName];
          const pose = { slideY: 0, ...p };
          cases.push({
            id: `${name}-${ratio}-${poseName}`,
            stage,
            rig,
            origin: cssPerspectiveOrigin(rig),
            slab: size,
            pose,
            points: frac.map(([fx, fy]) => {
              const pt = { x: size.w * fx, y: size.h * fy };
              const s = project(stage, rig, size, pose, pt);
              return { ...pt, sx: s.x, sy: s.y };
            }),
          });
        }
      }
    }
    return cases;
  },

  cam06: async () => {
    const list = await load("video/src/specimens/list.ts");
    return list.CAM06_SPECIMENS.map((s) => ({
      id: s.id,
      product: s.product,
      ratio: s.ratio,
      width: s.width,
      height: s.height,
      frames: [0, s.durationInFrames - 1],
      // QUATTRO PIXEL, E NON I "DUE" DEI DOCUMENTI DI REGIA. Misurato: la card di
      // Topics sta su coordinate frazionarie, la lastra e' scalata 1,04 e la
      // spinta la ingrandisce tre volte, e la rasterizzazione sposta l'anello
      // fino a 2,2 px all'ultimo frame del 16:9, contro 0,6 della lastra sonda,
      // che ha coordinate intere e scala 1. I due negativi scappano di almeno
      // 40 px in ogni variante: 4 sta dieci volte sotto il caso rotto e lascia
      // spazio alla differenza di rasterizzazione fra macOS e il Linux della CI.
      tolPx: 4,
      ...list.cam06Expectation(s.product, s.ratio),
    }));
  },
};

const cmd = process.argv[2];
if (!commands[cmd]) {
  console.error(`uso: node scripts/manifest.mjs <${Object.keys(commands).join("|")}>`);
  process.exit(2);
}
const result = await commands[cmd]();
// Le righe gia' formattate escono cosi' come sono, per i `read` della shell;
// il resto esce in JSON.
process.stdout.write(
  (typeof result === "string" || typeof result === "number"
    ? String(result)
    : JSON.stringify(result, null, 1)) + "\n",
);
