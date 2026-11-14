#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
aplicar_cambios.py  ·  Pasa a las páginas de categoría los cambios de prueba.html:
  1) El bloque azul "próximo partido / directo" solo se ve en la pestaña Jornadas.
  2) Pizarra: nuevo orden de barras (Colocar + pantalla completa, Añadir, Pasos y Animación,
     Herramienta, pista, Grabar y publicar), sin texto de ayuda y con pantalla completa.
  3) Campo del título de la jugada en blanco.
  4) Se quita el banner de arriba y aparece el menú superior fijo (como en prueba.html).

USO (desde la carpeta donde están los .html de las categorías):
    python aplicar_cambios.py Categorias           -> todos los .html con pizarra de esa carpeta (y subcarpetas)
    python aplicar_cambios.py                      -> igual, pero en la carpeta actual
    python aplicar_cambios.py AficionadoA.html     -> solo ese archivo

Guarda una copia de cada original en la carpeta _copia_seguridad y sobrescribe el archivo.\nTermina con error si alguna página no se ha podido actualizar.
Si en una página no encuentra algún punto de anclaje, NO la toca y te dice cuál falta.
Si la página ya tiene los cambios, la salta.
"""
import re, sys, glob, os, shutil

CSS = r"""#pzf{display:flex;flex-direction:column}
#pzf iframe{flex:none;order:1}
#pzbar{display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:8px;padding:6px 8px;background:#0d2561;border-top:1px solid rgba(255,255,255,.16);order:2}
#pzbar button{background:#173a8f;color:#fff;border:1px solid rgba(255,255,255,.16);font-weight:700;padding:6px 14px;border-radius:8px;min-height:36px}
#pzbar button:hover{background:#1f4cb8;transform:none}
#pzf.fsp{position:fixed;inset:0;z-index:9990;margin:0;border-radius:0;display:flex;flex-direction:column;height:100vh;height:100dvh;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}
#pzf.fsp #pzbar{flex:none}
#pzf.fsp iframe{flex:1 1 0;min-height:0;height:100%}
#pzbar .fsx{display:flex;flex:1 1 300px;min-width:0;align-items:center;gap:8px}
#pzf.fsp #pzbar .fsx{display:flex}
#pzbar #ptit2{flex:0 1 260px;width:auto;min-width:90px;padding:6px 10px;min-height:36px;border:2px solid #7aa9ff;border-radius:8px;background:#fff;color:#0b2a6f;font-weight:600}
#pzbar #ptit2::placeholder{color:#6b7aa6;font-weight:400}
#pzbar #ptit2:focus{outline:3px solid #ffd23f;outline-offset:1px}
#pzbar #pbtn2{background:var(--ye);border-color:var(--ye);color:#0b2a6f;white-space:nowrap}
#pzbar #pst2{flex:1;min-width:0;font-size:.8rem;color:#c3d0ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#pzf.fsp #pzbar{justify-content:space-between}"""

BAR = r"""<div id="pzf"><div id="pzbar"><span class="fsx"><input id="ptit2" maxlength="60" placeholder="Título de la jugada" aria-label="Título de la jugada"><button type="button" id="pbtn2">⏺ Grabar y publicar</button><span id="pst2" role="status"></span></span></div></div>"""

JS_PRE = r"""/* Orden de la pizarra: 1) Colocar + pantalla completa, 2) Añadir, 3) Pasos y Animación, 4) Herramienta, 5) pista. Sin texto de ayuda */
function pzStyle(){try{const d=pzFr.contentDocument;if(!d||d.getElementById("pzord"))return;
 const st=d.createElement("style");st.id="pzord";
 st.textContent=".app>.bar:nth-child(1){flex-direction:column;flex-wrap:nowrap;align-items:stretch;order:1}.app>.bar:nth-child(1)>.grp.colg{order:-1}.app>.bar:nth-child(4){order:2}.app>.bar:nth-child(2){order:3}.app>.cvw{order:4}.hint{display:none!important}";
 d.head.appendChild(st);
 const g=d.getElementById("form").closest(".grp");g.classList.add("colg");
 if(!d.getElementById("pzfsIn")){const b=d.createElement("button");b.id="pzfsIn";b.type="button";b.textContent=PFS?"✕ Salir de pantalla completa":"⛶ Pantalla completa";b.style.marginLeft="auto";b.onclick=()=>parent.togPzFS();g.appendChild(b)}
}catch(e){}}
"""

