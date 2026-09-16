#!/usr/bin/env node
//
// Il manifest dei banchi: cosa renderizzare e cosa deve risultare sul render,
// calcolato dai moduli puri del kit e non riscritto dentro gli script.
//
// PERCHE' ESISTE. I banchi di questo repo leggevano la geometria importando
// topics/geometry.ts, cioe' le costanti di Topics: su un'altra lastra o in un altro
// rapporto non misuravano niente, e nessuno se ne sarebbe accorto perche' non
// fallivano. Qui un banco chiede "cosa devo trovare, e dove" per ogni variante,
// e la risposta viene dallo stesso codice che produce il render.
//
// Uso:
//   node scripts/manifest.mjs cam06                 le varianti dello specimen CAM-06, in JSON
//   node scripts/manifest.mjs chain|fill --ratio R  le tracce della camera in un rapporto
//   node scripts/manifest.mjs film --ratio R        le finestre del film
//   node scripts/manifest.mjs bench NOME --ratio R  cosa deve trovare il banco NOME, in JSON
//     (NOME puo' essere il percorso di un modulo .ts: e' cosi' che un altro
//     repository fa girare i banchi sui suoi film)
//   node scripts/manifest.mjs checks --ratio R      i controlli da far girare, per expect.sh
//     [--solo A,B | --tranne A,B]                   solo quei moduli di scripts/checks, o tutti tranne
//     [--moduli DIR]                                i moduli di un'altra cartella
//
// Senza --ratio vale il 16:9. Un rapporto che il catalogo non dichiara esce 2.
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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

const ratioArg = () => argValue("--ratio") ?? "16x9";

const catalogJson = async () => {
  const { readFile } = await import("node:fs/promises");
  return JSON.parse(await readFile(join(root, "video/src/scenes/catalog.json"), "utf8"));
};

// La geometria di un banco sta in un modulo suo, sotto il prodotto:
// video/src/products/topics/benches/<nome>.ts, che esporta
// geometry(ratio, { catalog }) e restituisce un oggetto serializzabile.
// Il nome del file e' il nome del banco, quindi aggiungerne uno non tocca
// questo file.
const benchGeometry = async (name, ratio) => {
  const byPath = name.endsWith(".ts");
  if (!byPath && !/^[a-z0-9-]+$/.test(name)) throw new Error(`nome di banco non valido: ${name}`);
  const mod = byPath
    ? await import(pathToFileURL(resolve(process.cwd(), name)).href)
    : await load(`video/src/products/topics/benches/${name}.ts`);
  // `--guasto NOME` arriva al modulo: e' cosi' che un banco costruisce la copia
  // guasta di un film (un'esitazione troppo corta, una camera che torna indietro)
  // senza scriverla da se'.
  return mod.geometry(ratio, { catalog: await catalogJson(), guasto: argValue("--guasto") });
};

