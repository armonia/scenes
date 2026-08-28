#!/usr/bin/env python3
"""
Il centroide dei pixel accesi di una maschera, e quanti sono.

Stava dentro `handoff-travel.sh` come heredoc dentro una process substitution,
`read -r cx n < <( python3 - "$f" <<'PY' ... )`. Bash 3.2, che e' quello che
`/usr/bin/env bash` trova su macOS, non riesce a leggere quella forma: cerca la
parentesi di chiusura prima di consumare il documento, non la trova e muore con
"bad substitution". Lo script non partiva affatto, e il messaggio finale che
stampava era "la card non viaggia", cioe' una diagnosi sulla scena per un guasto
dell'attrezzatura. In CI gira bash 5 e la stessa riga passa, quindi il difetto
era invisibile da un lato e totale dall'altro.

Sta in un file anche perche' e' la prima misura condivisa: seam.sh conta i
pixel di una maschera, questo ne prende il baricentro, e prima o poi le due
cose devono avere una definizione sola di "pixel cambiato".

Uso:  _centroid.py maschera.png   ->  "<x medio> <quanti>"  (oppure "-1 0")
"""
import os
import subprocess
import sys

img = sys.argv[1]
convert = os.environ.get("IM_CONVERT_CMD", "magick").split()
identify = os.environ.get("IM_IDENTIFY_CMD", "magick identify").split()

raw = subprocess.run(
    convert + [img, "-depth", "8", "gray:-"], capture_output=True, check=True
).stdout

# `identify -format %w file` e basta: la 7 tollera anche un "info:" in coda, la
# 6 no e esce 1. La forma senza suffisso funziona su entrambe.
w = int(
    subprocess.run(
        identify + ["-format", "%w", img], capture_output=True, text=True, check=True
    ).stdout.strip()
)

tot = sx = 0
for i, v in enumerate(raw):
    if v > 127:
        tot += 1
        sx += i % w

print(f"{sx / tot:.1f} {tot}" if tot else "-1 0")
