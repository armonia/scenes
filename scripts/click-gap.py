#!/usr/bin/env python3
"""Fra il clic e la sua conseguenza passa qualche frame, o succedono insieme?

E' la promessa di CUR-03. Due o tre frame di scarto bastano perche' il gesto
sembri causare qualcosa; sullo stesso fotogramma il clic legge come finto,
perche' nella vita nessuna interfaccia risponde prima di aver ricevuto. Metterli
insieme e' anche piu' corto da scrivere, quindi e' l'errore che si fa per
distrazione ed e' esattamente per questo che serve un banco.

COME, e senza farsi dire la risposta. Il banco non legge i frame del clic: li
ritrova nel render. Il manifest (`bench click-gap`) gli da' due zone del quadro
e il tratto a camera ferma in cui cercare, e lui conta frame per frame i pixel
che cambiano in ognuna:

  1. IL COLPO, nel testo del campo. All'invio il campo si svuota e torna al
     segnaposto: migliaia di pixel contro le poche centinaia di una lettera
     battuta. E' il cambio PIU' GRANDE della zona nel tratto, e deve superare
     COLPO volte il suo novantesimo percentile. Il piu' grande e non il primo:
     il primo che supera la soglia e' il segnaposto che sparisce alla prima
     lettera (2100 px nel 16:9), mentre lo svuotamento ne cambia 5300, e dopo
     l'invio nel campo non succede piu' niente.
  2. LA CONSEGUENZA, nella coda del thread, dove sale la bolla. Dopo il colpo la
     zona si calma; la conseguenza e' il primo fotogramma che risale sopra quella
     quiete e sopra un pavimento proporzionale alla zona.

PERCHE' DUE ZONE E NON IL QUADRO. La prima versione contava il fotogramma
intero, e nel 16:9 il clic si vedeva grazie al pulsante che si abbassa e
all'anello del cursore. In 9:16 e 4:5 il pulsante e' fuori quadro: dopo il clic
i fotogrammi erano fermi, la quiete valeva zero, qualunque cosa la superava, e
il banco promuoveva "scarto 2" qualunque fosse lo scarto vero, anche su una
copia in cui la bolla arrivava undici frame dopo.

NEL FOTOGRAMMA DEL CLIC IL THREAD SALE GIA'. La bolla nuova prende il suo posto
nel layout appena parte l'invio e compare quattro frame dopo, quindi la coda del
thread cambia due volte: insieme al colpo (i messaggi salgono) e dopo (la bolla
entra). La prima e' parte del colpo, e il banco cerca la conseguenza dopo la
quiete che segue. E' un difetto di giunta di stato da sistemare nella scena
(passo C), non qui.

LO SCARTO VA DA 2 A 8. Uno scarto di un frame non si distingue da due eventi
fusi, perche' l'animazione della bolla continua il fotogramma dopo; sopra otto
diventa software lento. La versione di prima dichiarava 1 ma cercava da 2.

Uso:  ./scripts/click-gap.py <scena.mp4> --ratio R [--scene PromptInput|PromptInputFast]

Esce 0 se lo scarto sta nell'intervallo, 1 se il clic non c'e', se non ha
conseguenza o se lo scarto e' fuori, 3 se il file, il quadro, la durata o il
manifest non tornano.
"""
import argparse
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("--ratio", default="16x9")
ap.add_argument("--scene", default="PromptInput")
args = ap.parse_args()
SRC = pathlib.Path(args.src)

# Quante volte il novantesimo percentile della zona del campo deve essere superato
# perche' sia il colpo. Misurato: una lettera battuta cambia 130-560 pixel, lo
# svuotamento 5000-12000, nei tre rapporti.
COLPO = 5
# Quanto la conseguenza deve risalire sopra la quiete che segue il colpo.
RISALITA = 1.4
# E il pavimento sotto cui non e' una conseguenza: mezzo per cento della zona del
# thread. La bolla al primo fotogramma utile cambia 2300-6000 pixel; il rumore
# fra due fotogrammi fermi, da zero a otto.
PAVIMENTO = 0.005
MIN, MAX = 2, 8
# Differenza per pixel, su 255, sotto cui due pixel sono lo stesso pixel.
SOGLIA_PIXEL = 20

if not SRC.exists():
    print("manca il render: %s" % SRC, file=sys.stderr)
    raise SystemExit(3)

geo = subprocess.run(
    ["node", str(ROOT / "scripts/manifest.mjs"), "bench", "click-gap", "--ratio", args.ratio],
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


def probe(entries):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0",
         "-show_entries", "stream=" + entries, "-of", "csv=p=0", str(SRC)],
        capture_output=True, text=True,
    ).stdout.strip()
    return [x for x in out.split(",") if x != ""]


