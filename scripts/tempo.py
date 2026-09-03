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

Uso:  ./scripts/tempo.py [lungo.mp4 breve.mp4]
"""
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LUNGO = pathlib.Path(sys.argv[1]) if len(sys.argv) > 2 else ROOT / "video/out/card-handoff.mp4"
BREVE = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "video/out/.fast-card-handoff.mp4"

# Quante volte il confronto normalizzato deve battere quello non normalizzato.
# Misurato: 19x fra i 240 e i 120 fotogrammi di CardHandoff.
VANTAGGIO = 4.0
W, H = 480, 270
SOGLIA_PIXEL = 26

for p in (LUNGO, BREVE):
    if not p.exists():
        print("manca il render: %s" % p, file=sys.stderr)
        raise SystemExit(1)


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
         "-vf", "select=eq(n\\,%d),scale=%d:-2,format=gray" % (f, W),
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

print("Tempo di %s (%d fotogrammi) contro %s (%d)."
      % (LUNGO.name, n_lungo, BREVE.name, n_breve))
print("Fattore %.3f. Se le battute scalano, il fotogramma f del breve e' il f/%.3f del lungo."
      % (k, k))
print()

campioni = [f for f in range(10, n_breve - 5, max(6, n_breve // 12))]
norm, gre = [], []
for f in campioni:
    a = frame(BREVE, f)
    dn = diff(a, frame(LUNGO, round(f / k)))
    dg = diff(a, frame(LUNGO, f))
    if dn is None or dg is None:
        print("estrazione fallita al fotogramma %d" % f, file=sys.stderr)
        raise SystemExit(3)
    norm.append(dn)
    gre.append(dg)

def mediana(v):
    s = sorted(v)
    return s[len(s) // 2]

m_norm, m_gre = mediana(norm), mediana(gre)
print("  %-42s %6d px" % ("differenza a tempo normalizzato (mediana)", m_norm))
print("  %-42s %6d px" % ("differenza senza normalizzare (mediana)", m_gre))
print("  %-42s %6d px" % ("residuo massimo sul normalizzato", max(norm)))
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

print("VERDETTO: accorciare la durata accorcia ogni battuta dentro la scena.")
print("Il residuo di %d px sul confronto normalizzato non e' un difetto: sono le" % max(norm))
print("soglie percettive che di proposito NON scalano. A zero avrebbero scalato")
print("anche loro, e la scena veloce avrebbe perso il peso degli oggetti.")