JS_POST = r"""/* Dentro de la pantalla completa, la pizarra se ajusta al alto disponible para verla entera sin bajar */
let pzRO=null;
function fsLayout(on){
 try{
  const d=pzFr&&pzFr.contentDocument,w=pzFr&&pzFr.contentWindow;if(!d)return;
  if(pzRO){pzRO.disconnect();pzRO=null}
  let st=d.getElementById("pzfsx");const box=d.querySelector(".cvw"),cv=d.getElementById("cv");
  if(!on){if(st)st.remove();if(cv)cv.style.width="";return}
  if(!st){st=d.createElement("style");st.id="pzfsx";
   st.textContent="html,body{height:100%}body{padding:4px!important;overflow:hidden}.app{height:100%;max-width:none!important;gap:4px!important}.cvw{flex:1 1 0;min-height:0;display:flex;justify-content:center;align-items:center}.hint{display:none}.bar{padding:4px 8px!important}";
   d.head.appendChild(st)}
  const f=()=>{const h=box.clientHeight,wd=box.clientWidth;if(h>0)cv.style.width=Math.max(100,Math.min(wd,h*43.2/23.2))+"px"};
  f();pzRO=new w.ResizeObserver(f);pzRO.observe(box);
 }catch(e){}}
/* Pizarra a pantalla completa: tapa el menú, la barra de admin y el resto de botones de la página */
function setPzFS(on){
 const f=document.querySelector("#pzf");if(!f||on===PFS)return;
 PFS=on;f.classList.toggle("fsp",on);
 try{const b=pzFr.contentDocument.getElementById("pzfsIn");if(b)b.textContent=on?"✕ Salir de pantalla completa":"⛶ Pantalla completa"}catch(e){}
 document.body.style.overflow=(FS||PFS)?"hidden":"";
 if(on){
  try{const p=f.requestFullscreen&&f.requestFullscreen({navigationUI:"hide"});if(p&&p.catch)p.catch(()=>{})}catch(e){}
  try{const p=screen.orientation&&screen.orientation.lock&&screen.orientation.lock("landscape");if(p&&p.catch)p.catch(()=>{})}catch(e){}
 }else{
  try{if(document.fullscreenElement)document.exitFullscreen()}catch(e){}
  try{screen.orientation.unlock()}catch(e){}
 }
 if(pzFr&&!on)pzFr.style.height="900px";
 if(on)document.querySelector("#ptit2").value=document.querySelector("#ptit").value;
 fsLayout(on);setTimeout(()=>{if(PFS===on)fsLayout(on);ajusta()},150)}
window.togPzFS=()=>setPzFS(!PFS);
function setPSt(t){document.querySelector("#pst").textContent=t;document.querySelector("#pst2").textContent=t;document.querySelector("#ptit2").value=document.querySelector("#ptit").value}
document.querySelector("#ptit2").oninput=e=>{document.querySelector("#ptit").value=e.target.value};
document.querySelector("#pbtn2").onclick=()=>{if(document.querySelector("#pbtn").disabled)return;document.querySelector("#ptit").value=document.querySelector("#ptit2").value;document.querySelector("#pbtn").onclick()};
"""

CSS_MENU = r"""/* ===== Barra de menú fija: todas las opciones visibles en dos líneas ===== */
#topbar{position:fixed;top:0;left:0;right:0;z-index:50;padding:calc(env(safe-area-inset-top,0px) + 8px) 10px 6px;display:flex;justify-content:center;pointer-events:none}
#topbar .dock{pointer-events:auto;width:100%;max-width:980px;display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:20px;background:linear-gradient(90deg,rgba(246,236,214,.97),rgba(227,235,250,.97) 60%,rgba(212,217,234,.97));border:1px solid #2a5ba8;box-shadow:0 8px 24px #1e3a7a33,inset 0 1px 0 #ffffffaa;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
#tbsp{height:96px}
#topbar .brand{flex:none;display:flex;flex-direction:column;align-items:center;gap:1px;padding:0 6px;color:#0f2a6b;cursor:pointer;user-select:none;-webkit-user-select:none}
#topbar .brand .bl{font-size:1.6rem;line-height:1}
#topbar .brand b{font-size:.78rem;font-weight:800;letter-spacing:.08em;color:#d97706}
#topbar nav#nav{flex:1;min-width:0;display:grid;grid-template-columns:repeat(var(--c,4),minmax(0,1fr));grid-auto-rows:1fr;gap:4px;padding:0;position:static}
#topbar nav#nav button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-width:0;padding:5px 2px;border:0;border-radius:12px;background:rgba(255,255,255,.6);color:#10234b;font-weight:600;font-size:.7rem;line-height:1.1;box-shadow:none;transform:none}
#topbar nav#nav button:hover{background:rgba(255,255,255,.95);transform:none}
#topbar nav#nav button span:first-child{font-size:1.1rem;line-height:1.1}
#topbar nav#nav button span:last-child{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#topbar nav#nav button.on{background:var(--ye);color:#0a0f1e;box-shadow:0 3px 10px #d9770655}
#topbar nav#nav button.out{background:#ef4444;color:#fff}
@media(min-width:700px){
 #tbsp{height:104px}
 #topbar .brand{flex-direction:row;gap:8px;padding:0 10px}
 #topbar .brand b{font-size:1.3rem;letter-spacing:.06em}
 #topbar nav#nav button{flex-direction:row;gap:6px;padding:9px 8px;font-size:.9rem}
 #topbar nav#nav button span:first-child{font-size:1.05rem}
}
#topbar nav#nav button span:first-child{margin:0}"""

