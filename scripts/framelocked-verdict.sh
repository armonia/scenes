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
# IL VERDETTO NON USCIVA. Fino a settembre 2026 lo script stampava "almeno un
# frame diverge" e usciva 0 lo stesso: in CI una divergenza vera si sarebbe letta
# nel log e sarebbe passata col verde, e nessuno legge un log verde. Adesso esce
# 1, e la CI lo prova sulla sonda FrameLockedProbeRandom, che ha un Math.random
# dentro e deve essere bocciata.
#
# IL PROGETTO SI IMPACCHETTA UNA VOLTA. Ogni `remotion still` rifaceva il bundle
# da capo, e il bundle era meta' del tempo del banco. Le due passate restano due
# processi separati, che e' quello che conta: e' il tempo di orologio fra l'uno
# e l'altro a far emergere una deriva, non il bundle.
#
# Uso:
#   ./scripts/framelocked-verdict.sh                  i due rami della sonda GSAP
#   ./scripts/framelocked-verdict.sh PromptInput      una o piu' composition
#   FRAMES="150 175 200" ./scripts/framelocked-verdict.sh PromptInput
#   PROGETTO=../films ./scripts/framelocked-verdict.sh CifraFilm
#
# PROGETTO e' il progetto Remotion da impacchettare, di default video/ di questo
# repo: un altro repository che usa il kit ci passa il suo.
#
# Esce 0 se ogni frame e' ripetibile e la timeline avanza, 1 se un frame
# diverge o la timeline e' ferma, 3 se un render non e' uscito: in quel caso lo
# strumento non ha misurato niente e un verdetto sulla scena sarebbe inventato.
set -uo pipefail

cd "${PROGETTO:-$(dirname "$0")/../video}" || exit 1

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# I frame si possono scegliere dall'ambiente perche' il momento che conta non e'
# lo stesso in ogni composition: in PromptInput la digitazione, cioe' il posto
# dove un caso non seminato si vedrebbe, parte al frame 132.
# shellcheck disable=SC2206
FRAMES=(${FRAMES:-30 61 92})
FAIL=0
NOMEASURE=0

if ! npx remotion bundle --out-dir "$TMP/bundle" --log=error >/dev/null 2>&1 < /dev/null; then
  echo "VERDETTO: nessuno. Il bundle del progetto non e' uscito."
  exit 3
fi

probe() {
  local comp="$1" label="$2"
  echo ""
  echo "### $label  ($comp)"

  local hashes=""

  for f in "${FRAMES[@]}"; do
    for pass in a b; do
      npx remotion still "$TMP/bundle" "$comp" "$TMP/$comp-$f-$pass.png" \
        --frame="$f" --image-format=png --log=error >/dev/null 2>&1 < /dev/null
    done

    local ha hb
    ha=$(shasum -a 256 "$TMP/$comp-$f-a.png" 2>/dev/null | cut -c1-12)
    hb=$(shasum -a 256 "$TMP/$comp-$f-b.png" 2>/dev/null | cut -c1-12)

    if [ -z "$ha" ] || [ -z "$hb" ]; then
      echo "  frame $f: RENDER FALLITO"
      NOMEASURE=1
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

echo "Lo stesso frame renderizzato due volte, in due invocazioni. Frame: ${FRAMES[*]}"

if [ "$#" -eq 0 ]; then
  probe FrameLockedProbe "ticker STACCATO (come dice il §8)"
  probe FrameLockedProbeAttached "ticker ATTACCATO (il ramo che il §8 diceva rotto)"
else
  for comp in "$@"; do
    probe "$comp" "$comp"
  done
fi

echo ""
if [ "$NOMEASURE" -eq 1 ]; then
  echo "VERDETTO: nessuno. Almeno un render non e' uscito, quindi non ho misurato."
  exit 3
fi
if [ "$FAIL" -eq 1 ]; then
  echo "VERDETTO: almeno un frame diverge, o la timeline e' ferma. Vedi sopra dove."
  exit 1
fi
echo "VERDETTO: ogni frame e' ripetibile e la timeline avanza."
exit 0