w, h, n = (probe("width,height,nb_read_frames") + ["", "", ""])[:3]
if [w, h] != [str(g["stage"]["w"]), str(g["stage"]["h"])]:
    print("il quadro di %s e' %sx%s, lo stage di %s e' %dx%d: geometria di un altro rapporto"
          % (SRC.name, w, h, args.ratio, g["stage"]["w"], g["stage"]["h"]), file=sys.stderr)
    raise SystemExit(3)
if n != str(v["durationInFrames"]):
    print("%s ha %s fotogrammi, %s ne ha %d: non e' il render di quella scena"
          % (SRC.name, n, args.scene, v["durationInFrames"]), file=sys.stderr)
    raise SystemExit(3)

A, B = v["window"]


def serie(rect):
    """Pixel cambiati nella zona fra ogni fotogramma del tratto e il precedente."""
    vf = ("select='between(n\\,%d\\,%d)',crop=%d:%d:%d:%d,format=gray,"
          "tblend=all_mode=difference,lut=c0='if(gt(val\\,%d)\\,255\\,0)',"
          "signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-"
          % (A - 1, B, rect["w"], rect["h"], rect["x"], rect["y"], SOGLIA_PIXEL))
    out = subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", "-i", str(SRC), "-vf", vf,
         "-fps_mode", "passthrough", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stdout
    area = rect["w"] * rect["h"]
    vals = [float(x) / 255 * area for x in re.findall(r"YAVG=([0-9.]+)", out)]
    if len(vals) != B - A + 1:
        print("lettura della zona fallita: %d valori invece di %d" % (len(vals), B - A + 1),
              file=sys.stderr)
        raise SystemExit(3)
    return vals


# vals[i] e' la differenza fra il fotogramma A+i e il precedente.
campo = serie(v["rects"]["colpo"])
coda = serie(v["rects"]["conseguenza"])

srt = sorted(campo)
p90 = max(srt[int(len(srt) * 0.9)], 1.0)
hit = max(range(len(campo)), key=lambda i: campo[i])
if campo[hit] < p90 * COLPO:
    hit = -1

print("Scarto fra il clic d'invio e la sua conseguenza, su %s (%s)." % (SRC.name, args.ratio))
print("Tratto a camera ferma: fotogrammi %d-%d. Zone dal manifest: campo %s, thread %s."
      % (A, B, "%(w)dx%(h)d+%(x)d+%(y)d" % v["rects"]["colpo"],
         "%(w)dx%(h)d+%(x)d+%(y)d" % v["rects"]["conseguenza"]))
print()

if hit < 0:
    print("  il colpo: nessun fotogramma supera %dx il p90 del campo (%d px)" % (COLPO, p90))
    print()
    print("FALLITO: nel campo non c'e' il clic d'invio: il testo non si svuota mai.", file=sys.stderr)
    raise SystemExit(1)

pavimento = PAVIMENTO * v["rects"]["conseguenza"]["w"] * v["rects"]["conseguenza"]["h"]
quiete = sorted(coda[hit + 1:hit + 4])[1] if len(coda) > hit + 4 else 0
soglia = max(quiete * RISALITA, pavimento)
cons = next((i for i in range(hit + 1, min(hit + 20, len(coda))) if coda[i] >= soglia), -1)

print("  %-38s f%d  (%d px, p90 del campo %d)" % ("il colpo, nel campo", A + hit, campo[hit], p90))
print("  %-38s %d px" % ("il thread insieme al colpo", coda[hit]))
print("  %-38s %d px  (soglia %d)" % ("la quiete dopo il colpo", quiete, soglia))
if cons < 0:
    print()
    print("FALLITO: dopo il clic il thread non risponde entro venti frame, o la sua" , file=sys.stderr)
    print("animazione era gia' in corso nel fotogramma del clic, cioe' i due eventi", file=sys.stderr)
    print("si sono fusi.", file=sys.stderr)
    raise SystemExit(1)

gap = cons - hit
print("  %-38s f%d  (%d px)" % ("la conseguenza, nel thread", A + cons, coda[cons]))
print("  %-38s %d frame" % ("scarto", gap))
print()

if not MIN <= gap <= MAX:
    print("FALLITO: lo scarto e' di %d frame, fuori dall'intervallo %d-%d." % (gap, MIN, MAX),
          file=sys.stderr)
    print("Sotto il minimo il nesso fra gesto e risposta sparisce; sopra il massimo non", file=sys.stderr)
    print("legge come una conseguenza, legge come software lento.", file=sys.stderr)
    raise SystemExit(1)

print("VERDETTO: il colpo cade a f%d e la conseguenza a f%d, %d frame dopo." % (A + hit, A + cons, gap))
print("La UI risponde al clic invece di rispondere insieme al clic.")
