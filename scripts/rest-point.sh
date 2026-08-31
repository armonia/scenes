#!/usr/bin/env bash
#
# Una scena finisce ferma? E comincia ferma?
#
# E' la proprieta' su cui poggia meta' della regola "niente tagli". Due scene
# che agli estremi stanno ferme si possono mettere in qualunque ordine, perche'
# al confine non c'e' movimento da spezzare. Una che al bordo si muove ha un
# ordine obbligato, e conviene saperlo prima del montaggio invece di scoprirlo
# durante. Finora era scritta e basta: questo la misura.
#
# COME, e la distanza fra i due fotogrammi non e' un dettaglio. Con fotogrammi
# CONSECUTIVI non si misura niente: le camere qui si muovono di frazioni di
# grado al frame, e a meta' di prompt-input, dove si sta digitando, cambia lo
# 0,076% dei pixel, cioe' quasi quanto ai bordi. Con cinque frame di distanza il
# segnale si stacca dal rumore. Misurato sulle cinque scene, bordo e mezzo:
#
#   prompt-input   0,000%   0,434%
#   ui-mockup      0,041%   0,218%
#   card-handoff   0,000%   0,329%
#   card-focus     0,000%   1,019%
#   card-release   0,118%   0,952%
#
# La tolleranza al rumore di codifica e' la stessa di seam.sh, per lo stesso
# motivo: due fotogrammi sopravvivono a una codifica H.264 e non tornano
# identici al bit.
#
# IL CONTROLLO, e la prima versione lo aveva sbagliato. Contavo su CardHandoff
# come scena "che non parte ferma", perche' il suo commento dice che continua
# l'arco di UIMockup invece di ricominciarlo. E' vero della POSA e falso della
# VELOCITA': la sua camera usa Easing.inOut, che ha derivata nulla agli estremi,
# quindi anche lei parte ferma. Misurato: 0,000% come tutte le altre. Nel repo
# non c'e' nessuna scena che parta in movimento, quindi quel controllo non
# esisteva e il banco usciva 2 dicendo che non separava niente. Aveva ragione.
#
# Il controllo vero e' lo stesso di seam.sh: una coppia di fotogrammi presa dal
# MEZZO della scena, dove il movimento c'e' di sicuro. Ogni scena porta con se'
# il proprio controllo, non serve una fixture e non serve un'altra scena.
#
# CHE SAPPIA BOCCIARE si dimostra passandogli un file invece del catalogo. Un
# ritaglio preso dal mezzo di una scena parte e finisce in movimento per
# costruzione, ed e' il controllo negativo che il README pretende prima di
# fidarsi del verde:
#
#   ffmpeg -ss 2 -t 2 -i video/out/card-focus.mp4 /tmp/mosso.mp4
#   ./scripts/rest-point.sh /tmp/mosso.mp4     # esce 1
#
# Uso:  ./scripts/rest-point.sh [scena.mp4]
set -uo pipefail

. "$(dirname "${BASH_SOURCE[0]}")/_magick.sh"
export LC_NUMERIC=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Quanti frame di distanza fra i due fotogrammi confrontati.
PASSO=5
# Sopra questa frazione di pixel diversi un bordo non e' fermo. Il bordo piu'
# mosso misurato e' 0,118 (card-release), quindi c'e' margine.
FERMA=0.30
# Il mezzo deve muoversi almeno questo, altrimenti un fermo immagine passerebbe:
# tre zeri sono tre letture concordi e non provano niente. Il mezzo piu' fermo
# misurato e' 0,218 (ui-mockup).
MOTO_MIN=0.12
# E deve muoversi almeno questo PIU' dei bordi. Il rapporto piu' stretto
# misurato e' 5,3 (ui-mockup); la soglia sta sotto perche' su Linux le letture
# si spostano, come si e' visto con focus-sharpness.
SEPARA=3

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# Quanti pixel diversi fra due fotogrammi, in percentuale sul quadro.
coppia() {
  local a="$1" b="$2" tot
  tot=$("${IM_IDENTIFY[@]}" -format "%[fx:w*h]" "$a")
  local d
  d=$("${IM_COMPARE[@]}" -metric AE -fuzz 4% "$a" "$b" null: 2>&1 || true)
  # AE stampa "542.562 (0.000261652)": si tiene l'intero iniziale, e su un
  # conteggio esattamente zero la stringa e' "0 (0)", senza punti.
  d=$(echo "$d" | tr -d '[:space:]' | sed 's/[^0-9].*$//')
  case "${d:-}" in ''|*[!0-9]*) echo "confronto fallito su $(basename "$a")" >&2; exit 3 ;; esac
  python3 -c "print(f'{$d / $tot * 100:.3f}')"
}

