#!/usr/bin/env python3
"""
Ogni banco che promuove un render ha anche un caso che boccia, e lo boccia?

PERCHE' ESISTE. Un banco verde senza un negativo accanto dice solo che lo script
e' arrivato in fondo. Il repo lo ha scoperto due volte: framelocked-verdict.sh
stampava il verdetto e usciva 0 comunque, fill-measure.sh promuoveva una lastra
arretrata. In entrambi i casi il negativo mancava, e mancava in silenzio. Qui
il silenzio diventa un errore.

COSA CONTROLLA, sul report di expect.sh: per ogni banco che ha almeno un
positivo, esiste almeno un negativo dello stesso banco uscito col codice
atteso, diverso da 0. Un negativo che esce 0 non e' un negativo. Stampa la
tabella banco per banco.

IL NEGATIVO DI QUESTO BANCO: `--without <banco>` toglie dal report i negativi di
quel banco, cioe' simula un elenco di controlli in cui qualcuno l'ha
dimenticato. Il banco deve uscire 1 e nominarlo.

Uso:  bench-coverage.py <report.json> [--without BANCO]

Esce 0 se ogni banco con un positivo ha un negativo passato, 1 altrimenti, 3 se
il report manca o non contiene positivi.
"""
import argparse
import json
import sys

ap = argparse.ArgumentParser()
ap.add_argument("report")
ap.add_argument("--without", action="append", default=[])
args = ap.parse_args()

try:
    checks = json.load(open(args.report))["checks"]
except (OSError, ValueError, KeyError) as e:
    print(f"report illeggibile: {e}", file=sys.stderr)
    sys.exit(3)

checks = [c for c in checks if not (c["role"] == "negativo" and c["bench"] in args.without)]
positives = {}
negatives = {}
for c in checks:
    if c["role"] == "positivo":
        positives.setdefault(c["bench"], []).append(c)
    elif c["role"] == "negativo":
        negatives.setdefault(c["bench"], []).append(c)

if not positives:
    print("nessun positivo nel report: non c'e' niente da coprire", file=sys.stderr)
    sys.exit(3)

scoperti = []
print("Banco per banco: positivi passati, negativi passati (codice atteso diverso da 0).")
for bench in sorted(positives):
    pos = positives[bench]
    neg = [n for n in negatives.get(bench, []) if n["ok"] and n["expected"] != 0]
    esito = "coperto" if neg else "SCOPERTO"
    if not neg:
        scoperti.append(bench)
    codes = ",".join(sorted({str(n["expected"]) for n in neg})) or "-"
    print(f"  {bench:22} positivi {sum(p['ok'] for p in pos)}/{len(pos)}  "
          f"negativi {len(neg)} (rc {codes})  {esito}")

if scoperti:
    print(f"VERDETTO: {len(scoperti)} banchi promuovono senza un caso che boccia: {', '.join(scoperti)}.")
    sys.exit(1)
print(f"VERDETTO: tutti i {len(positives)} banchi hanno un negativo che esce col suo codice.")
sys.exit(0)
