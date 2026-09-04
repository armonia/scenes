#!/usr/bin/env python3
"""Il ciclo di ogni dimostrazione si chiude, o strappa a ogni giro?

PERCHE' ESISTE. Le demo della pagina girano in ciclo continuo. Se l'ultimo
fotogramma non somiglia al primo, ogni giro ha uno stacco secco - e a chi
guarda non arriva "questa e' una demo che riparte", arriva "il sito scatta".
Il repo intero sta in piedi su una regola che dice che due stati adiacenti si
devono attaccare senza che si veda; la pagina che quella regola la spiega la
violava trenta volte al minuto.

Undici voci su trenta strappavano: le animazioni a senso unico - una camera che
entra e resta dentro, un testo che si compone e resta scritto, un grafico che si
disegna e resta disegnato - finiscono lontanissimo da dove sono partite. GIU-04
cambiava il 28 per cento del quadro nel punto di ricongiunzione.

COME MISURA. La domanda e' se l'ultimo fotogramma sia A UN PASSO dal primo o
altrove. Si confronta la differenza fra ultimo e primo con la differenza fra il
primo e quello subito dopo, misurata quindi NELLO STESSO PUNTO del ciclo: se il
ciclo si chiude le due sono confrontabili, perche' sono entrambe un fotogramma
di distanza. Se strappa, la prima e' quella fra due stati che non si sono mai
toccati.

Due riferimenti sbagliati prima di questo, e vale la pena tenerli scritti.

Il novantesimo percentile del movimento non funzionava: le demo che stanno ferme
e cambiano a scatti - MAT-02 accende una scheda ogni 74 fotogrammi e nel mezzo
non succede niente - hanno un percentile a zero, quindi qualunque giunta
risultava infinita e il banco le bocciava per un cambio di colore che e' la loro
battuta.

Il PASSO PIU' GRANDE della demo era peggio, perche' si contamina: una demo che
stacca anche al suo interno si ritrova quello stacco come riferimento e si
autoassolve sulla giunta del ciclo. CHR-02 misurava passo massimo 652 e giunta
652, cioe' 1,0x, e i due numeri erano lo stesso difetto due volte.

E c'e' un pavimento in pixel assoluti, perche' un cambio di stato dell'interfaccia
- un contatore che passa da 2 a 3, una scheda che si accende - e' istantaneo per
natura e cambia poca roba: e' una battuta, non uno strappo. Sotto il due per
cento del quadro non si guarda il rapporto.

Il paragone e' interno alla demo perche' le demo si muovono in modo diverso fra
loro: una camera che scorre cambia migliaia di pixel per fotogramma, una parola
che si accende poche decine. Una soglia in pixel assoluti boccerebbe le prime e
promuoverebbe le seconde.

E ANCHE LA GIUNTA IN MEZZO, ma solo perche' la demo la dichiara. Meta' delle
voci mostrano il caso giusto e poi quello sbagliato, e nel passaggio fra i due
possono ripartire da capo azzerando tutto: e' lo stesso stacco, in un altro
punto del ciclo.

Cercarlo da soli non ha funzionato. Uno stacco e una DISSOLVENZA si somigliano
troppo: contando i pixel sopra una soglia, una dissolvenza lineare produce un
picco a meta' strada - dove la maggior parte dei pixel attraversa la soglia tutti
insieme - e il banco segnalava come stacco l'uscita di campo di una riga di
testo, che e' la cosa piu' continua che ci sia. Con la differenza media il picco
sparisce ma la misura diventa cosi' sensibile che segnala tutto.

La soluzione non e' stata una misura piu' furba, e' stata smettere di indovinare:
ogni demo a due meta' DICHIARA il fotogramma in cui cambia, con `half`, e il
banco va a guardare li'. E' lo stesso patto di `seamAfter` in catalog.json - la
scena dice dove sta la giunta e il banco la misura - e vale la stessa ragione:
una giunta dichiarata si puo' misurare esattamente, una da indovinare no.

Uso:  ./scripts/loop-close.py [pagina.html]
"""
import io
import pathlib
import statistics
import sys

from PIL import Image
from playwright.sync_api import sync_playwright

# Niente numpy: sul runner della CI non c'e', e per confrontare due immagini da
# 200x112 in scala di grigi bastano i byte. E' la stessa scelta di
# contrast-floor.py, e vale un pacchetto in meno da installare.

