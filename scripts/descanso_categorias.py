#!/usr/bin/env python3
"""Cambia el escudo del equipo que DESCANSA en todas las páginas de Categorias/ por un icono de luna con borde discontinuo
(se ve claramente que no juega). También cubre el caso de que la RFFM lo traiga como un equipo llamado «Descansa».
Idempotente. Uso, desde la RAÍZ del repositorio:   python3 scripts/descanso_categorias.py
"""
import glob
SVG = '<svg viewBox="0 0 24 24" width="62%" height="62%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>'
OLD_BD = 'const bd=id=>{if(!id)return`<span class="b" style="background:#334">💤</span>`;'
NEW_BD = 'const bd=id=>{if(!id||!T[id]||/^descansa/i.test(T[id][0]))return`<span class="b zz" title="Descansa">' + SVG + '</span>`;'
OLD_NM = 'const nm=id=>!id||!T[id]?"Descansa":'
NEW_NM = 'const nm=id=>!id||!T[id]||/^descansa/i.test(T[id][0])?"Descansa":'
CSS = (".b.zz{background:#eef2ff!important;color:#5b6aa8;border:2px dashed #9fb0e6!important;box-shadow:none!important}\n"
       ".b.zz svg{display:block}\n")
ok = ya = 0
for f in sorted(glob.glob("Categorias/**/*.html", recursive=True)):
    s = open(f, encoding="utf-8", newline="").read()
    if "b zz" in s: print("ya:", f); ya += 1; continue
    if OLD_BD not in s: print("sin función bd (se salta):", f); continue
    s = s.replace(OLD_BD, NEW_BD).replace(OLD_NM, NEW_NM)
    nl = "\r\n" if "\r\n" in s else "\n"
    i = s.rindex("</style>"); s = s[:i] + CSS.replace("\n", nl) + s[i:]
    open(f, "w", encoding="utf-8", newline="").write(s); print("OK:", f); ok += 1
print(f"\n{ok} páginas actualizadas, {ya} ya estaban.")
