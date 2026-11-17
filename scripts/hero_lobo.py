#!/usr/bin/env python3
"""Nuevo diseño del club en las páginas de Categorias/*.html. Idempotente (cada parte se aplica una sola vez).
 A) Cuadro de «Próximo partido» / «Partido finalizado»: degradado azul a blanco, escudos grandes, VS,
    fecha en pastilla, cuenta atrás y el lobo casi transparente pegado a la derecha.
 B) Marcador en directo: mismo degradado azul a blanco con el escudo de marca de agua (sin lobo) y
    botones «+1 GOL» nuevos (dorado para el Juncal, blanco para el rival).
«Descansa» y la pantalla completa mantienen su diseño.
Necesita Images/lobo.png en el repositorio.
Uso, desde la RAÍZ del repositorio:   python3 scripts/hero_lobo.py
"""
import glob, os, sys

MARK_A = "diseño club (lobo)"
MARK_B = "marcador directo (club) v2"
CSS_A = r'''/* ===== PRÓXIMO PARTIDO · diseño club (lobo) ===== */
#hero.hn{margin:18px 0;padding:26px 56px 26px;overflow:hidden;border-radius:26px;background:linear-gradient(90deg,#0b2273 0%,#1740c0 40%,#2f6bff 70%,#5b9bff 86%,#c9dcff 95%,#fff 100%);border:1px solid #8db4ff;box-shadow:0 18px 44px rgba(8,18,53,.5);isolation:isolate}
#hero.hn:after{display:none}
#hero.hn .hnx{display:contents}
#hero.hn .hn-fx{position:absolute;inset:0;z-index:-1;overflow:hidden;border-radius:inherit;pointer-events:none}
#hero.hn .hn-fx i{position:absolute;left:-30px;bottom:-60px;width:260px;height:260px;background:url(../Images/escudo.png) center/contain no-repeat;opacity:.22;filter:grayscale(1) brightness(2)}
#hero.hn .hn-lobo{position:absolute;right:0;bottom:0;z-index:0;width:auto;height:96%;opacity:.13;pointer-events:none;user-select:none}
#hero.hn .hn-tg{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px}
#hero.hn .hn-tg b{padding:5px 12px;border-radius:999px;color:#0a0f1e;background:var(--ye);font:800 .9rem/1 "Barlow Condensed",sans-serif;letter-spacing:.08em;text-transform:uppercase}
#hero.hn .hn-tg span{color:#fff;font:700 .9rem/1 "Barlow Condensed",sans-serif;letter-spacing:.1em;text-transform:uppercase}
#hero.hn .hn-tg .cf{padding:5px 11px;border:2px solid #fff;border-radius:999px;background:rgba(8,18,53,.35)}
#hero.hn .hn-tg .cf.f{border-color:var(--ye);color:var(--ye)}
#hero.hn .hn-eq{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px}
#hero.hn .hn-t{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0;text-align:center}
#hero.hn .hn-sh{display:grid;place-items:center;width:104px;height:104px;overflow:hidden;border:3px solid #fff;border-radius:50%;background:#fff;box-shadow:0 0 0 3px var(--ye),0 10px 24px rgba(8,18,53,.5)}
#hero.hn .hn-sh .b{width:100%;height:100%;border:0;border-radius:0;box-shadow:none;font-size:1.8rem}
#hero.hn .hn-t.me .hn-sh{animation:hnGlow 2.4s ease-in-out infinite}
@keyframes hnGlow{50%{box-shadow:0 0 0 3px var(--ye),0 0 28px 6px rgba(255,210,63,.7)}}
#hero.hn .hn-n{font:800 clamp(1.15rem,3vw,1.9rem)/1.05 "Barlow Condensed",sans-serif;text-transform:uppercase;text-shadow:0 2px 6px rgba(8,18,53,.5);overflow-wrap:anywhere}
#hero.hn .hn-vs{color:var(--ye);font:italic 800 clamp(2.3rem,6vw,3.8rem)/1 "Barlow Condensed",sans-serif;text-shadow:0 3px 0 #0b2273,0 0 20px rgba(255,210,63,.5);white-space:nowrap;transform:skewX(-8deg);animation:hnLat 1.6s ease-in-out infinite}
@keyframes hnLat{50%{transform:skewX(-8deg) scale(1.12)}}
#hero.hn .hn-dt{display:table;margin:24px auto 12px;padding:12px 30px;border-radius:12px;color:#0a0f1e;background:linear-gradient(180deg,#ffe27a,var(--ye));box-shadow:0 6px 0 #b8860b,0 12px 24px rgba(8,18,53,.4);font:800 clamp(1.4rem,4vw,2.2rem)/1 "Barlow Condensed",sans-serif;text-align:center;transform:skewX(-6deg)}
#hero.hn .hn-dt>span{display:inline-block;transform:skewX(6deg)}
#hero.hn .hn-loc{margin:0;text-align:center;font-weight:600;font-size:1rem}
#hero.hn .hn-loc a{color:#fff;text-decoration:underline;text-underline-offset:3px}
#hero.hn .cd{gap:8px;margin-top:16px}
#hero.hn .cd div{min-width:72px;padding:9px 12px;border:1px solid rgba(255,255,255,.28);border-radius:12px;background:rgba(8,18,53,.5);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
#hero.hn .cd b{color:var(--ye);font-size:2.2rem}
#hero.hn .cd span{font-size:.7rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
@media(max-width:760px){
 #hero.hn{padding:22px 16px 20px;background:linear-gradient(90deg,#0b2273 0%,#1740c0 38%,#2f6bff 70%,#5b9bff 84%,#c9dcff 94%,#fff 100%)}
 #hero.hn .hn-lobo{right:0;height:84%}
 #hero.hn .hn-sh{width:74px;height:74px}
 #hero.hn .cd div{min-width:56px;padding:7px 6px}
}
@media(prefers-reduced-motion:reduce){#hero.hn *{animation:none!important}}
'''
CSS_B1 = r'''
/* marcador directo (club) */
#hero.hl:not(.fs){margin:18px 0;padding:26px 56px;border-radius:26px;border-color:#8db4ff;background:linear-gradient(90deg,#0b2273 0%,#1740c0 40%,#2f6bff 70%,#5b9bff 86%,#c9dcff 95%,#fff 100%);box-shadow:0 18px 44px rgba(8,18,53,.5)}
#hero.hl:not(.fs):after{content:"";right:auto;left:-30px;bottom:-60px;width:260px;height:260px;font-size:0;background:url(../Images/escudo.png) center/contain no-repeat;opacity:.22;filter:grayscale(1) brightness(2);animation:none}
#hero.hl .live .cn,#hero.hl .live .lt{text-shadow:0 2px 6px rgba(8,18,53,.55)}
#hero.hl .gbtn{position:relative;flex-direction:column;gap:.15em;overflow:hidden;border:0;color:#0a0f1e;background:linear-gradient(180deg,#fff,#d6e4ff);box-shadow:0 .28em 0 #8fa9dd,0 .8em 1.3em rgba(8,18,53,.45);font-weight:800;transition:transform .15s,box-shadow .15s}
#hero.hl .gbtn.me{background:linear-gradient(180deg,#ffe27a,#ffd23f);box-shadow:0 .28em 0 #b8860b,0 .8em 1.3em rgba(8,18,53,.45)}
#hero.hl .gbtn:before{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 38%,rgba(255,255,255,.75) 50%,transparent 62%);transform:translateX(-130%);transition:transform .7s}
#hero.hl .gbtn:hover{border:0;transform:translateY(-3px)}
#hero.hl .gbtn:hover:before{transform:translateX(130%)}
#hero.hl .gbtn:active{transform:translateY(.22em);box-shadow:0 .05em 0 #8fa9dd,0 .2em .5em rgba(8,18,53,.4)}
#hero.hl .gbtn.me:active{box-shadow:0 .05em 0 #b8860b,0 .2em .5em rgba(8,18,53,.4)}
#hero.hl .gbtn:focus-visible{outline:3px solid #fff;outline-offset:3px}
#hero.hl .gp{font:italic 800 2.6em/.9 "Barlow Condensed",sans-serif}
#hero.hl .gt{font:800 1em/1 "Barlow Condensed",sans-serif;letter-spacing:.28em;text-indent:.28em}
#hero.hl .gx{display:-webkit-box;max-width:100%;overflow:hidden;opacity:.72;font:700 .66em/1.15 Barlow,system-ui,sans-serif;text-transform:uppercase;-webkit-box-orient:vertical;-webkit-line-clamp:2}
#hero.hl .gmn{color:#fff;border:1px solid rgba(255,255,255,.4);background:rgba(8,18,53,.5);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);font-weight:700}
@media(max-width:760px){#hero.hl:not(.fs){padding:22px 14px 20px;background:linear-gradient(90deg,#0b2273 0%,#1740c0 38%,#2f6bff 70%,#5b9bff 84%,#c9dcff 94%,#fff 100%)}#hero.hl .gbtn{aspect-ratio:auto;min-height:6.2em;padding:6px 4px}}
'''
BTN_NEW1 = '<span class="gp">＋</span><span class="gt">GOL</span><span class="gx">${esc(nm(id))}</span></button>'
CSS_B_PREV = r'''
/* marcador directo (club) v2 */
#hero.hl:not(.fs){margin:18px 0;padding:26px 56px;border-radius:26px;border-color:#8db4ff;background:linear-gradient(90deg,#0b2273 0%,#1740c0 40%,#2f6bff 70%,#5b9bff 86%,#c9dcff 95%,#fff 100%);box-shadow:0 18px 44px rgba(8,18,53,.5)}
#hero.hl:not(.fs):after{content:"";right:auto;left:-30px;bottom:-60px;width:260px;height:260px;font-size:0;background:url(../Images/escudo.png) center/contain no-repeat;opacity:.22;filter:grayscale(1) brightness(2);animation:none}
#hero.hl .live .cn,#hero.hl .live .lt{text-shadow:0 2px 6px rgba(8,18,53,.55)}
#hero.hl:not(.fs) .lb .cn{font-size:clamp(1.1rem,3.8vw,2.1rem);line-height:1.05}
#hero.hl:not(.fs) .ti{gap:8px}
#hero.hl:not(.fs) .ti .b{width:92px;height:92px;font-size:2rem;border:3px solid #fff;box-shadow:0 0 0 3px var(--ye),0 10px 24px rgba(8,18,53,.5);overflow:hidden}
#hero.hl:not(.fs) .ti .b.ok{background:#fff!important}
#hero.hl:not(.fs) .gb{gap:8px}
#hero.hl:not(.fs) .gbtn{width:auto;min-width:0;aspect-ratio:auto;white-space:nowrap;word-break:normal;padding:.35em 1.1em .35em .45em;border-radius:999px;font-size:clamp(1rem,3.8vw,1.35rem)}
#hero.hl .gbtn{position:relative;flex-direction:row;gap:.5em;overflow:hidden;border:0;color:#0a0f1e;background:linear-gradient(180deg,#fff,#d6e4ff);box-shadow:inset 0 .12em 0 rgba(255,255,255,.9),0 .28em 0 #8fa9dd,0 .8em 1.2em rgba(8,18,53,.45);font-weight:800;transition:transform .15s,box-shadow .15s}
#hero.hl .gbtn.me{background:linear-gradient(180deg,#ffe98f,#ffd23f 55%,#f2b705);box-shadow:inset 0 .12em 0 rgba(255,255,255,.8),0 .28em 0 #b8860b,0 .8em 1.2em rgba(8,18,53,.45)}
#hero.hl .gbtn:before{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 38%,rgba(255,255,255,.8) 50%,transparent 62%);transform:translateX(-130%);transition:transform .7s}
#hero.hl .gbtn.me:before{animation:hlBrillo 4s ease-in-out infinite}
@keyframes hlBrillo{0%,70%{transform:translateX(-130%)}100%{transform:translateX(130%)}}
#hero.hl .gbtn:hover{border:0;transform:translateY(-3px) scale(1.04)}
#hero.hl .gbtn:hover:before{transform:translateX(130%);animation:none}
#hero.hl .gbtn:active{transform:translateY(.22em);box-shadow:inset 0 .12em 0 rgba(255,255,255,.7),0 .04em 0 #8fa9dd,0 .15em .4em rgba(8,18,53,.4)}
#hero.hl .gbtn.me:active{box-shadow:inset 0 .12em 0 rgba(255,255,255,.7),0 .04em 0 #b8860b,0 .15em .4em rgba(8,18,53,.4)}
#hero.hl .gbtn:focus-visible{outline:3px solid #fff;outline-offset:3px}
#hero.hl .gp{position:relative;display:grid;place-items:center;width:1.5em;height:1.5em;border-radius:50%;color:#ffd23f;background:#0f2a78;box-shadow:inset 0 .1em .2em rgba(255,255,255,.35);font:800 1.15em/1 "Barlow Condensed",sans-serif}
#hero.hl .gbtn:not(.me) .gp{color:#fff}
#hero.hl .gt{position:relative;white-space:nowrap;font:italic 800 1.25em/1 "Barlow Condensed",sans-serif;letter-spacing:.14em}
#hero.hl .gx{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
#hero.hl .gmn{padding:.28em 1.1em;border:1px solid rgba(255,255,255,.55);border-radius:999px;color:#fff;background:linear-gradient(180deg,rgba(255,255,255,.28),rgba(255,255,255,.08));box-shadow:0 .2em 0 rgba(8,18,53,.6),0 .5em .9em rgba(8,18,53,.3);font-size:.8rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);transition:transform .15s,box-shadow .15s,background-color .15s}
#hero.hl .gmn:hover{transform:translateY(-2px);border-color:#fff}
#hero.hl .gmn:active{transform:translateY(.18em);box-shadow:0 .03em 0 rgba(8,18,53,.6)}
@media(max-width:760px){#hero.hl:not(.fs){padding:22px 12px 20px;background:linear-gradient(90deg,#0b2273 0%,#1740c0 38%,#2f6bff 70%,#5b9bff 84%,#c9dcff 94%,#fff 100%)}#hero.hl:not(.fs) .ti .b{width:70px;height:70px;font-size:1.5rem}#hero.hl:not(.fs) .gbtn{font-size:.95rem;padding:.3em .8em .3em .35em;gap:.35em}#hero.hl .gt{letter-spacing:.06em}}
'''
CSS_B = r'''
/* marcador directo (club) v2 */
#hero.hl:not(.fs){margin:18px 0;padding:26px 56px;border-radius:26px;border-color:#8db4ff;background:linear-gradient(90deg,#0b2273 0%,#1740c0 40%,#2f6bff 70%,#5b9bff 86%,#c9dcff 95%,#fff 100%);box-shadow:0 18px 44px rgba(8,18,53,.5)}
#hero.hl:not(.fs):after{content:"";right:auto;left:-30px;bottom:-60px;width:260px;height:260px;font-size:0;background:url(../Images/escudo.png) center/contain no-repeat;opacity:.22;filter:grayscale(1) brightness(2);animation:none}
#hero.hl .live .cn,#hero.hl .live .lt{text-shadow:0 2px 6px rgba(8,18,53,.55)}
#hero.hl:not(.fs) .lb .cn{font-size:clamp(1.1rem,3.8vw,2.1rem);line-height:1.05}
#hero.hl:not(.fs) .ti{gap:8px}
#hero.hl:not(.fs) .ti .b{width:92px;height:92px;font-size:2rem;border:3px solid #fff;box-shadow:0 0 0 3px var(--ye),0 10px 24px rgba(8,18,53,.5);overflow:hidden}
#hero.hl:not(.fs) .ti .b.ok{background:#fff!important}
#hero.hl:not(.fs) .gb{gap:28px}
#hero.hl:not(.fs) .gbtn{width:auto;min-width:0;aspect-ratio:auto;white-space:nowrap;word-break:normal;padding:.35em 1.1em .35em .45em;border-radius:999px;font-size:clamp(1rem,3.8vw,1.35rem)}
#hero.hl .gbtn{position:relative;flex-direction:row;gap:.5em;overflow:hidden;border:0;color:#0a0f1e;background:linear-gradient(180deg,#fff,#d6e4ff);box-shadow:inset 0 .12em 0 rgba(255,255,255,.9),0 .28em 0 #8fa9dd,0 .8em 1.2em rgba(8,18,53,.45);font-weight:800;transition:transform .15s,box-shadow .15s}
#hero.hl .gbtn.me{background:linear-gradient(180deg,#ffe98f,#ffd23f 55%,#f2b705);box-shadow:inset 0 .12em 0 rgba(255,255,255,.8),0 .28em 0 #b8860b,0 .8em 1.2em rgba(8,18,53,.45)}
#hero.hl .gbtn:before{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 38%,rgba(255,255,255,.8) 50%,transparent 62%);transform:translateX(-130%);transition:transform .7s}
#hero.hl .gbtn.me:before{animation:hlBrillo 4s ease-in-out infinite}
@keyframes hlBrillo{0%,70%{transform:translateX(-130%)}100%{transform:translateX(130%)}}
#hero.hl .gbtn:hover{border:0;transform:translateY(-3px) scale(1.04)}
#hero.hl .gbtn:hover:before{transform:translateX(130%);animation:none}
#hero.hl .gbtn:active{transform:translateY(.22em);box-shadow:inset 0 .12em 0 rgba(255,255,255,.7),0 .04em 0 #8fa9dd,0 .15em .4em rgba(8,18,53,.4)}
#hero.hl .gbtn.me:active{box-shadow:inset 0 .12em 0 rgba(255,255,255,.7),0 .04em 0 #b8860b,0 .15em .4em rgba(8,18,53,.4)}
#hero.hl .gbtn:focus-visible{outline:3px solid #fff;outline-offset:3px}
#hero.hl .gp{position:relative;display:grid;place-items:center;width:1.5em;height:1.5em;border-radius:50%;color:#ffd23f;background:#0f2a78;box-shadow:inset 0 .1em .2em rgba(255,255,255,.35);font:800 1.15em/1 "Barlow Condensed",sans-serif}
#hero.hl .gbtn:not(.me) .gp{color:#fff}
#hero.hl .gt{position:relative;white-space:nowrap;font:italic 800 1.25em/1 "Barlow Condensed",sans-serif;letter-spacing:.14em}
#hero.hl .gx{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
#hero.hl .gmn{padding:.28em 1.1em;border:1px solid rgba(255,255,255,.55);border-radius:999px;color:#fff;background:linear-gradient(180deg,rgba(255,255,255,.28),rgba(255,255,255,.08));box-shadow:0 .2em 0 rgba(8,18,53,.6),0 .5em .9em rgba(8,18,53,.3);font-size:.8rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);transition:transform .15s,box-shadow .15s,background-color .15s}
#hero.hl .gmn:hover{transform:translateY(-2px);border-color:#fff}
#hero.hl .gmn:active{transform:translateY(.18em);box-shadow:0 .03em 0 rgba(8,18,53,.6)}
@media(max-width:760px){#hero.hl:not(.fs){padding:22px 12px 20px;background:linear-gradient(90deg,#0b2273 0%,#1740c0 38%,#2f6bff 70%,#5b9bff 84%,#c9dcff 94%,#fff 100%)}#hero.hl:not(.fs) .ti .b{width:70px;height:70px;font-size:1.5rem}#hero.hl:not(.fs) .gb{gap:22px}#hero.hl:not(.fs) .gbtn{font-size:.95rem;padding:.3em .8em .3em .35em;gap:.35em}#hero.hl .gt{letter-spacing:.06em}}
'''

