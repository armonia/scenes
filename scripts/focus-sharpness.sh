#!/usr/bin/env bash
#
# Il testo regge l'ingrandimento, o si sfalda?
#
# E' la promessa di CardFocus, ed e' anche l'unica ragione tecnica per cui la
# lastra deve essere DOM invece di uno screenshot. La camera arriva addosso alla
# card ingrandendola 2,35 volte: se i pixel fossero stati rasterizzati alla
# larghezza della composizione e poi scalati, a quel punto sarebbero poltiglia.
# Rasterizzati alla dimensione finale, come fa il browser, restano nitidi.
#
# PRIMA MISURA, SCARTATA, e scartata dopo averla vista promuovere il difetto.
# Prendeva il ritaglio della card dall'ultimo fotogramma, lo rimpiccioliva del
# fattore di ingrandimento, lo riportava su, e chiedeva che l'originale fosse
# piu' nitido del giro. Sembra sensato e non misura niente: il rapporto fra
# un'immagine e la stessa immagine sfocata resta alto anche quando l'immagine di
# partenza e' gia' poltiglia, perche' e' una grandezza relativa a se stessa.
# Messa alla prova su una finta scena costruita ingrandendo un fermo immagine,
# cioe' esattamente il difetto da intercettare, dava 4,14x e la promuoveva. Un
# banco che promuove il proprio caso peggiore e' un ornamento.
#
# QUESTA. Il controinfattuale non si ricava dal fotogramma finale, si COSTRUISCE
# dal primo: si prende il campo largo, dove la card e' piccola, e lo si ingrandisce
# fino alla scala finale. E' letteralmente quello che sarebbe uscito se la lastra
# fosse stata uno screenshot. Poi si confronta l'energia alle alte frequenze dei
# due ritagli, che hanno lo stesso contenuto e la stessa dimensione in pixel: a
# quel punto l'unica differenza rimasta e' dove sono stati rasterizzati.
#
# COME SI MISURA LA NITIDEZZA. Media della differenza fra l'immagine e la stessa
# immagine sfocata di un pixel, cioe' quanta energia sta nelle alte frequenze.
# Non e' una grandezza percettiva ed e' inutile in assoluto: conta solo il
# rapporto fra le righe della tabella, che passano tutte per lo stesso
# trattamento.
#
# IL CONTROLLO NEGATIVO E' VERIFICATO, e sta in un file accanto.
# `fixture-screenshot.sh` costruisce la stessa discesa fatta di pixel che
# esistono solo alla scala del campo largo, cioe' il difetto da intercettare.
# Misurato: il render vero da' 2,09x, la fixture 1,03x. Su quella lo script esce
# 1. E' la condizione che il README chiede prima di fidarsi del verde, e la
# prima versione di questo banco non la superava: promuoveva la fixture.
#
# La geometria del ritaglio non e' scritta qui. Viene da primitives/slab.ts,
# perche' e' la stessa sorgente da cui la scena calcola la sua posa finale: una
# costante ricopiata a mano in bash resta giusta solo fino alla prima modifica
# della lastra.
#
# Uso:  ./scripts/focus-sharpness.sh [card-focus.mp4]
set -uo pipefail

. "$(dirname "${BASH_SOURCE[0]}")/_magick.sh"
export LC_NUMERIC=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-$ROOT/video/out/card-focus.mp4}"

# Quante volte il nostro ritaglio deve essere piu' nitido del controinfattuale.
# Non e' un numero scelto: e' la media geometrica fra le due letture misurate,
# 2,09 sul render vero e 1,03 sulla fixture costruita da fixture-screenshot.sh.
# Sta in mezzo perche' e' li' che separa, e se un giorno il render scendesse
# sotto vorrebbe dire che si sta avvicinando al caso che deve bocciare.
SOGLIA=1.50

[ -f "$SRC" ] || {
  echo "manca il render: ${SRC#"$ROOT"/}" >&2
  echo "  cd video && npx remotion render CardFocus out/card-focus.mp4" >&2
  exit 1
}

# La card, in pixel di composizione, all'ultimo fotogramma. Node legge il modulo
# della lastra direttamente: gli stessi numeri che usa la scena.
read -r CW CH CX CY ZOOM WX WY K < <(node --input-type=module -e '
const m = await import("'"$ROOT"'/video/src/primitives/slab.ts");
const r = m.handoffLandedRect();
const p = m.slabPointOnScreen(r.x + r.w / 2, r.y + r.h / 2);
const ox = m.COMP_W / 2, oy = m.COMP_H * m.PERSPECTIVE_ORIGIN_Y;
const k1 = m.zoomForPush(m.CARD_FOCUS_END_POSE.pushZ);   // ingrandimento finale
const k0 = m.zoomForPush(m.CARD_HANDOFF_END_POSE.pushZ); // ingrandimento al primo fotogramma
// Dove sta la card nel campo largo, e quanto manca da li alla scala finale.
const wx = ox + (p.x - ox) * k0;
const wy = oy + (p.y - oy) * k0;
console.log(
  Math.round(r.w * m.SLAB_SCALE * k1), Math.round(r.h * m.SLAB_SCALE * k1),
  Math.round(ox), Math.round(oy), k1.toFixed(4),
  Math.round(wx), Math.round(wy), (k1 / k0).toFixed(4));
' 2>/dev/null)

case "${CW:-}|${CH:-}|${ZOOM:-}|${K:-}" in
  *'|'|'|'*|'') echo "la geometria non e' arrivata da slab.ts: '$CW' '$CH' '$ZOOM'" >&2; exit 3 ;;
