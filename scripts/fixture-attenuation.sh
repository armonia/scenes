#!/usr/bin/env bash
#
# Costruisce la scena che contrast-floor.py deve bocciare.
#
# NON MISURA NIENTE. Renderizza PromptInput con il pavimento dell'attenuazione a
# 0,25 invece che a 0,62, cioe' la stessa identica scena attenuata troppo. E' il
# motivo per cui `attnFloor` esiste come prop: senza un render sbagliato da dare
# in pasto al banco, il verde del banco vorrebbe dire soltanto che lo script e'
# arrivato in fondo.
#
# Uso:  ./scripts/fixture-attenuation.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/video/out/.fixture-attn-025.mp4"

cd "$ROOT/video"
npx remotion render PromptInput "$OUT" --props='{"attnFloor":0.25}' >/dev/null

[ -s "$OUT" ] || { echo "il render della fixture non ha prodotto niente" >&2; exit 3; }
echo "fixture: video/out/.fixture-attn-025.mp4  (attenuazione a 0,25 invece di 0,62)"
