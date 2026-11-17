#!/usr/bin/env python3
"""Nuevo cuadro de «Próximo partido» con el lobo (Categorias/*.html). Idempotente.
Cambia el cuadro azul de próximo partido / partido finalizado por el diseño del club:
degradado azul a blanco, escudos grandes, VS, fecha en pastilla, cuenta atrás y el lobo
casi transparente pegado a la derecha. El directo (marcador en vivo), «Descansa» y la
pantalla completa NO se tocan.
Necesita el archivo Images/lobo.png en el repositorio.
Uso, desde la RAÍZ del repositorio:   python3 scripts/hero_lobo.py
"""
import glob, os, sys

MARK = "diseño club (lobo)"
CSS = r'''/* ===== PRÓXIMO PARTIDO · diseño club (lobo) ===== */
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

OLD_START = ' return`<div class="cn" style="font-size:1.1rem;color:var(--ye)">${dn?"PARTIDO FINALIZADO"'
OLD_END = '📡 Iniciar directo ahora</button></p>`:""}`}\n'
NEW = r''' const casa=nx.h==ME,etq=dn?"PARTIDO FINALIZADO":fut?"PRÓXIMO PARTIDO":"PARTIDO DE LA JORNADA";
 const eqp=id=>`<div class="hn-t${id==ME?" me":""}"><div class="hn-sh">${bd(id)}</div><div class="hn-n">${esc(nm(id))}</div></div>`;
 return`<div class="hnx"><div class="hn-fx"><i></i></div><img class="hn-lobo" src="../Images/lobo.png" alt="" aria-hidden="true">
 <div class="hn-tg"><b>${etq}</b><span>${lab(nx.r).toUpperCase()}</span><span class="cf${casa?"":" f"}">${casa?"🏠 Casa":"✈ Fuera"}</span></div>
 <div class="hn-eq">${eqp(nx.h)}<div class="hn-vs">${dn?`${m.h} - ${m.a}`:"VS"}</div>${eqp(nx.a)}</div>
 <div class="hn-dt"><span>${fmt(m.d||nx.r.d)} · ${m.t?m.t+" h":"hora por confirmar"}</span></div>
 <p class="hn-loc">${loc(nx.h,m)}</p>
 ${m.t&&fut&&!dn?`<div class="cd" id="cd" data-t="${when(nx).getTime()}"></div>`:""}${!dn&&!fut?`<p style="text-align:center;margin-top:12px">⏳ Resultado pendiente</p>`:""}${E()&&!dn?`<p style="text-align:center;margin-top:14px"><button onclick="startLive(${nx.r.n},${nx.h})">📡 Iniciar directo ahora</button></p>`:""}</div>`}
'''
TOG_OLD = 'document.getElementById("hero").innerHTML=hero();fit();'
TOG_NEW = 'document.getElementById("hero").innerHTML=hero();document.getElementById("hero").classList.toggle("hn",!!document.querySelector("#hero .hnx"));fit();'

if not os.path.exists("Images/lobo.png"):
    sys.exit("ERROR: falta Images/lobo.png en el repositorio. Súbelo antes de lanzar este script.")

n = 0
for f in sorted(glob.glob("Categorias/**/*.html", recursive=True)):
    if f.endswith("_old.html") or f.endswith("_orig.html") or f.endswith("prueba.html") or f.endswith("prueba_new.html"):
        continue
    raw = open(f, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in raw else "\n"
    s = raw.replace("\r\n", "\n"); o = s
    if MARK in s:
        print("ya:", f); continue
    a = s.find(OLD_START)
    b = s.find(OLD_END, a) if a >= 0 else -1
    if a < 0 or b < 0 or TOG_OLD not in s or "</style>" not in s:
        print("AVISO (no encaja, sin tocar):", f); continue
    b += len(OLD_END)
    s = s[:a] + NEW + s[b:]
    s = s.replace(TOG_OLD, TOG_NEW, 1)
    s = s.replace("</style>", CSS + "</style>", 1)
    open(f, "w", encoding="utf-8", newline="").write(s.replace("\n", nl))
    print("OK:", f); n += 1
print(f"\n{n} páginas actualizadas.")