esac
case "$CW$CH" in ''|*[!0-9]*) echo "geometria non numerica: '$CW' '$CH'" >&2; exit 3 ;; esac

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# L'ultimo fotogramma. `-update 1` riscrive lo stesso file a ogni frame, quindi
# alla fine resta l'ultimo senza dover sapere quanti sono.
ffmpeg -nostdin -v error -i "$SRC" -fps_mode passthrough -update 1 -y "$TMP/last.png"
[ -s "$TMP/last.png" ] || { echo "estrazione dell'ultimo fotogramma fallita" >&2; exit 3; }

# Il ritaglio: la card meno un margine dell'8%, per restare dentro il bordo e
# non misurare la nitidezza del bordo stesso, che e' un filo da un pixel e
# sopravvive a qualsiasi trattamento.
iw=$(python3 -c "print(int($CW * 0.84))")
ih=$(python3 -c "print(int($CH * 0.84))")
ix=$(python3 -c "print(int($CX - $iw / 2))")
iy=$(python3 -c "print(int($CY - $ih / 2))")
"${IM_CONVERT[@]}" "$TMP/last.png" -crop "${iw}x${ih}+${ix}+${iy}" +repage -colorspace Gray "$TMP/ours.png"
[ -s "$TMP/ours.png" ] || { echo "ritaglio fallito: ${iw}x${ih}+${ix}+${iy}" >&2; exit 3; }

# Il controinfattuale: il campo largo portato alla scala finale. Se la lastra
# fosse stata uno screenshot, l'ultimo fotogramma sarebbe stato questo.
ffmpeg -nostdin -v error -i "$SRC" -frames:v 1 -y "$TMP/wide.png"
[ -s "$TMP/wide.png" ] || { echo "estrazione del primo fotogramma fallita" >&2; exit 3; }
pc=$(python3 -c "print(f'{$K * 100:.4f}%')")
sx=$(python3 -c "print(int($WX * $K - $iw / 2))")
sy=$(python3 -c "print(int($WY * $K - $ih / 2))")
"${IM_CONVERT[@]}" "$TMP/wide.png" -resize "$pc" -crop "${iw}x${ih}+${sx}+${sy}" +repage \
  -colorspace Gray "$TMP/mockup.png"
[ -s "$TMP/mockup.png" ] || { echo "costruzione del controinfattuale fallita" >&2; exit 3; }

# Nitidezza: quanto si perde sfocando di un pixel.
nitidezza() {
  local img="$1"
  "${IM_CONVERT[@]}" "$img" -blur 0x1 "$TMP/b.png"
  local v
  v=$("${IM_CONVERT[@]}" "$img" "$TMP/b.png" -compose difference -composite \
    -colorspace Gray -format '%[fx:mean*255]' info:)
  case "$v" in
    ''|*[!0-9.eE+-]*) echo "lettura non numerica su $(basename "$img"): '$v'" >&2; exit 3 ;;
  esac
  printf '%s' "$v"
}

# Il giro di rimpicciolimento e ritorno, al fattore dato.
giro() {
  local k="$1" out="$2"
  local sw sh
  sw=$(python3 -c "print(max(2, int($iw / $k)))")
  sh=$(python3 -c "print(max(2, int($ih / $k)))")
  "${IM_CONVERT[@]}" "$TMP/ours.png" -resize "${sw}x${sh}!" -resize "${iw}x${ih}!" "$out"
  [ -s "$out" ] || { echo "giro a ${k}x fallito" >&2; exit 3; }
}

# Una sfocatura sul nostro ritaglio: serve solo a verificare che lo strumento
# risponda alla nitidezza. Se non cala, non sta misurando quello che dice.
giro 2 "$TMP/prova.png"

n_ours=$(nitidezza "$TMP/ours.png")
n_mock=$(nitidezza "$TMP/mockup.png")
n_prova=$(nitidezza "$TMP/prova.png")

echo "Energia alle alte frequenze del ritaglio della card, ${iw}x${ih} px."
echo "Le due righe hanno lo stesso contenuto e la stessa dimensione: cambia solo"
echo "a che scala i pixel sono stati rasterizzati."
echo
printf '  %-46s %9s\n' "riga" "energia"
printf '  %-46s %9.3f\n' "ultimo fotogramma (DOM, alla scala finale)" "$n_ours"
printf '  %-46s %9.3f\n' "primo fotogramma portato a ${ZOOM}x (screenshot)" "$n_mock"
printf '  %-46s %9.3f\n' "  (controllo strumento: il nostro, sfocato)" "$n_prova"
echo

# Le tre letture devono essere ordinate, altrimenti lo strumento non risponde a
# quello che dovrebbe misurare e qualunque verdetto sarebbe un caso fortunato.
# Lo strumento risponde alla nitidezza?
if ! python3 -c "exit(0 if $n_prova < $n_ours * 0.9 else 1)"; then
  echo "MISURA INUTILE: sfocando il nostro stesso ritaglio l'energia non cala," >&2
  echo "quindi questo indice non sta misurando la nitidezza. Nessun verdetto." >&2
  exit 2
fi

rapporto=$(python3 -c "print(f'{$n_ours / max($n_mock, 1e-9):.2f}')")
if python3 -c "exit(0 if $rapporto >= $SOGLIA else 1)"; then
  echo "VERDETTO: il testo regge l'ingrandimento. ${rapporto}x piu' nitido dello"
  echo "stesso contenuto ingrandito dal campo largo (soglia ${SOGLIA}x)."
  exit 0
fi

echo "FALLITO: solo ${rapporto}x contro lo screenshot, sotto la soglia di ${SOGLIA}x." >&2
echo "O la lastra ha smesso di essere DOM da qualche parte lungo la catena," >&2
echo "oppure CARD_FOCUS_ZOOM in primitives/slab.ts e' salito oltre quello che" >&2
echo "la rasterizzazione regge." >&2
exit 1
