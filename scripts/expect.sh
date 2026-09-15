#!/usr/bin/env bash
#
# Esegue i banchi dichiarati dal manifest e controlla che ognuno esca col codice
# che deve: 0 sui render buoni, il codice del difetto sui casi costruiti apposta.
#
# PERCHE' ESISTE. I controlli negativi erano novanta righe scritte a mano nel
# workflow, una per banco, tutte per il 16:9 di Topics. Con tre rapporti
# sarebbero diventate trecento, e un negativo dimenticato non rompe niente: il
# banco resta verde anche quando non puo' piu' fallire, che e' il difetto che il
# repo ha gia' pagato due volte (framelocked-verdict, fill-measure). Adesso le
# righe le genera `scripts/manifest.mjs checks`, questo script le esegue tutte
# senza fermarsi al primo errore, e scrive un report che `bench-coverage.py`
# legge per dire quale banco non ha un negativo che fallisce.
#
# FORMATO, una riga per controllo, campi separati da tab:
#   run     <etichetta>  <comando>                         preparazione, deve uscire 0
#   expect  <rc>  <banco>  <bersaglio>  <positivo|negativo>  <comando>
# Il comando gira con bash, dalla radice del repo, con lo stdin chiuso.
#
# `cmd; rc=$?` NON SI USA, per lo stesso motivo scritto nel workflow: sotto
# `bash -e` la shell se ne va prima di assegnare rc. Qui si usa `|| rc=$?`.
#
# Uso:  ./scripts/expect.sh <checks.tsv> <report.json>
#
# Esce 0 se ogni controllo esce col codice atteso e ogni preparazione riesce,
# 1 altrimenti, 3 se l'elenco dei controlli manca o e' vuoto.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHECKS="${1:?serve il file dei controlli}"
REPORT="${2:?serve il percorso del report}"

[ -s "$CHECKS" ] || { echo "nessun controllo in $CHECKS" >&2; exit 3; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
: > "$TMP/results.tsv"

BAD=0
N=0
TAB="$(printf '\t')"
while IFS="$TAB" read -r kind a b c d e; do
  [ -n "$kind" ] || continue
  case "$kind" in \#*) continue ;; esac
  N=$((N + 1))
  log="$TMP/$N.log"
  start=$(date +%s)
  case "$kind" in
    run)
      label="$a"; cmd="$b"
      rc=0; (cd "$ROOT" && bash -o pipefail -c "$cmd") < /dev/null > "$log" 2>&1 || rc=$?
      secs=$(( $(date +%s) - start ))
      if [ "$rc" = 0 ]; then
        printf '  ok    %-48s %4ss\n' "prepara: $label" "$secs"
      else
        printf '  ROTTO %-48s %4ss  rc=%s\n' "prepara: $label" "$secs" "$rc"
        tail -n 20 "$log" | sed 's/^/        /'
        BAD=$((BAD + 1))
      fi
      printf 'run\t%s\t-\t-\t0\t%s\t%s\n' "$label" "$rc" "$secs" >> "$TMP/results.tsv"
      ;;
    expect)
      want="$a"; bench="$b"; target="$c"; role="$d"; cmd="$e"
      rc=0; (cd "$ROOT" && bash -o pipefail -c "$cmd") < /dev/null > "$log" 2>&1 || rc=$?
      secs=$(( $(date +%s) - start ))
      if [ "$rc" = "$want" ]; then
        printf '  ok    %-22s %-22s %-8s rc=%s %4ss\n' "$bench" "$target" "$role" "$rc" "$secs"
      else
        printf '  ROTTO %-22s %-22s %-8s rc=%s, atteso %s %4ss\n' "$bench" "$target" "$role" "$rc" "$want" "$secs"
        tail -n 20 "$log" | sed 's/^/        /'
        BAD=$((BAD + 1))
      fi
      printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$role" "$bench" "$target" "$cmd" "$want" "$rc" "$secs" >> "$TMP/results.tsv"
      ;;
    *)
      echo "riga sconosciuta in $CHECKS: $kind" >&2
      BAD=$((BAD + 1))
      ;;
  esac
done < "$CHECKS"

[ "$N" -gt 0 ] || { echo "nessun controllo in $CHECKS" >&2; exit 3; }

mkdir -p "$(dirname "$REPORT")"
python3 - "$TMP/results.tsv" "$REPORT" <<'PY'
import json, sys
rows = []
for line in open(sys.argv[1], encoding="utf-8"):
    role, bench, target, cmd, want, rc, secs = line.rstrip("\n").split("\t")
    rows.append({"role": role, "bench": bench, "target": target, "command": cmd,
                 "expected": int(want), "rc": int(rc), "seconds": int(secs),
                 "ok": int(want) == int(rc)})
json.dump({"checks": rows}, open(sys.argv[2], "w"), indent=1)
PY

echo
if [ "$BAD" -gt 0 ]; then
  echo "VERDETTO: $BAD controlli su $N non escono col codice atteso. Report: $REPORT"
  exit 1
fi
echo "VERDETTO: tutti i $N controlli escono col codice atteso. Report: $REPORT"
exit 0
