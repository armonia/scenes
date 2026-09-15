#!/usr/bin/env bash
#
# Quanti pixel differiscono fra due immagini, in frazione e in numero.
#
# PERCHE' NON IMAGEMAGICK. seam.sh e rest-point.sh contavano con `compare
# -metric AE -fuzz 4%`, e la stessa coppia di immagini dava numeri diversi su
# ImageMagick 7 (macOS) e 6 (Linux della CI): fino a sei volte di piu' su una
# giunta, e su un cambiamento a bassa ampiezza (l'opacita' che risale all'inizio
# di BoardOrbit) abbastanza da far bocciare in CI una scena che sul Mac passava.
# Le soglie dei banchi erano tarate su una piattaforma e decidevano sull'altra.
# ffmpeg invece fa lo stesso conto nei due posti: grigio, differenza assoluta,
# soglia per pixel, media.
#
# Uso:  _pixeldiff.sh a.png b.png [soglia 0-255]   ->  "<frazione> <pixel>"
#
# Esce 3 se ffmpeg non legge le immagini o se hanno dimensioni diverse.
set -uo pipefail

A="${1:?serve la prima immagine}"
B="${2:?serve la seconda immagine}"
SOGLIA="${3:-20}"

dims() { ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$1" | cut -d, -f1,2; }
da=$(dims "$A"); db=$(dims "$B")
if [ -z "$da" ] || [ "$da" != "$db" ]; then
  echo "immagini non confrontabili: '$da' contro '$db'" >&2
  exit 3
fi

yavg=$(ffmpeg -nostdin -v error -i "$A" -i "$B" -filter_complex \
  "[0:v]format=gray[a];[1:v]format=gray[b];[a][b]blend=all_mode=difference,lut=c0='if(gt(val\,$SOGLIA)\,255\,0)',signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" \
  -f null - 2>/dev/null | sed -n 's/.*YAVG=\([0-9.]*\).*/\1/p' | head -n 1)
case "${yavg:-}" in
  ''|*[!0-9.]*) echo "confronto fallito su $(basename "$A") e $(basename "$B")" >&2; exit 3 ;;
esac

w=${da%,*}; h=${da#*,}
python3 -c "f = $yavg / 255; print(f'{f:.6f} {round(f * $w * $h)}')"