ROOT = pathlib.Path(__file__).resolve().parent.parent
if len(sys.argv) > 1:
    PAGE = pathlib.Path(sys.argv[1]).resolve()
else:
    PAGE = ROOT / "showcase" / "dist" / "grammatica.html"
    if not PAGE.exists():
        PAGE = ROOT / "showcase" / "grammatica.html"

# Quante volte la giunta puo' superare un passo normale preso nello stesso punto.
SOGLIA = 3.0
# Il pavimento: il due per cento del quadro campionato. Sotto, e' una battuta.
IGNORA = 448
W, H = 200, 112
DIFF = 18

fails = []

with sync_playwright() as pw:
    try:
        br = pw.chromium.launch(headless=True)
    except Exception:
        br = pw.chromium.launch(headless=True, channel="chrome")
    pg = br.new_context(viewport={"width": 1200, "height": 800}).new_page()
    pg.goto(PAGE.as_uri(), wait_until="load")
    pg.wait_for_timeout(1600)

    codes = pg.eval_on_selector_all(".mvhead .code", "e=>e.map(x=>x.textContent.trim())")
    stages = pg.query_selector_all(".stage")

    def shot(st, i, f):
        pg.evaluate(
            "([i,f])=>{const it=document.querySelectorAll('.stage')[i].__it;"
            " it.manual=f; it.last=-1; it.mv.draw(f,it.S);}", [i, f])
        im = Image.open(io.BytesIO(st.screenshot())).convert("L").resize((W, H))
        return im.tobytes()

    def d(a, b):
        return sum(1 for x, y in zip(a, b) if abs(x - y) > DIFF)

    print("%-8s %6s %10s %10s %9s %8s %9s" % ("voce", "dur", "passo capi", "giunta", "rapp.", "in mezzo", "rapp."))
    for i, c in enumerate(codes):
        st = stages[i]
        st.scroll_into_view_if_needed()
        pg.wait_for_timeout(90)
        dur = pg.evaluate("(i)=>document.querySelectorAll('.stage')[i].__it.mv.dur", i)
        f0, f1, f2 = shot(st, i, 0), shot(st, i, 1), shot(st, i, 2)
        fl, fp = shot(st, i, dur - 1), shot(st, i, dur - 2)
        # Un passo normale preso ai due capi del ciclo, cioe' dove sta la giunta.
        passo = max(d(f0, f1), d(f1, f2), d(fp, fl))
        wrap = d(fl, f0)
        ratio = wrap / passo if passo else (999.0 if wrap > IGNORA else 0.0)

        bad = wrap > IGNORA and ratio > SOGLIA

        # La giunta interna, dove la demo dice che c'e'.
        half = pg.evaluate("(i)=>document.querySelectorAll('.stage')[i].__it.mv.half || 0", i)
        mid, rmid, bad_mid = 0, 0.0, False
        if half:
            mid = d(shot(st, i, half - 1), shot(st, i, half))
            vic = max(d(shot(st, i, half - 4), shot(st, i, half - 3)),
                      d(shot(st, i, half + 2), shot(st, i, half + 3)))
            rmid = mid / vic if vic else (999.0 if mid > IGNORA else 0.0)
            bad_mid = mid > IGNORA and rmid > SOGLIA

        nota = "   STRAPPA" if bad else ("   STACCA a f%d" % half if bad_mid else "")
        print("%-8s %6d %10d %10d %8.1fx %8d %8.1fx%s"
              % (c, dur, passo, wrap, ratio, mid, rmid, nota))
        if bad or bad_mid:
            fails.append((c, wrap, ratio))

    br.close()

print()
if fails:
    print("cicli con uno stacco:", ", ".join(c for c, _, _ in fails), file=sys.stderr)
    print("O l'ultimo fotogramma non somiglia al primo, o la seconda meta' riparte", file=sys.stderr)
    print("da capo invece di continuare la prima. In tutti e due i casi non legge", file=sys.stderr)
    print("come una demo che va avanti, legge come un sito che scatta.", file=sys.stderr)
    raise SystemExit(1)
print("VERDETTO: tutte le dimostrazioni chiudono il proprio ciclo.")
print("L'ultimo fotogramma vale quanto un fotogramma qualsiasi rispetto al primo.")
