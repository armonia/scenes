#!/usr/bin/env python3
"""Accorciare una scena la rende piu' veloce, o le taglia solo la coda?

PERCHE' ESISTE. Da `primitives/tempo.ts` i tempi interni di una scena sono
scritti rispetto a una durata di riferimento, e `durationInFrames` in
catalog.json li scala tutti: cambiare la velocita' di una clip e' cambiare un
numero. E' una promessa facile da rompere in silenzio - basta che una battuta
resti scritta in frame nudi e il gesto si scompone - e impossibile da verificare
guardando, perche' due render alla stessa velocita' apparente hanno durate
diverse.

COME SI MISURA. Se le battute scalano, il fotogramma f del render breve e' il
fotogramma f/k del render lungo, con k il rapporto fra le durate. Quindi si
confrontano le due sequenze DOPO aver normalizzato il tempo, e in parallelo
senza normalizzarlo. Se il tempo scala, il primo confronto e' quasi nullo e il
secondo grande; se la scena e' stata solo tagliata, e' l'opposto.

IL RESIDUO NON DEVE ESSERE ZERO, ed e' la parte interessante. Le soglie
percettive - i tre frame di ritardo della card sulla mano, i quattro fra il clic
e la conseguenza, il periodo del caret - NON scalano di proposito. Se il
confronto normalizzato venisse identico vorrebbe dire che hanno scalato anche
loro, cioe' che la scena veloce ha perso il peso degli oggetti e il nesso fra
gesto ed effetto. Il residuo e' la loro firma.

COSA LO FA FALLIRE. Un ritaglio: la stessa scena troncata alla durata breve
invece di ritempificata. Li' il confronto normalizzato e' quello sbagliato e il
banco lo dice.

IN OGNI RAPPORTO, E SU TUTTO IL QUADRO. La prima versione rimpiccioliva a un
480x270 scritto a mano e teneva i primi 480x270 byte: in 16:9 era il quadro
intero, in 9:16 era il terzo alto e in 4:5 poco meno della meta', e nessuno se
ne accorgeva perche' il banco passava lo stesso. Adesso la scala e' un quarto
del lato del render, qualunque sia, e si confronta tutto il fotogramma. In 16:9
e' ancora 480x270, quindi i numeri di prima non cambiano.

LE FINESTRE PERCETTIVE, e perche' il banco le chiede. Il residuo sta tutto
nelle finestre in cui una soglia non scala (in CardHandoff dalla presa alla
posa: la card in ritardo di tre frame sulla mano). In 16:9 pesava poco e la
mediana su tutto il tratto passava con 18x; in 9:16 la card e' grande il doppio
e la camera la segue, e la stessa mediana dava 2,8x su un render giusto. Con
`--percettive a-b` il confronto si fa in due parti: FUORI dalle finestre il
tempo normalizzato deve battere l'altro di VANTAGGIO volte, DENTRO il residuo
deve esserci, altrimenti le soglie hanno scalato anche loro. Le finestre le
dichiara la scena, nel manifest (`bench tempo`): il banco non sa quali sono.

Uso:  ./scripts/tempo.py [lungo.mp4 breve.mp4] [--percettive a-b[,c-d]]

Esce 0 se il tempo scala, 1 se la scena breve e' un ritaglio o se le soglie
percettive hanno scalato anche loro, 3 se un render manca, i due render hanno
quadri diversi o nel tratto non succede niente.
"""
import argparse
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("lungo", nargs="?", default=str(ROOT / "video/out/card-handoff.mp4"))
ap.add_argument("breve", nargs="?", default=str(ROOT / "video/out/.fast-card-handoff.mp4"))
ap.add_argument("--percettive", default="", help="finestre a-b,c-d in frame del render breve")
args = ap.parse_args()
LUNGO = pathlib.Path(args.lungo)
BREVE = pathlib.Path(args.breve)
try:
    FINESTRE = [tuple(int(x) for x in w.split("-")) for w in args.percettive.split(",") if w]
except ValueError:
    print("finestre illeggibili: %r" % args.percettive, file=sys.stderr)
    raise SystemExit(3)

# Quante volte il confronto normalizzato deve battere quello non normalizzato.
# Misurato: 19x fra i 240 e i 120 fotogrammi di CardHandoff.
VANTAGGIO = 4.0
SOGLIA_PIXEL = 26

for p in (LUNGO, BREVE):
    if not p.exists():
        print("manca il render: %s" % p, file=sys.stderr)
        raise SystemExit(3)


def quadro(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True,
    ).stdout.strip()
    # ffprobe in csv puo' lasciare una virgola in coda (dati laterali del flusso):
    # si prendono i primi due numeri.
    try:
        w, h = (int(x) for x in out.split(",")[:2])
    except ValueError:
        print("non riesco a leggere le dimensioni di %s: %r" % (path, out), file=sys.stderr)
        raise SystemExit(3)
    return w, h


