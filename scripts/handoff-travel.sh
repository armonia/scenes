#!/usr/bin/env bash
#
# La card cambia davvero colonna, o si limita a tremare?
#
# PERCHE' ESISTE. `seam.sh` prova che la giunta non ha tagli, e `fill-measure`
# che il quadro e' pieno: nessuno dei due guarda il gesto. Una scena in cui la
# card resta ferma li supererebbe entrambi a pieni voti, perche' un fermo
# immagine ha la giunta perfetta e i bordi vivi. Il contenuto della scena e'
# tutto qui: un oggetto parte da una colonna e arriva in un'altra.
#
# COME. Si isola il rettangolo della card in viaggio con una differenza fra
# fotogrammi, e si segue il centroide dei pixel che cambiano. La misura non e'
# "si e' mosso": e' che la componente ORIZZONTALE del movimento sia
# monotona e copra la distanza fra due colonne. Un tremolio si muove e non
# arriva; un dissolvenza cambia pixel ovunque e non ha un centroide che
# viaggia.
#
# COSA LO FA FALLIRE, che e' cio' che rende un banco un banco:
#   - card ferma            -> nessun pixel cambia, zero campioni utili
#   - card che torna indietro -> la x non e' monotona
#   - taglio secco fra due stati -> un solo campione con movimento, non un arco
#   - card che parte e non arriva -> distanza sotto la larghezza di colonna
#
# Uso:  ./scripts/handoff-travel.sh [video.mp4]
set -uo pipefail

# ImageMagick si chiama `magick` sulla 7 e `convert`/`compare` sulla 6.
. "$(dirname "${BASH_SOURCE[0]}")/_magick.sh"
export LC_NUMERIC=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-$ROOT/video/out/card-handoff.mp4}"

[ -f "$SRC" ] || { echo "manca: $SRC" >&2; exit 1; }

WORK="$ROOT/out/.travel"
rm -rf "$WORK"; mkdir -p "$WORK"
trap 'rm -rf "$WORK"' EXIT

# La finestra del viaggio: TRAVEL_START 38 e TRAVEL_END 118 a 30fps.
# Si campiona dentro, non ai bordi, per non prendere il sollevamento.
SAMPLES="1.40 1.80 2.20 2.60 3.00 3.40 3.80"

# Larghezza di una colonna in coordinate lastra: (2400-280-420-48-40)/3 = 537,
# che scalata nel quadro renderizzato vale circa 300px. La card deve percorrere
# almeno mezza colonna, altrimenti non ha cambiato posto.
MIN_TRAVEL_PX=120

prev=""
xs=()

for t in $SAMPLES; do
  f="$WORK/f$t.png"
  ffmpeg -v error -ss "$t" -i "$SRC" -frames:v 1 -vf "scale=960:-2" -y "$f"
  [ -s "$f" ] || { echo "estrazione fallita a ${t}s" >&2; exit 3; }

  if [ -n "$prev" ]; then
    # I pixel cambiati fra due campioni. La soglia toglie il rumore di encoding
    # e le micro-variazioni della camera, che si muove pianissimo.
    "${IM_CONVERT[@]}" "$prev" "$f" -compose difference -composite \
      -colorspace Gray -threshold 12% "$WORK/d$t.png"

    # Il centroide dei pixel accesi, e quanti sono.
    read -r cx n < <( \
      python3 - "$WORK/d$t.png" <<'PY'
import os, subprocess, sys
# Estrae la maschera come testo grezzo: piu' semplice di far fare a IM la
# statistica dei momenti, e non dipende da quali feature ha questa build.
out = subprocess.run(
    os.environ["IM_CONVERT_CMD"].split() + [sys.argv[1], "-depth", "8", "gray:-"],
    capture_output=True, check=True).stdout
# `identify -format %w file` e basta: la 7 tollera anche un "info:" in coda,
# la 6 no e esce 1. La forma senza suffisso funziona su entrambe.
w = int(subprocess.run(os.environ["IM_IDENTIFY_CMD"].split() + ["-format", "%w", sys.argv[1]],
                       capture_output=True, text=True, check=True).stdout.strip())
tot = sx = 0
for i, v in enumerate(out):
    if v > 127:
        tot += 1
        sx += i % w
print(f"{sx/tot:.1f} {tot}" if tot else "-1 0")
PY
)
    # Se la lettura non ha prodotto due numeri, lo strumento non ha risposto:
    # senza questo, `n` resta vuoto, il test numerico sotto stampa "integer
    # expected" e il campione viene semplicemente saltato. Il verdetto finale
    # dice allora "la card non viaggia", che e' una diagnosi falsa per un
    # problema di attrezzatura.
    case "${cx:-}|${n:-}" in
      *'|'|'|'*) echo "lettura del centroide fallita a ${t}s" >&2; exit 3 ;;
    esac
    case "$n" in ''|*[!0-9]*) echo "conteggio non numerico a ${t}s: '$n'" >&2; exit 3 ;; esac

    printf '  %-6s x=%-8s pixel=%s\n' "${t}s" "$cx" "$n"
    # Sotto questa soglia il frame non contiene un oggetto in movimento, solo
    # rumore: non e' un campione, va scartato.
    if [ "$n" -gt 400 ]; then xs+=("$cx"); fi
  fi
  prev="$f"
done

echo
if [ "${#xs[@]}" -lt 4 ]; then
  echo "FALLITO: solo ${#xs[@]} campioni con movimento reale. La card non viaggia," >&2
  echo "oppure si sposta di scatto in un frame solo, che e' un taglio." >&2
  exit 1
fi

python3 - "${xs[@]}" <<'PY'
import sys
xs = [float(v) for v in sys.argv[1:]]
span = xs[-1] - xs[0]
# Monotona a meno di un filo di tolleranza: il centroide include anche la coda
# che si richiude, quindi puo' oscillare di pochi pixel.
back = sum(1 for a, b in zip(xs, xs[1:]) if b < a - 8)
print(f"  campioni: {len(xs)}   da x={xs[0]:.0f} a x={xs[-1]:.0f}   spostamento={span:.0f}px")
print(f"  passi all'indietro: {back}")
print()
if span < 120:
    print(f"FALLITO: la card si sposta di {span:.0f}px, meno di mezza colonna.", file=sys.stderr)
    sys.exit(1)
if back > 1:
    print(f"FALLITO: il movimento torna indietro {back} volte, non e' un tragitto.", file=sys.stderr)
    sys.exit(1)
print(f"VERDETTO: la card attraversa {span:.0f}px in avanti, senza tornare indietro.")
PY