TOPBAR = r"""<div id="topbar">
 <div class="dock">
  <div id="tt" class="brand" aria-label="Torrejón Juncal @@MARCA@@. Haz cinco clics para abrir el acceso de administración">
   <span class="bl">⚽</span><b class="cn">@@MARCA@@</b>
  </div>
  <nav id="nav"></nav>
 </div>
</div>"""

NV_SH = r""" const SH={jor:"Jornadas",cal:"Calendario",cla:"Clasif.",cop:"Copa",gol:"Goleadores",cro:"Jugadores",jug:"Jugadas",piz:"Pizarra",hor:"Horarios",pla:"Plantilla",ent:"Entrenos",log:"Login",out:"Salir"};"""
NV_LINE = r""" const nv=document.getElementById("nav");nv.style.setProperty("--c",Math.ceil(tabs.length/2));"""
NV_HTML = r""" nv.innerHTML=tabs.map(([k,l])=>{const ic=l.split(" ")[0],oc=k=="log"?"unlock()":k=="out"?"setEdit(false)":`tab='${k}';if(tab=='jor')jnAuto=true;if(tab=='ent')entD='';if(tab=='jug')PL=null;render()`;return`<button class="${tab==k?'on':''}${k=='out'?' out':''}" onclick="${oc}"><span>${ic}</span><span>${SH[k]}</span></button>`}).join("");"""
SETTB = r"""function setTb(){const tb=document.getElementById("topbar"),sp=document.getElementById("tbsp");if(tb&&sp&&tb.offsetHeight>0)sp.style.height=(tb.offsetHeight+4)+"px"}"""
FIT_TB = r""" const tb=document.getElementById("topbar"),sp=document.getElementById("tbsp");
 if(tb)tb.style.display=FS?"none":"";
 if(sp)sp.style.display=FS?"none":"";
 if(!FS)setTb();"""

class Parche:
    def __init__(self, t):
        self.t = t
        self.fallos = []
    def lit(self, a, b, nombre):
        n = self.t.count(a)
        if n != 1:
            self.fallos.append("%s (encontrado %d veces)" % (nombre, n))
        else:
            self.t = self.t.replace(a, b)
    def rx(self, patron, f, nombre, flags=0):
        n = len(re.findall(patron, self.t, flags))
        if n != 1:
            self.fallos.append("%s (encontrado %d veces)" % (nombre, n))
        else:
            self.t = re.sub(patron, f, self.t, flags=flags)

def etapa_pizarra(p):
    # 1) Bloque azul solo en Jornadas
    p.lit('document.getElementById("hero").style.display="";',
        'document.getElementById("hero").style.display=tab=="jor"?"":"none";', "hero solo en Jornadas")
    # CSS
    p.lit("</style>", CSS + "\n</style>", "cierre de <style>")
    # HTML de la barra inferior y tarjeta antigua oculta
    p.lit('<div id="pzf"></div>', BAR, "contenedor #pzf")
    p.rx(r'<div class="card">(\s*)<div class="pubr">', lambda m: '<div class="card" hidden style="display:none">' + m.group(1) + '<div class="pubr">', "tarjeta de grabar")
    # JS
    p.lit("let pzFr=null,pzQ=null;", "let pzFr=null,pzQ=null,PFS=false;", "variables de pizarra")
    p.lit("function ajusta(){try{const d=", "function ajusta(){try{if(PFS)return;const d=", "función ajusta")
    p.lit('pzFr.addEventListener("load",()=>{ajusta();', 'pzFr.addEventListener("load",()=>{pzStyle();ajusta();', "evento load del iframe")
    p.lit("function ensurePiz(){", JS_PRE + "function ensurePiz(){", "función ensurePiz")
    p.rx(r'function setPSt\(t\)\{[^}]*\}', lambda m: JS_POST.rstrip("\n"), "función setPSt")
    p.lit('document.body.style.overflow=FS?"hidden":"";', 'document.body.style.overflow=(FS||PFS)?"hidden":"";', "overflow en fit")
    p.rx(r'if\(!document\.fullscreenElement&&FS\)\{leaveFS\(\);render\(\)\}', lambda m: m.group(0) + "if(!document.fullscreenElement&&PFS)setPzFS(false);", "evento fullscreenchange")
    p.lit("if(sp)ensurePiz();", "if(sp)ensurePiz();if(!sp&&PFS)setPzFS(false);", "render de pizarra")
    p.rx(r'(TS\.on=false;\s*)(closeVer\(\);)', lambda m: m.group(1) + "setPzFS(false);" + m.group(2), "función setEdit")
    p.lit("if(ver)closeVer()}});", "if(ver)closeVer();if(PFS)setPzFS(false)}});", "tecla Escape")
    p.rx(r'\$q?\("#ptit"\)\.focus\(\)', lambda m: 'document.getElementById("ptit2").focus()', "foco del título")

