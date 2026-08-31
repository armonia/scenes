#!/usr/bin/env bash
#
# C'e' davvero una pausa prima dell'invio, o e' solo nel copione?
#
# `PromptInput` promette una battuta d'arresto fra l'ultimo tasto e la partenza
# verso il pulsante: `T.pauseAfterTyping = 24`. Il commento nel sorgente dice
# perche' esiste, che senza "l'invio parte insieme all'ultimo tasto e legge come
# uno script che esegue, non come qualcuno che rilegge". E' una delle voci del
# catalogo il cui banco era una frase in prosa. Questo la misura.
#
# COME. Si scorre il render fotogramma per fotogramma dentro una finestra e si
# conta quanto cambia da uno al successivo. Digitare cambia pixel, spostare il
# cursore cambia pixel, aspettare no. La pausa e' la corsa piu' lunga di
# fotogrammi consecutivi sotto la soglia di quiete.
#
# IL CONTROLLO, e qui e' la finestra accanto. Se anche durante la battitura
# esistesse una corsa ferma lunga uguale, questo indice non starebbe misurando
# l'attesa ma il rumore: la pausa si vede solo perche' intorno c'e' movimento.
# Lo script confronta le due e, se non si separano, esce 2 senza dare verdetti.
#
# LENTO DI PROPOSITO. Confronta un centinaio di coppie di fotogrammi, che con
# ImageMagick sono una ventina di secondi. Non gira su tutte le scene: gira su
# quella che fa questa promessa.
#
# QUANTO DURA DAVVERO. La pausa dichiarata e' 24 frame, la corsa ferma misurata
# e' 16. Non e' un errore: durante l'attesa il caret continua a lampeggiare ogni
# 15 frame, e ogni accensione e' un fotogramma che cambia, quindi spezza la
# corsa. Il banco misura il fermo VISIBILE, che e' quello che conta per l'occhio,
# non il valore scritto nella costante.
#
# CHE SAPPIA BOCCIARE si dimostra spostando la finestra sulla battitura, dove una
# pausa lunga non c'e':
#
#   ./scripts/hesitation.sh video/out/prompt-input.mp4 95 215   # esce 1
#
# Uso:  ./scripts/hesitation.sh [scena.mp4] [da] [a]
set -uo pipefail

. "$(dirname "${BASH_SOURCE[0]}")/_magick.sh"
export LC_NUMERIC=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-$ROOT/video/out/prompt-input.mp4}"

# La finestra in cui cercare, sovrascrivibile dagli argomenti. I numeri di
# default vengono da T in PromptInput.tsx, dove typeStart e' 88 e il testo
# finisce poco prima di 200; l'invio cade attorno a 250.
DA="${2:-150}"
A="${3:-270}"
# QUANTO E' "FERMO" NON SI PUO' SCRIVERE QUI, e averci provato ha fatto uscire
# rossa la CI. Con una soglia assoluta tarata su macOS (0,02%) su Linux non
# passava un fotogramma: lo stesso render, letto da ImageMagick 6 invece che 7,
# ha un fondo piu' alto. rest-point.sh sullo stesso video legge 0,000% qui e
# 0,016% li', e a meta' scena 0,434% contro 3,201%. Le due scale non sono
# confrontabili, i rapporti si'.
#
# Quindi la soglia si ricava dalla finestra stessa, e va messa FRA i due gruppi:
# media geometrica fra decimo e cinquantesimo percentile. Una frazione fissa
# della mediana non basta, l'ho provata e mancava il bersaglio dall'altra parte.
# La pausa dichiarata e' 24 frame. Sotto i dieci non si sente, e sotto questa
# soglia il banco boccia.
MINIMO=10
# La corsa ferma nella pausa deve essere almeno questo piu' lunga della piu'
# lunga trovata durante la battitura, altrimenti l'indice non separa.
SEPARA=3

[ -f "$SRC" ] || { echo "manca il render: ${SRC#"$ROOT"/}" >&2; exit 1; }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# I fotogrammi della finestra, estratti in un colpo solo: aprire il file una
# volta per fotogramma costerebbe piu' del confronto.
ffmpeg -v error -i "$SRC" -vf "select='between(n\,$DA\,$A)'" \
  -fps_mode passthrough -y "$TMP/f%04d.png"
[ -s "$TMP/f0001.png" ] || { echo "estrazione della finestra fallita" >&2; exit 3; }

# `%[fx:w*h]` torna in notazione scientifica su un quadro da due milioni di
# pixel, e una guardia che vuole solo cifre la rifiuta. Larghezza e altezza
# separate, e il prodotto lo fa la shell.
DIM=$("${IM_IDENTIFY[@]}" -format "%w %h" "$TMP/f0001.png")
set -- $DIM
case "${1:-}${2:-}" in ''|*[!0-9]*) echo "non riesco a leggere le dimensioni: '$DIM'" >&2; exit 3 ;; esac
TOT=$(( $1 * $2 ))

# Le differenze fra fotogrammi consecutivi, una per riga, in percentuale.
: > "$TMP/diff.txt"
prev=""
for f in "$TMP"/f*.png; do
  if [ -n "$prev" ]; then
    d=$("${IM_COMPARE[@]}" -metric AE -fuzz 4% "$prev" "$f" null: 2>&1 || true)
    d=$(echo "$d" | tr -d '[:space:]' | sed 's/[^0-9].*$//')
    case "${d:-}" in ''|*[!0-9]*) echo "confronto fallito su $(basename "$f")" >&2; exit 3 ;; esac
    python3 -c "print(f'{$d / $TOT * 100:.4f}')" >> "$TMP/diff.txt"
  fi
  prev="$f"
