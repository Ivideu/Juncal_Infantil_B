#!/usr/bin/env python3
"""El cartel de arriba («Próximo partido») sigue la jornada de la SEMANA, igual que el selector de jornadas:
muestra el partido del Juncal de esta jornada hasta el domingo a las 23:00 (Madrid), aunque ya se haya jugado
(entonces pone FINALIZADO y el resultado, o «Resultado pendiente» si aún no está) y, si descansa, lo indica.
A partir del domingo 23:00 pasa a la jornada siguiente. Idempotente. Requiere haber aplicado antes jornada_semana.py.
Uso, desde la RAÍZ del repositorio:   python3 scripts/hero_semana.py
"""
import glob
NM_OLD = "function nextM(){const lv=liveM(1);if(lv)return lv;return myM().filter(x=>x.h&&x.a).find(cur)}"
NM_NEW = ('function nextM(){const lv=liveM(1);if(lv)return lv;\n'
 ' const r=J.find(x=>x.n===wkJ()),p=r&&r.p.find(q=>q.includes(ME)),a=p?(p[0]&&p[1]?{r,h:p[0],a:p[1]}:{r,h:p[0],a:p[1],rest:1}):null;\n'
 ' const c=myM().filter(x=>x.r.copa&&x.h&&x.a).find(cur);\n'
 ' if(c&&(!a||a.rest||when(c)<=when(a)))return c;\n'
 ' return a||myM().filter(x=>x.h&&x.a).find(cur)}')
H1_OLD = " const m=M(nx.r.n,nx.h);\n return`<div class=\"cn\" style=\"font-size:1.1rem;color:var(--ye)\">PRÓXIMO PARTIDO · ${lab(nx.r).toUpperCase()}</div>"
H1_NEW = (" if(nx.rest)return`<div class=\"cn\" style=\"font-size:1.1rem;color:var(--ye)\">${lab(nx.r).toUpperCase()}</div>"
 "<div class=\"hv\"><div>${bd(0)}<div class=\"cn\">Descansa esta jornada</div></div></div>"
 "<p style=\"text-align:center\"><span class=\"dt dtb\">${fmt(nx.r.d)}</span></p>`;\n"
 " const m=M(nx.r.n,nx.h),dn=done(m),fut=when(nx).getTime()>Date.now();\n"
 " return`<div class=\"cn\" style=\"font-size:1.1rem;color:var(--ye)\">${dn?\"PARTIDO FINALIZADO\":fut?\"PRÓXIMO PARTIDO\":\"PARTIDO DE LA JORNADA\"} · ${lab(nx.r).toUpperCase()}</div>")
VS_OLD = '<div class="cn" style="font-size:2rem">VS</div>'
VS_NEW = '<div class="cn" style="font-size:2rem">${dn?`${m.h} - ${m.a}`:"VS"}</div>'
CD_OLD = ' ${m.t?`<div class="cd" id="cd" data-t="${when(nx).getTime()}"></div>`:""}${E()?'
CD_NEW = ' ${m.t&&fut&&!dn?`<div class="cd" id="cd" data-t="${when(nx).getTime()}"></div>`:""}${!dn&&!fut?`<p style="text-align:center;margin-top:12px">⏳ Resultado pendiente</p>`:""}${E()&&!dn?'
ok = ya = 0
for f in sorted(glob.glob("Categorias/**/*.html", recursive=True)):
    raw = open(f, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in raw else "\n"
    s = raw.replace("\r\n", "\n")
    if "nx.rest" in s: print("ya:", f); ya += 1; continue
    if "function wkJ()" not in s: print("falta jornada_semana.py (se salta):", f); continue
    if not all(x in s for x in (NM_OLD, H1_OLD, VS_OLD, CD_OLD)): print("sin el código esperado (se salta):", f); continue
    s = s.replace(NM_OLD, NM_NEW).replace(H1_OLD, H1_NEW).replace(VS_OLD, VS_NEW).replace(CD_OLD, CD_NEW)
    open(f, "w", encoding="utf-8", newline="").write(s.replace("\n", nl)); print("OK:", f); ok += 1
print(f"\n{ok} páginas actualizadas, {ya} ya estaban.")
