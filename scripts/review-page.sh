#!/usr/bin/env bash
#
# La pagina del verdetto: la nostra scena e il riferimento, affiancati e in
# movimento.
#
# Il provino a contatto (`contact-sheet.sh`) confronta la COMPOSIZIONE, che e'
# una proprieta' del fotogramma fermo. Ma meta' di quello che si giudica qui e'
# il RITMO: la pausa prima dell'invio, l'irregolarita' della battitura, il
# passo con cui la risposta arriva. Su una striscia di fotogrammi il ritmo non
# c'e', quindi il provino da solo non basta a dare il verdetto.
#
# Il riferimento parte da REF_START e non da zero: i primi secondi dello spot
# Linear sono il logo, e affiancare il nostro secondo 1 al loro logo non
# confronta niente.
#
# Uso:  ./scripts/review-page.sh [destinazione.html]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/out/review.html}"

MINE="$ROOT/video/out/prompt-input.mp4"
REF="$ROOT/ref/7gZBxBTapDQ.mp4"
SHEET="$ROOT/out/prompt-input-vs-ref.png"

# I sorgenti nella pagina vanno RELATIVI alla pagina, non assoluti: il visore
# della app rifiuta lo schema file://, quindi la stessa pagina deve funzionare
# sia aperta a mano sia servita da un http.server. Un path relativo fa tutti e
# due, un file:// nessuno dei due.
REL_MINE="../video/out/prompt-input.mp4"
REL_REF="../ref/7gZBxBTapDQ.mp4"
REL_SHEET="prompt-input-vs-ref.png"

# Il punto dello spot Linear in cui la lastra di UI e' in quadro e la camera
# sta scivolando: e' la grammatica A, cioe' quello che stiamo replicando.
REF_START=21

for f in "$MINE" "$REF"; do
  [ -f "$f" ] || { echo "manca: $f" >&2; exit 1; }
done

mkdir -p "$(dirname "$OUT")"

DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$MINE")

cat > "$OUT" <<HTML
<!doctype html>
<meta charset="utf-8">
<title>prompt-input contro il riferimento</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0; padding: 32px 28px 64px;
    background: #0a0a0b; color: #e8e8ea;
    font: 15px/1.6 ui-sans-serif, -apple-system, system-ui, sans-serif;
  }
  h1 { font-size: 21px; font-weight: 600; margin: 0 0 4px; letter-spacing: -.01em; }
  .sub { color: #8b8b93; margin: 0 0 28px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  figure { margin: 0; }
  video { width: 100%; border-radius: 10px; display: block; background: #000; }
  figcaption {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-top: 10px; font-size: 13px; color: #8b8b93;
  }
  figcaption b { color: #e8e8ea; font-weight: 600; font-size: 14px; }
  button {
    margin: 24px 0 40px; padding: 9px 18px; border-radius: 8px;
    border: 1px solid #2e2e33; background: #17171a; color: #e8e8ea;
    font: inherit; font-size: 14px; cursor: pointer;
  }
  button:hover { background: #202024; }
  h2 { font-size: 16px; font-weight: 600; margin: 40px 0 10px; }
  p { max-width: 68ch; }
  .muted { color: #8b8b93; }
  img { width: 100%; border-radius: 10px; display: block; }
  table { border-collapse: collapse; font-size: 14px; margin-top: 6px; }
  td, th { text-align: left; padding: 5px 22px 5px 0; }
  th { color: #8b8b93; font-weight: 500; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
</style>

<h1>prompt-input contro il riferimento</h1>
<p class="sub">A sinistra la scena costruita. A destra <i>Introducing Linear Diffs</i>, la grammatica che sta replicando.</p>

<div class="grid">
  <figure>
    <video id="mine" src="$REL_MINE" muted loop playsinline controls></video>
    <figcaption><b>prompt-input</b><span>${DUR}s, 30fps, tutto frame-locked</span></figcaption>
  </figure>
  <figure>
    <video id="ref" src="$REL_REF#t=$REF_START" muted loop playsinline controls></video>
    <figcaption><b>Linear, Diffs</b><span>il riferimento, da ${REF_START}s</span></figcaption>
  </figure>
</div>

<button id="both">Fai partire tutti e due</button>

<h2>Cosa guardare</h2>
<p>Tre cose, che sono le tre per cui <code>OrbitLoop</code> non reggeva.</p>
<p><b>Il quadro e' pieno?</b> La lastra borda fuori dall'inquadratura da entrambi i lati, come una finestra che continua oltre lo schermo. <code>OrbitLoop</code> stava nel terzo centrale e leggeva come un rettangolo appoggiato al centro.</p>
<p><b>Si legge?</b> A questa scala il testo del prompt e della risposta deve stare leggibile, altrimenti la scena non racconta niente.</p>
<p><b>Il ritmo e' una mano o uno script?</b> La battitura e' irregolare e c'e' una pausa prima dell'invio. Senza quella pausa l'invio parte insieme all'ultimo tasto e si vede che e' una macchina.</p>

<h2>La differenza onesta</h2>
<p>Il riferimento lascia respirare il nero: tiene vivi due bordi su quattro. Questa scena li tiene vivi tutti e quattro, sempre. Piu' piena del riferimento non e' automaticamente meglio, ed e' la prima cosa da sistemare se il giudizio e' che soffochi.</p>

<h2>Il provino a contatto</h2>
<p class="sub">Otto fotogrammi per video, stesso identico trattamento. Sopra la scena, sotto il riferimento.</p>
<img src="$REL_SHEET" alt="provino a contatto">

<script>
  // Frame-locked vale per le scene, non per questa pagina: qui si guarda, non
  // si renderizza. Il riferimento riparte da REF_START e non da zero.
  const mine = document.getElementById('mine');
  const ref = document.getElementById('ref');
  const REF_START = $REF_START;

  ref.addEventListener('loadedmetadata', () => { ref.currentTime = REF_START; });
  ref.addEventListener('timeupdate', () => {
    if (ref.currentTime < REF_START - 0.5) ref.currentTime = REF_START;
  });

  document.getElementById('both').addEventListener('click', () => {
    mine.currentTime = 0;
    ref.currentTime = REF_START;
    mine.play();
    ref.play();
  });
</script>
HTML

echo "$OUT"
