#!/usr/bin/env bash
#
# Costruisce la scena che tempo.py deve bocciare.
#
# NON MISURA NIENTE. Tronca una scena alla durata del suo provino veloce invece
# di ritempificarla: le battute restano dov'erano e la coda sparisce. E'
# esattamente quello che si otteneva prima di primitives/tempo.ts abbassando un
# numero in catalog.json, ed e' il difetto che il banco esiste per riconoscere.
#
# Uso:  ./scripts/fixture-trim.sh <scena.mp4> <provino-veloce.mp4> <uscita.mp4>
set -euo pipefail

SRC="${1:?serve il render della scena}"
FAST="${2:?serve il provino veloce}"
OUT="${3:?serve il file di uscita}"

[ -f "$SRC" ] || { echo "manca $SRC" >&2; exit 3; }
[ -f "$FAST" ] || { echo "manca $FAST: rendi i provini con fixture-tempo.sh" >&2; exit 3; }

N=$(ffprobe -v error -count_frames -select_streams v:0 \
      -show_entries stream=nb_read_frames -of csv=p=0 "$FAST" | tr -dc '0-9')
[ -n "$N" ] || { echo "non riesco a contare i fotogrammi di $FAST" >&2; exit 3; }
mkdir -p "$(dirname "$OUT")"
ffmpeg -nostdin -v error -i "$SRC" -frames:v "$N" -fps_mode passthrough -y "$OUT"

[ -s "$OUT" ] || { echo "il ritaglio non ha prodotto niente" >&2; exit 3; }
echo "fixture: $OUT  ($N fotogrammi, tagliati e non ritempificati)"
