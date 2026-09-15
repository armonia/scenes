#!/usr/bin/env bash
#
# Qualche banco si calcola ancora la geometria da solo, importando i moduli di
# un prodotto?
#
# PERCHE' ESISTE. Quattro banchi importavano topics/geometry.ts dentro uno script node
# scritto nel proprio corpo e rifacevano i conti di ripresa di Topics. Adesso li
# chiedono a scripts/manifest.mjs, che e' l'unico posto in cui un banco puo'
# leggere un prodotto. Senza un controllo, il primo banco nuovo scritto di fretta
# tornerebbe a importare topics/geometry.ts e a misurare solo Topics, e nessuno se ne
# accorgerebbe perche' non fallirebbe.
#
# COSA CERCA. Nelle righe di codice degli script (non nei commenti), anche nelle
# sottocartelle, un percorso a un modulo .ts o .tsx di un prodotto
# (video/src/products/). Sono ammessi solo manifest.mjs, che esiste per quello,
# e geometry-snapshot.mjs, che fotografa topics/geometry.ts apposta per
# confrontarne due versioni.
#
# IL KIT NON E' UN PRODOTTO. Leggere video/src/kit/stage.ts per sapere quanto e'
# largo un 9:16 non lega un banco a Topics, ed e' il motivo per cui la regola
# guarda products/ e non tutto video/src. La prima versione vietava ogni
# percorso sotto video/src, e bocciava catalog.mjs per aver chiesto al kit le
# dimensioni di uno stage.
#
# Uso:  ./scripts/no-product-literals.sh [cartella-degli-script]
#
# Esce 0 se nessun banco legge un prodotto da se', 1 altrimenti.
set -uo pipefail

DIR="${1:-$(cd "$(dirname "$0")" && pwd)}"
FOUND=0

while IFS= read -r f; do
  case "$(basename "$f")" in
    manifest.mjs | geometry-snapshot.mjs | no-product-literals.sh) continue ;;
  esac
  # Le righe di commento (# in shell e python, // in js) non contano: ci si
  # scrive da dove viene un numero, ed e' giusto che lo si scriva.
  hits=$(grep -n -E 'video/src/products/[^ "'"'"']+\.tsx?' "$f" \
    | grep -v -E '^[0-9]+:[[:space:]]*(#|//)' || true)
  if [ -n "$hits" ]; then
    echo "  ${f#"$DIR"/} legge un prodotto da se':"
    echo "$hits" | sed 's/^/    /'
    FOUND=1
  fi
done < <(find "$DIR" -type f \( -name '*.sh' -o -name '*.py' -o -name '*.mjs' \) -not -path '*/__pycache__/*' | sort)

if [ "$FOUND" -eq 1 ]; then
  echo "VERDETTO: almeno un banco si calcola la geometria di un prodotto invece di chiederla al manifest."
  exit 1
fi
echo "VERDETTO: nessun banco legge un prodotto da se'; la geometria passa tutta da manifest.mjs."
exit 0
