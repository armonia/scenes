#!/usr/bin/env python3
"""Il contenuto attenuato resta leggibile, o e' diventato sporco sul fondo?

PERCHE' ESISTE. CAM-05 dice che quello che non e' il soggetto scende a 0,62 e
non piu' giu', e che 0,62 e' un PAVIMENTO: sotto, il contenuto attenuato scende
sotto 3:1 una volta renderizzato e legge come sporco invece che come un piano
dietro. Quel 3:1 era una frase. Nessuno l'aveva mai misurato, e un numero che
nessuno misura e' un numero che qualcuno ha scritto.

COSA MISURA. Il rapporto di contrasto WCAG fra il testo attenuato e il suo
fondo, su un fotogramma vero, mentre la risposta scorre. Il ritaglio non e'
scelto a occhio: e' la fascia di intestazione del thread, e la sua posizione
esce da topics/geometry.ts proiettata con la posa finale di PromptInput. Quella posa sta a
yaw e pitch zero, quindi la proiezione e' esatta.

IL RITAGLIO STA SU UNA POSIZIONE ARITMETICA, e la prima versione no. Puntava la
fascia dei messaggi gia' scambiati, che e' contenuto giusto e posto sbagliato: i
messaggi hanno altezza naturale e il thread e' ancorato in basso, quindi basta
che le metriche dei font cambino - ed e' quello che succede fra questa macchina
e il Linux della CI - perche' tutto scorra e il ritaglio finisca sul vuoto. In
CI usciva 3, "non ho potuto misurare", che almeno era la risposta onesta.
L'intestazione invece sta a THREAD_TOP, che e' una costante.

NON MISURA IL SEGNAPOSTO DEL COMPOSER, e nemmeno quello e' un caso. "Chiedi
qualcosa" e' testo tenue di proposito: a piena opacita' sta gia' a 2,93:1,
quindi il banco lo bocciava a prescindere dall'attenuazione e dava la colpa a
CAM-05 per una scelta di design del campo. Un segnaposto non e' contenuto, e la
voce parla di contenuto.

COME LEGGE. Il fondo e' il valore piu' frequente del ritaglio, il testo e' la
media del NUCLEO dei glifi, cioe' dei pixel sopra il sessanta per cento fra
fondo e massimo. I percentili non bastavano: su un ritaglio in cui il testo e'
poca roba, il novantasettesimo percentile misura ancora il fondo, e la stessa
scena leggeva 2,59:1 o 4,17:1 secondo quanto testo capitava dentro il rettangolo.

COME FALLISCE. Sulla stessa scena resa con attnFloor a 0,25, cioe' attenuata
troppo, esce 1.

UN RITAGLIO VUOTO ESCE 3, e prima usciva 1. La docstring lo prometteva gia', ma
il controllo guardava solo quanti pixel stavano sopra la soglia del nucleo: su
un fondo uniforme o sul rumore di codifica il massimo coincide col fondo, la
soglia collassa sul fondo, il "nucleo" diventa mezzo ritaglio e il rapporto va a
1,00. Il banco diceva "alza il pavimento" per un ritaglio finito sul vuoto, che
in 9:16 e' esattamente quello che succede se la posa sposta l'intestazione fuori
dal punto calcolato. Adesso, prima di ogni verdetto: se fra fondo e massimo ci
sono meno di SEGNALE_MIN livelli, o se il nucleo occupa piu' di meta' del
ritaglio, non c'e' testo e il banco non ha misurato niente.

IN OGNI RAPPORTO. Il ritaglio e il fotogramma vengono dal manifest (`bench
contrast-floor --ratio R`), per la scena e per il suo provino veloce. Il banco
controlla che il quadro del file sia lo stage del rapporto: un 9:16 misurato con
la geometria del 16:9 esce 3, non con un numero.

UN FOTOGRAMMA SOLO BASTA. Il negativo non ha bisogno di rendere 450 fotogrammi
per leggerne uno: con un .png il banco legge quel fotogramma, e la fixture e' un
`remotion still` sul frame giusto.

Uso:  ./scripts/contrast-floor.py <scena.mp4|fotogramma.png> --ratio R [--scene PromptInput|PromptInputFast]

Esce 0 se il contrasto regge, 1 se sta sotto la soglia, 3 se il file manca, il
quadro non e' quello del rapporto, il manifest non risponde o il ritaglio non
contiene testo.
"""
import argparse, json, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("src", nargs="?", default=str(ROOT / "video/out/prompt-input.mp4"))
ap.add_argument("--ratio", default="16x9")
ap.add_argument("--scene", default="PromptInput")
args = ap.parse_args()
SRC = pathlib.Path(args.src)
SOGLIA = 3.0
# Sotto questo numero di pixel il ritaglio non contiene testo, e non c'e' niente
# di cui misurare il contrasto.
NUCLEO_MINIMO = 120
# Quanti livelli di grigio servono fra fondo e massimo perche' nel ritaglio ci
# sia testo. Misurato sulla scena attenuata a 0,25, che e' il caso piu' debole
# che il banco deve ancora leggere: fondo 20, massimo 67, cioe' 47 livelli, uguale
# nei tre rapporti. Un fondo uniforme ne da' zero e il rumore di codifica due o
# tre. Venti sta a due volte e mezzo sotto il caso debole e a sette sopra il
# rumore; quaranta, il primo valore provato, lasciava solo sette livelli di
# margine al negativo, e un font di Linux un filo piu' sottile l'avrebbe fatto
# uscire 3 invece di 1.
SEGNALE_MIN = 20