OLD_START = ' return`<div class="cn" style="font-size:1.1rem;color:var(--ye)">${dn?"PARTIDO FINALIZADO"'
OLD_END = '📡 Iniciar directo ahora</button></p>`:""}`}\n'
NEW_A = r''' const casa=nx.h==ME,etq=dn?"PARTIDO FINALIZADO":fut?"PRÓXIMO PARTIDO":"PARTIDO DE LA JORNADA";
 const eqp=id=>`<div class="hn-t${id==ME?" me":""}"><div class="hn-sh">${bd(id)}</div><div class="hn-n">${esc(nm(id))}</div></div>`;
 return`<div class="hnx"><div class="hn-fx"><i></i></div><img class="hn-lobo" src="../Images/lobo.png" alt="" aria-hidden="true">
 <div class="hn-tg"><b>${etq}</b><span>${lab(nx.r).toUpperCase()}</span><span class="cf${casa?"":" f"}">${casa?"🏠 Casa":"✈ Fuera"}</span></div>
 <div class="hn-eq">${eqp(nx.h)}<div class="hn-vs">${dn?`${m.h} - ${m.a}`:"VS"}</div>${eqp(nx.a)}</div>
 <div class="hn-dt"><span>${fmt(m.d||nx.r.d)} · ${m.t?m.t+" h":"hora por confirmar"}</span></div>
 <p class="hn-loc">${loc(nx.h,m)}</p>
 ${m.t&&fut&&!dn?`<div class="cd" id="cd" data-t="${when(nx).getTime()}"></div>`:""}${!dn&&!fut?`<p style="text-align:center;margin-top:12px">⏳ Resultado pendiente</p>`:""}${E()&&!dn?`<p style="text-align:center;margin-top:14px"><button onclick="startLive(${nx.r.n},${nx.h})">📡 Iniciar directo ahora</button></p>`:""}</div>`}
'''
TOG_OLD = 'document.getElementById("hero").innerHTML=hero();fit();'
TOG_A = 'document.getElementById("hero").innerHTML=hero();document.getElementById("hero").classList.toggle("hn",!!document.querySelector("#hero .hnx"));fit();'
HN_TOG = 'classList.toggle("hn",!!document.querySelector("#hero .hnx"));'
HL_TOG = HN_TOG + 'document.getElementById("hero").classList.toggle("hl",!!document.querySelector("#hero .live"));'
BTN_OLD = '＋ Gol ${esc(nm(id))}</button>'
BTN_NEW = '<span class="gp">＋</span><span class="gt">GOL</span><span class="gx">${esc(nm(id))}</span></button>'