done
righe=$(grep -c '' "$TMP/diff.txt")
[ "$righe" -gt 40 ] || { echo "troppo poche letture ($righe): finestra sbagliata?" >&2; exit 3; }

# La corsa ferma piu' lunga, e dove comincia. Il taglio fra "battitura" e
# "attesa" e' l'ultimo fotogramma in cui si e' scritto qualcosa, cioe' l'ultima
# riga sopra soglia prima della corsa lunga: si trovano tutte le corse e si
# guarda la piu' lunga e la seconda.
# La sostituzione di comando `$(...)` regge un heredoc; la sostituzione di
# processo `< <(...)` no, in bash 3.2. E' lo stesso inciampo di
# handoff-travel.sh, e ci sono ricascato scrivendo questo file.
RES=$(python3 - "$TMP/diff.txt" "$DA" <<'PYEND'
import sys
vals = [float(x) for x in open(sys.argv[1])]
base = int(sys.argv[2])
srt = sorted(vals); n = len(srt)
def pc(p): return srt[min(n - 1, int(n * p / 100))] if n else 0.0
# La soglia sta FRA i due gruppi, non a una frazione fissa di uno dei due.
# Misurato su prompt-input: la pausa sta a 0,02%, la battitura a 0,04-0,08%, e
# il fondo non e' mai zero (0,0149%). Il decimo percentile cade nel gruppo
# fermo, il cinquantesimo in quello che si muove: la loro media geometrica cade
# in mezzo, e ci cade anche quando l'intera scala si sposta, come succede su
# Linux dove le stesse letture sono circa sette volte piu' alte.
q = (pc(10) * pc(50)) ** 0.5
runs, start = [], None
for i, v in enumerate(vals):
    if v <= q:
        if start is None: start = i
    else:
        if start is not None: runs.append((i - start, start)); start = None
if start is not None: runs.append((len(vals) - start, start))
runs.sort(reverse=True)
best = runs[0] if runs else (0, 0)
second = runs[1][0] if len(runs) > 1 else 0
print(best[0], base + best[1], second, f"{q:.4f}", f"{pc(50):.4f}")
PYEND
)
set -- $RES
LUNGA="${1:-}"; INIZIO="${2:-}"; SECONDA="${3:-}"; SOGLIA="${4:-}"; MEDIANA="${5:-}"
case "${LUNGA:-}" in ''|*[!0-9]*) echo "analisi delle corse fallita" >&2; exit 3 ;; esac

echo "Pausa prima dell'invio, misurata su $(basename "$SRC")."
echo "Finestra dal fotogramma $DA al $A. Mediana ${MEDIANA}%, soglia del fermo"
echo "${SOGLIA}%: esce dai percentili della finestra, non e' scritta nello script."
echo
printf '  %-38s %s\n' "corsa ferma piu' lunga" "$LUNGA frame, da f$INIZIO"
printf '  %-38s %s\n' "seconda corsa ferma (controllo)" "$SECONDA frame"
echo

# PRIMA il verdetto, poi la validita' della misura. La versione precedente
# controllava per prima la separazione, e sulla finestra della battitura usciva
# 2 ("non so") invece di 1 ("non c'e' pausa"): la risposta giusta c'era e la
# buttava via. E' lo stesso inciampo di rest-point.sh, fatto due volte.
if ! python3 -c "exit(0 if $LUNGA >= $MINIMO else 1)"; then
  echo "FALLITO: la corsa ferma piu' lunga e' di $LUNGA frame, sotto il minimo di $MINIMO." >&2
  echo "Senza quella battuta l'invio parte insieme all'ultimo tasto e legge come" >&2
  echo "uno script che esegue. Il valore sta in T.pauseAfterTyping." >&2
  exit 1
fi

# Una pausa che copre quasi tutta la finestra non e' una pausa, e' un fermo
# immagine: senza movimento intorno, non c'e' niente da cui staccarsi.
if ! python3 -c "exit(0 if $LUNGA < $righe * 0.8 else 1)"; then
  echo "MISURA INUTILE: il fermo copre $LUNGA dei $righe fotogrammi della finestra." >&2
  echo "Non e' una pausa dentro una scena che si muove, e' una scena che sta ferma." >&2
  exit 2
fi

# E deve staccarsi dal fondo: se la seconda corsa ferma e' lunga quasi uguale,
# il fermo e' ovunque e questa non e' una battuta d'arresto.
if ! python3 -c "exit(0 if $LUNGA >= max($SECONDA * $SEPARA, 1) else 1)"; then
  echo "MISURA INUTILE: la corsa piu' lunga ($LUNGA) non si separa dalla seconda" >&2
  echo "($SECONDA). Dentro questa finestra il fermo e' ovunque, quindi non e' una" >&2
  echo "pausa: e' il fondo. Nessun verdetto." >&2
  exit 2
fi

echo "VERDETTO: c'e' una pausa di $LUNGA frame prima dell'invio, e intorno si"
echo "muove: la corsa ferma successiva e' lunga $SECONDA. L'attesa e' nel render,"
echo "non solo nel copione."
exit 0