if not SRC.exists():
    print("manca il render: %s" % SRC, file=sys.stderr)
    raise SystemExit(3)

# La geometria viene dal manifest: l'intestazione del thread all'ultima posa di
# PromptInput nel rapporto, proiettata e con dimensioni pari, e il fotogramma in
# cui leggerla per ogni durata (video/src/products/topics/benches/contrast-floor.ts).
geo = subprocess.run(
    ["node", "%s/scripts/manifest.mjs" % ROOT, "bench", "contrast-floor", "--ratio", args.ratio],
    capture_output=True, text=True,
)
if geo.returncode != 0:
    print("non riesco a leggere la geometria dal manifest:\n" + geo.stderr, file=sys.stderr)
    raise SystemExit(3)
g = json.loads(geo.stdout)
r = g["crop"]
variante = next((v for v in g["variants"] if v["id"] == args.scene), None)
if variante is None:
    print("il manifest non conosce la scena %s" % args.scene, file=sys.stderr)
    raise SystemExit(3)

dims = subprocess.run(
    ["ffprobe", "-v", "error", "-select_streams", "v:0",
     "-show_entries", "stream=width,height", "-of", "csv=p=0", str(SRC)],
    capture_output=True, text=True,
).stdout.strip().split(",")[:2]
if dims != [str(g["stage"]["w"]), str(g["stage"]["h"])]:
    print("il quadro di %s e' %s, lo stage di %s e' %dx%d: geometria di un altro rapporto"
          % (SRC.name, "x".join(dims), args.ratio, g["stage"]["w"], g["stage"]["h"]), file=sys.stderr)
    raise SystemExit(3)

if SRC.suffix.lower() == ".png":
    FRAME = variante["frame"]
    select = ""
else:
    nf = subprocess.run(
        ["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0",
         "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", str(SRC)],
        capture_output=True, text=True,
    ).stdout
    nf = int("".join(c for c in nf if c.isdigit()) or 0)
    if nf != variante["durationInFrames"]:
        print("%s ha %d fotogrammi, %s ne ha %d: non e' il render di quella scena"
              % (SRC.name, nf, args.scene, variante["durationInFrames"]), file=sys.stderr)
        raise SystemExit(3)
    FRAME = variante["frame"]
    select = "select=eq(n\\,%d)," % FRAME

