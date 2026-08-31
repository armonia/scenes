#!/usr/bin/env bash
#
# Fra il clic e la sua conseguenza passa qualche frame, o succedono insieme?
#
# E' la promessa di CUR-03. Due o tre frame di scarto bastano perche' il gesto
# sembri causare qualcosa; sullo stesso fotogramma il clic legge come finto,
# perche' nella vita nessuna interfaccia risponde prima di aver ricevuto.
# Metterli insieme e' anche piu' corto da scrivere, quindi e' l'errore che si fa
# per distrazione ed e' esattamente per questo che serve un banco.
#
# COME, e senza farsi dire la risposta. Lo script non legge i tempi dal
# sorgente: li ritrova nel render. Conta, frame per frame, quanti pixel
# cambiano rispetto al precedente, e nella finestra cerca due cose in fila:
#
#   1. IL COLPO. Il fotogramma in cui il conteggio esplode rispetto alla mediana
#      della finestra. Quando il messaggio parte, il composer si svuota e il
#      testo se ne va: sono decine di migliaia di pixel contro qualche migliaio.
#      Si prende il PRIMO che sfonda, non il piu' grande: piu' avanti ce n'e' un
#      altro altrettanto violento, ed e' l'indicatore di attesa che compare.
#   2. LA CONSEGUENZA. Dopo il colpo il quadro si calma; la conseguenza e' il
#      primo fotogramma in cui il conteggio risale sopra la quiete che lo
#      precede. Non e' un'esplosione, e' una bolla che scorre dentro.
#
# TUTTE SOGLIE RELATIVE, e non e' pignoleria: le letture di ImageMagick su Linux
# valgono cinque-dieci volte quelle di macOS sugli stessi render, e un numero
# assoluto tarato da una parte fallisce dall'altra. Qui si confrontano solo
# conteggi della stessa finestra fra loro.
#
# CHE SAPPIA BOCCIARE si dimostra in due modi. Puntato su una scena che quella
# promessa non la fa (ui-mockup, card-handoff, card-focus, card-release) non
# trova nessun colpo ed esce 1. E su un ritaglio in cui i fotogrammi fra colpo e
# conseguenza sono stati tolti, cioe' i due eventi fusi in uno, esce 1 lo stesso.
#
# Su quel secondo caso va detto com'e' andata davvero, perche' la diagnosi non e'
# quella che mi aspettavo: non riporta scarto zero, riporta uno scarto fuori
# intervallo. Fusi i due eventi, la "quiete" contro cui misura la risalita non e'
# piu' il quadro calmo, e' l'animazione della bolla gia' in corso, quindi la
# risalita successiva la trova piu' avanti. Boccia il difetto giusto per una
# strada diversa, e chi legge il verde deve saperlo.
#
# Uso:  ./scripts/click-gap.sh [scena.mp4]
set -uo pipefail

. "$(dirname "${BASH_SOURCE[0]}")/_magick.sh"
export LC_NUMERIC=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-$ROOT/video/out/prompt-input.mp4}"

# Quante volte la base della finestra deve superare il conteggio perche' sia
# "il colpo". La base e' il novantesimo percentile, non la mediana: vedi sotto.
COLPO=5
# Quante volte la quiete dopo il colpo deve superare il conteggio perche' sia
# "la conseguenza". Misurato su prompt-input: 1,9.
RISALITA=1.4
# Lo scarto ammesso, in frame. Sotto 1 il nesso sparisce, sopra 8 diventa
# lentezza del software invece che risposta.
MIN=1
MAX=8

[ -f "$SRC" ] || { echo "manca il render: $SRC" >&2; exit 1; }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

N=$(ffprobe -v error -count_frames -select_streams v:0 \
      -show_entries stream=nb_read_frames -of csv=p=0 "$SRC" | tr -dc '0-9')
case "${N:-}" in ''|*[!0-9]*) echo "non riesco a contare i fotogrammi di $SRC" >&2; exit 3 ;; esac

# La meta' centrale del render: il clic non sta ne' nei primi frame ne' negli
# ultimi, e restringere tiene bassa la mediana su cui si misura il colpo.
DA=$((N * 40 / 100)); A=$((N * 85 / 100))
ffmpeg -nostdin -v error -i "$SRC" -vf "select='between(n\,$DA\,$A)'" \
  -fps_mode passthrough -y "$TMP/p%04d.png"
ls "$TMP"/p*.png >/dev/null 2>&1 || { echo "estrazione fallita su $SRC" >&2; exit 3; }

