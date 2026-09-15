#!/usr/bin/env bash
#
# Costruisce il fotogramma che contrast-floor.py deve bocciare.
#
# NON MISURA NIENTE. Rende un fotogramma di PromptInput con il pavimento
# dell'attenuazione a 0,25 invece che a 0,62, cioe' la stessa identica scena
# attenuata troppo. E' il motivo per cui `attnFloor` esiste come prop: senza un
# render sbagliato da dare in pasto al banco, il verde del banco vorrebbe dire
# soltanto che lo script e' arrivato in fondo.
#
# UN FOTOGRAMMA E NON UNA SCENA. La prima versione rendeva tutti i 450
# fotogrammi, due minuti per rapporto, per un banco che ne legge uno.
#
# Uso:  ./scripts/fixture-attenuation.sh <composition> <frame> <uscita.png>
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMP="${1:?serve la composition, per esempio PromptInput-9x16}"
FRAME="${2:?serve il fotogramma}"
OUT="${3:?serve il file di uscita .png}"

mkdir -p "$(dirname "$OUT")"
OUT="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"
cd "$ROOT/video"
npx remotion still "$COMP" "$OUT" --frame="$FRAME" --image-format=png \
  --props='{"attnFloor":0.25}' --log=error >/dev/null < /dev/null

[ -s "$OUT" ] || { echo "il fotogramma della fixture non e' uscito" >&2; exit 3; }
echo "fixture: $OUT  ($COMP al fotogramma $FRAME, attenuazione a 0,25 invece di 0,62)"
