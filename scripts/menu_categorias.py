#!/usr/bin/env python3
"""El logo/cabecera de cada categoría deja de abrir el acceso de administración con 5 clics y pasa a abrir un menú
para cambiar de categoría (Aficionado A/B, Juvenil, Cadete, Infantil, Alevín) o volver al inicio.
El acceso de entrenador sigue estando en la pestaña «🔒 Login». Idempotente.
Uso, desde la RAÍZ del repositorio:   python3 scripts/menu_categorias.py
"""
import glob
OLD = 'let ck=0,ct;document.getElementById("tt").onclick=()=>{clearTimeout(ct);ct=setTimeout(()=>ck=0,900);if(++ck>=5){ck=0;unlock()}};'
NEW = r'''/* Menú de categorías en el logo */
(function(){const tt=document.getElementById("tt");if(!tt)return;
 const L=[["AficionadoA","Aficionado A"],["AficionadoB","Aficionado B"],["JuvenilA","Juvenil A"],["JuvenilB","Juvenil B"],["CadeteA","Cadete A"],["CadeteB","Cadete B"],["InfantilA","Infantil A"],["InfantilB","Infantil B"],["AlevinA","Alevín A"],["AlevinB","Alevín B"]];
 const cur=decodeURIComponent((location.pathname.split("/").pop()||"")).replace(/\.html$/i,"");
 const st=document.createElement("style");st.textContent="#cmenu{position:fixed;z-index:9990;width:min(360px,calc(100vw - 16px));background:#fff;border:1px solid #d5def5;border-radius:16px;padding:12px;box-shadow:0 18px 50px #0f1b3d55;font-family:Barlow,system-ui,sans-serif}#cmenu[hidden]{display:none}"+
  "#cmenu .cm-h{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:0 2px 10px;color:#0f1b3d}#cmenu .cm-h b{font:800 1.1rem 'Barlow Condensed',sans-serif;letter-spacing:.03em}#cmenu .cm-h a{font-size:.9rem;font-weight:600;color:#2f7bff;text-decoration:none}"+
  "#cmenu .cm-g{display:grid;grid-template-columns:1fr 1fr;gap:8px}#cmenu .cm-g a{display:block;text-align:center;padding:11px 8px;border:1px solid #d5def5;border-radius:10px;background:#f4f8ff;color:#0f1b3d;font-weight:600;text-decoration:none}"+
  "#cmenu .cm-g a:hover{border-color:#2f7bff;background:#eaf2ff}#cmenu .cm-g a.on{background:#2f7bff;border-color:#2f7bff;color:#fff}#cmenu a:focus-visible{outline:3px solid #2f7bff;outline-offset:2px}#tt:focus-visible{outline:3px solid #ffd23f;outline-offset:-3px}";
 document.head.appendChild(st);
 const m=document.createElement("div");m.id="cmenu";m.hidden=true;m.setAttribute("role","menu");m.setAttribute("aria-label","Cambiar de categoría");
 m.innerHTML='<div class="cm-h"><b>Cambiar de categoría</b><a href="../index.html">🏠 Inicio</a></div><div class="cm-g">'+L.map(([f,n])=>'<a role="menuitem" href="./'+f+'.html"'+(f===cur?' class="on" aria-current="page"':'')+'>'+n+'</a>').join("")+'</div>';
 document.body.appendChild(m);
 tt.setAttribute("role","button");tt.tabIndex=0;tt.setAttribute("aria-haspopup","menu");tt.setAttribute("aria-expanded","false");tt.setAttribute("aria-label","Cambiar de categoría");tt.title="Cambiar de categoría";
 const close=()=>{m.hidden=true;tt.setAttribute("aria-expanded","false")};
 const open=()=>{m.hidden=false;const r=tt.getBoundingClientRect();m.style.top=Math.max(8,r.bottom+8)+"px";m.style.left=Math.max(8,Math.min(innerWidth-m.offsetWidth-8,r.left+r.width/2-m.offsetWidth/2))+"px";tt.setAttribute("aria-expanded","true");const a=m.querySelector("a.on")||m.querySelector(".cm-g a");if(a)a.focus({preventScroll:true})};
 tt.onclick=e=>{e.stopPropagation();m.hidden?open():close()};
 tt.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();tt.onclick(e)}};
 document.addEventListener("click",e=>{if(!m.hidden&&!m.contains(e.target))close()});
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!m.hidden){close();tt.focus()}});
 addEventListener("scroll",()=>{if(!m.hidden)close()},{passive:true});
})();'''
OLD_ARIA = " Haz cinco clics para abrir el acceso de administración"
ok = ya = 0
for f in sorted(glob.glob("Categorias/**/*.html", recursive=True)):
    raw = open(f, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in raw else "\n"
    s = raw.replace("\r\n", "\n")
    if 'id="cmenu"' in s or "Menú de categorías en el logo" in s: print("ya:", f); ya += 1; continue
    if OLD not in s: print("sin el código esperado (se salta):", f); continue
    if "id=\"mLog\"" not in s: print("sin pestaña Login: se salta para no dejarte sin acceso:", f); continue
    s = s.replace(OLD, NEW).replace(OLD_ARIA, ". Pulsa para cambiar de categoría")
    open(f, "w", encoding="utf-8", newline="").write(s.replace("\n", nl)); print("OK:", f); ok += 1
print(f"\n{ok} páginas actualizadas, {ya} ya estaban.")