prev=""; : > "$TMP/n.txt"
for f in "$TMP"/p*.png; do
  if [ -n "$prev" ]; then
    "${IM_CONVERT[@]}" "$prev" "$f" -compose difference -composite \
      -colorspace Gray -threshold 8% -format '%[fx:mean*w*h]' info: >> "$TMP/n.txt"
    echo >> "$TMP/n.txt"
  fi
  prev="$f"
done

RES=$(python3 - "$TMP/n.txt" "$DA" "$COLPO" "$RISALITA" <<'PYEND'
import sys
vals = [float(x) for x in open(sys.argv[1]) if x.strip()]
base, colpo, risalita = int(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
if len(vals) < 20:
    print("0 0 0 0 0"); raise SystemExit
srt = sorted(vals)
# LA BASE NON PUO' ESSERE LA MEDIANA, e questo l'ha insegnato un falso positivo.
# Quando la camera sta ferma durante la recita - che e' come va girata, perche'
# non si muove la macchina mentre qualcuno scrive - meta' dei fotogrammi non
# cambia NIENTE. La mediana e' zero, "cinque volte la mediana" diventa "piu' di
# zero", e il primo carattere battuto sfonda la soglia: il banco riportava con
# sicurezza un clic a f181 mentre quello vero stava a f271. Un banco che sbaglia
# in silenzio e' peggio di uno che fallisce.
#
# La base e' il novantesimo percentile della finestra. Resta un rapporto interno
# alla finestra, come tutte le soglie qui, ma non degenera su una scena immobile.
mediana = srt[len(srt) // 2]
base_px = srt[int(len(srt) * 0.90)]
if base_px <= 0:
    # Finestra senza movimento: non c'e' niente contro cui misurare un colpo, e
    # dichiararne uno vorrebbe dire inventarlo.
    print(f"0 0 0 {mediana:.0f} 0"); raise SystemExit
# Il colpo: il primo che sfonda, non il piu' grande. Piu' avanti ce n'e' un
# altro altrettanto violento ed e' un evento diverso.
hit = next((i for i, v in enumerate(vals) if v >= base_px * colpo), -1)
if hit < 0 or hit + 5 >= len(vals):
    print(f"0 0 0 {mediana:.0f} 0"); raise SystemExit
# La quiete subito dopo il colpo, e il primo fotogramma che ci risale sopra.
quiete = sorted(vals[hit + 1:hit + 4])[1]
cons = next((i for i in range(hit + 2, min(hit + 20, len(vals)))
             if vals[i] >= quiete * risalita), -1)
gap = (cons - hit) if cons > 0 else 0
print(hit + base + 1, (cons + base + 1) if cons > 0 else 0, gap,
      f"{mediana:.0f}", f"{quiete:.0f}")
PYEND
)
set -- $RES
COLPO_F="$1"; CONS_F="$2"; GAP="$3"; MEDIANA="$4"; QUIETE="$5"

echo "Scarto fra il clic e la sua conseguenza, misurato su $(basename "$SRC")."
echo "Finestra dal fotogramma $DA al $A. Mediana dei pixel cambiati: ${MEDIANA}."
echo "Le soglie sono rapporti dentro questa finestra, non numeri assoluti."
echo
printf '  %-34s %s\n' "il colpo (>= ${COLPO}x il p90)" "${COLPO_F:-nessuno}"
printf '  %-34s %s\n' "la conseguenza (>= ${RISALITA}x la quiete)" "${CONS_F:-nessuna}"
printf '  %-34s %s\n' "quiete fra i due" "${QUIETE} pixel"
printf '  %-34s %s frame\n' "scarto" "$GAP"
echo

if [ "$COLPO_F" = 0 ] || [ "$CONS_F" = 0 ]; then
  echo "FALLITO: non trovo la coppia colpo/conseguenza in questa scena." >&2
  echo "O il clic non c'e', oppure la conseguenza parte insieme al colpo e i due" >&2
  echo "eventi si sono fusi in un fotogramma solo, che e' il difetto cercato." >&2
  exit 1
fi

if ! python3 -c "exit(0 if $MIN <= $GAP <= $MAX else 1)"; then
  echo "FALLITO: lo scarto e' di $GAP frame, fuori dall'intervallo $MIN-$MAX." >&2
  echo "Sotto il minimo il nesso fra gesto e risposta sparisce; sopra il massimo" >&2
  echo "non legge come una conseguenza, legge come software lento." >&2
  exit 1
fi

echo "VERDETTO: il colpo cade a f${COLPO_F} e la conseguenza a f${CONS_F}, ${GAP} frame"
echo "dopo. La UI risponde al clic invece di rispondere insieme al clic."
exit 0
