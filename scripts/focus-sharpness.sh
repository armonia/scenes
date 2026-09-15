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
# immagine sfocata di mezzo pixel, cioe' quanta energia sta nelle frequenze piu'
# alte. Era un pixel intero; mezzo pixel guarda proprio la banda che un
# ingrandimento di K butta via, e a K basso e' quasi l'unica differenza che
# resta: in 9:16 (K 1,31) il render vero passa da 1,57x a 1,79x mentre lo
# screenshot resta a 1,14x.
# Non e' una grandezza percettiva ed e' inutile in assoluto: conta solo il
# rapporto fra le righe della tabella, che passano tutte per lo stesso
# trattamento.
#
# IL CONTROLLO NEGATIVO E' VERIFICATO, e sta in un file accanto.
# `fixture-screenshot.sh` costruisce la stessa discesa fatta di pixel che
# esistono solo alla scala del campo largo, cioe' il difetto da intercettare.
# Misurato su macOS, render vero contro fixture: 2,81x e 1,09x nel 16:9 (K 2,21),
# 1,79x e 1,14x in 9:16 (K 1,31), 2,02x e 1,06x in 4:5 (K 1,90). Sulla fixture lo
# script esce 1. E' la condizione che il README chiede prima di fidarsi del
# verde, e la prima versione di questo banco non la superava: promuoveva la
# fixture.
#
# La geometria del ritaglio non e' scritta qui. La calcola il manifest
# (`bench focus-sharpness --ratio R`) dalle tracce della camera del rapporto,
# con la proiezione esatta: la card all'ultimo fotogramma, tagliata sul bordo del
# quadro dove deborda (in 9:16 e 4:5 esce a destra), la stessa zona della lastra
# al primo fotogramma, e K, quanto la camera l'ha ingrandita.
#
# UNA SOGLIA SOLA, VICINA ALLO SCREENSHOT. Il render vero si allontana da 1 tanto
# piu' quanto piu' la camera ingrandisce, lo screenshot no: resta fra 1,06x e
# 1,14x in tutti e tre i rapporti. La soglia di prima, 1,50 a meta' strada nel
# 16:9, sarebbe caduta troppo vicino al 9:16. Si e' provato anche a ricavarla da
# K col giro di rimpicciolimento e ritorno del ritaglio stesso, ed era di nuovo
# una grandezza relativa a se stessa: sulla fixture, gia' sfocata, la soglia
# calava con lei e il banco usciva 2 invece di 1. 1,35 sta 1,18 volte sopra lo
# screenshot peggiore e 1,33 volte sotto il render vero piu' debole. Sotto K_MIN
# i due casi sono troppo vicini per una soglia sola, e il banco esce 2.
#
# NIENTE VERDETTO SU UN RITAGLIO SBAGLIATO. Con i numeri del 16:9 su un render
# verticale il ritaglio cadeva fuori dall'immagine, ImageMagick restituiva un
# PNG di un pixel e il banco usciva 0 con "449159000x". Adesso il quadro del file
# deve essere lo stage del rapporto, e ogni ritaglio deve uscire della
# dimensione chiesta: altrimenti 3.
#
# Uso:  ./scripts/focus-sharpness.sh <card-focus.mp4> --ratio R
#
# Esce 0 se il testo regge, 1 se sta sotto la soglia, 2 se lo strumento non
# risponde o l'ingrandimento e' troppo basso per decidere, 3 se il file, il
# quadro o un ritaglio non tornano.
set -uo pipefail

. "$(dirname "${BASH_SOURCE[0]}")/_magick.sh"
export LC_NUMERIC=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-$ROOT/video/out/card-focus.mp4}"
RATIO=16x9
[ "${2:-}" = "--ratio" ] && RATIO="${3:?serve il rapporto}"

SOGLIA=1.35
K_MIN=1.2

