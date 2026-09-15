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

const argValue = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};

const catalogScenes = async () => {
  const { readFile } = await import("node:fs/promises");
  const c = JSON.parse(
    await readFile(join(root, "video/src/scenes/catalog.json"), "utf8"),
  );
  return c.scenes;
};

const commands = {
  // GIU-04 sulla catena del catalogo: le tracce delle scene, nell'ordine in cui
  // si agganciano, lette da checkChain. --linear toglie tutti gli easing, ed e'
  // il controllo negativo: le giunte non sono piu' a riposo.
  chain: async () => {
    const { checkChain, linearized } = await load("video/src/kit/camera.ts");
    const { TOPICS_TRACKS } = await load("video/src/primitives/tracks.ts");
    const scenes = (await catalogScenes()).map((s) => {
      const build = TOPICS_TRACKS[s.id];
      if (!build) throw new Error(`nessuna traccia per ${s.id} in primitives/tracks.ts`);
      const track = build(s.durationInFrames);
      return {
        id: s.id,
        frames: s.durationInFrames,
        track: process.argv.includes("--linear") ? linearized(track) : track,
      };
    });
    return { scenes: scenes.map((s) => s.id), findings: checkChain(scenes) };
  },

  // CAM-01 in geometria: per ogni scena che dichiara `fill`, dal 20% della durata
  // all'ultimo frame, i quattro angoli del quadro devono cadere dentro la lastra
  // proiettata. --push-offset N sposta indietro la camera di N su ogni posa, ed e'
  // il controllo negativo: la lastra arretrata.
  fill: async () => {
    const { poseAt } = await load("video/src/kit/camera.ts");
    const { project } = await load("video/src/kit/project.ts");
    const { TOPICS_TRACKS } = await load("video/src/primitives/tracks.ts");
    const slab = await load("video/src/primitives/slab.ts");
    const offset = Number(argValue("--push-offset") ?? 0);
    const stage = slab.TOPICS_STAGE;
    const out = [];
    for (const s of await catalogScenes()) {
      if (!s.fill) continue;
      const track = TOPICS_TRACKS[s.id](s.durationInFrames);
      const from = Math.floor(s.durationInFrames * 0.2);
      let first = null;
      let minMargin = Infinity;
      for (let f = from; f < s.durationInFrames; f++) {
        const pose = poseAt(track, f);
        pose.pushZ += offset;
        const W = slab.TOPICS_SLAB.w;
        const H = slab.TOPICS_SLAB.h;
        const q = [
          [0, 0],
          [W, 0],
          [W, H],
          [0, H],
        ].map(([x, y]) => project(stage, slab.TOPICS_RIG, slab.TOPICS_SLAB, pose, { x, y }));
        // Distanza con segno di un punto dai lati del quadrilatero convesso,
        // positiva dentro. IL SEGNO NON SI ASSUME: dipende dal verso in cui si
        // percorrono gli angoli, e con l'asse y che scende la prima versione lo
        // aveva al contrario e dava ogni scena scoperta di 2300 px. Si prende dal
        // centro della lastra, che dentro ci sta per forza.
        const raw = (px, py) =>
          Math.min(
            ...q.map((a, i) => {
              const b = q[(i + 1) % 4];
              const ex = b.x - a.x;
              const ey = b.y - a.y;
              return ((px - a.x) * ey - (py - a.y) * ex) / Math.hypot(ex, ey);
            }),
          );
        const cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4;
        const cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4;
        const inward = q
          .map((a, i) => {
            const b = q[(i + 1) % 4];
            return (cx - a.x) * (b.y - a.y) - (cy - a.y) * (b.x - a.x);
          })
          .every((v) => v > 0)
          ? 1
          : -1;
        const margin = (px, py) =>
          inward === 1
            ? raw(px, py)
            : Math.min(
                ...q.map((a, i) => {
                  const b = q[(i + 1) % 4];
                  const ex = b.x - a.x;
                  const ey = b.y - a.y;
                  return -((px - a.x) * ey - (py - a.y) * ex) / Math.hypot(ex, ey);
                }),
              );
        const corners = [
          ["alto a sinistra", 0, 0],
          ["alto a destra", stage.w, 0],
          ["basso a destra", stage.w, stage.h],
          ["basso a sinistra", 0, stage.h],
        ];
        for (const [name, x, y] of corners) {
          const m = margin(x, y);
          minMargin = Math.min(minMargin, m);
          if (m < 0 && !first) first = { frame: f, corner: name, margin: m };
        }
      }
      out.push({ id: s.id, from, to: s.durationInFrames - 1, first, minMargin });
    }
    return out;
  },

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