if not os.path.exists("Images/lobo.png"):
    sys.exit("ERROR: falta Images/lobo.png en el repositorio. Súbelo antes de lanzar este script.")

n = 0
for f in sorted(glob.glob("Categorias/**/*.html", recursive=True)):
    if f.endswith(("_old.html", "_orig.html", "prueba.html", "prueba_new.html")):
        continue
    raw = open(f, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in raw else "\n"
    s = raw.replace("\r\n", "\n"); o = s
    if "</style>" not in s:
        print("AVISO (sin <style>, sin tocar):", f); continue
    # --- A: próximo partido
    if MARK_A not in s:
        a = s.find(OLD_START)
        b = s.find(OLD_END, a) if a >= 0 else -1
        if a < 0 or b < 0 or TOG_OLD not in s:
            print("AVISO (parte A no encaja, sin tocar):", f); continue
        b += len(OLD_END)
        s = s[:a] + NEW_A + s[b:]
        s = s.replace(TOG_OLD, TOG_A, 1)
        s = s.replace("</style>", CSS_A + "</style>", 1)
    # --- B: marcador en directo
    if MARK_B in s and CSS_B_PREV in s:      # v2 anterior: se aumenta la separación de los botones
        s = s.replace(CSS_B_PREV, CSS_B)
    if MARK_B not in s:
        if CSS_B1 in s:                      # ya tenía la versión 1: se mejora
            s = s.replace(CSS_B1, CSS_B).replace(BTN_NEW1, BTN_NEW)
        elif HN_TOG in s and s.count(BTN_OLD) == 1:
            s = s.replace(HN_TOG, HL_TOG, 1)
            s = s.replace(BTN_OLD, BTN_NEW, 1)
            s = s.replace("</style>", CSS_B + "</style>", 1)
        else:
            print("AVISO (parte B no encaja):", f)
    if s != o:
        open(f, "w", encoding="utf-8", newline="").write(s.replace("\n", nl)); print("OK:", f); n += 1
    else:
        print("ya:", f)
print(f"\n{n} páginas actualizadas.")