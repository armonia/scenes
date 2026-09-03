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
esce da slab.ts proiettata con la posa finale di PromptInput. Quella posa sta a
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

COME FALLISCE. Sul render fatto con attnFloor a 0,25, cioe' la stessa scena
attenuata troppo, esce rosso. E se il ritaglio non contiene testo - perche'
qualcuno ha cambiato il layout e la fascia adesso e' vuota - le due letture
coincidono, il rapporto va verso 1, e allora esce 3: non ho potuto misurare, che
e' un'altra cosa da "ho misurato e non va".

Uso:  ./scripts/contrast-floor.py [scena.mp4]
"""
import json, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "video/out/prompt-input.mp4"
SOGLIA = 3.0
# Sotto questo numero di pixel il ritaglio non contiene testo, e non c'e' niente
# di cui misurare il contrasto.
NUCLEO_MINIMO = 120
# Il fotogramma da guardare, tardi nello streaming, quando l'attenuazione e' a
# regime - espresso alla durata di riferimento della scena e poi scalato.
#
# SEGUE LA DURATA perche' le battute interne la seguono (primitives/tempo.ts):
# su un render ritempificato a due terzi il fotogramma 430 non esiste, e su uno
# a meta' cadrebbe dopo la fine.
BASE_FRAMES = 450
FRAME_BASE = 430

if not SRC.exists():
    print("manca il render: %s" % SRC, file=sys.stderr)
    raise SystemExit(1)

# La geometria viene dal modulo, non da due numeri copiati qui.
geo = subprocess.run(
    ["node", "--input-type=module", "-e", """
const m = await import("%s/video/src/primitives/slab.ts");
const p = m.PROMPT_INPUT_END_POSE;
const k = m.zoomForPush(p.pushZ);
const ox = m.COMP_W / 2, oy = m.COMP_H * m.PERSPECTIVE_ORIGIN_Y;
// L'intestazione del thread: contenuto vero, attenuato per costruzione mentre
// la risposta scorre, e in una posizione che e' aritmetica invece che
// dipendente da come vanno a capo i messaggi.
const x0 = m.SIDEBAR_W + 20, x1 = m.SIDEBAR_W + 560;
const y0 = m.THREAD_TOP + 10, y1 = m.THREAD_TOP + 44;
const P = (x, y) => {
  const s = m.slabPointOnScreen(x, y);
  return [ox + (s.x + p.slideX - ox) * k, oy + (s.y + (p.slideY ?? 0) - oy) * k];
};
const a = P(x0, y0), b = P(x1, y1);
// Dimensioni PARI: su una sorgente yuv420p ffmpeg arrotonda un ritaglio
// dispari al pixel sotto, restituisce una riga in meno di quella chiesta, e il
// controllo sulla lunghezza del buffer scatta dicendo che l'estrazione e'
// fallita quando invece e' solo diversa di uno.
const pari = (v) => 2 * Math.floor(v / 2);
console.log(JSON.stringify({
  x: pari(Math.max(0, Math.round(a[0]))), y: pari(Math.round(a[1])),
  w: pari(Math.round(b[0] - a[0])), h: pari(Math.round(b[1] - a[1])),
}));
""" % ROOT],
    capture_output=True, text=True,
)
if geo.returncode != 0:
    print("non riesco a leggere la geometria da slab.ts:\n" + geo.stderr, file=sys.stderr)
    raise SystemExit(3)
r = json.loads(geo.stdout.strip().splitlines()[-1])
if r["w"] < 40 or r["h"] < 12:
    print("il ritaglio calcolato e' degenere: %s" % r, file=sys.stderr)
    raise SystemExit(3)

nf = subprocess.run(
    ["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0",
     "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", str(SRC)],
    capture_output=True, text=True,
).stdout
nf = int("".join(c for c in nf if c.isdigit()) or 0)
if nf <= 0:
    print("non riesco a contare i fotogrammi di %s" % SRC, file=sys.stderr)
    raise SystemExit(3)
FRAME = round(FRAME_BASE * nf / BASE_FRAMES)

raw = subprocess.run(
    ["ffmpeg", "-nostdin", "-v", "error", "-i", str(SRC),
     "-vf", "select=eq(n\\,%d),crop=%d:%d:%d:%d,format=gray" % (FRAME, r["w"], r["h"], r["x"], r["y"]),
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
print("Ritaglio sull'intestazione del thread, proiettato da slab.ts: %dx%d a (%d,%d)."
      % (r["w"], r["h"], r["x"], r["y"]))
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
