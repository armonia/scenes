#!/usr/bin/env python3
"""La card cambia davvero colonna, o si limita a tremare?

PERCHE' ESISTE. `seam.sh` prova che la giunta non ha tagli e `fill-geom.py` che
il quadro e' pieno: nessuno dei due guarda il gesto. Una scena in cui la card
resta ferma li supererebbe entrambi, perche' un fermo immagine ha la giunta
perfetta e i bordi coperti. Il contenuto della scena e' tutto qui: un oggetto
parte da una colonna e arriva in un'altra.

COME. Ogni campione del trascinamento si riporta sulla lastra con la
trasformazione prospettica della camera a quel frame (i quattro angoli della
lastra proiettati, dal manifest `bench handoff-travel`), e fra due campioni
raddrizzati si prende la differenza dentro la meta' alta della board, solo dove
la lastra era in quadro in tutti e due. Sulla lastra la board sta ferma: quello
che cambia e' la card che viaggia, la mano e la colonna che si richiude. Del
cambiamento si segue il baricentro orizzontale, e la misura e' che vada avanti
senza tornare indietro e copra almeno meta' della distanza fra le due colonne.

PERCHE' SULLA LASTRA E NON SULLO SCHERMO. La prima versione differenziava i
fotogrammi dello schermo. In 9:16 e 4:5 la camera segue la card mentre la mano
la trascina, la card sullo schermo si sposta di poche decine di pixel e tutta la
board le scorre sotto: sullo schermo si misurava la panoramica. E i campioni
cominciavano prima della presa, dove camera e cursore si muovono gia', tanto che
un taglio secco a meta' scena passava con quattro campioni buoni. Adesso stanno
tutti dentro il trascinamento.

IL RADDRIZZAMENTO SI CONTROLLA, e la prima prova l'ha dimostrato. Raddrizzare
la stessa immagine con due camere diverse la fa scorrere sulla lastra: in 9:16
un fermo immagine, raddrizzato con la panoramica del manifest, "attraversava"
208 px. Il controllo sono le intestazioni delle colonne, che durante il
trascinamento non cambiano: su un render vero, sulla lastra, cambiano di zero
pixel in ogni coppia di campioni in tutti e tre i rapporti; su un fermo immagine
di 40-150. Se cambiano, il render non segue la camera di quel rapporto e il
viaggio misurato non vorrebbe dire niente.

COSA LO FA FALLIRE:
  - fermo immagine, render al contrario, taglio secco prima del trascinamento:
    la camera del render non e' quella del manifest e le intestazioni si
    muovono sulla lastra. Nel 16:9, dove la camera quasi non si sposta, le
    stesse copie falliscono anche sul viaggio (tornano indietro).
  - card che non viaggia o torna indietro con la camera giusta: nessun campione
    con movimento, o baricentro non monotono.
  - card che parte e non arriva: distanza sotto la soglia.

Uso:  ./scripts/handoff-travel.py <scena.mp4> --ratio R [--scene CardHandoff|CardHandoffFast]

Esce 0 se la card attraversa, 1 se non viaggia, torna indietro o non arriva, 3
se file, quadro, durata, manifest o ImageMagick non tornano.
"""
import argparse
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("--ratio", default="16x9")
ap.add_argument("--scene", default="CardHandoff")
args = ap.parse_args()
SRC = pathlib.Path(args.src)

# Differenza per pixel, su 255, sotto cui due pixel della lastra raddrizzata sono
# lo stesso pixel: toglie il rumore di codifica e il ricampionamento.
SOGLIA_PIXEL = 30
# Sotto questa frazione della board un campione non contiene un oggetto in
# movimento. La card sulla lastra raddrizzata occupa circa 263x38 px, il 7% della
# zona; mezzo per cento e' un settimo di card.
PIXEL_MIN = 0.005
# Passi all'indietro tollerati, in pixel della lastra raddrizzata: la colonna che
# si richiude tira un poco il baricentro verso sinistra alla fine.
INDIETRO = 3
# Pixel cambiati ammessi nelle intestazioni fra due campioni: il mezzo per cento di
# quelle in quadro, e almeno otto. Misurato zero sui render veri, 40 il minimo su
# un fermo immagine in 9:16.
FERMA_MAX = 0.005

IM = ["magick"] if shutil.which("magick") else (["convert"] if shutil.which("convert") else None)
if IM is None:
    print("serve ImageMagick: 'magick' (v7) oppure 'convert' (v6)", file=sys.stderr)
    raise SystemExit(3)
if not SRC.exists():
    print("manca il render: %s" % SRC, file=sys.stderr)
    raise SystemExit(3)

geo = subprocess.run(
    ["node", str(ROOT / "scripts/manifest.mjs"), "bench", "handoff-travel", "--ratio", args.ratio],
    capture_output=True, text=True,
)
if geo.returncode != 0:
    print("la geometria non e' arrivata dal manifest:\n" + geo.stderr, file=sys.stderr)
    raise SystemExit(3)
g = json.loads(geo.stdout)
v = next((x for x in g["variants"] if x["id"] == args.scene), None)
if v is None:
    print("il manifest non conosce la scena %s" % args.scene, file=sys.stderr)
    raise SystemExit(3)

