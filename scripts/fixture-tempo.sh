#!/usr/bin/env bash
#
# Rende i provini del tempo di un rapporto: le stesse scene a durata ridotta.
#
# NON MISURANO NIENTE da soli. Sono composition dichiarate in catalog.json sotto
# tempoFixtures e non fra le scene, quindi non finiscono in vetrina e il film non
# le contiene: sono la sola cosa contro cui si puo' provare che accorciare la
# durata accorcia anche le battute interne, invece di tagliare la coda.
#
# L'elenco non e' scritto qui: i comandi li stampa `catalog.mjs fixtures`, come
# quelli delle scene li stampa `catalog.mjs render`.
#
# Uso:  ./scripts/fixture-tempo.sh [--ratio 16x9|9x16|4x5]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RATIO=16x9
[ "${1:-}" = "--ratio" ] && RATIO="${2:?serve il rapporto}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
node "$ROOT/scripts/catalog.mjs" fixtures --ratio "$RATIO" > "$TMP/render.sh"
[ -s "$TMP/render.sh" ] || { echo "il catalogo non dichiara provini del tempo" >&2; exit 3; }

cd "$ROOT/video"
while read -r _npx _remotion _render id out; do
  npx remotion render "$id" "$out" >/dev/null < /dev/null
  [ -s "$out" ] || { echo "il render del provino $id non ha prodotto niente" >&2; exit 3; }
  echo "provino del tempo: $id -> video/$out"
done < "$TMP/render.sh"
