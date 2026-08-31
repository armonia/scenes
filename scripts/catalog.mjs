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
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { scenes } = JSON.parse(
  readFileSync(join(root, "video/src/scenes/catalog.json"), "utf8"),
);

const out = (s) => process.stdout.write(s + "\n");

const commands = {
  render: () =>
    scenes.forEach((s) =>
      out(`npx remotion render ${s.id} out/${s.slug}.mp4`),
    ),

  slugs: () => scenes.forEach((s) => out(s.slug)),

  ids: () => scenes.forEach((s) => out(s.id)),

  // I banchi che dipendono solo dal catalogo: il riempimento di ogni scena che
  // lo dichiara, e la giunta di ogni coppia adiacente. Quelli specifici di una
  // scena sola (focus-sharpness, handoff-travel) restano scritti nel workflow:
  // non sono derivabili da un elenco, e fingere il contrario nasconderebbe che
  // esistono.
  // Le scene che dichiarano di stare ferme sui bordi. rest-point.sh boccia solo
  // quelle: le altre le misura e basta.
  rest: () => scenes.filter((s) => s.restAtEdges).forEach((s) => out(s.slug)),

  measures: () => {
    for (const s of scenes) {
      if (s.fill) out(`./scripts/fill-measure.sh video/out/${s.slug}.mp4`);
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
    const blocks = scenes.map((s) => {
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
