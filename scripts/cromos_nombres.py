#!/usr/bin/env python3
"""Arregla los cromos de jugadores con nombre de varias palabras («Jorge de Lucas», «Marcos C», «Marcos J»):
la página buscaba el cromo solo por la primera palabra («Jorge», «Marcos»), así que el cromo se creaba pero no se enlazaba
a su jugador. Ahora se busca primero por el nombre completo y, si no hay, por la primera palabra (como antes).
Idempotente. Uso, desde la RAÍZ del repositorio:   python3 scripts/cromos_nombres.py
"""
import glob
OLD = ("const p=pn(n),t=noacc(p.name.split(/\\s+/)[0]),j=CROMOS.filter(c=>!c.coach),"
       "m=j.filter(c=>noacc(c.name)===t&&(!p.num||!c.num||c.num==p.num));\n return m[0]||null}")
NEW = ("const p=pn(n),full=noacc(p.name.trim()),t=noacc(p.name.split(/\\s+/)[0]),j=CROMOS.filter(c=>!c.coach),"
       "ok=c=>!p.num||!c.num||c.num==p.num;\n return j.find(c=>noacc(c.name.trim())===full&&ok(c))||j.find(c=>noacc(c.name)===t&&ok(c))||null}")
ok = ya = 0
for f in sorted(glob.glob("Categorias/**/*.html", recursive=True)):
    raw = open(f, encoding="utf-8", newline="").read()
    s = raw.replace("\r\n", "\n")
    if "full=noacc(p.name.trim())" in s: print("ya:", f); ya += 1; continue
    if OLD not in s: print("sin cromoFor esperado (se salta):", f); continue
    s = s.replace(OLD, NEW)
    if "\r\n" in raw: s = s.replace("\n", "\r\n")
    open(f, "w", encoding="utf-8", newline="").write(s); print("OK:", f); ok += 1
print(f"\n{ok} páginas actualizadas, {ya} ya estaban.")
