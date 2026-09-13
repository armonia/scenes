#!/usr/bin/env python3
"""Le voci tipografiche si leggono, o si coprono, spariscono e scattano?

PERCHE' ESISTE. Due volte di fila i banchi erano verdi e scorrendo il sito si
vedevano parole una sopra l'altra, frasi che sparivano e ricomparivano, cose
che scattavano. Nessun banco guardava quelle tre cose: demo-check.py misura la
tesi di ogni voce, loop-close.py la giunta del ciclo, e fra le due passavano
tutti i difetti che si vedono in riproduzione.

COSA MISURA, su ogni fotogramma di ogni voce tipografica, a piu' larghezze:

  COPERTURA. Due unita' di testo visibili - parole, lettere, la didascalia
  ruotata - non si sovrappongono, e nessuna passa sotto il testo della HUD.
  TYP-02 copriva la seconda riga con la parola ingrandita per 59 fotogrammi;
  TYP-04 metteva "pose" sopra "is" per 118 su 260, perche' due parole di
  quattro lettere non sono larghe uguali; e sul telefono la didascalia stesa
  di TYP-09 finiva sopra il contatore dei fotogrammi.

  QUADRO. Nessun testo visibile esce dal palco. La parola ingrandita di TYP-02
  usciva da tutti e due i lati per 63 fotogrammi.

  PAROLA INTERA. In ogni fotogramma almeno una parola della riga si vede
  tutta. Non basta che il quadro non sia nero: la prima correzione lo
  garantiva, sfalsando uscite e ingressi, e le frasi continuavano a sparire
  e tornare - in onda: in TYP-01 un quinto della frase sullo schermo per mezzo
  secondo, due volte a giro, e in TYP-04 la parola piu' visibile al 23%. Quello
  che l'occhio legge come "la frase se n'e' andata" e' non avere niente di
  intero da leggere.

  SCATTO. Nessuna proprieta' salta in un fotogramma mentre si vede: quanto se
  ne vede, posizione, colore. TYP-03 cambiava colore in un fotogramma.

COME LEGGE. Le proprieta' rese del DOM, non i pixel. Coi pixel una
dissolvenza e uno stacco si somigliano troppo per distinguerli; con le
proprieta' una dissolvenza cambia l'opacita' di pochi centesimi per
fotogramma e uno stacco di tutta.

QUANTO SI VEDE di un'unita' e' la frazione che resta dentro tutte le caselle
che la ritagliano, per la sua opacita'. La prima versione guardava solo
l'opacita', e una parola che sale da dietro il bordo della sua casella -
scoperta di undici pixel su settantaquattro al primo fotogramma - risultava
uno scatto da zero a uno.

LE COPIE IDENTICHE contano come una. Quando una casella passa il turno a una
parola uguale, le due copie stanno nella stessa casella, e nel fotogramma in
cui si scambiano il ruolo sono gli stessi glifi nello stesso posto: si
sommano, e lo scambio non e' uno scatto perche' non si vede.

Uso:  ./scripts/type-check.py [pagina.html] [--widths 390,1440] [--only TYP-02,TYP-09]
"""
import argparse
import pathlib
import re
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent

ap = argparse.ArgumentParser()
ap.add_argument("page", nargs="?")
ap.add_argument("--widths", default="390,1440")
ap.add_argument("--only", default="")
args = ap.parse_args()

if args.page:
    PAGE = pathlib.Path(args.page).resolve()
else:
    PAGE = ROOT / "showcase" / "dist" / "grammatica.html"
    if not PAGE.exists():
        PAGE = ROOT / "showcase" / "grammatica.html"
ONLY = {c.strip() for c in args.only.split(",") if c.strip()}

# Sopra questa quota di se' un'unita' conta come visibile.
VISIBILE = 0.2
# Frazione della piu' piccola delle due parti oltre la quale e' copertura.
COPRE = 0.06
# Una parola e' intera quando se ne vede almeno questa quota.
INTERA = 0.9
# Un salto di visibilita' in un fotogramma oltre il quale e' uno scatto.
SALTO_VISIBILE = 0.4
# Uno spostamento in un fotogramma, in frazione della larghezza del palco.
SALTO_POSIZIONE = 0.05
# Una differenza di colore in un fotogramma, somma delle tre componenti.
SALTO_COLORE = 90

