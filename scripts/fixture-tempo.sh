#!/usr/bin/env bash
#
# Rende i due provini del tempo: le stesse scene a durata ridotta.
#
# NON MISURANO NIENTE da soli. Sono composition dichiarate in Root.tsx e non in
# catalog.json, quindi non finiscono in vetrina e il film non le contiene: sono
# la sola cosa contro cui si puo' provare che accorciare la durata accorcia
# anche le battute interne, invece di tagliare la coda.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/video"
npx remotion render CardHandoffFast out/.fast-card-handoff.mp4 >/dev/null
npx remotion render PromptInputFast out/.fast-prompt-input.mp4 >/dev/null

for f in out/.fast-card-handoff.mp4 out/.fast-prompt-input.mp4; do
  [ -s "$f" ] || { echo "il render del provino $f non ha prodotto niente" >&2; exit 3; }
done
echo "provini del tempo: CardHandoff a 120 fotogrammi (meta'), PromptInput a 300 (due terzi)"
