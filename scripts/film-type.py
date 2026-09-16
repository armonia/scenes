#!/usr/bin/env python3
"""La tipografia del film sta nel quadro, e si legge sopra quello che ha sotto?

PERCHE' ESISTE. Gli script dei commercial mettono frasi bianche sopra una lastra
chiara (Cifra e Zeno hanno pannelli chiari), e avvertono che attenuata a 0,62 la
lastra lascia il bianco a 2,78:1. Un fondo scuro sotto la frase, o la lastra
spenta, e' una scelta di regia; che basti, e' una misura. E nei formati stretti la
stessa frase va a capo, e una parola chiave che cresce puo' uscire dal quadro.

COME. Il manifest (`bench film-demo`) da' i fotogrammi da guardare: per ogni
battuta uno a meta' sosta, per la parola chiave quello in cui e' piu' grande, per
la didascalia uno a dissolvenza finita. Ogni campione nomina il suo strato. Il
film si rende due volte a quel fotogramma: com'e', e con quel solo strato bianco
pieno sul nero (prop `solo`). La seconda e' la maschera: dice dove sono le
lettere senza doverle cercare nel render completo.

  1. NEL QUADRO. Il rettangolo che contiene le lettere deve stare ad almeno
     MARGINE pixel da ogni bordo: una lettera tagliata dal bordo e' un difetto,
     non una scelta.
  2. SI LEGGE. Nel render completo si confronta la luminanza del nucleo delle
     lettere con quella della corona di pixel intorno (da 3 a 8 pixel fuori dalle
     lettere), con il rapporto di contrasto WCAG. Si misura a riquadri di RIQUADRO
     pixel e conta il riquadro peggiore: la prima versione faceva la media su
     tutta la frase, e la didascalia della chiusura del 16:9, con le ultime tre
     cifre bianche sulla lastra bianca, passava lo stesso. Una frase e' testo
     grande e regge da 3:1; una didascalia e' testo piccolo, e regge da 4,5:1.

IL NEGATIVO: `--guasto tipo-grande` raddoppia il corpo (le frasi escono dal
quadro), `--guasto senza-fondo` toglie il fondo scuro sotto le frasi sul vetro (il
bianco resta sulla lastra chiara). `--regola quadro|contrasto` fa contare solo
una delle due misure: il corpo doppio abbassa anche il contrasto (le lettere
escono dal fondo scuro), e senza la regola il negativo del quadro passerebbe
anche con la misura del bordo rotta. `--guasto maschera-con-lastra` rende la
lastra anche nella maschera: deve uscire 3, perche' una maschera che accende
mezzo quadro non dice dove sono le lettere.

Il film e' il banco del manifest (`--film`, di default film-demo, oppure il
percorso del modulo di geometria di un altro repository): deve dare la
composition, i campioni (frame, strato, ruolo, testo), e accettare le props
`solo` (lo strato) e `guasto`. `--progetto` e' il progetto Remotion da
impacchettare, di default video/ di questo repo.

Uso:  ./scripts/film-type.py --ratio R [--film NOME|MODULO.ts] [--progetto DIR]
                             [--guasto G --regola quadro|contrasto]

Esce 0 se ogni campione sta nel quadro e si legge, 1 altrimenti, 3 se il manifest
o un render non rispondono.
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
ap.add_argument("--ratio", default="16x9")
ap.add_argument("--film", default="film-demo")
ap.add_argument("--progetto", default=str(ROOT / "video"))
ap.add_argument("--guasto")
ap.add_argument("--regola", choices=["quadro", "contrasto"])
args = ap.parse_args()
PROGETTO = pathlib.Path(args.progetto).resolve()

MARGINE = 12
SOGLIA = {"frase": 3.0, "didascalia": 4.5}
RIQUADRO = 48
# Quanta parte del quadro puo' accendere una maschera di sola tipografia. La
# frase piu' grande del film di esempio, col corpo raddoppiato del negativo, ne
# accende meno del SOLO_MAX; la lastra dimenticata nella maschera ne accendeva
# piu' di meta'. Sopra, lo strumento non sta misurando lettere: esce 3.
SOLO_MAX = 0.3
# Un riquadro conta se almeno il 2% dei suoi pixel e' nucleo di lettera e almeno
# il 2% e' corona: sotto, la media e' fatta di pochi pixel di bordo.
COPERTURA = 0.02

IM = ["magick"] if shutil.which("magick") else (["convert"] if shutil.which("convert") else None)
if IM is None:
    print("serve ImageMagick", file=sys.stderr)
    raise SystemExit(3)

geo = subprocess.run(
    ["node", str(ROOT / "scripts/manifest.mjs"), "bench", args.film, "--ratio", args.ratio],
    capture_output=True, text=True,
)
if geo.returncode != 0:
    print("il manifest non risponde:\n" + geo.stderr, file=sys.stderr)
    raise SystemExit(3)
g = json.loads(geo.stdout)
comp = g["composition"]
if not g.get("samples"):
    print("%s non dichiara fotogrammi da guardare" % args.film, file=sys.stderr)
    raise SystemExit(3)

WORK = pathlib.Path(tempfile.mkdtemp(prefix="film-type-"))


def run(cmd, what, cwd=None):
    r = subprocess.run(cmd, capture_output=True, text=True, stdin=subprocess.DEVNULL, cwd=cwd)
    if r.returncode != 0:
        print("%s fallito:\n%s" % (what, (r.stderr or r.stdout)[-800:]), file=sys.stderr)
        shutil.rmtree(WORK, ignore_errors=True)
        raise SystemExit(3)
    return r.stdout.strip()


def still(frame, props, out):
    run(["npx", "remotion", "still", str(WORK / "bundle"), comp, str(out), "--frame=%d" % frame,
         "--image-format=png", "--props=%s" % json.dumps(props), "--log=error"], "render di f%d" % frame,
        cwd=PROGETTO)


def tiles(image_args, w, h, name):
    """Le medie a riquadri di un'immagine grigia, da 0 a 1, riga per riga.

    L'immagine si allarga col nero a multipli di RIQUADRO e si rimpicciolisce di
    RIQUADRO volte con -scale, che a fattore intero fa la media dei blocchi. Il
    risultato esce come PGM a 16 bit, che si legge senza librerie.
    """
    tw, th = -(-w // RIQUADRO), -(-h // RIQUADRO)
    out = WORK / (name + ".pgm")
    # -compose Over prima di -extent: l'allargamento compone col fondo usando
    # l'operatore corrente, e dopo un Multiply il nero moltiplicava tutto a zero.
    run(IM + image_args + ["-compose", "Over", "-background", "black", "-gravity", "NorthWest", "-extent",
                           "%dx%d" % (tw * RIQUADRO, th * RIQUADRO), "-scale", "%dx%d!" % (tw, th),
                           "-depth", "16", str(out)], "riquadri")
    data = out.read_bytes()
    fields, i = [], 0
    while len(fields) < 4:
        while data[i:i + 1].isspace():
            i += 1
        j = i
        while not data[j:j + 1].isspace():
            j += 1
        fields.append(data[i:j])
        i = j
    i += 1  # un solo spazio fra l'intestazione e i dati
    if fields[0] != b"P5" or int(fields[1]) != tw or int(fields[2]) != th:
        print("riquadri illeggibili in %s" % out, file=sys.stderr)
        raise SystemExit(3)
    maxval = int(fields[3])
    step = 2 if maxval > 255 else 1
    body = data[i:]
    return [int.from_bytes(body[k:k + step], "big") / maxval for k in range(0, tw * th * step, step)]


def lum(v):
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def luminance(rgb):
    r, gr, b = (lum(c) for c in rgb)
    return 0.2126 * r + 0.7152 * gr + 0.0722 * b


def contrast(a, b):
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


try:
    run(["npx", "remotion", "bundle", "--out-dir", str(WORK / "bundle"), "--log=error"], "bundle", cwd=PROGETTO)
    guasto = {"guasto": args.guasto} if args.guasto else {}
    print("La tipografia di %s%s: nel quadro, e contrasto con quello che ha sotto, riquadro per riquadro."
          % (comp, " (guasto: %s)" % args.guasto if args.guasto else ""))
    fail = []
    for n, s in enumerate(g["samples"]):
        f, soglia = s["frame"], SOGLIA[s["role"]]
        tag = "%d-%d" % (n, f)
        full, solo = WORK / ("full-%s.png" % tag), WORK / ("solo-%s.png" % tag)
        still(f, guasto, full)
        still(f, {"solo": s["layer"], **guasto}, solo)
        w, h = (int(x) for x in run(IM + [str(solo), "-format", "%w %h", "info:"], "dimensioni").split())
        bbox = run(IM + [str(solo), "-alpha", "off", "-colorspace", "Gray", "-threshold", "25%", "-format", "%@", "info:"],
                   "ingombro")
        # %@ stampa LxA+X+Y del rettangolo che contiene i pixel accesi.
        try:
            size, bx, by = bbox.split("+")
            bw, bh = (int(x) for x in size.split("x"))
            bx, by = int(bx), int(by)
        except ValueError:
            print("  f%-5d %-9s %-28s nessuna lettera nella maschera" % (f, s["layer"], s["text"][:28]))
            fail.append("f%d vuota" % f)
            continue
        lit = float(run(IM + [str(solo), "-alpha", "off", "-colorspace", "Gray", "-threshold", "25%",
                              "-format", "%[fx:mean]", "info:"], "pixel accesi"))
        if lit > SOLO_MAX:
            print("la maschera di f%d (strato %s) accende il %d%% del quadro: il film non rende solo la"
                  " tipografia con solo=%s, e non c'e' niente da misurare" % (f, s["layer"], lit * 100, s["layer"]),
                  file=sys.stderr)
            raise SystemExit(3)
        margin = min(bx, by, w - (bx + bw), h - (by + bh))
        core, d2, d8, ring = (WORK / ("%s-%s.png" % (k, tag)) for k in ("core", "d2", "d8", "ring"))
        run(IM + [str(solo), "-alpha", "off", "-colorspace", "Gray", "-threshold", "78%", str(core)], "nucleo")
        run(IM + [str(core), "-morphology", "Dilate", "Disk:2", str(d2)], "dilatazione")
        run(IM + [str(core), "-morphology", "Dilate", "Disk:8", str(d8)], "dilatazione")
        run(IM + [str(d8), str(d2), "-compose", "Difference", "-composite", str(ring)], "corona")

        cov = {m: tiles([str(p)], w, h, "%s-%s" % (m, tag)) for m, p in (("core", core), ("ring", ring))}
        sums = {}
        for m, p in (("core", core), ("ring", ring)):
            for ch in "RGB":
                sums[(m, ch)] = tiles([str(full), "-alpha", "off", "-channel", ch, "-separate", "+channel",
                                       str(p), "-compose", "Multiply", "-composite"], w, h, "%s-%s-%s" % (m, ch, tag))
        worst, counted, tot = None, 0, {k: 0.0 for k in list(sums) + ["core", "ring"]}
        for i in range(len(cov["core"])):
            c, r = cov["core"][i], cov["ring"][i]
            for k in sums:
                tot[k] += sums[k][i]
            tot["core"] += c
            tot["ring"] += r
            if c < COPERTURA or r < COPERTURA:
                continue
            fg = luminance([sums[("core", ch)][i] / c for ch in "RGB"])
            bg = luminance([sums[("ring", ch)][i] / r for ch in "RGB"])
            k = contrast(fg, bg)
            counted += 1
            worst = k if worst is None else min(worst, k)
        if not counted:
            print("  f%-5d %-9s %-28s nessun riquadro con lettere e fondo" % (f, s["layer"], s["text"][:28]))
            fail.append("f%d senza riquadri" % f)
            continue
        mean = contrast(luminance([tot[("core", ch)] / tot["core"] for ch in "RGB"]),
                        luminance([tot[("ring", ch)] / tot["ring"] for ch in "RGB"]))
        problems = []
        if margin < MARGINE and args.regola in (None, "quadro"):
            problems.append("ESCE DAL QUADRO (%d px dal bordo)" % margin)
        if worst < soglia and args.regola in (None, "contrasto"):
            problems.append("NON SI LEGGE (%.2f:1, sotto %.1f)" % (worst, soglia))
        print("  f%-5d %-9s %-28s bordo %4d px   contrasto peggiore %5.2f:1 su %3d riquadri, medio %5.2f:1   %s"
              % (f, s["layer"], s["text"][:28], margin, worst, counted, mean, " ".join(problems) or "ok"))
        if problems:
            fail.append("f%d %s" % (f, s["text"]))
finally:
    shutil.rmtree(WORK, ignore_errors=True)

print()
if fail:
    print("VERDETTO: %d campioni escono dal quadro o non si leggono: %s." % (len(fail), "; ".join(fail)))
    raise SystemExit(1)
print("VERDETTO: ogni campione sta ad almeno %d px dal bordo, e ogni riquadro regge la sua soglia"
      " (frasi %.1f:1, didascalie %.1f:1)." % (MARGINE, SOGLIA["frase"], SOGLIA["didascalia"]))
