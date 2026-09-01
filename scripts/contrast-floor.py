#!/usr/bin/env python3
"""Il contenuto attenuato resta leggibile, o e' diventato sporco sul fondo?

PERCHE' ESISTE. CAM-05 dice che quello che non e' il soggetto scende a 0,62 e
non piu' giu', e che 0,62 e' un PAVIMENTO: sotto, il contenuto attenuato scende
sotto 3:1 una volta renderizzato e legge come sporco invece che come un piano
dietro. Quel 3:1 era una frase. Nessuno l'aveva mai misurato, e un numero che
nessuno misura e' un numero che qualcuno ha scritto.

COSA MISURA. Il rapporto di contrasto WCAG fra il testo attenuato e il suo
fondo, su un fotogramma vero, mentre la risposta scorre. Il ritaglio non e'
scelto a occhio: e' la fascia dei messaggi gia' scambiati, che in quel momento
e' attenuata per costruzione, e la sua posizione esce da slab.ts proiettata con
la posa finale di PromptInput. Quella posa sta a yaw e pitch zero, quindi la
proiezione e' esatta e non un'approssimazione.

NON MISURA IL SEGNAPOSTO DEL COMPOSER, e la prima versione lo faceva. "Chiedi
qualcosa" e' testo tenue di proposito: a piena opacita' sta gia' a 2,75:1,
quindi il banco lo bocciava a prescindere dall'attenuazione e dava la colpa a
CAM-05 per una scelta di design del campo. Un segnaposto non e' contenuto, e la
voce parla di contenuto.

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
# Sotto questo rapporto il ritaglio non contiene testo: fondo e "testo" sono la
# stessa cosa, e non c'e' niente da giudicare.
NIENTE_TESTO = 1.2
# Il fotogramma: tardi nello streaming, quando l'attenuazione e' a regime.
FRAME = 430

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
// La fascia dei messaggi gia' scambiati, sopra la risposta in arrivo: e'
// contenuto vero, ed e' attenuato per costruzione mentre la risposta scorre.
const x0 = m.SIDEBAR_W + 70, x1 = m.SIDEBAR_W + 1100;
const y0 = 820, y1 = 880;
const P = (x, y) => {
  const s = m.slabPointOnScreen(x, y);
  return [ox + (s.x + p.slideX - ox) * k, oy + (s.y + (p.slideY ?? 0) - oy) * k];
};
const a = P(x0, y0), b = P(x1, y1);
console.log(JSON.stringify({
  x: Math.round(a[0]), y: Math.round(a[1]),
  w: Math.round(b[0] - a[0]), h: Math.round(b[1] - a[1]),
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

raw = subprocess.run(
    ["ffmpeg", "-nostdin", "-v", "error", "-i", str(SRC),
     "-vf", "select=eq(n\\,%d),crop=%d:%d:%d:%d,format=gray" % (FRAME, r["w"], r["h"], r["x"], r["y"]),
     "-frames:v", "1", "-f", "rawvideo", "-"],
    capture_output=True,
).stdout
if len(raw) < r["w"] * r["h"]:
    print("estrazione del fotogramma %d fallita su %s" % (FRAME, SRC), file=sys.stderr)
    raise SystemExit(3)

vals = sorted(raw[: r["w"] * r["h"]])


def lum(v255):
    """Luminanza relativa sRGB, come la definisce WCAG."""
    c = v255 / 255.0
    c = c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return c


def perc(p):
    return vals[min(len(vals) - 1, int(len(vals) * p))]


# Il fondo del campo e' la moda scura, il testo la coda chiara. I percentili
# tengono fuori l'antialiasing dei bordi, che non e' ne' l'uno ne' l'altro.
bg, fg = perc(0.20), perc(0.97)
l1, l2 = max(lum(fg), lum(bg)), min(lum(fg), lum(bg))
ratio = (l1 + 0.05) / (l2 + 0.05)

print("Contrasto del contenuto attenuato su %s, fotogramma %d." % (SRC.name, FRAME))
print("Ritaglio sulla fascia dei messaggi, proiettato da slab.ts: %dx%d a (%d,%d)."
      % (r["w"], r["h"], r["x"], r["y"]))
print()
print("  fondo del campo (20° percentile)   %3d" % bg)
print("  testo attenuato (97° percentile)   %3d" % fg)
print("  rapporto di contrasto              %.2f:1   (soglia %.1f:1)" % (ratio, SOGLIA))
print()

if ratio < NIENTE_TESTO:
    print("MISURA INUTILE: nel ritaglio fondo e testo coincidono (%.2f:1)." % ratio,
          file=sys.stderr)
    print("Li' dentro non c'e' testo, quindi non c'e' niente di cui misurare il", file=sys.stderr)
    print("contrasto. Il layout del thread e' cambiato e il ritaglio va rifatto.", file=sys.stderr)
    raise SystemExit(3)

if ratio < SOGLIA:
    print("FALLITO: il contenuto attenuato sta a %.2f:1, sotto %.1f:1." % (ratio, SOGLIA),
          file=sys.stderr)
    print("A quel punto non e' un piano dietro, e' sporco sul fondo: il numero da", file=sys.stderr)
    print("alzare e' il pavimento dell'attenuazione, non l'opacita' del soggetto.", file=sys.stderr)
    raise SystemExit(1)

print("VERDETTO: il contenuto attenuato regge %.2f:1, sopra la soglia di %.1f:1." % (ratio, SOGLIA))
print("Il pavimento a 0,62 e' un numero misurato e non piu' una frase.")
