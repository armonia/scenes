#!/usr/bin/env node
//
// Legge video/src/scenes/catalog.json e ne stampa la parte che serve a chi
// chiama. Esiste perche' shell e workflow non possono importare il catalogo:
// senza questo, l'elenco delle scene tornerebbe a essere copiato a mano in
// ogni file che lo usa, che e' esattamente il problema che catalog.json
// risolve.
//
// Uso:
//   node scripts/catalog.mjs render   comandi remotion render, uno per riga
//   node scripts/catalog.mjs slugs    i nomi dei file .mp4, senza estensione
//   node scripts/catalog.mjs measures i comandi dei banchi generici
//   node scripts/catalog.mjs html     la sezione <section id="scenes"> intera
//   node scripts/catalog.mjs ratios   i rapporti in cui escono le scene
//
// render, slugs, ids, rest e measures accettano `--ratio 9x16` (o 4x5): stessi
// comandi per le varianti di quel rapporto. Senza, il 16:9, con gli id e gli
// slug di sempre. La pagina resta sul 16:9.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(
  readFileSync(join(root, "video/src/scenes/catalog.json"), "utf8"),
);
const { STAGES, variantName } = await import(
  pathToFileURL(join(root, "video/src/kit/stage.ts")).href
);

const ratioArg = (() => {
  const i = process.argv.indexOf("--ratio");
  return i === -1 ? "16x9" : process.argv[i + 1];
})();
if (!catalog.ratios.includes(ratioArg)) {
  console.error(
    `catalog.json non dichiara il rapporto "${ratioArg}" (ratios: ${catalog.ratios.join(", ")})`,
  );
  process.exit(2);
}

// Le scene nel rapporto chiesto: id e slug col suffisso, dimensioni dallo stage.
const variant = (s, ratio) => ({
  ...s,
  id: variantName(s.id, ratio),
  slug: variantName(s.slug, ratio),
  seamAfter: s.seamAfter && variantName(s.seamAfter, ratio),
  width: STAGES[ratio].w,
  height: STAGES[ratio].h,
});
const scenes = catalog.scenes.map((s) => variant(s, ratioArg));
const pageScenes = catalog.scenes.map((s) => variant(s, "16x9"));

const out = (s) => process.stdout.write(s + "\n");

const commands = {
  render: () =>
    scenes.forEach((s) =>
      out(`npx remotion render ${s.id} out/${s.slug}.mp4`),
    ),

  slugs: () => scenes.forEach((s) => out(s.slug)),

  ids: () => scenes.forEach((s) => out(s.id)),

  ratios: () => catalog.ratios.forEach((r) => out(r)),

  // Le scene che dichiarano di stare ferme sui bordi. rest-point.sh boccia solo
  // quelle: le altre le misura e basta.
  rest: () => scenes.filter((s) => s.restAtEdges).forEach((s) => out(s.slug)),

  // I banchi che dipendono solo dal catalogo: la giunta di ogni coppia
  // adiacente. Quelli specifici di una scena sola (focus-sharpness,
  // handoff-travel) restano scritti nel workflow: non sono derivabili da un
  // elenco, e fingere il contrario nasconderebbe che esistono.
  //
  // `fill` NON GENERA PIU' UN COMANDO. fill-measure.sh promuove anche una lastra
  // arretrata (vedi la sua intestazione). Il campo lo legge fill-geom.py, che
  // verifica il riempimento in geometria sulle tracce della camera.
  measures: () => {
    for (const s of scenes) {
      if (s.seamAfter) {
        const prev = scenes.find((x) => x.id === s.seamAfter);
        if (!prev) {
          console.error(
            `catalog.json: ${s.id} dichiara seamAfter "${s.seamAfter}", che non e' una scena.`,
          );
          process.exit(1);
        }
        out(
          `./scripts/seam.sh video/out/${prev.slug}.mp4 video/out/${s.slug}.mp4`,
        );
      }
    }
  },

  // La pagina finita: il template con la sezione delle scene al posto del
  // segnaposto. Sta qui e non in showcase-build.sh perche' l'HTML lo genera
  // gia' questo file, e farlo passare per la shell voleva dire quotare a mano
  // un blocco di markup di venti righe.
  page: () => {
    const [tpl, dest] = process.argv.slice(3);
    if (!tpl || !dest) {
      console.error("uso: node scripts/catalog.mjs page <template> <destinazione>");
      process.exit(2);
    }
    const html = readFileSync(tpl, "utf8");
    if (!html.includes(PLACEHOLDER)) {
      console.error(`${tpl} non ha piu' il segnaposto ${PLACEHOLDER}`);
      process.exit(1);
    }
    writeFileSync(dest, html.replace(PLACEHOLDER, sceneSection()));
  },

  html: () => out(sceneSection()),
};

const PLACEHOLDER = "<!-- SCENES -->";

function sceneSection() {
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const blocks = pageScenes.map((s) => {
      // Il blurb e' HTML voluto (<em>, <code>), quindi passa intero; titolo e
      // dimensioni no, quelli si scappano.
      const meta = `${esc(s.id)} · ${s.width}×${s.height} · ${s.fps}fps`;
      return `        <div class="scene">
          <h2>${esc(s.title)} <span>${meta}</span></h2>
          <p>
            ${s.blurb}
          </p>
          <div class="frame">
            <video
              src="${s.slug}.mp4"
              autoplay
              loop
              muted
              playsinline
              preload="metadata"
            ></video>
          </div>
        </div>`;
    });
  return `      <section id="scenes">
        <p class="section-title">The scenes</p>

${blocks.join("\n\n")}
      </section>`;
}

const cmd = process.argv[2];
if (!commands[cmd]) {
  console.error(
    `uso: node scripts/catalog.mjs <${Object.keys(commands).join("|")}>`,
  );
  process.exit(2);
}
commands[cmd]();