out = subprocess.run(
    ["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0",
     "-show_entries", "stream=width,height,nb_read_frames", "-of", "csv=p=0", str(SRC)],
    capture_output=True, text=True,
).stdout.strip()
w, h, n = ([x for x in out.split(",") if x] + ["", "", ""])[:3]
if [w, h] != [str(g["stage"]["w"]), str(g["stage"]["h"])]:
    print("il quadro di %s e' %sx%s, lo stage di %s e' %dx%d: geometria di un altro rapporto"
          % (SRC.name, w, h, args.ratio, g["stage"]["w"], g["stage"]["h"]), file=sys.stderr)
    raise SystemExit(3)
if n != str(v["durationInFrames"]):
    print("%s ha %s fotogrammi, %s ne ha %d: non e' il render di quella scena"
          % (SRC.name, n, args.scene, v["durationInFrames"]), file=sys.stderr)
    raise SystemExit(3)

SW, SH = g["slab"]["w"], g["slab"]["h"]
b = g["board"]
WORK = pathlib.Path(tempfile.mkdtemp(prefix="travel-"))


def run(cmd):
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0:
        print("comando fallito: %s\n%s" % (" ".join(cmd[:3]), r.stderr.decode(errors="replace")), file=sys.stderr)
        raise SystemExit(3)
    return r.stdout


def raddrizza(sample):
    """Il fotogramma e la sua maschera di visibilita', riportati sulla lastra."""
    f = sample["frame"]
    png = WORK / ("s%d.png" % f)
    run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(SRC), "-vf", "select=eq(n\\,%d)" % f,
         "-frames:v", "1", "-y", str(png)])
    punti = " ".join("%s,%s %s,%s" % (c["sx"], c["sy"], c["x"], c["y"]) for c in sample["corners"])
    comune = ["-virtual-pixel", "black", "-define", "distort:viewport=%dx%d+0+0" % (SW, SH),
              "-distort", "Perspective", punti,
              "-crop", "%dx%d+%d+%d" % (b["w"], b["h"], b["x"], b["y"]), "+repage"]
    img = run(IM + [str(png), "-colorspace", "Gray"] + comune + ["-depth", "8", "gray:-"])
    mask = run(IM + ["-size", "%sx%s" % (w, h), "xc:white", "-colorspace", "Gray"] + comune + ["-depth", "8", "gray:-"])
    if len(img) != b["w"] * b["h"] or len(mask) != b["w"] * b["h"]:
        print("raddrizzamento del fotogramma %d fallito" % f, file=sys.stderr)
        raise SystemExit(3)
    return img, mask


try:
    fotogrammi = [raddrizza(s) for s in v["samples"]]
    area = b["w"] * b["h"]
    ferme = g["stillRows"] * b["w"]
    xs = []
    registrate = True
    print("Il viaggio della card in %s (%s), sulla lastra raddrizzata (zona board %dx%d)."
          % (SRC.name, args.ratio, b["w"], b["h"]))
    for (s0, (a, ma)), (s1, (c, mc)) in zip(zip(v["samples"], fotogrammi), zip(v["samples"][1:], fotogrammi[1:])):
        tot = sx = visibili = mosse = 0
        for i in range(area):
            if ma[i] > 250 and mc[i] > 250:
                cambia = abs(a[i] - c[i]) > SOGLIA_PIXEL
                if i < ferme:
                    visibili += 1
                    mosse += cambia
                elif cambia:
                    tot += 1
                    sx += i % b["w"]
        cx = sx / tot if tot else -1
        allineate = mosse <= max(8, FERMA_MAX * visibili)
        registrate = registrate and allineate
        usato = tot >= PIXEL_MIN * area
        print("  f%-4d -> f%-4d  x=%7.1f  pixel=%6d  intestazioni cambiate %4d su %5d  %s"
              % (s0["frame"], s1["frame"], cx, tot, mosse, visibili,
                 "NON ALLINEATE" if not allineate else ("" if usato else "(nessun movimento)")))
        if usato:
            xs.append(cx)
finally:
    shutil.rmtree(WORK, ignore_errors=True)

print()
if not registrate:
    print("FALLITO: sulla lastra raddrizzata le intestazioni delle colonne si muovono, e", file=sys.stderr)
    print("durante il trascinamento non devono. Il render non segue la camera di questo", file=sys.stderr)
    print("rapporto: un fermo immagine, un render al contrario o tagliato, o una posa", file=sys.stderr)
    print("diversa da quella del manifest. Il viaggio misurato non vorrebbe dire niente.", file=sys.stderr)
    raise SystemExit(1)
if len(xs) < 4:
    print("FALLITO: solo %d campioni con movimento. La card non viaggia, oppure si sposta"
          % len(xs), file=sys.stderr)
    print("di scatto fuori dal trascinamento, che e' un taglio.", file=sys.stderr)
    raise SystemExit(1)

span = xs[-1] - xs[0]
back = sum(1 for p, q in zip(xs, xs[1:]) if q < p - INDIETRO)
print("  campioni: %d   da x=%.0f a x=%.0f   spostamento=%.0f px (soglia %.0f)"
      % (len(xs), xs[0], xs[-1], span, g["minTravel"]))
print("  passi all'indietro: %d" % back)
print()
if back > 1:
    print("FALLITO: il movimento torna indietro %d volte, non e' un tragitto." % back, file=sys.stderr)
    raise SystemExit(1)
if span < g["minTravel"]:
    print("FALLITO: la card si sposta di %.0f px sulla lastra, sotto i %.0f di meta' strada."
          % (span, g["minTravel"]), file=sys.stderr)
    raise SystemExit(1)
print("VERDETTO: la card attraversa %.0f px della lastra in avanti, senza tornare indietro." % span)
