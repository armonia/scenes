#!/usr/bin/env bash
#
# I quattro tempi della scena, verificati sul file finito.
#
# PERCHE' ESISTE. La scena chiede quattro cose: il cursore entra, digita,
# invia, la risposta arriva in streaming. Il render ne ha mostrate tre per un
# giorno intero senza che niente protestasse. Il thread e' ancorato in basso e
# arriva a 922, il composer e' opaco e comincia a 838: l'ultimo messaggio
# finiva sotto, quindi la risposta si componeva parola per parola dove nessuno
# poteva vederla. Il codice era giusto, il layout no, e nessun typecheck vede
# una cosa del genere. La vede solo qualcuno che legge il fotogramma.
#
# COME. Si leggono i fotogrammi con l'OCR e si contano le parole attese in tre
# momenti dello streaming. La condizione non e' "ce ne sono": e' che siano di
# PIU' ogni volta. Una soglia fissa la passerebbe anche un fermo immagine con
# la risposta gia' stampata; la crescita no, quella la puo' produrre solo un
# testo che si compone.
#
# COSA LO FA FALLIRE, che e' la sola cosa che rende un banco un banco. La
# regressione del composer sopra fa restare il conteggio a zero in tutti e tre
# i momenti. Un testo che appare tutto insieme fa tre conteggi uguali. Una
# scena che finisce troppo presto fa scendere l'ultimo.
#
# Uso:  ./scripts/beats.sh [video.mp4]
set -uo pipefail

# ImageMagick si chiama `magick` sulla 7 e `convert`/`compare` sulla 6.
. "$(dirname "${BASH_SOURCE[0]}")/_magick.sh"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-$ROOT/video/out/prompt-input.mp4}"

[ -f "$SRC" ] || { echo "manca: $SRC" >&2; exit 1; }

# Non sotto /tmp: e' un symlink e tesseract non lo segue.
WORK="$ROOT/out/.beats"
rm -rf "$WORK"; mkdir -p "$WORK"
trap 'rm -rf "$WORK"' EXIT

# SENZA L'OCR QUESTO BANCO NON MISURA NIENTE, e deve dirlo invece di bocciare.
# Con tesseract assente ogni lettura torna vuota, ogni conteggio torna zero, e
# il verdetto diventa "la risposta non si vede mai": una diagnosi sulla scena
# per un guasto dello strumento. E' lo stesso difetto per cui handoff-travel.sh
# ha accusato CardHandoff per mesi su macOS. Esce 3, che vuol dire "non ho
# potuto misurare", e non 1, che vorrebbe dire "ho misurato e non va".
command -v tesseract >/dev/null 2>&1 || {
  echo "manca tesseract: senza OCR questo banco non puo' leggere niente." >&2
  echo "  macOS:  brew install tesseract" >&2
  echo "  debian: sudo apt-get install -y tesseract-ocr" >&2
  exit 3
}

FPS=30
FAIL=0

# Le parole della risposta che l'OCR regge bene: niente punteggiatura attaccata,
# niente parole di tre lettere che l'OCR pesca ovunque.
RESPONSE_WORDS="trovati punti chiamata server sposto refresh token dentro guard solo"

# Il prompt, che deve comparire prima nel campo e poi come messaggio inviato.
PROMPT_WORDS="rifai flusso auth apri"

ocr_at() {
  local frame="$1"
  local t
  t=$(python3 -c "print(f'{$frame / $FPS:.4f}')")
  ffmpeg -v error -ss "$t" -i "$SRC" -frames:v 1 -y "$WORK/f.png" 2>/dev/null
  "${IM_CONVERT[@]}" "$WORK/f.png" -colorspace Gray -normalize "$WORK/g.png"
  tesseract "$WORK/g.png" stdout --psm 6 2>/dev/null | tr '[:upper:]' '[:lower:]'
}

# Quante delle parole cercate compaiono nel testo letto.
hits() {
  local text="$1" wanted="$2" n=0
  for w in $wanted; do
    case "$text" in *"$w"*) n=$((n + 1));; esac
  done
  echo "$n"
}

echo "I quattro tempi di $(basename "$SRC")"
echo

# TEMPO 1 e 2: il campo si riempie. A 170 il prompt e' cominciato ma non
# finito, a 210 c'e' tutto: se i due conteggi coincidono, non sta digitando.
t1=$(hits "$(ocr_at 170)" "$PROMPT_WORDS")
t2=$(hits "$(ocr_at 210)" "$PROMPT_WORDS")
printf '  digita        frame 170: %s parole   frame 210: %s parole' "$t1" "$t2"
if [ "$t2" -gt "$t1" ]; then echo "   ok"; else echo "   FERMO"; FAIL=1; fi

# TEMPO 3: l'invio. Dopo il click il prompt e' ancora in quadro, ma come
# messaggio, e il campo torna al segnaposto.
sent=$(ocr_at 300)
t3=$(hits "$sent" "$PROMPT_WORDS")
printf '  invia         frame 300: %s parole del prompt in quadro' "$t3"
if [ "$t3" -ge 3 ]; then echo "   ok"; else echo "   IL MESSAGGIO NON C'E'"; FAIL=1; fi
case "$sent" in
  *"chiedi qualcosa"*) echo "                il campo e' tornato al segnaposto   ok";;
  *) echo "                il campo NON si e' svuotato   sospetto"; FAIL=1;;
esac

# TEMPO 4: lo streaming. Tre momenti, e devono crescere.
s1=$(hits "$(ocr_at 340)" "$RESPONSE_WORDS")
s2=$(hits "$(ocr_at 385)" "$RESPONSE_WORDS")
s3=$(hits "$(ocr_at 430)" "$RESPONSE_WORDS")
printf '  streaming     frame 340: %s   frame 385: %s   frame 430: %s' "$s1" "$s2" "$s3"
if [ "$s3" -gt "$s2" ] && [ "$s2" -gt "$s1" ]; then
  echo "   ok"
elif [ "$s3" -eq 0 ]; then
  echo "   LA RISPOSTA NON SI VEDE MAI"; FAIL=1
else
  echo "   NON CRESCE"; FAIL=1
fi

echo
if [ "$FAIL" -eq 0 ]; then
  echo "VERDETTO: tutti e quattro i tempi si vedono nel render."
else
  echo "VERDETTO: un tempo manca. Vedi sopra quale."
fi
exit "$FAIL"
