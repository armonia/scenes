#!/usr/bin/env python3
"""
La proiezione del kit coincide con quella di Chrome?

PERCHE' ESISTE. `kit/project.ts` rifa in aritmetica la catena CSS del blocco di
ripresa: posizione, rotazioni, spinta, prospettiva con la sua origine. Serve ai
banchi che devono sapere dove sta un elemento con la camera inclinata e in
movimento, cioe' a quasi tutti quelli che verranno. Un'aritmetica che sbaglia
un segno di rotazione produce ritagli spostati di cento pixel e verdetti su
parti di quadro in cui l'elemento non c'e', quindi prima di usarla la si
confronta con il motore che disegna davvero.

COSA MISURA. Per ogni caso (due lastre, tre stage, le sei pose della catena di
Topics) costruisce in Chromium lo stesso contenitore prospettico e la stessa
lastra trasformata, mette un segno di 2x2 px su cinque punti della lastra e
legge il centro di `getBoundingClientRect`. Lo confronta con il punto che il
manifest calcola con `project()`. Passa sotto mezzo pixel.

IL NEGATIVO: `--origin-mismatch` mette nel CSS l'origine 50% 50% invece di
quella del rig. Con --must-fail il banco esce 0 solo se l'errore massimo supera
20 px, cioe' se si accorge dell'origine sbagliata.

Uso:  project-check.py [--origin-mismatch] [--must-fail]

Esce 0 se ogni punto coincide (con --must-fail: se l'errore massimo supera
20 px), 1 altrimenti, 3 se Chromium non parte.
"""
import argparse
import json
import math
import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

ap = argparse.ArgumentParser()
ap.add_argument("--origin-mismatch", action="store_true")
ap.add_argument("--must-fail", action="store_true")
args = ap.parse_args()

TOL = 0.5
NEG = 20.0

cases = json.loads(
    subprocess.run(
        ["node", os.path.join(ROOT, "scripts/manifest.mjs"), "project-cases"],
        capture_output=True, text=True, check=True, cwd=ROOT,
    ).stdout
)

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("playwright non e' installato: non ho misurato niente", file=sys.stderr)
    sys.exit(3)

PAGE = """<!doctype html><html><body style="margin:0;background:#000">
<div style="position:relative;width:{w}px;height:{h}px;perspective:{P}px;perspective-origin:{origin}">
<div style="position:absolute;left:{left}px;top:{top}px;width:{sw}px;height:{sh}px;transform:translateZ({push}px) rotateY({yaw}deg) rotateX({pitch}deg) scale({s});transform-origin:50% 50%;transform-style:preserve-3d;overflow:hidden;background:#222">
{markers}
</div></div></body></html>"""

peggiore = 0.0
peggiore_caso = ""
fuori = 0

with sync_playwright() as pw:
    # Come gli altri banchi della pagina: in CI il chromium lo porta playwright,
    # su un portatile spesso c'e' solo Chrome installato.
    try:
        browser = pw.chromium.launch(headless=True)
    except Exception:  # noqa: BLE001
        try:
            browser = pw.chromium.launch(headless=True, channel="chrome")
        except Exception as e:  # noqa: BLE001
            print(f"Chromium non parte: {e}", file=sys.stderr)
            sys.exit(3)
    page = browser.new_page(device_scale_factor=1)
    for c in cases:
        st, rig, sl, po = c["stage"], c["rig"], c["slab"], c["pose"]
        page.set_viewport_size({"width": st["w"], "height": st["h"]})
        markers = "".join(
            f'<i id="m{i}" style="position:absolute;display:block;left:{p["x"] - 1}px;'
            f'top:{p["y"] - 1}px;width:2px;height:2px"></i>'
            for i, p in enumerate(c["points"])
        )
        page.set_content(PAGE.format(
            w=st["w"], h=st["h"], P=rig["perspective"],
            origin="50% 50%" if args.origin_mismatch else c["origin"],
            left=(st["w"] - sl["w"]) / 2 + po["slideX"],
            top=(st["h"] - sl["h"]) / 2 + po["slideY"],
            sw=sl["w"], sh=sl["h"], push=po["pushZ"], yaw=po["yaw"],
            pitch=po["pitch"], s=rig["slabScale"], markers=markers,
        ))
        rects = page.evaluate(
            "n => Array.from({length: n}, (_, i) => {"
            " const r = document.getElementById('m' + i).getBoundingClientRect();"
            " return [r.left + r.width / 2, r.top + r.height / 2]; })",
            len(c["points"]),
        )
        err = max(math.hypot(rx - p["sx"], ry - p["sy"]) for (rx, ry), p in zip(rects, c["points"]))
        if err > TOL:
            fuori += 1
        if err > peggiore:
            peggiore, peggiore_caso = err, c["id"]
    browser.close()

print(f"Proiezione del kit contro Chromium: {len(cases)} casi, 5 punti ciascuno"
      f"{', origine sbagliata nel CSS' if args.origin_mismatch else ''}.")
print(f"  errore massimo {peggiore:.3f} px ({peggiore_caso}), casi oltre {TOL} px: {fuori}")

if args.must_fail:
    if peggiore > NEG:
        print(f"VERDETTO: con l'origine sbagliata l'errore arriva a {peggiore:.1f} px, e il banco se ne accorge.")
        sys.exit(0)
    print(f"VERDETTO: il banco PROMUOVE un'origine sbagliata: errore massimo {peggiore:.1f} px, sotto {NEG}.")
    sys.exit(1)

if fuori:
    print(f"VERDETTO: in {fuori} casi la proiezione del kit sbaglia di piu' di {TOL} px.")
    sys.exit(1)
print(f"VERDETTO: la proiezione del kit coincide con Chromium entro {TOL} px in tutti i {len(cases)} casi.")
sys.exit(0)