const commands = {
  // Il film di Topics come finestre: per ogni scena, nell'ordine delle giunte,
  // l'id della composition da sola, dove comincia nel film e quanto dura. Lo
  // legge film-identity.sh per sapere quali fotogrammi confrontare.
  film: async () => {
    const { chainOrder, filmWindows } = await load("video/src/kit/film.ts");
    const { variantName } = await load("video/src/kit/stage.ts");
    const { poseAt } = await load("video/src/kit/camera.ts");
    const { TOPICS_TRACKS } = await load("video/src/products/topics/tracks.ts");
    const ratio = ratioArg();
    const windows = filmWindows(chainOrder(await catalogScenes()));
    // Il fotogramma in cui la camera della scena si muove di piu': li' un frame di
    // scarto cambia per forza l'immagine, e il negativo di film-identity lo usa.
    // Ai bordi una scena puo' partire o finire ferma, e a meta' PromptInput cade
    // fra due parole dello streaming.
    const moving = (w) => {
      const track = TOPICS_TRACKS[w.id](w.frames, ratio);
      let best = 0;
      let bestD = -1;
      for (let f = 0; f < w.frames - 1; f++) {
        const a = poseAt(track, f);
        const b = poseAt(track, f + 1);
        const d =
          Math.abs(b.pushZ - a.pushZ) + Math.abs(b.slideX - a.slideX) + Math.abs(b.slideY - a.slideY) +
          50 * (Math.abs(b.yaw - a.yaw) + Math.abs(b.pitch - a.pitch));
        if (d > bestD) {
          bestD = d;
          best = f;
        }
      }
      return best;
    };
    return {
      film: variantName("TopicsFilm", ratio),
      windows: windows.map((w) => ({ ...w, id: variantName(w.id, ratio), moving: moving(w) })),
    };
  },

  // GIU-04 sulla catena del catalogo: le tracce delle scene, nell'ordine in cui
  // si agganciano, lette da checkChain. --linear toglie tutti gli easing, ed e'
  // il controllo negativo: le giunte non sono piu' a riposo.
  chain: async () => {
    const { checkChain, linearized } = await load("video/src/kit/camera.ts");
    const { TOPICS_TRACKS } = await load("video/src/products/topics/tracks.ts");
    const ratio = ratioArg();
    const scenes = (await catalogScenes()).map((s) => {
      const build = TOPICS_TRACKS[s.id];
      if (!build) throw new Error(`nessuna traccia per ${s.id} in products/topics/tracks.ts`);
      const track = build(s.durationInFrames, ratio);
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
    const { TOPICS_TRACKS } = await load("video/src/products/topics/tracks.ts");
    const slab = await load("video/src/products/topics/geometry.ts");
    const { STAGES } = await load("video/src/kit/stage.ts");
    const offset = Number(argValue("--push-offset") ?? 0);
    const ratio = ratioArg();
    const stage = STAGES[ratio];
    const out = [];
    for (const s of await catalogScenes()) {
      if (!s.fill) continue;
      const track = TOPICS_TRACKS[s.id](s.durationInFrames, ratio);
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

  // I casi su cui project-check.py confronta la proiezione con il DOM: due
  // lastre, tre stage, le sette pose della catena di Topics NEL RAPPORTO DI
  // QUELLO STAGE (poses.ts), cinque punti ciascuno messi apposta lontano dal
  // centro e fuori dagli assi.
  "project-cases": async () => {
    const { STAGES, RATIOS } = await load("video/src/kit/stage.ts");
    const { cssPerspectiveOrigin } = await load("video/src/kit/rig.ts");
    const { project } = await load("video/src/kit/project.ts");
    const slab = await load("video/src/products/topics/geometry.ts");
    const { TOPICS_POSES } = await load("video/src/products/topics/poses.ts");
    const probe = await load("video/src/products/probe/geometry.ts");
    const slabs = {
      topics: { rig: slab.TOPICS_RIG, size: slab.TOPICS_SLAB },
      probe: { rig: probe.PROBE_RIG, size: probe.PROBE_SLAB },
    };
    const poses = Object.keys(TOPICS_POSES["16x9"]);
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
          const p = TOPICS_POSES[ratio][poseName];
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

  // Cosa deve trovare un banco, per rapporto: ritagli, frame, soglie. Il
  // calcolo sta nel modulo del banco sotto il prodotto (vedi benchGeometry).
  bench: async () => {
    const name = process.argv[3];
    if (!name || name.startsWith("--")) throw new Error("uso: manifest.mjs bench NOME [--ratio R]");
    return benchGeometry(name, ratioArg());
  },

  // I controlli di un rapporto, uno per riga, nel formato di expect.sh. Ogni
  // banco li dichiara in scripts/checks/<banco>.mjs, che esporta
  // checks(ctx) e restituisce righe; qui si raccolgono in ordine di nome.
  // Il contesto da' il rapporto, i nomi delle varianti e la geometria dei
  // banchi, cosi' i moduli dei controlli non leggono mai un prodotto da se'.
  checks: async () => {
    const ratio = ratioArg();
    const { variantName, STAGES } = await load("video/src/kit/stage.ts");
    const catalog = await catalogJson();
    const scenes = catalog.scenes.map((s) => ({
      ...s,
      variant: variantName(s.id, ratio),
      file: `video/out/${variantName(s.slug, ratio)}.mp4`,
    }));
    const ctx = {
      ratio,
      stage: STAGES[ratio],
      variantName: (base) => variantName(base, ratio),
      scenes,
      scene: (id) => {
        const s = scenes.find((x) => x.id === id);
        if (!s) throw new Error(`scena sconosciuta: ${id}`);
        return s;
      },
      fixtures: catalog.tempoFixtures.map((f) => ({
        ...f,
        variant: variantName(f.id, ratio),
        file: `video/out/${variantName(f.slug, ratio)}.mp4`,
      })),
      bench: (name) => benchGeometry(name, ratio),
      tmp: (name) => `$CHECKS_TMP/${variantName(name, ratio)}`,
    };
    const dir = argValue("--moduli") ? resolve(process.cwd(), argValue("--moduli")) : join(root, "scripts/checks");
    const lines = [];
    // `--solo` e `--tranne` scelgono i moduli per nome (film-demo, seam...): il
    // film di esempio ha un job di CI suo, e i suoi controlli non devono girare
    // anche in quello delle scene. Un nome che non esiste e' un errore, non un
    // filtro vuoto: un job con zero controlli passerebbe.
    const modules = readdirSync(dir).filter((f) => f.endsWith(".mjs")).map((f) => f.slice(0, -4)).sort();
    const pick = (flag) => {
      const v = argValue(flag);
      if (v === undefined) return undefined;
      const names = v.split(",").filter(Boolean);
      for (const n of names) if (!modules.includes(n)) throw new Error(`${flag}: nessun modulo di controlli ${n}`);
      return names;
    };
    const solo = pick("--solo");
    const tranne = pick("--tranne") ?? [];
    for (const file of modules.filter((m) => (solo ? solo.includes(m) : !tranne.includes(m))).map((m) => `${m}.mjs`)) {
      const mod = await import(pathToFileURL(join(dir, file)).href);
      for (const c of await mod.checks(ctx)) {
        const fields =
          c.run !== undefined
            ? ["run", c.label, c.run]
            : ["expect", String(c.rc), c.bench, c.target, c.role, c.cmd];
        for (const f of fields) {
          if (typeof f !== "string" || f === "" || /[\t\n]/.test(f)) {
            throw new Error(`${file}: campo non valido in ${JSON.stringify(c)}`);
          }
        }
        if (c.run === undefined && !["positivo", "negativo"].includes(c.role)) {
          throw new Error(`${file}: ruolo sconosciuto ${c.role}`);
        }
        lines.push(fields.join("\t"));
      }
    }
    return lines.join("\n");
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
if (argValue("--ratio") !== undefined) {
  const { ratios } = await catalogJson();
  if (!ratios.includes(argValue("--ratio"))) {
    console.error(`catalog.json non dichiara il rapporto "${argValue("--ratio")}" (ratios: ${ratios.join(", ")})`);
    process.exit(2);
  }
}
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
