#!/usr/bin/env python3
"""
CAM-06 sul render: il bersaglio resta sull'origine della prospettiva mentre la
camera avanza, su due lastre e in tre rapporti.

PERCHE' ESISTE. CAM-06 era dimostrata solo sulla pagina del catalogo, in un
palco 16:9 con la geometria di Topics ricopiata in JavaScript. I documenti di
regia dei primi film di prodotto ne avevano tratto una regola sbagliata ("il
46% non e' una frazione del quadro, e' il risultato della geometria"), e
nessun banco poteva smentirli perche' nessun banco guardava un altro rapporto.
Questo guarda sei varianti: Topics e la lastra sonda, in 16:9, 9:16 e 4:5.

COSA MISURA. Ogni variante e' uno specimen (video/src/specimens/) in cui la
lastra viene spostata una volta con centreOn e poi spinta in Z fino a far
occupare al bersaglio il 90% del quadro. Sul bersaglio c'e' un anello magenta:
il banco ne prende il baricentro al primo e all'ultimo frame e lo confronta con
l'origine che il manifest calcola dallo stesso codice del render. Entro 2 px su
entrambi i frame, la variante passa.

I DUE NEGATIVI, e il banco deve bocciarli in OGNI variante (--must-fail):
  --props '{"compensate": false}'      senza lo spostamento il bersaglio scappa
  --props '{"originMismatch": true}'   spostamento calcolato sul 46%, CSS al 50%
Il secondo e' il piu' sottile: al primo frame il segno e' esattamente dove il
manifest lo aspetta, e se ne va solo mentre la camera avanza. Un banco che
guardasse un frame solo lo promuoverebbe.

Il segno fuori quadro, o assente, conta come difetto della variante: e' quello
che succede senza compensazione quando il bersaglio esce dal bordo.

Uso:
  drift.py [--only ID] [--props JSON] [--must-fail]

Esce 0 se ogni variante sta entro la tolleranza (con --must-fail: se ognuna ne
esce), 1 altrimenti, 2 se il manifest non separa il caso giusto da quello
sbagliato, 3 se un render non e' uscito.
"""
import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
VIDEO = os.path.join(ROOT, "video")

ap = argparse.ArgumentParser()
ap.add_argument("--only")
ap.add_argument("--ratio", help="solo le varianti di questo rapporto (16x9, 9x16, 4x5)")
ap.add_argument("--props")
ap.add_argument("--must-fail", action="store_true")
args = ap.parse_args()

# Un manifest che non risponde e' uno strumento guasto, non un verdetto sulla
# scena: esce 3 come gli altri banchi, invece di un traceback con codice 1 che
# nel report di expect.sh si confonderebbe con una bocciatura.
r = subprocess.run(
    ["node", os.path.join(ROOT, "scripts/manifest.mjs"), "cam06"],
    capture_output=True, text=True, cwd=ROOT,
)
if r.returncode != 0:
    print("il manifest non risponde:\n" + r.stderr, file=sys.stderr)
    sys.exit(3)
manifest = json.loads(r.stdout)
if args.ratio:
    manifest = [v for v in manifest if v["ratio"] == args.ratio]
    if not manifest:
        print(f"nessuna variante nel rapporto {args.ratio}", file=sys.stderr)
        sys.exit(3)
if args.only:
    manifest = [v for v in manifest if v["id"] == args.only]
    if not manifest:
        print(f"nessuna variante {args.only} nel manifest", file=sys.stderr)
        sys.exit(2)

# ImageMagick si chiama `magick` sulla 7 e `convert` sulla 6, che e' quella di CI.
CONVERT = ["magick"] if shutil.which("magick") else ["convert"]
MAGENTA = re.compile(rb"[\x80-\xff]")


def render(vid, frame, out):
    cmd = ["npx", "remotion", "still", vid, out, f"--frame={frame}",
           "--image-format=png", "--log=error"]
    if args.props:
        cmd.append(f"--props={args.props}")
    r = subprocess.run(cmd, cwd=VIDEO, capture_output=True, text=True,
                       stdin=subprocess.DEVNULL)
    return r.returncode == 0 and os.path.exists(out) and os.path.getsize(out) > 0


