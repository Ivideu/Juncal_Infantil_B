#!/usr/bin/env python3
"""InfantilB.html: dentro de la app nueva («Torrejón Juncal», que se abre en app.html) la página NO se suscribe sola
al tema «juncal»: cada familia elige sus equipos con las campanas de app.html. Las apps antiguas (un APK por categoría)
siguen funcionando igual. Idempotente.
Uso, desde la RAÍZ del repositorio:   python3 scripts/avisos_app.py
"""
import glob
OLD = 'const FM=window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.FirebaseMessaging;if(!FM)return;\n const p=await FM.requestPermissions();'
NEW = 'const FM=window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.FirebaseMessaging;if(!FM)return;\n if(localStorage.getItem("jb_app"))return;   /* app nueva: los avisos se eligen en app.html */\n const p=await FM.requestPermissions();'
n = 0
for f in sorted(glob.glob("Categorias/**/*.html", recursive=True)):
    raw = open(f, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in raw else "\n"
    s = raw.replace("\r\n", "\n")
    if 'localStorage.getItem("jb_app")' in s: print("ya:", f); continue
    if OLD not in s: continue
    open(f, "w", encoding="utf-8", newline="").write(s.replace(OLD, NEW).replace("\n", nl)); print("OK:", f); n += 1
print(f"\n{n} páginas actualizadas.")