# Un quarto del lato, arrotondato al pari: 1920x1080 -> 480x270 come prima,
# 1080x1920 -> 270x480, 1080x1350 -> 270x338. La densita' di campionamento e'
# la stessa in ogni rapporto.
if quadro(LUNGO) != quadro(BREVE):
    print("i due render hanno quadri diversi: %s contro %s" % (quadro(LUNGO), quadro(BREVE)),
          file=sys.stderr)
    raise SystemExit(3)
_w, _h = quadro(LUNGO)
W, H = 2 * round(_w / 8), 2 * round(_h / 8)


def conta(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0",
         "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True,
    ).stdout
    n = "".join(c for c in out if c.isdigit())
    if not n:
        print("non riesco a contare i fotogrammi di %s" % path, file=sys.stderr)
        raise SystemExit(3)
    return int(n)


def frame(path, f):
    raw = subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", "-i", str(path),
         "-vf", "select=eq(n\\,%d),scale=%d:%d,format=gray" % (f, W, H),
         "-frames:v", "1", "-f", "rawvideo", "-"],
        capture_output=True,
    ).stdout
    return raw[: W * H]


def diff(a, b):
    if len(a) < W * H or len(b) < W * H:
        return None
    return sum(1 for x, y in zip(a, b) if abs(x - y) > SOGLIA_PIXEL)


n_lungo, n_breve = conta(LUNGO), conta(BREVE)
if n_breve >= n_lungo:
    print("il secondo render non e' piu' breve del primo (%d contro %d)" % (n_breve, n_lungo),
          file=sys.stderr)
    raise SystemExit(3)
k = n_breve / n_lungo

print("Tempo di %s (%d fotogrammi) contro %s (%d), confrontati a %dx%d."
      % (LUNGO.name, n_lungo, BREVE.name, n_breve, W, H))
print("Fattore %.3f. Se le battute scalano, il fotogramma f del breve e' il f/%.3f del lungo."
      % (k, k))
print()

def dentro(f):
    return any(a <= f <= b for a, b in FINESTRE)


campioni = [f for f in range(10, n_breve - 5, max(4, n_breve // 30))]
norm, gre, residui = [], [], []
for f in campioni:
    a = frame(BREVE, f)
    dn = diff(a, frame(LUNGO, round(f / k)))
    dg = diff(a, frame(LUNGO, f))
    if dn is None or dg is None:
        print("estrazione fallita al fotogramma %d" % f, file=sys.stderr)
        raise SystemExit(3)
    if dentro(f):
        residui.append(dn)
    else:
        norm.append(dn)
        gre.append(dg)

if not norm:
    print("tutti i campioni cadono nelle finestre percettive: non resta niente da misurare",
          file=sys.stderr)
    raise SystemExit(3)

def mediana(v):
    s = sorted(v)
    return s[len(s) // 2]

m_norm, m_gre = mediana(norm), mediana(gre)
fuori = " fuori dalle finestre percettive" if FINESTRE else ""
print("  %d campioni%s, %d dentro" % (len(norm), fuori, len(residui)))
print("  %-42s %6d px" % ("differenza a tempo normalizzato (mediana)", m_norm))
print("  %-42s %6d px" % ("differenza senza normalizzare (mediana)", m_gre))
if residui:
    print("  %-42s %6d px" % ("residuo massimo nelle finestre percettive", max(residui)))
print()

if m_norm == 0 and m_gre == 0:
    print("MISURA INUTILE: i due render non differiscono in nessuno dei due confronti.",
          file=sys.stderr)
    print("Nel tratto campionato non succede niente, quindi non c'e' tempo da misurare.",
          file=sys.stderr)
    raise SystemExit(3)

vantaggio = (m_gre / m_norm) if m_norm else float("inf")
print("  il confronto normalizzato batte l'altro di %.1f volte   (serve %.1f)"
      % (vantaggio, VANTAGGIO))
print()

if vantaggio < VANTAGGIO:
    print("FALLITO: normalizzare il tempo non avvicina i due render (%.1fx, serve %.1fx)."
          % (vantaggio, VANTAGGIO), file=sys.stderr)
    print("Le battute interne non hanno seguito la durata: la scena breve non e' la", file=sys.stderr)
    print("stessa scena piu' veloce, e' la stessa scena con la coda tagliata.", file=sys.stderr)
    raise SystemExit(1)

if FINESTRE and residui and max(residui) == 0:
    print("FALLITO: nelle finestre percettive i due render coincidono a tempo normalizzato.",
          file=sys.stderr)
    print("Le soglie che non devono scalare (il ritardo della card sulla mano) hanno", file=sys.stderr)
    print("scalato anche loro: la scena veloce ha perso il peso degli oggetti.", file=sys.stderr)
    raise SystemExit(1)

print("VERDETTO: accorciare la durata accorcia ogni battuta dentro la scena.")
if residui:
    print("Il residuo di %d px nelle finestre percettive non e' un difetto: sono le" % max(residui))
    print("soglie che di proposito NON scalano. A zero avrebbero scalato anche loro,")
    print("e la scena veloce avrebbe perso il peso degli oggetti.")
