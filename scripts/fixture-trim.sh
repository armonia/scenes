#!/usr/bin/env bash
#
# Costruisce la scena che tempo.py deve bocciare.
#
# NON MISURA NIENTE. Tronca CardHandoff alla durata del provino veloce invece di
# ritempificarla: le battute restano dov'erano e la coda sparisce. E' esattamente
# quello che si otteneva prima di primitives/tempo.ts abbassando un numero in
# catalog.json, ed e' il difetto che il banco esiste per riconoscere.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/video/out/card-handoff.mp4"
FAST="$ROOT/video/out/.fast-card-handoff.mp4"
OUT="$ROOT/video/out/.fixture-trim.mp4"

[ -f "$SRC" ] || { echo "manca $SRC" >&2; exit 1; }
[ -f "$FAST" ] || { echo "manca $FAST: rendi CardHandoffFast" >&2; exit 1; }

N=$(ffprobe -v error -count_frames -select_streams v:0 \
      -show_entries stream=nb_read_frames -of csv=p=0 "$FAST" | tr -dc '0-9')
ffmpeg -nostdin -v error -i "$SRC" -frames:v "$N" -fps_mode passthrough -y "$OUT"

[ -s "$OUT" ] || { echo "il ritaglio non ha prodotto niente" >&2; exit 3; }
echo "fixture: video/out/.fixture-trim.mp4  ($N fotogrammi, tagliati e non ritempificati)"