PROBE = r"""([code, f]) => {
  const h=[...document.querySelectorAll('.mv')];
  const i=h.findIndex(m=>(m.querySelector('.code')||{}).textContent.trim()===code);
  const st=document.querySelectorAll('.stage')[i], it=st.__it;
  it.manual=f; it.last=-1; it.mv.draw(f,it.S);
  const sr=st.getBoundingClientRect();
  const rel=r=>({l:r.left-sr.left, r:r.right-sr.left, t:r.top-sr.top, b:r.bottom-sr.top});
  function eop(e){ let o=1; for(let n=e; n && n!==st; n=n.parentElement){ o*=parseFloat(getComputedStyle(n).opacity); } return o; }
  // Le caselle che ritagliano, fino al palco tipografico escluso: .tstage
  // ritaglia tutto al quadro, e contarlo nasconderebbe proprio il testo che
  // ne esce.
  function clip(e){
    let c={l:-1e9, r:1e9, t:-1e9, b:1e9};
    for(let n=e.parentElement; n && n!==st && !n.classList.contains('tstage'); n=n.parentElement){
      const cs=getComputedStyle(n);
      if(cs.overflowX!=='visible' || cs.overflowY!=='visible'){
        const q=rel(n.getBoundingClientRect());
        c={l:Math.max(c.l,q.l), r:Math.min(c.r,q.r), t:Math.max(c.t,q.t), b:Math.min(c.b,q.b)};
      }
    }
    return c;
  }
  function part(e){
    const r=rel(e.getBoundingClientRect()), c=clip(e);
    const p={l:Math.max(r.l,c.l), r:Math.min(r.r,c.r), t:Math.max(r.t,c.t), b:Math.min(r.b,c.b)};
    const full=Math.max(1e-6,(r.r-r.l)*(r.b-r.t));
    const area=(p.r>p.l && p.b>p.t) ? (p.r-p.l)*(p.b-p.t) : 0;
    return {box:p, area, frac:area/full, op:eop(e), color:getComputedStyle(e).color};
  }
  function unit(id, word, letter, els){
    const ps=els.map(part);
    let vis=0, wx=0, wy=0, wa=0;
    ps.forEach(p=>{ vis+=p.frac*p.op; const w=p.area*p.op; wx+=(p.box.l+p.box.r)/2*w; wy+=(p.box.t+p.box.b)/2*w; wa+=w; });
    const best=ps.reduce((a,b)=>a.frac*a.op>=b.frac*b.op?a:b);
    return {id, word, letter, text:els[0].textContent, vis:Math.min(1,vis),
      parts:ps.filter(p=>p.frac*p.op>0.2 && p.area>4).map(p=>p.box),
      x:wa?wx/wa:0, y:wa?wy/wa:0, color:best.color};
  }
  const units=[];
  st.querySelectorAll('.tline .tw').forEach((w,k)=>{
    const leaves=[...w.querySelectorAll('*')].filter(c=>c.children.length===0 && c.textContent.trim().length);
    const letters=leaves.length>1 && leaves.every(c=>c.textContent.length===1);
    if(!leaves.length){ units.push(unit('w'+k, k, false, [w])); return; }
    const groups=new Map();
    leaves.forEach((c,j)=>{ const key=letters?'l'+j:'t'+c.textContent; if(!groups.has(key)) groups.set(key,[]); groups.get(key).push(c); });
    groups.forEach((els,key)=>units.push(unit('w'+k+key, k, letters, els)));
  });
  const s=st.querySelector('.tside');
  if(s) units.push(unit('side', -1, false, [s]));
  const hud=[...st.querySelectorAll('.hud > span')].filter(e=>e.textContent.trim()).map(e=>{
    const rg=document.createRange(); rg.selectNodeContents(e);
    const r=rel(rg.getBoundingClientRect()), q=rel(e.getBoundingClientRect());
    return {text:e.textContent.trim(), box:{l:Math.max(r.l,q.l), r:Math.min(r.r,q.r), t:Math.max(r.t,q.t), b:Math.min(r.b,q.b)}};
  });
  return {w:sr.width, h:sr.height, units, hud};
}"""


def inter(a, b):
    return max(0, min(a["r"], b["r"]) - max(a["l"], b["l"])) * max(0, min(a["b"], b["b"]) - max(a["t"], b["t"]))


def area(a):
    return max(0, a["r"] - a["l"]) * max(0, a["b"] - a["t"])


def rgb(c):
    m = re.findall(r"[\d.]+", c)
    return tuple(float(v) for v in m[:3]) if len(m) >= 3 else (0.0, 0.0, 0.0)


def whole(units):
    """La parola piu' intera del fotogramma. Una parola fatta di lettere e'
    intera quanto la meno visibile delle sue lettere."""
    words = {}
    for u in units:
        if u["word"] < 0:
            continue
        if u["letter"]:
            words.setdefault(u["word"], []).append(u["vis"])
        else:
            words.setdefault((u["word"], u["id"]), []).append(u["vis"])
    return max([min(v) for v in words.values()] + [0])


fails = []

