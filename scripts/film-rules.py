#!/usr/bin/env python3
"""Le regole di regia di un film, controllate senza renderizzare.

PERCHE' ESISTE. Gli script dei commercial scrivono le regole in numeri: la camera
di un piano sequenza non torna mai indietro e parte e arriva ferma, una frase
resta sotto i 15,5 caratteri al secondo, la mano aspetta da 10 a 25 frame prima
di premere, una conseguenza segue la causa da 2 a 40 frame dopo, niente cambia
con la camera parcheggiata sopra. Guardando il render se ne accorge chi sa
cosa cercare, e solo sui fotogrammi che guarda. Il film pero' e' fatto di dati
(chiavi di camera, battute, catene), e le regole si calcolano sui dati: il
modulo delle regole del film (products/<prodotto>/rules.ts) le restituisce come
elenchi di problemi, e il manifest le passa qui.

IL NEGATIVO: `--guasto NOME` chiede al modulo la copia guasta del film (una
chiave di camera che torna indietro, un'esitazione di quattro frame...), e
`--regola GRUPPO` dice quale regola deve accorgersene. Con `--regola` il verdetto
guarda solo quel gruppo: un guasto che fa scattare un'altra regola, e non la
sua, esce 0 e il negativo fallisce, perche' la regola che doveva vederlo non lo
vede.

Il film e' il banco del manifest: un nome (`film-demo`) o il percorso del modulo
di geometria di un altro repository che usa il kit.

Uso:  ./scripts/film-rules.py --ratio R [--film NOME|MODULO.ts] [--guasto G --regola GRUPPO]

Esce 0 se nessuna regola ha problemi, 1 se ne ha, 3 se il manifest non risponde
o il film non dichiara regole.
"""
import argparse
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("--ratio", default="16x9")
ap.add_argument("--film", default="film-demo")
ap.add_argument("--guasto")
ap.add_argument("--regola")
args = ap.parse_args()

NOMI = {
    "camera": "camera del film: niente inversioni, ferma ai capi, niente scavalchi",
    "dwell": "soste delle battute (TYP-01): sotto 15,5 caratteri al secondo",
    "cues": "battute che non si pestano i piedi",
    "hesitation": "esitazione prima della pressione (CUR-02): da 10 a 25 frame",
    "chain": "catene di conseguenze (CHR-03): da 2 a 40 frame fra un anello e l'altro",
    "handoff": "consegne (CHR-01): varco, volo, chiusura, in quest'ordine",
    "lockup": "la chiusura col marchio e' ferma in campo prima della fine",
    "parked": "nessun cambio di stato con la camera ferma",
}

cmd = ["node", str(ROOT / "scripts/manifest.mjs"), "bench", args.film, "--ratio", args.ratio]
if args.guasto:
    cmd += ["--guasto", args.guasto]
geo = subprocess.run(cmd, capture_output=True, text=True)
if geo.returncode != 0:
    print("il manifest non risponde:\n" + geo.stderr[-1200:], file=sys.stderr)
    raise SystemExit(3)
rules = json.loads(geo.stdout).get("rules") or {}
if not rules:
    print("%s non dichiara regole: non c'e' niente da controllare" % args.film, file=sys.stderr)
    raise SystemExit(3)
if args.regola and args.regola not in rules:
    print("la regola %s non esiste; il film dichiara: %s" % (args.regola, ", ".join(rules)), file=sys.stderr)
    raise SystemExit(3)

print("Le regole di %s in %s%s." % (args.film, args.ratio, " (guasto: %s)" % args.guasto if args.guasto else ""))
bad = []
for group, problems in rules.items():
    counted = args.regola is None or group == args.regola
    mark = "ok" if not problems else ("1 problema" if len(problems) == 1 else "%d problemi" % len(problems))
    print("  %-10s %-72s %s%s" % (group, NOMI.get(group, "")[:72], mark, "" if counted else "   (non conta)"))
    for p in problems:
        print("               - %s" % p)
    if problems and counted:
        bad.append(group)

print()
if bad:
    print("VERDETTO: il film rompe %s." % ", ".join(bad))
    raise SystemExit(1)
if args.regola:
    print("VERDETTO: la regola %s non trova problemi." % args.regola)
else:
    print("VERDETTO: nessuna regola trova problemi.")
