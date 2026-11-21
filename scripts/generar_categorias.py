#!/usr/bin/env python3
"""Genera las páginas de categoría (Categorias/*.html) TODAS desde la misma plantilla: Categorias/InfantilA.html.
Cada página solo se diferencia en 5 sitios (título, nombre de la app, bloque CAT, etiqueta y nombre en la cabecera);
los equipos, el calendario y los resultados llegan de la sincronización (Firebase, nodo cfg), igual en todas.
Infantil B incluye además lo que ya tenía suyo (sus cromos de archivo) y guarda en el nodo «juncal» (ver categorias.json).

Ejecútalo desde la RAÍZ del repositorio:
    python scripts/generar_categorias.py             -> escribe en salida/Categorias/ para que lo revises
    python scripts/generar_categorias.py --escribir  -> escribe en Categorias/ (copia antes lo anterior en Backup/)
Lee scripts/categorias.json (id, grupo, equipo, liga, node)."""
import re, sys, json, pathlib, shutil, time
ESCRIBIR = "--escribir" in sys.argv
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
SRC = pathlib.Path(ARGS[0] if ARGS else "Categorias/InfantilA.html")   # plantilla común
OUT = pathlib.Path("Categorias" if ESCRIBIR else "salida/Categorias"); OUT.mkdir(parents=True, exist_ok=True)
# id -> (archivo, nombre corto, liga por defecto)
TABLA = {
 "aficionado-a": ("AficionadoA", "Aficionado A", "Preferente Aficionado Sala"),
 "aficionado-b": ("AficionadoB", "Aficionado B", "Primera Aficionado Sala"),
 "juvenil-a": ("JuvenilA", "Juvenil A", "Preferente Juvenil Sala"),
 "juvenil-b": ("JuvenilB", "Juvenil B", "Primera Juvenil Sala"),
 "cadete-a": ("CadeteA", "Cadete A", "Primera Cadete Sala"),
 "cadete-b": ("CadeteB", "Cadete B", "Primera Cadete Sala"),
 "infantil-a": ("InfantilA", "Infantil A", "Preferente Infantil Sala"),
 "infantil-b": ("InfantilB", "Infantil B", "Primera Infantil Sala"),
 "alevin-a": ("AlevinA", "Alevín A", "Alevín Sala"),
 "alevin-b": ("AlevinB", "Alevín B", "Alevín Sala"),
}
# Lo de la plantilla (Infantil A) que se cambia en cada página
P_TITLE = "<title>Infantil A · Preferente Infantil FS · Grupo 2 · 2026-27</title>"
P_APPT = 'content="Juncal_InfantilA"'
P_ARIA = 'aria-label="Torrejón Juncal INFANTIL A.. Pulsa para cambiar de categoría"'
P_CN = '<b class="cn">INFANTIL A</b>'
RE_CAT = re.compile(r"<script>const CAT=\{.*?\};</script>")

# Infantil B conserva sus cromos de archivo (Cromos/*.png) y sus dos entrenadores
B_CROMOS = ('const CROMOS_FILES=["Alex_10_ala.png","Edu_11_ala.png","Diego_3_ala.png","Erik_5_pivot.png","Gabriel_15_ala.png","Hector_18_ala.png","Ivan.png","Izan_7_pivot.png","Javier.png","Joel_8_ala.png","Manu_2_cierre.png","Marcos_13_portero.png","Nico_6_cierre.png","Pablo_89_portero.png","Pedro_28_ala.png","Ruben_1_portero.png"];\n'
            'const COACHES=["Javier.png","Ivan.png"]; // archivos que son entrenadores, en este orden')
B_ORDC = 'const ORDC=c=>c.coach?COACHES.indexOf(c.file):(c.pos==="portero"?0:1);'
B_CROMOS_MAP = 'const CROMOS=CROMOS_FILES.map(f=>{const k=f.replace(/\\.png$/i,""),p=k.split("_"),co=COACHES.includes(f)||p[p.length-1]==="entrenador";return{file:f,key:k,name:p[0].replace(/\\d+$/,""),num:co?"":p[1],pos:co?"entrenador":p[2],coach:co}}).sort((a,b)=>ORDC(a)-ORDC(b)||(+a.num||0)-(+b.num||0));'

cj = pathlib.Path("scripts/categorias.json")
extra = {c["id"]: c for c in json.loads(cj.read_text(encoding="utf-8")).get("categorias", [])} if cj.exists() else {}
base = SRC.read_text(encoding="utf-8")
def rep(t, old, new):
    if old not in t: sys.exit("NO ENCONTRADO en " + SRC.name + ": " + old[:90])
    return t.replace(old, new, 1)
for cid, (carpeta, corto, liga0) in TABLA.items():
    c = extra.get(cid, {}); liga = c.get("liga") or liga0; nombre = "Torrejón Juncal " + corto
    node = c.get("node") or "cat-" + cid
    cat = dict(nombre=nombre, corto=corto, liga=liga, node=node, email=cid + "@torrejonjuncal.es", grupo=str(c.get("grupo", "")), equipo=str(c.get("equipo", "")), me=0)
    t = rep(base, P_TITLE, "<title>" + corto + " · " + liga + " · 2026-27</title>")
    t = rep(t, P_APPT, 'content="Juncal_' + carpeta + '"')
    t = rep(t, P_ARIA, 'aria-label="Torrejón Juncal ' + corto.upper() + '.. Pulsa para cambiar de categoría"')
    t = rep(t, P_CN, '<b class="cn">' + corto.upper() + "</b>")
    t, k = RE_CAT.subn(lambda m: "<script>const CAT=" + json.dumps(cat, ensure_ascii=False) + ";</script>", t, count=1)
    if not k: sys.exit("NO ENCONTRADO el bloque CAT")
    if cid == "infantil-b":
        t = rep(t, 'const CATK=CAT.node.replace(/^cat-/,"")', 'const CATK="infantil-b"')   # Pizarra, jugadas y sesión van por «infantil-b»
        t = rep(t, "const CROMOS_FILES=[];", B_CROMOS)
        t = re.sub(r"^const ORDC=.*$", lambda m: B_ORDC, t, count=1, flags=re.M)
        t = re.sub(r"^const CROMOS=CROMOS_FILES\.map.*$", lambda m: B_CROMOS_MAP, t, count=1, flags=re.M)
    dest = OUT / (carpeta + ".html")
    if ESCRIBIR and dest.exists() and dest.read_text(encoding="utf-8") != t:
        b = pathlib.Path("Backup"); b.mkdir(exist_ok=True)
        shutil.copy(dest, b / (carpeta + "_" + time.strftime("%Y%m%d-%H%M") + ".html"))
    dest.write_text(t, encoding="utf-8")
    print("OK", dest, "· nodo Firebase:", node)
