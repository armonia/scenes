#!/usr/bin/env bash
#
# Costruisce la fixture di CardFocus: la stessa discesa, ma fatta di pixel che
# esistono solo alla scala del campo largo. E' la scena che `focus-sharpness.sh`
# DEVE bocciare, e senza di essa quel banco e' una promessa.
#
# Non serve una composizione rotta. Basta prendere il primo fotogramma del
# render vero e ingrandirlo fino alla posa finale: e' esattamente quello che
# avrebbe prodotto una lastra fatta di screenshot invece che di DOM.
#
# IN OGNI RAPPORTO. La geometria viene dal manifest (`bench focus-sharpness`): la
# zona della card al primo fotogramma, dove finisce all'ultimo, e l'ingrandimento
# K. Il quadro dell'ultimo fotogramma e' lo stage del rapporto; la prima versione
# ritagliava 1920x1080 anche da un 9:16, e ffmpeg poi schiacciava quel
# fotogramma nel quadro verticale.
#
# Uso:  ./scripts/fixture-screenshot.sh <sorgente.mp4> <destinazione.mp4> --ratio R
set -uo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/_magick.sh"
export LC_NUMERIC=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:?serve il render di CardFocus}"
OUT="${2:?serve il file di uscita}"
RATIO=16x9
[ "${3:-}" = "--ratio" ] && RATIO="${4:?serve il rapporto}"
[ -f "$SRC" ] || { echo "manca il render: $SRC" >&2; exit 3; }

T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
if ! node "$ROOT/scripts/manifest.mjs" bench focus-sharpness --ratio "$RATIO" > "$T/g.json" 2> "$T/g.err"; then
  echo "la geometria non e' arrivata dal manifest:" >&2; cat "$T/g.err" >&2; exit 3
fi
read -r SW SH OX OY K < <(python3 -c "
import json; g = json.load(open('$T/g.json')); k = g['k']
print(g['stage']['w'], g['stage']['h'],
      round(g['wide']['x'] * k - g['ours']['x']), round(g['wide']['y'] * k - g['ours']['y']), k)")
case "${K:-}" in ''|*[!0-9.]*) echo "geometria non numerica dal manifest" >&2; exit 3 ;; esac

mkdir -p "$T/f"
ffmpeg -nostdin -v error -i "$SRC" -frames:v 1 -y "$T/wide.png"
[ -s "$T/wide.png" ] || { echo "estrazione del primo fotogramma fallita" >&2; exit 3; }

# Il campo largo portato alla scala finale e spostato perche' la card cada dove
# cade nell'ultimo fotogramma vero. Dove l'ingrandimento non copre il quadro, nero.
"${IM_CONVERT[@]}" "$T/wide.png" -resize "$(python3 -c "print(f'{$K*100:.4f}%')")" \
  -crop "${SW}x${SH}+${OX}+${OY}" +repage -background black -gravity NorthWest \
  -extent "${SW}x${SH}" "$T/last.png"
[ -s "$T/last.png" ] || { echo "costruzione dell'ultimo fotogramma fallita" >&2; exit 3; }

cp "$T/wide.png" "$T/f/0001.png"
for i in $(seq 2 12); do cp "$T/last.png" "$T/f/$(printf '%04d' "$i").png"; done
mkdir -p "$(dirname "$OUT")"
ffmpeg -nostdin -v error -framerate 30 -i "$T/f/%04d.png" -pix_fmt yuv420p -y "$OUT"
[ -s "$OUT" ] || { echo "codifica della fixture fallita" >&2; exit 3; }
echo "fixture: $OUT  (primo fotogramma reale, ultimo ingrandito ${K}x, ${SW}x${SH})"
