#!/usr/bin/env bash
#
# Il contenuto borda fuori dall'inquadratura, o galleggia in mezzo?
#
# E' il difetto preciso per cui OrbitLoop non reggeva il confronto: il
# meccanismo stava nel terzo centrale mentre il riferimento riempie il quadro.
# A parole si discute all'infinito, quindi serve un numero.
#
# PRIMA MISURA, SCARTATA. Tagliare il fotogramma in nove e guardare la
# deviazione standard di ogni nono. Non separava niente: OrbitLoop prendeva 8
# noni occupati su 9, esattamente come il riferimento, perche' gli anelli si
# allargano abbastanza da toccare quasi tutti i noni pur restando dentro il
# quadro. Un'asserzione che non puo' fallire non e' una misura, e' un ornamento.
#
# QUESTA. Si guardano solo le quattro fasce di bordo, spesse un cinquantesimo.
# Se una composizione borda fuori dallo schermo, il bordo e' occupato. Se
# galleggia, il bordo e' fondale e basta. E' la differenza fra una finestra che
# continua oltre il quadro e un rettangolo appoggiato al centro.
#
# Sui tre video, misurato: OrbitLoop da' 0,00 su tutti e quattro i bordi a ogni
# istante campionato. Il riferimento Linear ne tiene vivi due su quattro. La
# nostra prompt-input tutti e quattro.
#
# NON DA' UN VERDETTO, e il motivo e' misurato (15 settembre 2026). Il "20 su
# 20" che questo script stampa sulle sei scene lo stampa anche su una lastra
# arretrata. Ridotto al 60% ui-mockup.mp4 e riempito il resto col colore vero
# del fondale (#1B1C20), la lettura esce 28,79 su tutti e quattro i bordi a ogni
# campione: il fondale delle scene ha luminanza intorno a 20, e la soglia e' 2.
# La soglia era giusta per OrbitLoop, che aveva il fondo nero, e ha smesso di
# esserlo quando il fondo e' diventato quello dell'app.
#
# Neanche la tessitura locale separa i due casi. Il rapporto fra la varianza 3x3
# della fascia di bordo e quella del centro scende a 0,014 su card-release con
# la lastra in quadro, e sale a 0,043 su board-orbit, dove i bordi mostrano il
# fondale apposta. Dietro la lastra c'e' il piano attenuato (MAT-03), cioe' la
# board disegnata una seconda volta e sfocata, e per i pixel e' contenuto.
#
# Quindi il verdetto sul riempimento non si prende dai pixel: si prende dalla
# geometria, proiettando la lastra ai frame campionati e chiedendo che copra i
# quattro bordi del quadro. E' fill-geom.py, e gira in CI al posto di questo, che
# resta una lettura. Un banco che non puo' fallire non va lasciato in un elenco
# di banchi che possono.
#
# Uso:  ./scripts/fill-measure.sh <video.mp4>
set -uo pipefail

# ImageMagick si chiama `magick` sulla 7 e `convert`/`compare` sulla 6.
. "$(dirname "${BASH_SOURCE[0]}")/_magick.sh"

# La misura e' un numero con il punto decimale, e printf lo formatta secondo il
# locale. Su una macchina italiana LC_NUMERIC=it_IT vuole la virgola, quindi
# `printf '%.2f' 25.34` fallisce con "invalid number" e la colonna esce vuota.
# Fissare il locale numerico qui rende la stampa uguale ovunque giri.
export LC_NUMERIC=C

SRC="${1:?serve un video}"
SOGLIA=2.0

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC")

echo "$(basename "$SRC")  (luminanza media della fascia di bordo, soglia $SOGLIA)"
printf '  %-7s %7s %7s %7s %7s\n' "a" "sopra" "sotto" "sx" "dx"

vivi=0
tot=0

for q in 0.20 0.38 0.56 0.74 0.90; do
  at=$(python3 -c "print(f'{$dur * $q:.2f}')")
  ffmpeg -v error -ss "$at" -i "$SRC" -frames:v 1 -vf "scale=900:-2" -y "$TMP/f.png"
  [ -s "$TMP/f.png" ] || { echo "estrazione fallita a ${at}s" >&2; exit 3; }

  read -r W H < <("${IM_IDENTIFY[@]}" -format '%w %h\n' "$TMP/f.png")
  # Se identify non ha prodotto due interi, lo strumento non ha risposto e ogni
  # numero stampato dopo sarebbe inventato.
  case "${W:-}${H:-}" in
    ''|*[!0-9]*) echo "identify non ha dato le dimensioni: '$W' '$H'" >&2; exit 3 ;;
  esac
  b=$((W / 50))

  line=""
  for spec in "${W}x${b}+0+0" "${W}x${b}+0+$((H - b))" "${b}x${H}+0+0" "${b}x${H}+$((W - b))+0"; do
    m=$("${IM_CONVERT[@]}" "$TMP/f.png" -crop "$spec" +repage -colorspace Gray \
      -format '%[fx:mean*255]' info:)
    # La luminanza deve essere un numero. Quando ImageMagick manca o fallisce,
    # `m` resta vuoto: la prima versione lo passava a python, che si limitava a
    # stampare un errore, e il loop proseguiva scrivendo 0.00 su ogni bordo.
    # Cosi' la misura riportava "0 su 20 bordi vivi", che e' il referto di una
    # scena nera, per una scena che nessuno aveva guardato. Un banco che sbaglia
    # in silenzio e' peggio di un banco assente, perche' lo si legge.
    case "$m" in
      ''|*[!0-9.eE+-]*) echo "misura non numerica su $spec: '$m'" >&2; exit 3 ;;
    esac
    tot=$((tot + 1))
    if python3 -c "exit(0 if $m >= $SOGLIA else 1)"; then
      vivi=$((vivi + 1))
      line=$(printf '%s %6.2f*' "$line" "$m")
    else
      line=$(printf '%s %6.2f ' "$line" "$m")
    fi
  done
  printf '  %-7s%s\n' "${at}s" "$line"
done

echo "  bordi vivi: $vivi su $tot campioni"
echo "  (lettura, non verdetto: questa soglia promuove anche una lastra arretrata, vedi l'intestazione)"
