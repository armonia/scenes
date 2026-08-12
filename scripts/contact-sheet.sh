#!/usr/bin/env bash
#
# Il provino a contatto, che e' il modo in cui si verifica una scena.
#
# La regola di metodo, e vale piu' della scena stessa: il giudizio si da' sul
# RENDER, con il nostro provino messo accanto a quello del riferimento. Non a
# parole, e non guardando la scena da sola. Una scena guardata da sola sembra
# sempre a posto: e' l'accostamento che mostra che il riferimento riempie il
# quadro e noi no.
#
# I due video passano per lo stesso identico trattamento, stesso numero di
# fotogrammi e stessa griglia. Riusare il vecchio sheet del riferimento sarebbe
# stato piu' rapido e avrebbe confrontato due trattamenti diversi.
#
# Uso:  ./scripts/contact-sheet.sh <destinazione.png>
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/out/prompt-input-vs-ref.png}"

MINE="$ROOT/video/out/prompt-input.mp4"
# 7gZBxBTapDQ dura 52 secondi: e' Linear "Introducing Linear Diffs", cioe' la
# grammatica A. L'altro Linear (Loops, 41s) e' la B, che non e' quella che
# stiamo replicando qui.
REF="$ROOT/ref/7gZBxBTapDQ.mp4"

TILES=8
TILE_W=600
FONT="/System/Library/Fonts/Supplemental/Arial.ttf"

for f in "$MINE" "$REF"; do
  [ -f "$f" ] || { echo "manca: $f" >&2; exit 1; }
done

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

strip() {
  local src="$1" tag="$2" label="$3"
  local dur
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$src")

  for i in $(seq 0 $((TILES - 1))); do
    local t
    t=$(python3 -c "print($dur * ($i + 0.5) / $TILES)")
    ffmpeg -v error -ss "$t" -i "$src" -frames:v 1 \
      -vf "scale=${TILE_W}:-2" -y "$TMP/$tag-$(printf '%02d' "$i").png"
  done

  montage "$TMP/$tag-"*.png -tile 4x2 -geometry +3+3 -background "#15171c" \
    "$TMP/$tag-grid.png"

  convert "$TMP/$tag-grid.png" \
    -background "#15171c" -fill "#e6e8ec" -font "$FONT" -pointsize 30 \
    label:"  $label" +swap -gravity west -append "$TMP/$tag-strip.png"
}

strip "$MINE" mine "NOSTRO   prompt-input   1920x1080   30fps   13s"
strip "$REF" ref "RIFERIMENTO   Linear, Introducing Linear Diffs   52s"

convert "$TMP/mine-strip.png" "$TMP/ref-strip.png" \
  -background "#0b0d11" -gravity west -append \
  -bordercolor "#0b0d11" -border 16 "$OUT"

echo "$OUT"
identify -format '%wx%h\n' "$OUT"