raw = subprocess.run(
    ["ffmpeg", "-nostdin", "-v", "error", "-i", str(SRC),
     "-vf", "%scrop=%d:%d:%d:%d,format=gray" % (select, r["w"], r["h"], r["x"], r["y"]),
     "-frames:v", "1", "-f", "rawvideo", "-"],
    capture_output=True,
).stdout
if len(raw) < r["w"] * r["h"]:
    print("estrazione del fotogramma %d fallita su %s" % (FRAME, SRC), file=sys.stderr)
    raise SystemExit(3)

px = raw[: r["w"] * r["h"]]


def lum(v255):
    """Luminanza relativa sRGB, come la definisce WCAG."""
    c = v255 / 255.0
    c = c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return c


# Il fondo e' il valore piu' frequente; il testo e' il nucleo dei glifi, cioe'
# i pixel sopra il 60 per cento fra fondo e massimo. Cosi' l'antialiasing dei
# bordi, che non e' ne' fondo ne' testo, resta fuori da entrambi.
conteggi = [0] * 256
for v in px:
    conteggi[v] += 1
bg = conteggi.index(max(conteggi))
mx = max(px)
soglia_nucleo = bg + 0.6 * (mx - bg)
nucleo = [v for v in px if v >= soglia_nucleo]

if mx - bg < SEGNALE_MIN or len(nucleo) > len(px) / 2:
    print("MISURA INUTILE: fra fondo (%d) e massimo (%d) ci sono %d livelli, e il nucleo"
          % (bg, mx, mx - bg), file=sys.stderr)
    print("occupa %d pixel su %d. Li' dentro non c'e' testo: il ritaglio e' finito sul"
          % (len(nucleo), len(px)), file=sys.stderr)
    print("fondo, e un rapporto di contrasto su quello non direbbe niente della scena.", file=sys.stderr)
    raise SystemExit(3)

if len(nucleo) < NUCLEO_MINIMO:
    print("MISURA INUTILE: nel ritaglio ci sono %d pixel di testo, sotto i %d che"
          % (len(nucleo), NUCLEO_MINIMO), file=sys.stderr)
    print("servono. Li' dentro non c'e' scritto niente, quindi non c'e' niente di", file=sys.stderr)
    print("cui misurare il contrasto: il ritaglio va rifatto, non la scena.", file=sys.stderr)
    raise SystemExit(3)

fg = sum(nucleo) / len(nucleo)
l1, l2 = max(lum(fg), lum(bg)), min(lum(fg), lum(bg))
ratio = (l1 + 0.05) / (l2 + 0.05)

print("Contrasto del contenuto attenuato su %s, fotogramma %d." % (SRC.name, FRAME))
print("Ritaglio sull'intestazione del thread in %s, proiettato dal manifest: %dx%d a (%d,%d)."
      % (args.ratio, r["w"], r["h"], r["x"], r["y"]))
print()
print("  fondo (valore piu' frequente)      %3d" % bg)
print("  testo attenuato (nucleo, %5d px) %5.1f" % (len(nucleo), fg))
print("  rapporto di contrasto              %.2f:1   (soglia %.1f:1)" % (ratio, SOGLIA))
print()

if ratio < SOGLIA:
    print("FALLITO: il contenuto attenuato sta a %.2f:1, sotto %.1f:1." % (ratio, SOGLIA),
          file=sys.stderr)
    print("A quel punto non e' un piano dietro, e' sporco sul fondo: il numero da", file=sys.stderr)
    print("alzare e' il pavimento dell'attenuazione, non l'opacita' del soggetto.", file=sys.stderr)
    raise SystemExit(1)

print("VERDETTO: il contenuto attenuato regge %.2f:1, sopra la soglia di %.1f:1." % (ratio, SOGLIA))
print("Il pavimento a 0,62 e' un numero misurato e non piu' una frase.")
