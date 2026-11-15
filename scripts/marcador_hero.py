#!/usr/bin/env python3
"""Arregla el cartel grande de «Próximo partido» (Categorias/*.html). Idempotente.
 1) El resultado (p. ej. «3 - 1») ya no se parte en varias líneas en móvil: se queda en una sola línea.
 2) Solo InfantilB (el que tiene directo): el cartel «FIN PARTIDO» se mantiene hasta el domingo a las 23:00 (Madrid)
    de la semana del partido, igual que el selector de jornadas, en vez de hasta el lunes a las 6:00.
Uso, desde la RAÍZ del repositorio:   python3 scripts/marcador_hero.py
"""
import glob
CSS_MARK = "/* marcador hero en una línea */"
CSS = CSS_MARK + "\n.hv>.cn{flex:none;white-space:nowrap;max-width:none}\n"
HE_OLD = ('function holdEnd(fin){const d=new Date(fin).toLocaleDateString("sv-SE",{timeZone:"Europe/Madrid"}),'
          'w=new Date(d+"T12:00:00Z").getUTCDay(),n=w==6?2:1,e=new Date(Date.parse(d+"T12:00:00Z")+n*864e5).toISOString().slice(0,10);return madrid(e,"06:00")}')
HE_NEW = ('function holdEnd(fin){const d=new Date(fin).toLocaleDateString("sv-SE",{timeZone:"Europe/Madrid"}),t=new Date(d+"T12:00:00Z");'
          't.setUTCDate(t.getUTCDate()+(7-t.getUTCDay())%7);return Math.max(madrid(t.toISOString().slice(0,10),"23:00"),+fin+36e5)}')
n = 0
for f in sorted(glob.glob("Categorias/**/*.html", recursive=True)):
    if f.endswith("_old.html") or f.endswith("prueba.html"): continue
    raw = open(f, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in raw else "\n"
    s = raw.replace("\r\n", "\n"); o = s
    if CSS_MARK not in s and "</style>" in s: s = s.replace("</style>", CSS + "</style>", 1)
    if HE_OLD in s: s = s.replace(HE_OLD, HE_NEW)
    if s != o: open(f, "w", encoding="utf-8", newline="").write(s.replace("\n", nl)); print("OK:", f); n += 1
    else: print("ya:", f)
print(f"\n{n} páginas actualizadas.")
