#!/usr/bin/env bash
#
# I fotogrammi delle scene sono identici a quelli di un altro commit?
#
# PERCHE' ESISTE. Il kit sposta codice che disegna: la geometria prima, poi il
# blocco di ripresa che sei scene ricopiavano a mano. Quei passi promettono di
# non cambiare un pixel, e una promessa cosi' non si verifica guardando i video:
# due render della stessa sorgente, codificati in H.264, differiscono gia' di
# qualche migliaio di pixel per il rumore del codificatore. I PNG di
# `remotion still` invece sono ripetibili (lo prova framelocked-verdict.sh),
# quindi due hash uguali sono due fotogrammi uguali.
#
# COME. Il commit di base si estrae in un worktree temporaneo che usa gli stessi
# node_modules, si rendono gli stessi fotogrammi da li' e dal working tree, e si
# confrontano gli sha256. Per ogni scena: il primo, il secondo, quello di mezzo,
# il penultimo e l'ultimo.
#
# IL CONTROLLO DELLO STRUMENTO. Un fotogramma per scena si rende due volte dal
# working tree: se quei due hash non coincidono, lo strumento non e' ripetibile
# e un "diverso" non vorrebbe dire niente. Il controllo negativo lo fa la CI o
# chi lo lancia: spostare di un pixel una posa e vedere uscire 1.
#
# Uso:  ./scripts/still-identity.sh <commit-di-base> [Composition ...]
#       senza composition, tutte quelle di catalog.json
#       FRAMES="20 40 80" ./scripts/still-identity.sh main UIMockup
#       per scegliere i fotogrammi: servono quando un refactor tocca una finestra
#       che i cinque di default non attraversano, come i primi 80 frame di UIMockup
#
# Esce 0 se tutti i fotogrammi coincidono, 1 se almeno uno cambia, 2 se lo
# strumento non e' ripetibile, 3 se un render non esce.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE_REF="${1:?serve il commit di base, per esempio origin/main}"
shift

TMP="$(mktemp -d)"
cleanup() {
  git -C "$ROOT" worktree remove --force "$TMP/base" >/dev/null 2>&1
  rm -rf "$TMP"
}
trap cleanup EXIT

if [ "$#" -gt 0 ]; then
  COMPS=("$@")
else
  # shellcheck disable=SC2207
  COMPS=($(node "$ROOT/scripts/catalog.mjs" ids))
fi

if ! git -C "$ROOT" worktree add --detach "$TMP/base" "$BASE_REF" >/dev/null 2>&1; then
  echo "non riesco a estrarre $BASE_REF in un worktree" >&2
  exit 3
fi
ln -s "$ROOT/video/node_modules" "$TMP/base/video/node_modules"

duration() { # composition -> durata, letta dal catalogo del working tree
  python3 -c "
import json,sys
c=json.load(open('$ROOT/video/src/scenes/catalog.json'))
d={s['id']:s['durationInFrames'] for s in c['scenes']}
print(d.get(sys.argv[1], 0))" "$1"
}

still() { # cartella-video composition frame file
  (cd "$1" && npx remotion still "$2" "$4" --frame="$3" --image-format=png --log=error \
    >/dev/null 2>&1 < /dev/null) && [ -s "$4" ]
}

hash() { shasum -a 256 "$1" | cut -c1-16; }

echo "Fotogrammi di $BASE_REF contro il working tree."
DIFF=0
for comp in "${COMPS[@]}"; do
  n=$(duration "$comp")
  if [ "$n" -le 0 ]; then
    echo "  $comp: durata sconosciuta, non e' nel catalogo" >&2
    exit 3
  fi
  mid=$((n / 2))
  frames="${FRAMES:-0 1 $mid $((n - 2)) $((n - 1))}"
  line="  $(printf '%-13s' "$comp")"
  for f in $frames; do
    still "$TMP/base/video" "$comp" "$f" "$TMP/b-$comp-$f.png" || { echo "$line base f$f: RENDER FALLITO"; exit 3; }
    still "$ROOT/video" "$comp" "$f" "$TMP/h-$comp-$f.png" || { echo "$line f$f: RENDER FALLITO"; exit 3; }
    if [ "$(hash "$TMP/b-$comp-$f.png")" = "$(hash "$TMP/h-$comp-$f.png")" ]; then
      line="$line f$f="
    else
      line="$line f$f≠"
      DIFF=$((DIFF + 1))
    fi
  done
  # Il controllo dello strumento: lo stesso fotogramma, due volte dal working
  # tree. Il primo dell'elenco, che esiste anche quando i fotogrammi li sceglie
  # chi lancia il banco: la prima versione ripeteva sempre quello di mezzo, e con
  # FRAMES lo confrontava con un file mai renderizzato.
  set -- $frames
  rep="$1"
  still "$ROOT/video" "$comp" "$rep" "$TMP/r-$comp.png" || { echo "$line ripetizione: RENDER FALLITO"; exit 3; }
  if [ "$(hash "$TMP/r-$comp.png")" != "$(hash "$TMP/h-$comp-$rep.png")" ]; then
    echo "$line  (lo stesso fotogramma reso due volte cambia: strumento non ripetibile)"
    exit 2
  fi
  echo "$line"
done

echo ""
if [ "$DIFF" -gt 0 ]; then
  echo "VERDETTO: $DIFF fotogrammi cambiano rispetto a $BASE_REF."
  exit 1
fi
echo "VERDETTO: tutti i fotogrammi sono identici a $BASE_REF, e lo strumento e' ripetibile."
exit 0