[ -f "$SRC" ] || {
  echo "manca il render: ${SRC#"$ROOT"/}" >&2
  exit 3
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if ! node "$ROOT/scripts/manifest.mjs" bench focus-sharpness --ratio "$RATIO" > "$TMP/g.json" 2> "$TMP/g.err"; then
  echo "la geometria non e' arrivata dal manifest:" >&2; cat "$TMP/g.err" >&2; exit 3
fi
read -r SW SH iw ih ix iy K sx sy < <(python3 -c "
import json; g = json.load(open('$TMP/g.json')); o = g['ours']; w = g['wide']; k = g['k']
print(g['stage']['w'], g['stage']['h'], o['w'], o['h'], o['x'], o['y'], k,
      round(w['x'] * k), round(w['y'] * k))")
case "$SW$SH$iw$ih$ix$iy$sx$sy" in ''|*[!0-9-]*) echo "geometria non numerica dal manifest" >&2; exit 3 ;; esac

dims=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$SRC" | cut -d, -f1,2)
if [ "$dims" != "$SW,$SH" ]; then
  echo "il quadro di $(basename "$SRC") e' ${dims/,/x}, lo stage di $RATIO e' ${SW}x${SH}: geometria di un altro rapporto" >&2
  exit 3
fi

# Un ritaglio deve uscire della dimensione chiesta. ImageMagick tronca in
# silenzio un ritaglio che esce dall'immagine, e se ne esce del tutto restituisce
# un pixel: in entrambi i casi la misura sarebbe su un'altra cosa.
dimensione() {
  local got
  got=$("${IM_IDENTIFY[@]}" -format '%wx%h' "$1" 2>/dev/null)
  [ "$got" = "${iw}x${ih}" ] || { echo "ritaglio $(basename "$1") di $got invece di ${iw}x${ih}" >&2; exit 3; }
}

# L'ultimo fotogramma. `-update 1` riscrive lo stesso file a ogni frame, quindi
# alla fine resta l'ultimo senza dover sapere quanti sono.
ffmpeg -nostdin -v error -i "$SRC" -fps_mode passthrough -update 1 -y "$TMP/last.png"
[ -s "$TMP/last.png" ] || { echo "estrazione dell'ultimo fotogramma fallita" >&2; exit 3; }
"${IM_CONVERT[@]}" "$TMP/last.png" -crop "${iw}x${ih}+${ix}+${iy}" +repage -colorspace Gray "$TMP/ours.png"
dimensione "$TMP/ours.png"

# Il controinfattuale: il campo largo portato alla scala finale. Se la lastra
# fosse stata uno screenshot, l'ultimo fotogramma sarebbe stato questo.
ffmpeg -nostdin -v error -i "$SRC" -frames:v 1 -y "$TMP/wide.png"
[ -s "$TMP/wide.png" ] || { echo "estrazione del primo fotogramma fallita" >&2; exit 3; }
pc=$(python3 -c "print(f'{$K * 100:.4f}%')")
"${IM_CONVERT[@]}" "$TMP/wide.png" -resize "$pc" -crop "${iw}x${ih}+${sx}+${sy}" +repage \
  -colorspace Gray "$TMP/mockup.png"
dimensione "$TMP/mockup.png"

# Nitidezza: quanto si perde sfocando di mezzo pixel.
nitidezza() {
  local img="$1"
  "${IM_CONVERT[@]}" "$img" -blur 0x0.5 "$TMP/b.png"
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
printf '  %-46s %9.3f\n' "primo fotogramma portato a ${K}x (screenshot)" "$n_mock"
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

case "$n_mock" in 0|0.0|0.00|0.000) echo "il controinfattuale e' vuoto: nessuna energia da confrontare" >&2; exit 3 ;; esac
if ! python3 -c "exit(0 if $K >= $K_MIN else 1)"; then
  echo "MISURA INUTILE: in $RATIO la camera ingrandisce la card di ${K}x, sotto ${K_MIN}x:" >&2
  echo "DOM e screenshot sono troppo vicini per decidere con una soglia sola." >&2
  exit 2
fi

rapporto=$(python3 -c "print(f'{$n_ours / $n_mock:.2f}')")
if python3 -c "exit(0 if $rapporto >= $SOGLIA else 1)"; then
  echo "VERDETTO: il testo regge l'ingrandimento. ${rapporto}x piu' nitido dello"
  echo "stesso contenuto ingrandito dal campo largo (soglia ${SOGLIA}x)."
  exit 0
fi

echo "FALLITO: solo ${rapporto}x contro lo screenshot, sotto la soglia di ${SOGLIA}x." >&2
echo "O la lastra ha smesso di essere DOM da qualche parte lungo la catena," >&2
echo "oppure l'ingrandimento di CardFocus in questo rapporto e' salito oltre quello" >&2
echo "che la rasterizzazione regge." >&2
exit 1
