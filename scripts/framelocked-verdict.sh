#!/usr/bin/env bash
#
# Il verdetto su FrameLocked, che il documento di ripresa lasciava aperto.
#
# Il §8 sosteneva che senza `gsap.ticker.remove(gsap.updateRoot)` in headless
# GSAP continua ad avanzare per conto suo e i frame ballano. Era una previsione,
# non una misura: quel wrapper non era mai passato per un render.
#
# La prova e' binaria e non chiede pareri. Si renderizza lo STESSO frame in due
# invocazioni separate, cioe' a distanza di secondi di orologio a muro, e si
# confrontano gli hash dei PNG. Se il render e' una funzione pura del frame gli
# hash coincidono. Se qualcosa avanza da solo fra il seek e lo scatto, no.
#
# Due invocazioni separate e non due frame nella stessa: e' il tempo di
# orologio che passa fra l'una e l'altra a far emergere la deriva. Dentro un
# singolo render i frame si susseguono troppo in fretta perche' si veda.
#
# Uso:  ./scripts/framelocked-verdict.sh
set -uo pipefail

cd "$(dirname "$0")/../video" || exit 1

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

FRAMES=(30 61 92)
FAIL=0

probe() {
  local comp="$1" label="$2"
  echo ""
  echo "### $label  ($comp)"

  local hashes=""

  for f in "${FRAMES[@]}"; do
    for pass in a b; do
      npx remotion still "$comp" "$TMP/$comp-$f-$pass.png" \
        --frame="$f" --image-format=png --log=error >/dev/null 2>&1
    done

    local ha hb
    ha=$(shasum -a 256 "$TMP/$comp-$f-a.png" 2>/dev/null | cut -c1-12)
    hb=$(shasum -a 256 "$TMP/$comp-$f-b.png" 2>/dev/null | cut -c1-12)

    if [ -z "$ha" ] || [ -z "$hb" ]; then
      echo "  frame $f: RENDER FALLITO"
      FAIL=1
    elif [ "$ha" = "$hb" ]; then
      echo "  frame $f: ripetibile   $ha"
    else
      echo "  frame $f: DIVERGE      $ha vs $hb"
      FAIL=1
    fi

    hashes="$hashes $ha"
  done

  # LA META' DEL TEST CHE MANCAVA, e senza la quale il verdetto mente.
  #
  # Confrontare due passate dello stesso frame dice solo che il render e'
  # ripetibile. Una timeline ferma e' ripetibilissima: al primo giro il §8
  # passava con tre hash uguali su tre, e passava perche' non si muoveva
  # niente. Un test che una scena rotta supera non e' un test.
  #
  # Quindi si controlla anche il contrario: frame diversi devono dare immagini
  # diverse. Se coincidono, la timeline non sta seguendo il clock.
  local distinti
  distinti=$(echo "$hashes" | tr ' ' '\n' | sed '/^$/d' | sort -u | wc -l | tr -d ' ')

  if [ "$distinti" -eq "${#FRAMES[@]}" ]; then
    echo "  la timeline avanza: ${#FRAMES[@]} frame, $distinti immagini distinte"
  else
    echo "  TIMELINE FERMA: ${#FRAMES[@]} frame ma solo $distinti immagini distinte"
    FAIL=1
  fi
}

echo "FrameLocked: lo stesso frame renderizzato due volte, in due invocazioni."

probe FrameLockedProbe "ticker STACCATO (come dice il §8)"
probe FrameLockedProbeAttached "ticker ATTACCATO (il ramo che il §8 diceva rotto)"

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "VERDETTO: nessuna divergenza in nessuno dei due rami."
else
  echo "VERDETTO: almeno un frame diverge. Vedi sopra quale ramo."
fi
