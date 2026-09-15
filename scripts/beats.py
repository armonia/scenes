#!/usr/bin/env python3
"""I quattro tempi di PromptInput, verificati sul file finito.

PERCHE' ESISTE. La scena chiede quattro cose: il cursore entra, digita, invia,
la risposta arriva in streaming. Il render ne ha mostrate tre per un giorno
intero senza che niente protestasse. Il thread e' ancorato in basso e il
composer e' opaco: l'ultimo messaggio finiva sotto, quindi la risposta si
componeva parola per parola dove nessuno poteva vederla. Il codice era giusto,
il layout no, e nessun typecheck vede una cosa del genere. La vede solo
qualcuno che legge il fotogramma.

COME. Si leggono i fotogrammi con l'OCR e si contano le parole attese. La
condizione non e' "ce ne sono": e' che siano di PIU' ogni volta, nella battitura
e nello streaming. Una soglia fissa la passerebbe anche un fermo immagine con la
risposta gia' stampata; la crescita no, quella la puo' produrre solo un testo
che si compone.

COSA ARRIVA DAL MANIFEST (`bench beats --ratio R`): i fotogrammi, calcolati
dalla recita della scena alla sua durata; le parole da cercare, tolte quelle che
il thread mostrava gia'; la zona del quadro da leggere, cioe' thread e campo alla
posa ferma del rapporto. Prima erano sei frame e due elenchi di parole copiati
dalla scena, e l'OCR leggeva il quadro intero, board compresa.

COSA LO FA FALLIRE, che e' la sola cosa che rende un banco un banco. Un fermo
immagine della fine: la battitura non cresce e lo streaming nemmeno. La coda del
thread coperta, cioe' la regressione del composer sopra i messaggi: il messaggio
inviato e la risposta non si vedono. Tutti e due escono 1.

SENZA L'OCR QUESTO BANCO NON MISURA NIENTE, e deve dirlo invece di bocciare: con
tesseract assente ogni lettura torna vuota, ogni conteggio zero, e il verdetto
diventerebbe "la risposta non si vede mai", una diagnosi sulla scena per un
guasto dello strumento. Esce 3. Il comando si puo' cambiare con TESSERACT, ed e'
cosi' che la CI prova l'uscita 3 senza spostare il binario con sudo.

Uso:  ./scripts/beats.py <scena.mp4> --ratio R [--scene PromptInput|PromptInputFast]

Esce 0 se i quattro tempi si vedono, 1 se ne manca uno, 3 se mancano il file,
l'OCR o il manifest, o se quadro e durata non sono quelli del rapporto.
"""
import argparse
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("--ratio", default="16x9")
ap.add_argument("--scene", default="PromptInput")
args = ap.parse_args()
SRC = pathlib.Path(args.src)
TESSERACT = os.environ.get("TESSERACT", "tesseract")

if not shutil.which(TESSERACT):
    print("manca l'OCR (%s): senza, questo banco non puo' leggere niente." % TESSERACT, file=sys.stderr)
    print("  macOS:  brew install tesseract", file=sys.stderr)
    print("  debian: sudo apt-get install -y tesseract-ocr", file=sys.stderr)
    raise SystemExit(3)
if not SRC.exists():
    print("manca il render: %s" % SRC, file=sys.stderr)
    raise SystemExit(3)

geo = subprocess.run(
    ["node", str(ROOT / "scripts/manifest.mjs"), "bench", "beats", "--ratio", args.ratio],
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

# Non sotto /tmp su macOS: e' un symlink e tesseract non lo segue. La cartella e'
# privata di questa esecuzione, quindi due rapporti in parallelo non si
# cancellano i fotogrammi a vicenda come faceva la vecchia out/.beats.
WORK = pathlib.Path(tempfile.mkdtemp(prefix=".beats-", dir=ROOT / "video" / "out"
                                     if (ROOT / "video" / "out").is_dir() else None))
IM = ["magick"] if shutil.which("magick") else ["convert"]
r = v["read"]


def ocr_at(frame):
    png = WORK / ("f%d.png" % frame)
    gray = WORK / ("g%d.png" % frame)
    subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", "-i", str(SRC),
         "-vf", "select=eq(n\\,%d),crop=%d:%d:%d:%d" % (frame, r["w"], r["h"], r["x"], r["y"]),
         "-frames:v", "1", "-y", str(png)],
        capture_output=True,
    )
    if not png.exists() or png.stat().st_size == 0:
        print("estrazione del fotogramma %d fallita su %s" % (frame, SRC), file=sys.stderr)
        raise SystemExit(3)
    subprocess.run(IM + [str(png), "-colorspace", "Gray", "-normalize", str(gray)], capture_output=True)
    res = subprocess.run([TESSERACT, str(gray), "stdout", "--psm", "6"], capture_output=True, text=True)
    return res.stdout.lower()


def hits(text, wanted):
    return sum(1 for word in wanted if word in text)


try:
    f = v["frames"]
    fail = []
    print("I quattro tempi di %s (%s), letti nella zona %dx%d+%d+%d." % (SRC.name, args.ratio, r["w"], r["h"], r["x"], r["y"]))
    print()

    t1 = hits(ocr_at(f["type1"]), g["promptWords"])
    t2 = hits(ocr_at(f["type2"]), g["promptWords"])
    ok = t2 > t1
    print("  digita     f%d: %d parole   f%d: %d parole   %s" % (f["type1"], t1, f["type2"], t2, "ok" if ok else "FERMO"))
    if not ok:
        fail.append("digita")

    sent = ocr_at(f["sent"])
    t3 = hits(sent, g["promptWords"])
    ok = t3 >= len(g["promptWords"]) - 1
    print("  invia      f%d: %d parole del prompt in quadro   %s" % (f["sent"], t3, "ok" if ok else "IL MESSAGGIO NON C'E'"))
    if not ok:
        fail.append("invia")
    ok = "chiedi qualcosa" in sent
    print("             il campo %s" % ("e' tornato al segnaposto   ok" if ok else "NON si e' svuotato"))
    if not ok:
        fail.append("campo")

    s = [hits(ocr_at(x), g["responseWords"]) for x in f["stream"]]
    if s[2] > s[1] > s[0]:
        esito = "ok"
    elif s[2] == 0:
        esito = "LA RISPOSTA NON SI VEDE MAI"
        fail.append("streaming")
    else:
        esito = "NON CRESCE"
        fail.append("streaming")
    print("  streaming  %s   %s" % ("   ".join("f%d: %d" % (x, y) for x, y in zip(f["stream"], s)), esito))
    print()
finally:
    shutil.rmtree(WORK, ignore_errors=True)

if fail:
    print("VERDETTO: manca un tempo (%s). Vedi sopra quale." % ", ".join(fail))
    raise SystemExit(1)
print("VERDETTO: tutti e quattro i tempi si vedono nel render.")
