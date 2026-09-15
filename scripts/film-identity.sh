#!/usr/bin/env bash
#
# Un fotogramma del film e' lo stesso fotogramma della scena presa da sola?
#
# PERCHE' ESISTE. I film di prodotto non sono clip agganciate: sono le stesse
# scene messe una dopo l'altra dentro una composition sola, ognuna nella sua
# finestra (kit/film.ts, kit/SceneWindow.tsx). La finestra funziona solo se
# dentro di lei la scena vede il proprio tempo: frame da zero, durata della
# finestra e non del film. Se una sola di queste due cose sbaglia, la scena nel
# film parte spostata o gira a un'altra velocita', e nessuno dei banchi sulle
# clip se ne accorge, perche' le clip sono giuste.
#
# COME. Per ogni finestra, il primo, quello di mezzo e l'ultimo fotogramma: dalla
# scena da sola al frame f, dal film al frame start+f. Due PNG di `remotion
# still` con lo stesso sha256 sono lo stesso fotogramma (framelocked-verdict.sh
# prova che il PNG e' ripetibile). Il progetto si impacchetta una volta, e ogni
# fotogramma costa un secondo invece di un bundle.
#
# IL CONTROLLO DELLO STRUMENTO. Il primo fotogramma del film si rende due volte:
# se i due hash non coincidono lo strumento non e' ripetibile, e l'uscita e' 2.
#
# IL NEGATIVO. `--offset 1` confronta la scena al frame f col film al frame
# start+f+1, cioe' una finestra che parte con un fotogramma di ritardo. Con
# `--must-fail` il banco esce 0 solo se ogni finestra ha almeno un fotogramma
# diverso: un banco che non vede un frame di scarto non vede nemmeno il difetto.
# Il negativo guarda un fotogramma solo per finestra (`--veloce`), quello in cui
# la camera della scena si muove di piu', che il manifest calcola dalla traccia.
# I primi tentativi hanno scelto a occhio e hanno sbagliato due volte: l'ultimo
# fotogramma di CardFocus e CardRelease e' fermo, quello di mezzo di PromptInput
# cade fra due parole dello streaming, e in 4:5 anche il primo di PromptInput e'
# uguale al secondo, perche' la camera parte da ferma. Dove la camera corre, un
# frame di scarto cambia per forza l'immagine.
#
# Le finestre e gli id non sono scritti qui: li stampa `scripts/manifest.mjs film`.
#
# Uso:  ./scripts/film-identity.sh [--ratio 16x9|9x16|4x5] [--offset N] [--must-fail] [--veloce]
#
# Esce 0 se ogni fotogramma coincide (con --must-fail: se ogni finestra ne ha
# uno diverso), 1 altrimenti, 2 se lo strumento non e' ripetibile, 3 se un
# render o il manifest non rispondono.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RATIO=16x9
OFFSET=0
MUST_FAIL=0
VELOCE=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --veloce) VELOCE=1; shift ;;
    --ratio) RATIO="$2"; shift 2 ;;
    --offset) OFFSET="$2"; shift 2 ;;
    --must-fail) MUST_FAIL=1; shift ;;
    *) echo "argomento sconosciuto: $1" >&2; exit 3 ;;
  esac
done

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

node "$ROOT/scripts/manifest.mjs" film --ratio "$RATIO" > "$TMP/film.json" 2>"$TMP/manifest.err" || {
  echo "il manifest non risponde:" >&2; cat "$TMP/manifest.err" >&2; exit 3; }

# Una riga per finestra: id start frames.
python3 -c "
import json,sys
d=json.load(open(sys.argv[1]))
print(d['film'])
for w in d['windows']: print(w['id'], w['start'], w['frames'], w['moving'])
" "$TMP/film.json" > "$TMP/windows.txt" || { echo "manifest illeggibile" >&2; exit 3; }
FILM=$(head -n 1 "$TMP/windows.txt")
[ -n "$FILM" ] || { echo "il manifest non nomina il film" >&2; exit 3; }
[ "$(wc -l < "$TMP/windows.txt")" -gt 1 ] || { echo "il film non ha finestre" >&2; exit 3; }
TOTAL=$(tail -n 1 "$TMP/windows.txt" | awk '{print $2 + $3}')

(cd "$ROOT/video" && npx remotion bundle --out-dir "$TMP/bundle" --log=error >/dev/null 2>&1 < /dev/null) \
  || { echo "bundle fallito" >&2; exit 3; }

still() { # composition frame file
  (cd "$ROOT/video" && npx remotion still "$TMP/bundle" "$1" "$3" --frame="$2" --image-format=png --log=error \
    >/dev/null 2>&1 < /dev/null) && [ -s "$3" ]
}
hash() { shasum -a 256 "$1" | cut -c1-16; }

still "$FILM" 0 "$TMP/rep-a.png" && still "$FILM" 0 "$TMP/rep-b.png" \
  || { echo "render del film fallito" >&2; exit 3; }
if [ "$(hash "$TMP/rep-a.png")" != "$(hash "$TMP/rep-b.png")" ]; then
  echo "lo stesso fotogramma del film reso due volte cambia: strumento non ripetibile" >&2
  exit 2
fi

echo "Il film $FILM contro le scene da sole$([ "$OFFSET" != 0 ] && echo ", finestre spostate di $OFFSET")."
DIFF=0
WINDOWS_WITH_DIFF=0
WINDOWS=0
while read -r id start frames moving; do
  WINDOWS=$((WINDOWS + 1))
  line="  $(printf '%-18s' "$id") da f$start"
  here=0
  scelti="0 $((frames / 2)) $((frames - 1))"
  [ "$VELOCE" = 1 ] && scelti="$moving"
  for f in $scelti; do
    ff=$((start + f + OFFSET))
    # Con lo spostamento l'ultimo fotogramma dell'ultima finestra cade fuori dal
    # film: non c'e' niente da confrontare, e non e' un render fallito.
    if [ "$ff" -lt 0 ] || [ "$ff" -ge "$TOTAL" ]; then
      line="$line  f$f fuori"
      continue
    fi
    still "$id" "$f" "$TMP/s-$id-$f.png" || { echo "$line f$f: RENDER FALLITO"; exit 3; }
    still "$FILM" "$ff" "$TMP/f-$id-$f.png" || { echo "$line film f$ff: RENDER FALLITO"; exit 3; }
    if [ "$(hash "$TMP/s-$id-$f.png")" = "$(hash "$TMP/f-$id-$f.png")" ]; then
      line="$line  f$f="
    else
      line="$line  f$f≠"
      DIFF=$((DIFF + 1))
      here=1
    fi
  done
  WINDOWS_WITH_DIFF=$((WINDOWS_WITH_DIFF + here))
  echo "$line"
done < <(tail -n +2 "$TMP/windows.txt")

echo
if [ "$MUST_FAIL" = 1 ]; then
  if [ "$WINDOWS_WITH_DIFF" = "$WINDOWS" ]; then
    echo "VERDETTO: con le finestre spostate di $OFFSET ognuna delle $WINDOWS scene ha fotogrammi diversi, come deve."
    exit 0
  fi
  echo "VERDETTO: il banco PROMUOVE $((WINDOWS - WINDOWS_WITH_DIFF)) finestre spostate di $OFFSET."
  exit 1
fi
if [ "$DIFF" -gt 0 ]; then
  echo "VERDETTO: $DIFF fotogrammi del film non sono quelli delle scene."
  exit 1
fi
echo "VERDETTO: in tutte le $WINDOWS finestre il film mostra gli stessi fotogrammi delle scene da sole."
exit 0
