#!/usr/bin/env python3
"""Genera las páginas de categoría a partir de Categorias/InfantilB.html (que NO se modifica).
Ejecútalo desde la RAÍZ del repositorio:
    python scripts/generar_categorias.py             -> escribe en salida/Categorias/ para que lo revises
    python scripts/generar_categorias.py --escribir  -> escribe directamente en Categorias/ (copia antes lo anterior en Backup/)
Lee scripts/categorias.json (id, grupo, equipo, liga) si existe."""
import re, sys, json, pathlib, shutil, time
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
ESCRIBIR = "--escribir" in sys.argv
SRC = pathlib.Path(ARGS[0] if ARGS else "Categorias/InfantilB.html")
OUT = pathlib.Path("Categorias" if ESCRIBIR else "salida/Categorias"); OUT.mkdir(parents=True, exist_ok=True)
EXTRA_JS = "../scripts/categoria-extra.js"       # ruta desde Categorias/ (cámbiala si lo mueves a js/)
SALTAR = {"infantil-b"}                            # Infantil B es el original
# id -> (carpeta/archivo, nombre corto, liga por defecto)
TABLA = {
 "aficionado-a":("AficionadoA","Aficionado A","Preferente Aficionado Sala"),
 "aficionado-b":("AficionadoB","Aficionado B","Primera Aficionado Sala"),
 "juvenil-a":("JuvenilA","Juvenil A","Preferente Juvenil Sala"),
 "juvenil-b":("JuvenilB","Juvenil B","Primera Juvenil Sala"),
 "cadete-a":("CadeteA","Cadete A","Primera Cadete Sala"),
 "cadete-b":("CadeteB","Cadete B","Primera Cadete Sala"),
 "infantil-a":("InfantilA","Infantil A","Preferente Infantil Sala"),
 "alevin-a":("AlevinA","Alevín A","Alevín Sala"),
 "alevin-b":("AlevinB","Alevín B","Alevín Sala"),
}
cj = pathlib.Path("scripts/categorias.json")
extra = {c["id"]: c for c in json.loads(cj.read_text(encoding="utf-8")).get("categorias", [])} if cj.exists() else {}
for i in extra:
    if i not in TABLA and i not in SALTAR: print("AVISO: categoría en categorias.json sin plantilla en TABLA:", i)
base = SRC.read_text(encoding="utf-8")
def rep(t, old, new):
    if old not in t: sys.exit("NO ENCONTRADO en " + SRC.name + ": " + old[:80])
    return t.replace(old, new)
def rex(t, pat, new):
    t2, k = re.subn(pat, lambda m: new, t, flags=re.M)
    if not k: sys.exit("NO ENCONTRADO en " + SRC.name + ": " + pat)
    return t2
for cid, (carpeta, corto, liga0) in TABLA.items():
    c = extra.get(cid, {}); liga = c.get("liga") or liga0; node = "cat-" + cid; nombre = "Torrejón Juncal " + corto
    t = base.replace("../../", "../")             # las páginas viven en Categorias/ (un nivel)
    t = rep(t, "<title>Juncal B · Primera Infantil FS G2 · 2026-27</title>", "<title>" + corto + " · " + liga + " · 2026-27</title>")
    t = rep(t, 'content="Juncal_Inf.B"', 'content="Juncal_' + carpeta + '"')
    t = rep(t, "<small>Primera Infantil FS · Grupo 2 · Temporada 2026-27</small>", "<small>" + liga + " · Temporada 2026-27</small>")
    t = rex(t, r"^const T=\{2:.*$", "const T={};")
    t = rex(t, r"^const COD=\{.*\};$", "const COD={};")
    t = rex(t, r"^const R=\[.*\];$", "const R=[];")
    t = t.replace("Torrejón Juncal B", nombre).replace("Juncal B", "${CAT.corto}")
    t = rep(t, "const ME=10;", "let ME=CAT.me||0;")
    t = rep(t, 'const nm=id=>id?T[id][0]:"Descansa";', 'const nm=id=>!id||!T[id]?"Descansa":id==ME&&CAT.nombre?CAT.nombre:T[id][0];')
    t = rep(t, "T[ME][0]", "nm(ME)")
    t = rep(t, "const myM=()=>{const l=J.map(r=>{const p=r.p.find(q=>q.includes(ME));return{r,h:p[0],a:p[1]}});",
               "const myM=()=>{const l=[];J.forEach(r=>{const p=r.p.find(q=>q.includes(ME));if(p)l.push({r,h:p[0],a:p[1]})});")
    t = rep(t, "const cSrc=c=>CROMOS_DIR+encodeURIComponent(c.file);", "const cSrc=c=>c.src||CROMOS_DIR+encodeURIComponent(c.file);")
    t = rex(t, r"^const CROMOS_FILES=\[.*\];$", "const CROMOS_FILES=[];")
    t = rep(t, '"/juncal.json', '"/"+CAT.node+".json')
    t = rep(t, '"juncalB"', '"juncal_"+CAT.node')
    t = rep(t, ":JSON.parse(m.data)}catch(e){return}", ':(typeof m.data==="string"?JSON.parse(m.data):m.data)}catch(e){return}')
    t = rep(t, "actions/workflows/sync.yml/dispatches", "actions/workflows/sync-categorias.yml/dispatches")   # "Actualizar ahora" del propietario
    cat = dict(nombre=nombre, corto=corto, liga=liga, node=node, email=node + "@torrejonjuncal.es", grupo=str(c.get("grupo", "")), equipo=str(c.get("equipo", "")), me=0)
    t = rep(t, "</style>\n</head>", "</style>\n<script>const CAT=" + json.dumps(cat, ensure_ascii=False) + ";</script>\n</head>")
    t = rep(t, "</script>\n</body>", '</script>\n<script src="' + EXTRA_JS + '"></script>\n</body>')
    dest = OUT / (carpeta + ".html")
    if ESCRIBIR and dest.exists():
        b = pathlib.Path("Backup"); b.mkdir(exist_ok=True)
        shutil.copy(dest, b / (carpeta + "_" + time.strftime("%Y%m%d-%H%M") + ".html"))
    dest.write_text(t, encoding="utf-8")
    print("OK", dest, "· usuario Firebase:", cat["email"])