# I primi due e gli ultimi due fotogrammi di un render.
estremi() {
  local src="$1" n m i f
  # csv=p=0 stampa "150," con la virgola in coda, e la guardia numerica sotto
  # la rifiutava. Si tengono solo le cifre.
  n=$(ffprobe -v error -count_frames -select_streams v:0 \
        -show_entries stream=nb_read_frames -of csv=p=0 "$src" | tr -dc '0-9')
  case "${n:-}" in ''|*[!0-9]*) echo "non riesco a contare i fotogrammi di $src" >&2; exit 3 ;; esac
  if [ "$n" -lt $((PASSO * 3)) ]; then
    echo "$src ha solo $n fotogrammi, troppo pochi per un passo di $PASSO" >&2; exit 3
  fi
  m=$((n / 2))

  # `-vsync 0` non esiste piu' da ffmpeg 8: e' `-fps_mode passthrough`, che c'e'
  # dalla 5 in poi e quindi vale anche sulla ffmpeg di Ubuntu in CI.
  #
  # E `-nostdin`, che non e' un dettaglio: senza, ffmpeg legge lo standard input
  # e si mangia le righe del `while read` che chiama questa funzione. In CI si
  # vedeva il suo prompt interattivo nel log. E' lo stesso motivo per cui il
  # passo delle misure gira con `< /dev/null`.
  i=0
  for f in 0 "$PASSO" $((n - 1)) $((n - 1 - PASSO)) "$m" $((m + PASSO)); do
    i=$((i + 1))
    ffmpeg -nostdin -v error -i "$src" -vf "select='eq(n\,$f)'" -fps_mode passthrough \
      -frames:v 1 -y "$TMP/f$i.png"
    [ -s "$TMP/f$i.png" ] || { echo "estrazione del fotogramma $f fallita su $src" >&2; exit 3; }
  done
  printf '%s %s %s' "$(coppia "$TMP/f1.png" "$TMP/f2.png")" \
    "$(coppia "$TMP/f3.png" "$TMP/f4.png")" "$(coppia "$TMP/f5.png" "$TMP/f6.png")"
}

echo "Quanto si muove una scena fra due fotogrammi distanti ${PASSO}, in pixel"
echo "diversi per cento. Ai bordi deve stare sotto ${FERMA}%. La colonna del"
echo "mezzo e' il controllo: li' il movimento c'e' per costruzione, e senza"
echo "quel confronto un fermo immagine darebbe tre zeri concordi e passerebbe."
echo
printf '  %-16s %10s %10s %12s\n' "scena" "inizio" "fine" "mezzo (ctrl)"

# Niente mapfile e niente array associativi: sono bash 4, e `/usr/bin/env bash`
# su macOS trova la 3.2. E' lo stesso inciampo che ha tenuto handoff-travel.sh
# fermo per mesi su questa piattaforma mentre in CI passava.
rotte=""
# Con un argomento si misura quello e basta: e' cosi' che si prova che il banco
# sa uscire rosso. Senza, si misura tutto il catalogo.
if [ "$#" -gt 0 ]; then
  [ -f "$1" ] || { echo "non trovo $1" >&2; exit 1; }
  echo "$1" > "$TMP/slugs.txt"
else
  node "$ROOT/scripts/catalog.mjs" slugs > "$TMP/slugs.txt" || {
    echo "il catalogo non ha restituito nessuna scena" >&2; exit 3; }
  [ -s "$TMP/slugs.txt" ] || { echo "il catalogo non ha restituito nessuna scena" >&2; exit 3; }
fi

while IFS= read -r slug; do
  [ -n "$slug" ] || continue
  case "$slug" in
    */*|*.mp4) src="$slug"; slug=$(basename "$slug" .mp4) ;;
    *)         src="$ROOT/video/out/$slug.mp4" ;;
  esac
  if [ ! -f "$src" ]; then
    echo "manca il render: video/out/$slug.mp4" >&2
    echo "  cd video && node ../scripts/catalog.mjs render" >&2
    exit 1
  fi
  # `estremi` gira in una sottoshell, quindi un suo exit non ferma questo
  # ciclo: il risultato va controllato qui.
  vals=$(estremi "$src") || exit 3
  set -- $vals
  ini="$1"; fin="$2"; mid="$3"
  case "$ini$fin$mid" in ''|*[!0-9.]*) echo "lettura non valida su $slug: '$vals'" >&2; exit 3 ;; esac
  printf '  %-16s %9s%% %9s%% %11s%%\n' "$slug" "$ini" "$fin" "$mid"

  # PRIMA il verdetto sui bordi. La versione precedente controllava per prima
  # la separazione, e su un ritaglio che si muove ovunque usciva 2 dicendo "non
  # so" invece di 1 dicendo "non e' ferma": la risposta giusta c'era e la
  # buttava via. La separazione serve a intercettare un fermo immagine, che e'
  # un caso diverso.
  if ! python3 -c "exit(0 if $ini <= $FERMA and $fin <= $FERMA else 1)"; then
    rotte="$rotte $slug($ini%,$fin%)"
    continue
  fi

  # Bordi fermi: adesso serve sapere che lo strumento risponde. Se anche il
  # mezzo e' fermo, le tre letture concordi non provano niente e potrebbero
  # venire da un fermo immagine.
  if ! python3 -c "exit(0 if $mid >= $MOTO_MIN and $mid >= max($ini,$fin,0.001) * $SEPARA else 1)"; then
    echo >&2
    echo "MISURA INUTILE su $slug: i bordi sono fermi ma anche il mezzo ($mid%)," >&2
    echo "quindi le tre letture concordano e non distinguono una scena ferma agli" >&2
    echo "estremi da un fermo immagine. Nessun verdetto." >&2
    exit 2
  fi
done < "$TMP/slugs.txt"
echo

if [ -n "$rotte" ]; then
  echo "FALLITO: queste scene non sono ferme su tutti e due i bordi:$rotte" >&2
  echo "Una scena che al confine si muove ha un ordine obbligato nel montaggio," >&2
  echo "e la giunta con quella dopo va guardata di conseguenza. Non e' un difetto" >&2
  echo "in se': va saputo prima, non scoperto in montaggio." >&2
  exit 1
fi

echo "VERDETTO: tutte le scene del catalogo sono ferme su tutti e due i bordi,"
echo "e in ognuna il mezzo si muove almeno ${SEPARA} volte tanto. Si possono mettere"
echo "in qualunque ordine senza che una giunta spezzi un movimento."
exit 0
