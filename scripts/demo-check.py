#!/usr/bin/env python3
"""Misura le dimostrazioni della pagina del catalogo sul rendering.

PERCHE' ESISTE. Ogni voce del catalogo dichiara una tesi, e la dimostrazione
accanto dovrebbe farla vedere. La differenza fra "lo fa vedere" e "non lo fa
vedere" e' quasi sempre TEMPORALE - due eventi a cinque frame di distanza
invece che sullo stesso, un ritardo proporzionale alla distanza invece che
all'indice - e uno screenshot non la vede. Guardando i fermo immagine di
CHR-03 le due meta' del ciclo sono identiche; scorrendole frame per frame
sono opposte. Questo banco scorre.

COSA MISURA. Non legge la HUD: la HUD e' la dichiarazione della demo, e farsi
confermare una tesi dalla frase che la enuncia non e' una misura. Legge i
rettangoli e gli stili calcolati degli elementi veri, come li vede il browser.

COME FALLISCE. Ogni voce ha un caso peggiore dichiarato accanto: se una demo
smette di dimostrare la propria tesi il controllo corrispondente esce 1 e
nomina la voce.
"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
# Con un argomento si misura quella pagina: serve a dare al banco la copia
# guasta che deve bocciare, che e' l'unica prova che stia misurando qualcosa.
if len(sys.argv) > 1:
    PAGE = pathlib.Path(sys.argv[1]).resolve()
else:
    PAGE = ROOT / "showcase" / "dist" / "grammatica.html"
    if not PAGE.exists():
        PAGE = ROOT / "showcase" / "grammatica.html"

# Sonda: disegna un frame e restituisce i rettangoli che servono a giudicare.
PROBE = """([code, f]) => {
  const heads = [...document.querySelectorAll('.mv')];
  const mv = heads.find(m => (m.querySelector('.code')||{}).textContent?.trim() === code);
  if (!mv) throw new Error('voce non trovata: ' + code);
  const stage = mv.querySelector('.stage');
  const it = stage.__it;
  // draw() sta dentro la chiusura della pagina: si chiama il disegno della
  // demo direttamente, che e' esattamente quello che draw() fa a sua volta.
  it.manual = f; it.last = -1; it.mv.draw(f, it.S);
  const S = it.S, sr = stage.getBoundingClientRect();
  const box = e => { const r = e.getBoundingClientRect();
    return {x: r.left + r.width/2 - sr.left, y: r.top + r.height/2 - sr.top, w: r.width, h: r.height}; };
  const active = S.cards.find(c => c.col === 1 && c.idx === 0);
  const out = {
    dur: it.mv.dur, sw: sr.width, sh: sr.height,
    slab: box(S.slab), panel: box(S.panel), side: box(S.side),
    active: box(active.el), title: active.el.querySelector('.ttl').className,
    tag: active.tag.textContent,
    cnt1: S.cols[1].cnt.textContent,
    sideOp: parseFloat(getComputedStyle(S.side).opacity),
    cards: S.cards.map(c => ({col: c.col, idx: c.idx, x: box(c.el).x, y: box(c.el).y, op: parseFloat(getComputedStyle(c.el).opacity)})),
  };
  if (S.prows && S.prows[0]) out.prow = S.prows[0].textContent;
  if (S.send) out.press = S.send.className.indexOf('press') >= 0;
  if (S.stream) out.stream = (S.stream.textContent || '').trim();
  if (S.newcard) out.newcard = {op: parseFloat(S.newcard.style.opacity || '0'), y: box(S.newcard).y};
  if (S.mk) out.mk = box(S.mk);
  if (S.cur) out.cur = box(S.cur);
  if (S.ghost) out.ghost = box(S.ghost);
  if (S.metric) { out.metric = S.metric.textContent; out.metricW = S.metric.getBoundingClientRect().width; }
  if (S.edge) out.edge = parseFloat(getComputedStyle(S.edge).opacity);
  { const m = new DOMMatrixReadOnly(getComputedStyle(active.el).transform);
    out.tilt = Math.atan2(m.b, m.a) * 180 / Math.PI; }
  return out;
}"""

# Le voci tipografiche non hanno lastra: il palco contiene parole, e quello che
# serve giudicarle sono i rettangoli e i colori resi degli span.
PROBE_TYPE = """([code, f]) => {
  const heads = [...document.querySelectorAll('.mv')];
  const mv = heads.find(m => (m.querySelector('.code')||{}).textContent?.trim() === code);
  if (!mv) throw new Error('voce non trovata: ' + code);
  const stage = mv.querySelector('.stage');
  const it = stage.__it;
  it.manual = f; it.last = -1; it.mv.draw(f, it.S);
  const sr = stage.getBoundingClientRect();
  const line = stage.querySelector('.tline');
  const spans = [...stage.querySelectorAll('.tline > .tw')].map(sp => {
    const r = sp.getBoundingClientRect();
    const cs = getComputedStyle(sp);
    // Le parole che si scambiano stanno DENTRO la casella: per il colore e
    // l'opacita' conta quella visibile, non il contenitore.
    const kids = [...sp.children].filter(k => parseFloat(getComputedStyle(k).opacity) > 0.5);
    const vis = kids.length ? kids[0] : sp;
    const vr = vis.getBoundingClientRect(), vcs = getComputedStyle(vis);
    return {
      text: (vis.textContent || '').trim(),
      x: vr.left - sr.left + vr.width / 2, y: vr.top - sr.top + vr.height / 2,
      w: r.width, h: vr.height,
      op: parseFloat(cs.opacity) * parseFloat(vcs.opacity),
      color: vcs.color, size: parseFloat(vcs.fontSize),
      shown: kids.length > 0 || sp.children.length === 0,
    };
  });
  return { dur: it.mv.dur, lineColor: getComputedStyle(line).color, spans };
}"""

fails = []
def check(name, ok, said):
    print(("  ok   " if ok else "  ROTTA ") + name + "  " + said)
    if not ok:
        fails.append(name)

with sync_playwright() as pw:
    # In CI il chromium se lo porta playwright; sulla macchina di chi scrive
    # spesso c'e' solo Chrome installato, e scaricare 150 MB per guardare una
    # pagina statica non serve a niente.
    try:
        br = pw.chromium.launch(headless=True)
    except Exception:
        br = pw.chromium.launch(headless=True, channel="chrome")
    pg = br.new_context(viewport={"width": 1500, "height": 950}).new_page()
    pg.goto(PAGE.as_uri(), wait_until="load")
    pg.wait_for_timeout(1200)

    cache = {}
    def at(code, f):
        k = (code, f)
        if k not in cache:
            cache[k] = pg.evaluate(PROBE, [code, f])
        return cache[k]
    def dur(code):
        return at(code, 0)["dur"]
    def first(code, rng, pred):
        for f in rng:
            if pred(at(code, f)):
                return f
        return None

    # CAM-02 - i piani si separano solo se stanno a profondita' diverse.
    # Caso peggiore: se il pannello e la board percorrono gli stessi pixel,
    # quella non e' una lastra, e' una panoramica su una fotografia.
    # Il pannello e la card percorrono pixel diversi anche a z 0, perche' stanno
    # in punti diversi di un piano inclinato: la corsa differenziale da sola non
    # misura la profondita'. Quello che la misura e' quanto quella differenza
    # cambia togliendo lo stacco in z, cioe' lo scarto fra le due meta'.
    def shear(code, a, b):
        return ((at(code, b)["active"]["x"] - at(code, a)["active"]["x"])
                - (at(code, b)["panel"]["x"] - at(code, a)["panel"]["x"]))
    con, senza = shear("CAM-02", 20, 50), shear("CAM-02", 130, 160)
    check("CAM-02", abs(con - senza) > 8,
          "scorrimento differenziale card/pannello: %.1f px con lo stacco in z, %.1f px a z 0, cioe' %.1f px di parallasse" % (con, senza, abs(con - senza)))

    # CAM-03 - l'orbita esce oltre il limite dichiarato, se no il limite e' un'opinione.
    def span(f):
        xs = [c["x"] for c in at("CAM-03", f)["cards"]]
        return max(xs) - min(xs)
    sp = [span(f) for f in range(0, dur("CAM-03"), 5)]
    check("CAM-03", min(sp) < max(sp) * 0.72,
          "larghezza della board fra la prima e l'ultima card: da %d px a %d px, cioe' scorcia fino al %d%%" % (max(sp), min(sp), 100 * min(sp) / max(sp)))

    # CAM-04 - la discesa deve ingrandire la card e tenerla nel quadro.
    # Caso peggiore: la camera passa accanto al soggetto e il fondo resta nero.
    a0, a1 = at("CAM-04", 4), at("CAM-04", dur("CAM-04") - 1)
    c1 = a1["active"]
    inside = abs(c1["x"] - a1["sw"] / 2) < a1["sw"] / 2 and abs(c1["y"] - a1["sh"] * 0.46) < a1["sh"] / 2
    check("CAM-04", a1["active"]["w"] > a0["active"]["w"] * 2 and inside,
          "la card passa da %d a %d px di larghezza e all'ultimo frame sta dentro il quadro" % (a0["active"]["w"], a1["active"]["w"]))

    # CAM-05 - si scende fino al pavimento dichiarato e poi sotto.
    ops = [at("CAM-05", f)["sideOp"] for f in range(0, dur("CAM-05"), 4)]
    check("CAM-05", min(ops) < 0.32 and any(abs(o - 0.62) < 0.03 for o in ops),
          "opacita' del fondo: tocca 0,62 e poi scende a %.2f" % min(ops))

    # CAM-06 - la compensazione azzera la deriva, l'assenza no.
    d = dur("CAM-06")
    def drift(f):
        s = at("CAM-06", f)
        return ((s["mk"]["x"] - s["sw"] / 2) ** 2 + (s["mk"]["y"] - s["sh"] * 0.46) ** 2) ** 0.5
    check("CAM-06", drift(103) > 60 and drift(d - 3) < 4,
          "deriva del soggetto dall'origine: %d px senza compensazione, %d px con" % (drift(103), drift(d - 3)))

    # CUR-03 - la seconda meta' e' lo stesso clic senza risposta.
    p1 = any(at("CUR-03", f).get("press") for f in range(40, 70))
    s1 = any(at("CUR-03", f).get("stream") for f in range(50, 110))
    p2 = any(at("CUR-03", f).get("press") for f in range(155, 185))
    s2 = any(at("CUR-03", f).get("stream") for f in range(165, 225))
    check("CUR-03", p1 and s1 and not p2 and not s2,
          "prima meta': premuto %s, risposta %s. Seconda: premuto %s, risposta %s" % (p1, s1, p2, s2))

    # CUR-02 - la pausa fra l'arrivo sul pulsante e la pressione.
    # E' la misura che sul render non si riesce a fare, perche' la differenza
    # fra fotogrammi non distingue una sosta voluta da un assestamento lento.
    # Qui il puntatore ha una posizione, e la pausa e' una sottrazione.
    def hold(base):
        end = at("CUR-02", base + 100)["cur"]["x"]
        land = first("CUR-02", range(base, base + 100), lambda s: abs(s["cur"]["x"] - end) < 2)
        press = first("CUR-02", range(base, base + 100), lambda s: s["press"])
        return None if land is None or press is None else press - land
    h1, h2 = hold(0), hold(125)
    check("CUR-02", h1 is not None and h2 is not None and h1 >= 10 and h2 <= 2,
          "fra l'arrivo sul pulsante e la pressione: %s frame, poi %s" % (h1, h2))

    # TXT-04 - 18 frame di anticipo, e gli stessi due eventi sullo stesso frame.
    def lead(base):
        y0 = at("TXT-04", base)["cards"]
        g = first("TXT-04", range(base, base + 110),
                  lambda s: any(abs(c["y"] - y0[i]["y"]) > 2 for i, c in enumerate(s["cards"])))
        l = first("TXT-04", range(base, base + 110), lambda s: s["newcard"]["op"] > 0.02)
        return None if g is None or l is None else l - g
    l1, l2 = lead(0), lead(125)
    check("TXT-04", l1 is not None and l2 is not None and l1 >= 12 and l2 <= 2,
          "scarto fra l'apertura dello spazio e l'arrivo della riga: %s frame, poi %s" % (l1, l2))

    # CHR-02 - il ritardo segue la distanza dal cambiamento, non l'indice.
    # Ogni card e' a posto quando ha finito di salire: l'ordine di arrivo e' la
    # regola di scaglionamento, e le due meta' devono avere ordini diversi.
    def arrival(base):
        end = {(c["col"], c["idx"]): c["y"] for c in at("CHR-02", base + 118)["cards"]}
        out = {}
        for f in range(base + 118, base, -1):
            for c in at("CHR-02", f)["cards"]:
                k = (c["col"], c["idx"])
                if abs(c["y"] - end[k]) > 1.5:
                    out.setdefault(k, f - base)
        return out
    a1, a2 = arrival(0), arrival(125)
    ord1 = [k for k, v in sorted(a1.items(), key=lambda kv: kv[1])]
    ord2 = [k for k, v in sorted(a2.items(), key=lambda kv: kv[1])]
    sprd = (max(a1.values()) - min(a1.values())) if a1 else 0
    def rho(arr, base):
        # Spearman fra la distanza dal punto del cambiamento e il frame di partenza.
        end = {(c["col"], c["idx"]): c for c in at("CHR-02", base + 118)["cards"]}
        a = end[(1, 0)]
        pts = [(((end[k]["x"] - a["x"]) ** 2 + (end[k]["y"] - a["y"]) ** 2) ** 0.5, v)
               for k, v in arr.items() if k != (1, 0)]
        if len(pts) < 4:
            return 0.0
        def rank(vals):
            o = sorted(range(len(vals)), key=lambda i: vals[i])
            r = [0] * len(vals)
            for pos, i in enumerate(o):
                r[i] = pos
            return r
        rd, rf = rank([p[0] for p in pts]), rank([p[1] for p in pts])
        m = len(pts)
        return 1 - 6 * sum((rd[i] - rf[i]) ** 2 for i in range(m)) / (m * (m * m - 1))
    r1, r2 = rho(a1, 0), rho(a2, 125)
    check("CHR-02", len(a1) >= 5 and sprd >= 4 and ord1 != ord2 and r1 > 0.8 and r2 < 0.6,
          "%d card su %d frame; correlazione fra ritardo e distanza %.2f, contro %.2f scaglionando per indice" % (len(a1), sprd, r1, r2))

    # CHR-03 - card, conteggio e pannello a frame distinti, poi tutti insieme.
    def events(base):
        return (first("CHR-03", range(base, base + 120), lambda s: "done" in s["title"]),
                first("CHR-03", range(base, base + 120), lambda s: s["cnt1"] == "1"),
                first("CHR-03", range(base, base + 120), lambda s: s["prow"] == "Fatto"))
    e1, e2 = events(0), events(130)
    check("CHR-03", None not in e1 and None not in e2 and len(set(e1)) == 3 and len(set(e2)) == 1,
          "tre eventi ai frame %s, poi tutti e tre a %s" % (list(e1), list(e2)))

    # GIU-02 - alla posa lontana l'una e' ferma e l'altra no.
    def speed(f):
        return abs(at("GIU-02", f)["slab"]["x"] - at("GIU-02", f - 1)["slab"]["x"])
    v1, v2 = speed(64), speed(194)
    check("GIU-02", v1 < 0.6 and v2 > 2 * max(v1, 0.3),
          "corsa della lastra al frame della posa lontana: %.2f px con l'easing, %.2f px lineare" % (v1, v2))

    # CUR-01 - la mano arriva in arco, non in linea retta.
    # Caso peggiore: una curva a curvatura nulla e' un tween, e il controllo
    # rosso disegnato accanto serve proprio a rendere il confronto guardabile.
    def bow(key):
        pts = [at("CUR-01", f)[key] for f in range(10, 92, 4)]
        a, b = pts[0], pts[-1]
        vx, vy = b["x"] - a["x"], b["y"] - a["y"]
        L = (vx * vx + vy * vy) ** 0.5
        return max(abs((p["x"] - a["x"]) * vy - (p["y"] - a["y"]) * vx) / L for p in pts)
    ba, bg = bow("cur"), bow("ghost")
    def speeds(key):
        # Solo la finestra in cui la corsa e' ancora in moto: dopo f86 il
        # parametro e' clampato e la velocita' e' zero per costruzione, il che
        # farebbe passare per "non costante" anche il controllo in linea retta.
        pts = [at("CUR-01", f)[key] for f in range(12, 82, 4)]
        return [(((pts[i + 1]["x"] - pts[i]["x"]) ** 2 + (pts[i + 1]["y"] - pts[i]["y"]) ** 2) ** 0.5)
                for i in range(len(pts) - 1)]
    vh, vg = speeds("cur"), speeds("ghost")
    def wobble(v):
        return (max(v) - min(v)) / (sum(v) / len(v))
    # La soglia e' un rapporto dentro la stessa finestra, non un valore assoluto:
    # sul piano inclinato anche la retta a velocita' costante varia di un quarto
    # sullo schermo, ed e' esattamente il genere di numero che non si indovina.
    check("CUR-01", ba > 10 and bg < 1.5 and wobble(vh) > 3 * wobble(vg),
          "scarto dalla corda %.1f px contro %.1f del controllo; escursione di velocita' %.0f%% contro %.0f%% della retta"
          % (ba, bg, 100 * wobble(vh), 100 * wobble(vg)))

    # CUR-04 - la card insegue il puntatore, e l'inclinazione va a zero ai capi.
    def gap(f):
        s = at("CUR-04", f)
        return ((s["cur"]["x"] - s["active"]["x"]) ** 2 + (s["cur"]["y"] - s["active"]["y"]) ** 2) ** 0.5
    mid = max(gap(f) for f in range(60, 120, 6))
    tilts = [abs(at("CUR-04", f)["tilt"]) for f in (32, 148)]
    tmax = max(abs(at("CUR-04", f)["tilt"]) for f in range(60, 120, 6))
    check("CUR-04", mid > 8 and max(tilts) < 0.25 and tmax > 1.0,
          "ritardo della card sul puntatore %d px a meta' corsa; inclinazione %.2f° ai capi contro %.2f° nel mezzo" % (mid, max(tilts), tmax))

    # TXT-03 - il numero supera il valore finale e poi ci si posa.
    vals = [int((at("TXT-03", f)["metric"] or "0").split()[0]) for f in range(10, 120, 3)]
    ws = [at("TXT-03", f)["metricW"] for f in range(10, 120, 3)]
    check("TXT-03", max(vals) > 128 and vals[-1] == 128 and (max(ws) - min(ws)) < 0.6,
          "il numero sale a %d e si posa su %d, e il blocco resta largo %.1f px per tutti i frame" % (max(vals), vals[-1], ws[0]))

    # MAT-01 - lo spessore c'e' nella prima meta' e non nella seconda.
    check("MAT-01", at("MAT-01", 50)["edge"] > 0.9 and at("MAT-01", 150)["edge"] < 0.1,
          "bordo della lastra: opacita' %.0f nella prima meta', %.0f nella seconda"
          % (at("MAT-01", 50)["edge"], at("MAT-01", 150)["edge"]))

    # ---------------------------------------------------------------- typ
    tcache = {}
    def ty(code, f):
        k = (code, f)
        if k not in tcache:
            tcache[k] = pg.evaluate(PROBE_TYPE, [code, f])
        return tcache[k]

    # TYP-01 - la sosta, cioe' i fotogrammi in cui la frase e' su e ferma.
    # Caso peggiore: due meta' con la stessa sosta non dimostrerebbero niente,
    # perche' la voce parla di quanto una sosta puo' accorciarsi prima che la
    # riga venga tolta mentre la si legge.
    def dwell(code, lo, hi):
        prev, run, best = None, 0, 0
        for f in range(lo, hi):
            s0 = ty(code, f)
            up = all(sp["op"] > 0.985 for sp in s0["spans"])
            still = prev is not None and all(
                abs(a["x"] - b["x"]) < 0.4 and abs(a["y"] - b["y"]) < 0.4
                for a, b in zip(s0["spans"], prev["spans"])
            )
            run = run + 1 if (up and still) else 0
            best = max(best, run)
            prev = s0
        return best
    chars = len("Real UI, not a drawing of UI.")
    d1, d2 = dwell("TYP-01", 0, 104), dwell("TYP-01", 104, 187)
    c1 = chars / (d1 / 30) if d1 else 0
    c2 = chars / (d2 / 30) if d2 else 0
    check("TYP-01", d1 > d2 * 1.4 and 14 < c1 < 17 and 22 < c2 < 30,
          "sosta netta %df = %.1f c/s nella prima meta', %df = %.1f c/s nella seconda"
          % (d1, c1, d2, c2))

    # TYP-02 - una parola sola, enorme.
    def hratio(code, f):
        sp = ty(code, f)["spans"]
        key = sp[0]["size"]
        rest = max(s["size"] for s in sp[1:])
        return key / rest
    r1 = max(hratio("TYP-02", f) for f in range(60, 100, 6))
    r2 = max(hratio("TYP-02", f) for f in range(170, 210, 6))
    check("TYP-02", r1 > 2.0 and abs(r2 - 1.0) < 0.05,
          "corpo della parola chiave: %.2f volte le altre, contro %.2f quando la riga e' tutta uguale" % (r1, r2))

    # TYP-03 - il colore su una parola sola.
    def lit(code, f):
        s0 = ty(code, f)
        return sum(1 for sp in s0["spans"] if sp["color"] != s0["lineColor"])
    l1 = max(lit("TYP-03", f) for f in range(60, 84, 4))
    l2 = max(lit("TYP-03", f) for f in range(160, 184, 4))
    check("TYP-03", l1 == 1 and l2 >= 3,
          "parole accese: %d nella prima meta', %d nella seconda" % (l1, l2))

    # TYP-04 - le parole che restano non si muovono.
    # Gli indici 0, 2 e 3 sono le tre parole in comune fra le due frasi; l'1 e'
    # quella che cambia, e quella deve muoversi.
    def drift(code, lo, hi):
        base = ty(code, lo)["spans"]
        worst = 0
        for f in range(lo, hi, 3):
            sp = ty(code, f)["spans"]
            for i in (0, 2, 3):
                worst = max(worst, abs(sp[i]["x"] - base[i]["x"]))
        return worst
    w1, w2 = drift("TYP-04", 40, 118), drift("TYP-04", 170, 248)
    check("TYP-04", w1 < 1.0 and w2 > 20,
          "spostamento delle tre parole in comune: %.2f px sostituendo una parola, %.0f px sostituendo la riga" % (w1, w2))

    br.close()

print()
if fails:
    print("dimostrazioni che non dimostrano piu' la loro tesi: " + ", ".join(fails))
    sys.exit(1)
print("tutte le dimostrazioni misurate reggono la tesi della loro voce.")