def marker(png, w):
    """Baricentro dei pixel magenta, e quanti sono.

    L'ORDINE DELLE DUE SOSTITUZIONI CONTA. La prima versione colorava di bianco
    il magenta e poi metteva a nero tutto cio' che non era bianco: i pixel gia'
    bianchi della lastra restavano nella maschera, e il baricentro finiva a
    duecento pixel dal segno. Il banco bocciava anche il caso giusto, e con un
    negativo che boccia tutto quello che si legge e' un verde. Prima si spegne
    tutto cio' che non e' magenta, poi si accende il magenta.
    """
    mask = subprocess.run(
        CONVERT + [png, "-fuzz", "25%", "-fill", "black", "+opaque", "#ff00ff",
                   "-fill", "white", "-opaque", "#ff00ff", "-depth", "8", "gray:-"],
        capture_output=True, check=True,
    ).stdout
    n = sx = sy = 0
    for m in MAGENTA.finditer(mask):
        i = m.start()
        sx += i % w
        sy += i // w
        n += 1
    # Il pixel i copre [i, i+1): il suo centro e' i + 0,5. Senza questo mezzo
    # pixel ogni misura usciva spostata in alto a sinistra di 0,7 px.
    return (sx / n + 0.5, sy / n + 0.5, n) if n else (None, None, 0)


tmp = tempfile.mkdtemp()
esito = {}
separa = True
print(f"CAM-06 sul render: il bersaglio sta sull'origine per tutta la spinta."
      f"{'  props ' + args.props if args.props else ''}")
print(f"  {'variante':28} {'origine':>15} {'frame':>6} {'segno':>17} {'scarto':>8}")

for v in manifest:
    ox, oy = v["origin"]["x"], v["origin"]["y"]
    # Se il punto non compensato cadesse gia' sull'origine, togliere la
    # compensazione non cambierebbe niente e il negativo non potrebbe fallire.
    ux, uy = v["uncompensated"]["x"], v["uncompensated"]["y"]
    if math.hypot(ux - ox, uy - oy) < 10 * v["tolPx"]:
        separa = False
        print(f"  {v['id']:28} il bersaglio non compensato e' gia' sull'origine: il negativo non separa")
    peggiore = 0.0
    for f in v["frames"]:
        out = os.path.join(tmp, f"{v['id']}-{f}.png")
        if not render(v["id"], f, out):
            print(f"  {v['id']:28} frame {f}: RENDER FALLITO")
            sys.exit(3)
        mx, my, n = marker(out, v["width"])
        if n == 0:
            print(f"  {v['id']:28} {ox:7.1f},{oy:7.1f} {f:6d} {'fuori quadro':>17} {'inf':>8}")
            peggiore = math.inf
            continue
        d = math.hypot(mx - ox, my - oy)
        peggiore = max(peggiore, d)
        print(f"  {v['id']:28} {ox:7.1f},{oy:7.1f} {f:6d} {mx:8.1f},{my:8.1f} {d:8.2f}")
    esito[v["id"]] = peggiore <= v["tolPx"]

shutil.rmtree(tmp, ignore_errors=True)
print("")

if not separa:
    print("VERDETTO: nessuno. Almeno una variante non separa il caso giusto da quello sbagliato.")
    sys.exit(2)

dentro = [k for k, ok in esito.items() if ok]
fuori = [k for k, ok in esito.items() if not ok]

if args.must_fail:
    if dentro:
        print(f"VERDETTO: il banco PROMUOVE un caso rotto in {len(dentro)} varianti su "
              f"{len(esito)}: {', '.join(dentro)}. Non misura quello che dice.")
        sys.exit(1)
    print(f"VERDETTO: il caso rotto esce dalla tolleranza in tutte le {len(esito)} varianti, come deve.")
    sys.exit(0)

if fuori:
    print(f"VERDETTO: il bersaglio scappa dall'origine in {len(fuori)} varianti su "
          f"{len(esito)}: {', '.join(fuori)}.")
    sys.exit(1)
print(f"VERDETTO: il bersaglio resta entro {manifest[0]['tolPx']} px dall'origine in tutte "
      f"le {len(esito)} varianti, dal primo all'ultimo frame.")
sys.exit(0)
