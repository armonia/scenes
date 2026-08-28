#!/usr/bin/env bash
#
# La giunta fra due scene: e' davvero senza taglio, o solo abbastanza simile?
#
# La regola dice che una scena deve poter entrare dallo stato finale della
# precedente. Finche' resta una frase nel README, la si rispetta a occhio, e a
# occhio due fotogrammi scuri con la stessa UI sembrano sempre uguali. Questo
# script guarda i pixel: estrae l'ULTIMO fotogramma della scena A e il PRIMO
# della scena B, li mette a confronto e stampa quanti pixel differiscono.
#
# COSA RENDE LA MISURA ONESTA. Il confronto non e' col nero, ne' con un frame a
# caso: e' con il vicino di banco. Insieme alla giunta viene misurato anche un
# TAGLIO FINTO, cioe' l'ultimo frame di A contro un frame preso in mezzo a B.
# Se la giunta e il taglio finto dessero numeri simili, la misura non
# separerebbe niente e sarebbe un ornamento: il taglio finto e' li' per
# dimostrare che la soglia distingue davvero i due casi.
#
# PERCHE' NON SI PRETENDE ZERO. La giunta e' esatta nel modello (entrambe le
# scene leggono UI_MOCKUP_END_POSE), ma i due frame passano per due encoding
# H.264 distinti, e un encoder lossy non restituisce mai gli stessi byte. La
# soglia sta sulla frazione di pixel oltre una tolleranza percettiva, non
# sull'uguaglianza binaria.
#
# Uso:  ./scripts/seam.sh
set -uo pipefail

# ImageMagick si chiama `magick` sulla 7 e `convert`/`compare` sulla 6.
. "$(dirname "${BASH_SOURCE[0]}")/_magick.sh"
export LC_NUMERIC=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
A="$ROOT/video/out/ui-mockup.mp4"
B="$ROOT/video/out/card-handoff.mp4"

# Oltre questa frazione di pixel diversi, la giunta e' un taglio.
SOGLIA=0.02
# Differenza per canale sotto cui due pixel sono "lo stesso pixel" a occhio.
FUZZ="4%"

for f in "$A" "$B"; do
  if [ ! -f "$f" ]; then
    echo "manca il render: ${f#"$ROOT"/}" >&2
    echo "  cd video && npx remotion render <CompositionId> out/$(basename "$f")" >&2
    exit 1
  fi
done

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Ultimo fotogramma di A. `-update 1` riscrive lo stesso file a ogni frame,
# quindi al termine resta l'ultimo. Costa una passata sul video e in cambio non
# richiede di sapere quanti frame sono: la prima versione cercava con `-sseof`
# e usciva a mani vuote, che e' il modo in cui una misura mente senza fallire.
ffmpeg -v error -i "$A" -fps_mode passthrough -update 1 -y "$TMP/a-last.png"
# Primo fotogramma di B.
ffmpeg -v error -i "$B" -frames:v 1 -y "$TMP/b-first.png"
# Un fotogramma dal mezzo di B: il taglio finto, il controllo negativo.
ffmpeg -v error -ss 4 -i "$B" -frames:v 1 -y "$TMP/b-mid.png"

# Se un'estrazione e' andata a vuoto, fermarsi qui. Senza questo controllo il
# confronto gira su file inesistenti e stampa 0.000%, cioe' il numero che si
# vorrebbe vedere: un errore che si traveste da successo.
for f in a-last b-first b-mid; do
  if [ ! -s "$TMP/$f.png" ]; then
    echo "estrazione fallita: $f.png non e' stato prodotto" >&2
    exit 3
  fi
done

misura() {
  local x="$1" y="$2"
  local diff
  # AE conta i pixel che differiscono oltre la fuzz. Su stderr, e con exit 1
  # quando ce ne sono: entrambi previsti.
  diff=$("${IM_COMPARE[@]}" -metric AE -fuzz "$FUZZ" "$x" "$y" null: 2>&1 || true)
  diff=$(echo "$diff" | tr -d '[:space:]' | sed 's/\..*//')
  # AE deve dare un intero. Se qui c'e' un messaggio d'errore, il confronto non
  # e' avvenuto e proseguire vorrebbe dire stampare un numero inventato.
  case "$diff" in
    ''|*[!0-9]*)
      echo "confronto fallito su $(basename "$x") vs $(basename "$y"): $diff" >&2
      exit 3
      ;;
  esac
  local tot
  tot=$("${IM_IDENTIFY[@]}" -format '%[fx:w*h]' "$x")
  python3 -c "print(f'{$diff / $tot:.5f} {$diff}')"
}

read -r seam_frac seam_px < <(misura "$TMP/a-last.png" "$TMP/b-first.png")
read -r cut_frac cut_px < <(misura "$TMP/a-last.png" "$TMP/b-mid.png")

echo "La giunta fra UIMockup e CardHandoff"
echo
printf '  %-34s %9s %12s\n' "confronto" "diversi" "pixel"
printf '  %-34s %8.3f%% %12s\n' "ultimo A  vs  primo B  (giunta)" \
  "$(python3 -c "print($seam_frac * 100)")" "$seam_px"
printf '  %-34s %8.3f%% %12s\n' "ultimo A  vs  meta' B  (taglio)" \
  "$(python3 -c "print($cut_frac * 100)")" "$cut_px"
echo

# Il controllo negativo deve essere almeno 10 volte peggiore, altrimenti la
# misura non separa una giunta da un taglio e non prova niente.
if ! python3 -c "exit(0 if $cut_frac > $seam_frac * 10 else 1)"; then
  echo "MISURA INUTILE: giunta e taglio danno numeri simili, la soglia non separa." >&2
  exit 2
fi

if python3 -c "exit(0 if $seam_frac <= $SOGLIA else 1)"; then
  echo "VERDETTO: giunta continua (sotto $(python3 -c "print($SOGLIA*100)")%), e il taglio di controllo e' $(python3 -c "print(f'{$cut_frac/max($seam_frac,1e-9):.0f}')")x peggiore."
  exit 0
fi

echo "VERDETTO: c'e' un salto. La posa finale di UIMockup e quella iniziale di" >&2
echo "CardHandoff non coincidono: controlla UI_MOCKUP_END_POSE in primitives/slab.ts." >&2
exit 1
