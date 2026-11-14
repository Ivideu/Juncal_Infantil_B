#!/usr/bin/env python3
"""La jornada «actual» de cada categoría pasa a ser la de la SEMANA: dura hasta el domingo a las 23:00 (hora de Madrid),
juegue o descanse el Torrejón Juncal. Antes saltaba a la siguiente en cuanto el Juncal había jugado (o si descansaba).
Idempotente. Uso, desde la RAÍZ del repositorio:   python3 scripts/jornada_semana.py
"""
import glob
JS = r'''/* Jornada de la semana: hasta el domingo a las 23:00 (Madrid) de la semana de su fecha */
function wkJ(){const mad=(y,m,d)=>{for(const o of [1,2]){const t=Date.UTC(y,m-1,d,23-o,0);if(+new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Madrid",hour:"numeric",hourCycle:"h23"}).format(t)===23)return t}return Date.UTC(y,m-1,d,22,0)};
 const fin=iso=>{const t=new Date(iso+"T12:00:00Z");t.setUTCDate(t.getUTCDate()+(7-t.getUTCDay())%7);return mad(t.getUTCFullYear(),t.getUTCMonth()+1,t.getUTCDate())};
 const r=J.find(x=>x.d&&fin(x.d)>Date.now());return r?r.n:J.length}
'''
A1 = "function jsel(){const c=(nextL()||{r:{n:0}}).r.n;"
B1 = "function jsel(){const c=wkJ();"
A2 = "if(jnAuto){const nx=nextL();jn=nx?nx.r.n:J.length}"
B2 = "if(jnAuto)jn=wkJ();"
ok = ya = 0
for f in sorted(glob.glob("Categorias/**/*.html", recursive=True)):
    raw = open(f, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in raw else "\n"
    s = raw.replace("\r\n", "\n")
    if "function wkJ()" in s: print("ya:", f); ya += 1; continue
    if A1 not in s or A2 not in s: print("sin el código esperado (se salta):", f); continue
    s = s.replace(A1, JS + B1).replace(A2, B2)
    open(f, "w", encoding="utf-8", newline="").write(s.replace("\n", nl)); print("OK:", f); ok += 1
print(f"\n{ok} páginas actualizadas, {ya} ya estaban.")
