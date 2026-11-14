#!/usr/bin/env python3
"""Pone el escudo de Torrejón Juncal en TODAS las páginas de Categorias/ (el equipo propio, ME, usa Images/escudo.png)
y deja el escudo de los rivales como hasta ahora (Escudos/<CodEquipo>.png, con las iniciales de reserva si no existe).
Es idempotente: se puede lanzar las veces que haga falta.

Uso, desde la RAÍZ del repositorio:   python3 scripts/escudos_categorias.py
"""
import glob, re, sys

PAT = re.compile(r'COD\[id\]\?`<img src="((?:\.\./)+)Escudos/\$\{COD\[id\]\}\.png"')
n_ok = n_ya = 0
for f in sorted(glob.glob("Categorias/**/*.html", recursive=True)):
    raw = open(f, encoding="utf-8", newline="").read()
    if 'id==ME?"' in raw and "Images/escudo.png" in raw:
        print("ya tiene escudo propio:", f); n_ya += 1; continue
    m = PAT.search(raw)
    if not m:
        print("sin función de escudos (se salta):", f); continue
    p = m.group(1)
    new = ('(COD[id]||id==ME)?`<img src="${id==ME?"%sImages/escudo.png":"%sEscudos/"+COD[id]+".png"}"' % (p, p))
    raw = raw[:m.start()] + new + raw[m.end():]
    open(f, "w", encoding="utf-8", newline="").write(raw)
    print("OK:", f); n_ok += 1
print(f"\n{n_ok} páginas actualizadas, {n_ya} ya estaban.")
