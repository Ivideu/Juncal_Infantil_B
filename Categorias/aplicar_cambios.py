#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
aplicar_cambios.py  ·  Pasa a las páginas de categoría los cambios de prueba.html:
  1) El bloque azul "próximo partido / directo" solo se ve en la pestaña Jornadas.
  2) Pizarra: nuevo orden de barras (Colocar + pantalla completa, Añadir, Pasos y Animación,
     Herramienta, pista, Grabar y publicar), sin texto de ayuda y con pantalla completa.
  3) Campo del título de la jugada en blanco.

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

def aplicar(t):
    fallos = []
    def lit(a, b, nombre):
        nonlocal t
        if t.count(a) != 1:
            fallos.append("%s (encontrado %d veces)" % (nombre, t.count(a)))
        else:
            t = t.replace(a, b)
    def rx(p, f, nombre):
        nonlocal t
        n = len(re.findall(p, t))
        if n != 1:
            fallos.append("%s (encontrado %d veces)" % (nombre, n))
        else:
            t = re.sub(p, f, t)

    # 1) Bloque azul solo en Jornadas
    lit('document.getElementById("hero").style.display="";',
        'document.getElementById("hero").style.display=tab=="jor"?"":"none";', "hero solo en Jornadas")
    # CSS
    lit("</style>", CSS + "\n</style>", "cierre de <style>")
    # HTML de la barra inferior y tarjeta antigua oculta
    lit('<div id="pzf"></div>', BAR, "contenedor #pzf")
    rx(r'<div class="card">(\s*)<div class="pubr">', lambda m: '<div class="card" hidden style="display:none">' + m.group(1) + '<div class="pubr">', "tarjeta de grabar")
    # JS
    lit("let pzFr=null,pzQ=null;", "let pzFr=null,pzQ=null,PFS=false;", "variables de pizarra")
    lit("function ajusta(){try{const d=", "function ajusta(){try{if(PFS)return;const d=", "función ajusta")
    lit('pzFr.addEventListener("load",()=>{ajusta();', 'pzFr.addEventListener("load",()=>{pzStyle();ajusta();', "evento load del iframe")
    lit("function ensurePiz(){", JS_PRE + "function ensurePiz(){", "función ensurePiz")
    rx(r'function setPSt\(t\)\{[^}]*\}', lambda m: JS_POST.rstrip("\n"), "función setPSt")
    lit('document.body.style.overflow=FS?"hidden":"";', 'document.body.style.overflow=(FS||PFS)?"hidden":"";', "overflow en fit")
    rx(r'if\(!document\.fullscreenElement&&FS\)\{leaveFS\(\);render\(\)\}', lambda m: m.group(0) + "if(!document.fullscreenElement&&PFS)setPzFS(false);", "evento fullscreenchange")
    lit("if(sp)ensurePiz();", "if(sp)ensurePiz();if(!sp&&PFS)setPzFS(false);", "render de pizarra")
    rx(r'(TS\.on=false;\s*)(closeVer\(\);)', lambda m: m.group(1) + "setPzFS(false);" + m.group(2), "función setEdit")
    lit("if(ver)closeVer()}});", "if(ver)closeVer();if(PFS)setPzFS(false)}});", "tecla Escape")
    rx(r'\$q?\("#ptit"\)\.focus\(\)', lambda m: 'document.getElementById("ptit2").focus()', "foco del título")
    return t, fallos

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
        if 'id="pzbar"' in t:
            print("= %s: ya tenía los cambios, se salta." % f)
            salt += 1
            continue
        nuevo, fallos = aplicar(t)
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