with sync_playwright() as pw:
    try:
        br = pw.chromium.launch(headless=True)
    except Exception:
        br = pw.chromium.launch(headless=True, channel="chrome")

    for W in [int(x) for x in args.widths.split(",") if x]:
        pg = br.new_context(viewport={"width": W, "height": 900}).new_page()
        pg.goto(PAGE.as_uri(), wait_until="load")
        pg.wait_for_timeout(1200)
        codes = [c for c in pg.eval_on_selector_all(".mvhead .code", "e=>e.map(x=>x.textContent.trim())")
                 if c.startswith("TYP") and (not ONLY or c in ONLY)]
        print("larghezza %d px" % W)
        for code in codes:
            dur = pg.evaluate("(c)=>{const h=[...document.querySelectorAll('.mv')];"
                              "const i=h.findIndex(m=>(m.querySelector('.code')||{}).textContent.trim()===c);"
                              "return document.querySelectorAll('.stage')[i].__it.mv.dur;}", code)
            frames = [pg.evaluate(PROBE, [code, f]) for f in range(dur)]
            SW, SH = frames[0]["w"], frames[0]["h"]
            cop, hud, fuori, vuoti, scatti = [], [], [], [], []
            low = (1.0, 0)
            for f, fr in enumerate(frames):
                U = [u for u in fr["units"] if u["vis"] > VISIBILE and u["parts"]]
                for i in range(len(U)):
                    for j in range(i + 1, len(U)):
                        a, b = U[i], U[j]
                        # Le lettere di una stessa parola si toccano per via della
                        # spaziatura negativa: e' composizione, non copertura.
                        if a["letter"] and b["letter"] and a["word"] == b["word"]:
                            continue
                        if any(inter(p, q) / max(1, min(area(p), area(q))) > COPRE
                               for p in a["parts"] for q in b["parts"]):
                            cop.append((f, a["text"].strip(), b["text"].strip()))
                for u in U:
                    for p in u["parts"]:
                        for t in fr["hud"]:
                            if inter(p, t["box"]) > 2:
                                hud.append((f, u["text"].strip(), t["text"][:12]))
                        if p["l"] < -1 or p["r"] > SW + 1 or p["t"] < -1 or p["b"] > SH + 1:
                            fuori.append((f, u["text"].strip()))
                wv = whole(fr["units"])
                if wv < low[0]:
                    low = (wv, f)
                if wv < INTERA:
                    vuoti.append(f)
                A = {u["id"]: u for u in fr["units"]}
                B = {u["id"]: u for u in frames[(f + 1) % dur]["units"]}
                for k in A:
                    if k not in B:
                        continue
                    a, b = A[k], B[k]
                    if abs(a["vis"] - b["vis"]) > SALTO_VISIBILE and max(a["vis"], b["vis"]) > 0.3:
                        scatti.append((f, "visibilita'", a["text"].strip()))
                    if min(a["vis"], b["vis"]) > 0.3:
                        if max(abs(a["x"] - b["x"]), abs(a["y"] - b["y"])) > SALTO_POSIZIONE * SW:
                            scatti.append((f, "posizione", a["text"].strip()))
                        if sum(abs(x - y) for x, y in zip(rgb(a["color"]), rgb(b["color"]))) > SALTO_COLORE:
                            scatti.append((f, "colore", a["text"].strip()))
            bad = []
            if cop:
                bad.append("copertura in %d fotogrammi (f%d: \"%s\" su \"%s\")" % (len({c[0] for c in cop}), cop[0][0], cop[0][1], cop[0][2]))
            if hud:
                bad.append("sotto la HUD in %d fotogrammi (f%d: \"%s\" su \"%s\")" % (len({c[0] for c in hud}), hud[0][0], hud[0][1], hud[0][2]))
            if fuori:
                bad.append("fuori quadro in %d fotogrammi (f%d: \"%s\")" % (len({c[0] for c in fuori}), fuori[0][0], fuori[0][1]))
            if vuoti:
                bad.append("senza una parola intera per %d fotogrammi (da f%d; al minimo %.0f%% a f%d)" % (len(vuoti), vuoti[0], low[0] * 100, low[1]))
            if scatti:
                bad.append("%d scatti (f%d: %s di \"%s\")" % (len(scatti), scatti[0][0], scatti[0][1], scatti[0][2]))
            if bad:
                print("  ROTTA %s  %s" % (code, "; ".join(bad)))
                fails.append("%s a %d px" % (code, W))
            else:
                print("  ok    %s  %d fotogrammi: niente coperture ne' fuori quadro, sempre una parola intera (al minimo %.0f%%), nessuno scatto"
                      % (code, dur, low[0] * 100))
        pg.close()
    br.close()

print()
if fails:
    print("voci tipografiche che non si leggono: " + ", ".join(fails))
    raise SystemExit(1)
print("VERDETTO: nessuna parola ne copre un'altra o la HUD, nessuna esce dal quadro,")
print("c'e' sempre una parola intera da leggere e niente scatta mentre si vede.")
