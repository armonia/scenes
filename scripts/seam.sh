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
# Uso:  ./scripts/seam.sh [scena-A.mp4] [scena-B.mp4]
#
# I due argomenti sono opzionali e senza di essi la coppia e' quella storica,
# UIMockup -> CardHandoff. Sono diventati necessari con la quarta scena: una
# giunta esiste per ogni coppia adiacente, e con i percorsi cablati dentro lo
# script il secondo anello avrebbe voluto un secondo script identico a questo
# tranne che per due righe. Da li' in poi le soglie divergono e nessuno se ne
# accorge, che e' esattamente il modo in cui una misura smette di misurare.
set -uo pipefail

# ImageMagick si chiama `magick` sulla 7 e `convert`/`compare` sulla 6.
. "$(dirname "${BASH_SOURCE[0]}")/_magick.sh"
export LC_NUMERIC=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
A="${1:-$ROOT/video/out/ui-mockup.mp4}"
B="${2:-$ROOT/video/out/card-handoff.mp4}"

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
# La meta' si calcola, non si scrive: era 4 secondi, che e' meta' di
# card-handoff e non meta' di nient'altro. Su una scena piu' corta quel valore
# sarebbe caduto oltre la fine e il confronto avrebbe girato su un fotogramma
# vuoto, cioe' su un controllo che boccia sempre e non prova niente.
mid=$(python3 -c "print(f'{float('$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$B")') / 2:.3f}')")
ffmpeg -v error -ss "$mid" -i "$B" -frames:v 1 -y "$TMP/b-mid.png"

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
  # AE stampa "542.562 (0.000261652)": si tiene l'intero iniziale. Tagliare dal
  # primo punto bastava finche' il conteggio non era esattamente zero, perche'
  # allora la stringa e' "0 (0)", non ha punti, e restava "0(0)": il controllo
  # numerico sotto la bocciava e lo script usciva 3 dicendo che il confronto era
  # fallito. Cioe' proprio su una giunta perfetta.
  diff=$(echo "$diff" | tr -d '[:space:]' | sed 's/[^0-9].*$//')
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

echo "La giunta fra $(basename "$A" .mp4) e $(basename "$B" .mp4)"
echo
printf '  %-34s %9s %12s\n' "confronto" "diversi" "pixel"
printf '  %-34s %8.3f%% %12s\n' "ultimo A  vs  primo B  (giunta)" \
  "$(python3 -c "print($seam_frac * 100)")" "$seam_px"
printf '  %-34s %8.3f%% %12s\n' "ultimo A  vs  meta' B  (taglio)" \
  "$(python3 -c "print($cut_frac * 100)")" "$cut_px"
echo

# Il controllo negativo deve essere almeno 10 volte peggiore, altrimenti la
# misura non separa una giunta da un taglio e non prova niente. Il rapporto si
# calcola sui conteggi di pixel: la frazione e' stampata a cinque decimali, e su
# una giunta quasi perfetta vale 0.00000, quindi dividerci dentro stampava
# numeri a sette cifre al posto di una separazione.
if ! python3 -c "exit(0 if $cut_frac > $seam_frac * 10 else 1)"; then
  echo "MISURA INUTILE: giunta e taglio danno numeri simili, la soglia non separa." >&2
  exit 2
fi

if python3 -c "exit(0 if $seam_frac <= $SOGLIA else 1)"; then
  echo "VERDETTO: giunta continua (sotto $(python3 -c "print($SOGLIA*100)")%), e il taglio di controllo e' $(python3 -c "print(f'{$cut_px/max($seam_px,1):.0f}')")x peggiore."
  exit 0
fi

echo "VERDETTO: c'e' un salto fra $(basename "$A" .mp4) e $(basename "$B" .mp4)." >&2
echo "Le due pose non coincidono: la posa di giunzione va letta da" >&2
echo "primitives/slab.ts da entrambe le scene, non riscritta in una delle due." >&2
exit 1
