#!/usr/bin/env bash
#
# Qualche banco si calcola ancora la geometria da solo, importando i moduli di
# un prodotto?
#
# PERCHE' ESISTE. Quattro banchi importavano slab.ts dentro uno script node
# scritto nel proprio corpo e rifacevano i conti di ripresa di Topics. Adesso li
# chiedono a scripts/manifest.mjs, che e' l'unico posto in cui un banco puo'
# leggere video/src. Senza un controllo, il primo banco nuovo scritto di fretta
# tornerebbe a importare slab.ts e a misurare solo Topics, e nessuno se ne
# accorgerebbe perche' non fallirebbe.
#
# COSA CERCA. Nelle righe di codice degli script (non nei commenti) un percorso
# a un modulo .ts o .tsx di video/src. Sono ammessi solo manifest.mjs, che
# esiste per quello, e geometry-snapshot.mjs, che fotografa slab.ts apposta per
# confrontarne due versioni.
#
# Uso:  ./scripts/no-product-literals.sh [cartella-degli-script]
#
# Esce 0 se nessun banco legge video/src da se', 1 altrimenti.
set -uo pipefail

DIR="${1:-$(cd "$(dirname "$0")" && pwd)}"
FOUND=0

for f in "$DIR"/*.sh "$DIR"/*.py "$DIR"/*.mjs; do
  [ -f "$f" ] || continue
  case "$(basename "$f")" in
    manifest.mjs | geometry-snapshot.mjs | no-product-literals.sh) continue ;;
  esac
  # Le righe di commento (# in shell e python, // in js) non contano: ci si
  # scrive da dove viene un numero, ed e' giusto che lo si scriva.
  hits=$(grep -n -E 'video/src/[^ "'"'"']+\.tsx?' "$f" \
    | grep -v -E '^[0-9]+:[[:space:]]*(#|//)' || true)
  if [ -n "$hits" ]; then
    echo "  $(basename "$f") legge video/src da se':"
    echo "$hits" | sed 's/^/    /'
    FOUND=1
  fi
done

if [ "$FOUND" -eq 1 ]; then
  echo "VERDETTO: almeno un banco si calcola la geometria di un prodotto invece di chiederla al manifest."
  exit 1
fi
echo "VERDETTO: nessun banco legge video/src da se'; la geometria passa tutta da manifest.mjs."
exit 0
