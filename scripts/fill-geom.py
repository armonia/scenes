#!/usr/bin/env python3
"""
CAM-01 in geometria: la lastra copre i quattro bordi del quadro.

PERCHE' ESISTE. fill-measure.sh dava 20 su 20 anche su una lastra arretrata:
il fondale delle scene e' luminoso quanto la sua soglia, e il piano sfocato
dietro la lastra inganna qualunque misura sui pixel. Il riempimento e' una
domanda di geometria, e con le tracce della camera (products/topics/tracks.ts) e la
proiezione del kit (kit/project.ts, verificata contro Chromium) la si puo' fare
esattamente, su ogni fotogramma, senza renderizzare.

COSA MISURA. Per ogni scena che dichiara `fill` in catalog.json, dal 20% della
durata all'ultimo frame, i quattro angoli della lastra si proiettano con la posa
di quel frame, e i quattro angoli del quadro devono cadere dentro. Il margine
e' la distanza dal lato piu' vicino: positivo coperto, negativo scoperto. Mezzo
pixel di tolleranza, perche' PromptInput porta per costruzione il bordo basso
della lastra esattamente sul bordo del quadro, e zero in virgola mobile puo'
uscire -1e-13.

IL NEGATIVO: --push-offset -1500 arretra la camera su ogni posa. Con --must-fail
il banco esce 0 solo se tutte le scene risultano scoperte.

Uso:  fill-geom.py [--ratio 16x9|9x16|4x5] [--push-offset N] [--must-fail]

Esce 0 se ogni scena che dichiara `fill` copre il quadro (con --must-fail: se
nessuna lo copre), 1 altrimenti, 3 se il manifest non risponde.
"""
import argparse
import json
import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TOL = 0.5

ap = argparse.ArgumentParser()
ap.add_argument("--push-offset", type=float, default=0)
ap.add_argument("--ratio", default="16x9")
ap.add_argument("--must-fail", action="store_true")
args = ap.parse_args()

cmd = ["node", os.path.join(ROOT, "scripts/manifest.mjs"), "fill", "--ratio", args.ratio]
if args.push_offset:
    cmd += ["--push-offset", str(args.push_offset)]
r = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
if r.returncode != 0:
    print("il manifest non risponde:\n" + r.stderr, file=sys.stderr)
    sys.exit(3)
scenes = json.loads(r.stdout)
if not scenes:
    print("nessuna scena dichiara fill: non c'e' niente da misurare", file=sys.stderr)
    sys.exit(3)

print(f"CAM-01 in geometria, {args.ratio}: i quattro angoli del quadro dentro la lastra proiettata"
      f"{f', camera arretrata di {-args.push_offset:g}' if args.push_offset else ''}.")
scoperte = []
for s in scenes:
    ok = s["minMargin"] >= -TOL
    esito = "coperto" if ok else "SCOPERTO"
    extra = ""
    if not ok:
        scoperte.append(s["id"])
        first = next((x for x in [s["first"]] if x), None)
        if first:
            extra = f"  dal frame {first['frame']}, angolo {first['corner']}"
    print(f"  {s['id']:12} f{s['from']}-f{s['to']}  margine minimo {s['minMargin']:8.1f} px  {esito}{extra}")

if args.must_fail:
    coperte = [s["id"] for s in scenes if s["id"] not in scoperte]
    if coperte:
        print(f"VERDETTO: il banco PROMUOVE una lastra arretrata in {', '.join(coperte)}.")
        sys.exit(1)
    print(f"VERDETTO: con la camera arretrata tutte le {len(scenes)} scene risultano scoperte, come deve.")
    sys.exit(0)

if scoperte:
    print(f"VERDETTO: {len(scoperte)} scene lasciano scoperto un bordo del quadro: {', '.join(scoperte)}.")
    sys.exit(1)
print(f"VERDETTO: tutte le {len(scenes)} scene che dichiarano fill coprono i quattro bordi, "
      f"su ogni frame dal 20% della durata.")
sys.exit(0)
