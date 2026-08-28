#!/usr/bin/env bash
#
# A che grandezza il testo della scena smette di leggersi.
#
# E' il secondo dei tre difetti per cui OrbitLoop non reggeva: "le etichette a
# quella scala non si leggono". Il primo (il quadro pieno) lo misura
# `fill-measure.sh`. Questo misura il secondo.
#
# PERCHE' NON BASTA GUARDARE IL RENDER A 1920. A grandezza piena si legge
# qualunque cosa. Il testo di questa scena sta fra 16 e 26 pixel su una lastra
# da 2200 dentro un quadro da 1920, cioe' circa il 2% dell'altezza. Su un video
# incorporato a meta' larghezza in una pagina diventa la meta'. La domanda
# giusta non e' "si legge?" ma "fino a che larghezza si legge?".
#
# COME. Si rimpicciolisce il fotogramma a larghezze crescenti di visione e a
# ognuna si passa l'OCR, contando quante delle parole attese tornano indietro.
# Il numero non e' una soglia di leggibilita' umana: l'OCR e' piu' fragile di un
# occhio, e questo testo sta per giunta su un piano inclinato, che lo deforma.
# E' un indice comparativo, e vale solo perche' accanto ci passa il riferimento
# con lo stesso identico trattamento.
#
# PERCHE' PUO' FALLIRE, che e' la parte che rende la misura una misura. Se la
# scena avesse il testo troppo piccolo, a 640 tornerebbe zero mentre il
# riferimento tiene. Il confronto e' il test; la colonna nostra da sola non
# direbbe niente.
#
# Uso:  ./scripts/legibility.sh
set -uo pipefail

# ImageMagick si chiama `magick` sulla 7 e `convert`/`compare` sulla 6.
. "$(dirname "${BASH_SOURCE[0]}")/_magick.sh"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MINE="$ROOT/video/out/prompt-input.mp4"
REF="$ROOT/ref/7gZBxBTapDQ.mp4"

# Non sotto /tmp: su questa macchina /tmp e' un symlink e tesseract non lo
# segue, quindi darebbe "nessun testo" per un motivo che non c'entra niente.
WORK="$ROOT/out/.legibility"
rm -rf "$WORK"; mkdir -p "$WORK"

# Le larghezze a cui uno guarda davvero un video: pieno, meta' pagina, colonna
# stretta, miniatura.
WIDTHS=(1920 1280 960 640 480)

# Un fotogramma con il prompt gia' scritto per intero, e uno con la risposta in
# streaming: sono i due momenti in cui la scena ha del testo da leggere.
declare -a SHOTS=("8.2" "11.8")

ocr_words() {
  local img="$1"
  tesseract "$img" stdout --psm 11 2>/dev/null |
    tr '[:upper:]' '[:lower:]' |
    tr -cs '[:alnum:]' '\n' |
    sed '/^.\{0,2\}$/d' |
    sort -u
}

measure() {
  local src="$1" label="$2"; shift 2
  local -a times=("$@")

  printf '%s\n' "$label"
  printf '  %-8s %s\n' "larghezza" "parole lette dall'OCR (unione dei fotogrammi)"

  for w in "${WIDTHS[@]}"; do
    local total=0
    for i in "${!times[@]}"; do
      local t="${times[$i]}"
      ffmpeg -v error -ss "$t" -i "$src" -frames:v 1 \
        -vf "scale=${w}:-2" -y "$WORK/s.png" 2>/dev/null
      # L'OCR lavora meglio su una scala di grigi con un po' di contrasto, e il
      # trattamento e' identico per i due video: e' l'unica cosa che conta.
      "${IM_CONVERT[@]}" "$WORK/s.png" -colorspace Gray -normalize "$WORK/s2.png"
      local n
      n=$(ocr_words "$WORK/s2.png" | wc -l | tr -d ' ')
      total=$((total + n))
    done
    printf '  %-8s %s\n' "${w}px" "$total"
  done
  echo
}

echo "Leggibilita': quante parole distinte sopravvivono al rimpicciolimento."
echo "Stesso trattamento sui due video. Conta il confronto fra le colonne, non il valore assoluto."
echo

measure "$MINE" "prompt-input (prompt scritto, poi risposta in streaming)" "${SHOTS[@]}"
# Due momenti dello spot Linear in cui c'e' UI con testo in quadro.
measure "$REF" "Linear, Diffs (il riferimento)" "24.0" "31.0"

rm -rf "$WORK"