def etapa_menu(p):
    t = p.t
    m = re.search(r'"corto":\s*"([^"]+)"', t)
    marca = (m.group(1) if m else "Juncal").upper()
    marca = marca.replace("&", "&amp;").replace("<", "&lt;")
    barra = TOPBAR.replace("@@MARCA@@", marca)
    # 1) Fuera el banner de arriba
    p.rx(r'<header class="site-banner">.*?</header>\s*', "", "banner de cabecera", re.S)
    # 2) El menú sale de la página y pasa a la barra superior
    p.lit('<nav id="nav"></nav>', "", "menú <nav id=nav>")
    p.lit('<div class="wrap">', barra + '\n<div class="wrap">\n<div id="tbsp"></div>', "contenedor .wrap")
    p.lit("</style>", CSS_MENU + "\n</style>", "cierre de <style> (menú)")
    # 3) JavaScript del menú
    p.lit('const nv=document.getElementById("nav"),big=tabs.length>4;nv.style.setProperty("--n",big?3:4);nv.className=big?"x":"";',
          NV_SH.strip() + "\n" + NV_LINE.strip(), "construcción del menú")
    p.rx(r'nv\.innerHTML=tabs\.map[^\n]*', lambda m: NV_HTML.strip(), "botones del menú")
    p.rx(r'function fit\(\)\{(\s*)const h=document\.getElementById\("hero"\);',
         lambda m: SETTB + "\nfunction fit(){" + m.group(1) + 'const h=document.getElementById("hero");\n' + FIT_TB, "función fit")
    p.lit('document.getElementById("app").innerHTML=h}', 'document.getElementById("app").innerHTML=h;setTb()}', "final de render")
    p.lit("render();setInterval(tick,1000);",
          'render();setInterval(tick,1000);\ntry{new ResizeObserver(setTb).observe(document.getElementById("topbar"))}catch(e){}', "arranque")
    # línea inútil (el botón de descarga está comentado): se quita si existe
    p.t = re.sub(r'<script>if\(window\.Capacitor\|\|navigator\.standalone\)document\.getElementById\("dl"\)\.style\.display="none"</script>\s*', "", p.t)

def aplicar(t):
    p = Parche(t)
    hecho = False
    if 'id="pzbar"' not in p.t:
        etapa_pizarra(p); hecho = True
    if 'id="topbar"' not in p.t:
        etapa_menu(p); hecho = True
    return p.t, p.fallos, hecho

def recoger(args):
    """Convierte carpetas en la lista de .html con pizarra que hay dentro (también en subcarpetas)."""
    res = []
    for a in args:
        if os.path.isdir(a):
            for raiz, dirs, archivos in os.walk(a):
                dirs[:] = [d for d in dirs if d != "_copia_seguridad" and not d.startswith(".")]
                for n in sorted(archivos):
                    if n.lower().endswith(".html"):
                        ruta = os.path.join(raiz, n)
                        if 'id="pizW"' in open(ruta, encoding="utf-8", errors="ignore").read():
                            res.append(ruta)
        elif os.path.isfile(a):
            res.append(a)
        else:
            print("! No existe: %s" % a)
    return res

def main():
    args = sys.argv[1:] or ["."]
    ficheros = recoger(args)
    if not ficheros:
        print("No he encontrado ningún .html con pizarra en: %s" % " ".join(args))
        return
    ok = salt = mal = 0
    for f in ficheros:
        t = open(f, encoding="utf-8").read()
        nuevo, fallos, hecho = aplicar(t)
        if not hecho:
            print("= %s: ya tenía los cambios, se salta." % f)
            salt += 1
            continue
        if fallos:
            print("✗ %s: NO modificado. Faltan estos puntos:" % f)
            for x in fallos:
                print("    - " + x)
            mal += 1
            continue
        dest = os.path.join("_copia_seguridad", os.path.relpath(f))
        os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
        shutil.copy2(f, dest)
        open(f, "w", encoding="utf-8", newline="").write(nuevo)
        print("✓ %s: actualizado." % f)
        ok += 1
    print("\nResumen: %d actualizados, %d ya estaban, %d con problemas." % (ok, salt, mal))
    if mal:
        sys.exit(1)

if __name__ == "__main__":
    main()