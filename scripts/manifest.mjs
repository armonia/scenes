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
process.stdout.write(JSON.stringify(await commands[cmd](), null, 1) + "\n");
