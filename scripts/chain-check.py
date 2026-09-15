#!/usr/bin/env python3
"""
GIU-04: la camera della catena non torna mai indietro mentre si muove.

PERCHE' ESISTE. La voce GIU-04 della grammatica diceva "l'occhio segue la
derivata, e un'inversione a una giunta si legge come uno stacco anche quando i
pixel coincidono", e nominava un banco che non esisteva. seam.sh misura che due
fotogrammi si somigliano; non puo' vedere il verso del movimento. Questo lo
misura sulle tracce della camera (products/topics/tracks.ts), cioe' sugli stessi
dati che le scene passano al render.

COSA CONTROLLA, su yaw, pitch, spinta e spostamenti, lungo tutte le scene del
catalogo nell'ordine in cui si agganciano:
  - dentro una scena la derivata non cambia segno;
  - a una giunta l'ultima posa di una scena e' la prima della successiva;
  - a una giunta il verso cambia solo se la camera e' ferma da tutte e due le
    parti (velocita' di confine sotto il 5% della massima di quell'asse).
Le inversioni a riposo si stampano senza bocciarle: sono ammesse perche' dove i
due lati sono fermi non c'e' una derivata da rovesciare.

IL NEGATIVO: --linear toglie gli easing a tutte le tracce. Le giunte smettono di
essere a riposo e le stesse inversioni diventano inversioni in moto. Con
--must-fail il banco esce 0 solo se se ne accorge.

Uso:  chain-check.py [--ratio 16x9|9x16|4x5] [--linear] [--must-fail]

Esce 0 se la catena non ha salti ne' inversioni in moto (con --must-fail: se ne
ha), 1 altrimenti, 3 se il manifest non risponde.
"""
import argparse
import json
import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

ap = argparse.ArgumentParser()
ap.add_argument("--linear", action="store_true")
ap.add_argument("--ratio", default="16x9")
ap.add_argument("--must-fail", action="store_true")
args = ap.parse_args()

cmd = ["node", os.path.join(ROOT, "scripts/manifest.mjs"), "chain", "--ratio", args.ratio]
if args.linear:
    cmd.append("--linear")
r = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
if r.returncode != 0:
    print("il manifest non risponde:\n" + r.stderr, file=sys.stderr)
    sys.exit(3)
data = json.loads(r.stdout)

print(f"GIU-04 sulla catena in {args.ratio}: {' → '.join(data['scenes'])}"
      f"{'  (easing tolti)' if args.linear else ''}")
gravi = [f for f in data["findings"] if f["kind"] != "inversione a riposo"]
for f in data["findings"]:
    print(f"  {f['kind']:20} {f['axis']:7} {f['where']:34} {f['detail']}")
if not data["findings"]:
    print("  nessuna inversione e nessun salto")

if args.must_fail:
    if gravi:
        print(f"VERDETTO: il banco trova {len(gravi)} inversioni in moto o salti, come deve.")
        sys.exit(0)
    print("VERDETTO: il banco PROMUOVE una catena che si inverte in moto.")
    sys.exit(1)

if gravi:
    print(f"VERDETTO: {len(gravi)} fra inversioni in moto e salti. La camera torna indietro mentre si muove.")
    sys.exit(1)
riposo = len(data["findings"])
print(f"VERDETTO: la camera non torna mai indietro in moto; {riposo} inversioni, tutte a giunte ferme.")
sys.exit(0)
