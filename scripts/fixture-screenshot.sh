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
# Uso:  ./scripts/fixture-screenshot.sh [sorgente.mp4] [destinazione.mp4]
set -uo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/_magick.sh"
export LC_NUMERIC=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-$ROOT/video/out/card-focus.mp4}"
OUT="${2:-$ROOT/video/out/.fixture-card-focus-screenshot.mp4}"
[ -f "$SRC" ] || { echo "manca il render: $SRC" >&2; exit 1; }

read -r CX CY WX WY K < <(node --input-type=module -e '
const m = await import("'"$ROOT"'/video/src/primitives/slab.ts");
const r = m.handoffLandedRect();
const p = m.slabPointOnScreen(r.x + r.w / 2, r.y + r.h / 2);
const ox = m.COMP_W / 2, oy = m.COMP_H * m.PERSPECTIVE_ORIGIN_Y;
const k1 = m.zoomForPush(m.CARD_FOCUS_END_POSE.pushZ);
const k0 = m.zoomForPush(m.CARD_HANDOFF_END_POSE.pushZ);
console.log(Math.round(ox), Math.round(oy),
            Math.round(ox + (p.x - ox) * k0), Math.round(oy + (p.y - oy) * k0),
            (k1 / k0).toFixed(4));
' 2>/dev/null)
case "${K:-}" in ''|*[!0-9.]*) echo "geometria non arrivata da slab.ts" >&2; exit 3 ;; esac

T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
mkdir -p "$T/f"
ffmpeg -nostdin -v error -i "$SRC" -frames:v 1 -y "$T/wide.png"
[ -s "$T/wide.png" ] || { echo "estrazione del primo fotogramma fallita" >&2; exit 3; }

# Il campo largo portato alla scala finale, ricentrato sulla card.
ox=$(python3 -c "print(int($WX * $K - $CX))")
oy=$(python3 -c "print(int($WY * $K - $CY))")
"${IM_CONVERT[@]}" "$T/wide.png" -resize "$(python3 -c "print(f'{$K*100:.4f}%')")" \
  -crop "1920x1080+${ox}+${oy}" +repage -background black -flatten "$T/last.png"
[ -s "$T/last.png" ] || { echo "costruzione dell'ultimo fotogramma fallita" >&2; exit 3; }

cp "$T/wide.png" "$T/f/0001.png"
for i in $(seq 2 12); do cp "$T/last.png" "$T/f/$(printf '%04d' "$i").png"; done
ffmpeg -nostdin -v error -framerate 30 -i "$T/f/%04d.png" -pix_fmt yuv420p -y "$OUT"
[ -s "$OUT" ] || { echo "codifica della fixture fallita" >&2; exit 3; }
echo "fixture: ${OUT#"$ROOT"/}  (primo fotogramma reale, ultimo ingrandito ${K}x)"
