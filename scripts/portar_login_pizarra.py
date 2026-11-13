#!/usr/bin/env python3
"""
Porta el login por categoría (con opción de administrador del club), la pestaña Jugadas
y la Pizarra de infantilb.html a AficionadoA.html (o cualquier otra categoría).

Uso:
  python3 portar_login_pizarra.py Categorias/InfantilB.html Categorias/AficionadoA.html Categorias/AficionadoA.nuevo.html
"""
import re
import sys

if len(sys.argv) < 3:
    sys.exit(__doc__)

inf = open(sys.argv[1], encoding="utf-8").read()
af = open(sys.argv[2], encoding="utf-8").read()
out = sys.argv[3] if len(sys.argv) > 3 else "AficionadoA.nuevo.html"


def cut(s, a, b):
    """Texto de s desde a hasta b (sin incluir b)."""
    assert a in s, "No encuentro el inicio: " + a[:70]
    i = s.index(a)
    assert b in s[i:], "No encuentro el final: " + b[:70]
    return s[i:s.index(b, i)]


def rep(s, old, new):
    assert s.count(old) == 1, "Ancla no encontrada o repetida: " + old[:70]
    return s.replace(old, new)


def swap(dst, src, a, b):
    """Sustituye en dst el tramo [a,b) por el mismo tramo de src."""
    return rep(dst, cut(dst, a, b), cut(src, a, b))


def port(js):
    """CAT -> CATK; $ -> $q para no chocar con otros scripts."""
    js = re.sub(r"\bCAT\b", "CATK", js)
    return js.replace("const $=", "const $q=").replace("$(", "$q(")


# 1) CSS de la Pizarra y el visor de jugadas
css = cut(inf, "/* ===== Login, Jugadas (vídeos) y Pizarra del entrenador ===== */", "</style>")
af = rep(af, "</style>", css + "</style>")

# 2) HTML: Pizarra incrustada y los modales (incluyendo el de login completo con opción de administrador)
piz = cut(inf, "<!-- Pizarra del entrenador", '<div class="volver">')
af = rep(af, '<div class="volver">', piz + '<div class="volver">')

modals = cut(inf, "<!-- Login -->", "<script>\n(function(){") .rstrip() + "\n"
modals = modals.replace("✔ Publicar en Infantil B", "✔ Publicar")
af = rep(af, 'onchange="importD(this)">\n</div>\n', 'onchange="importD(this)">\n</div>\n' + modals)

# 3) Constantes y variables de sesión de forma flexible
af = rep(af, 'GH_REPO="Juncal_Infantil_B";',
         'GH_REPO="Juncal_Infantil_B";\nconst CATK=CAT.node,CAT_NAME=CAT.corto,BASE="../",TEAM_MAIL=CAT.email;')

pw_anchor = re.search(r'let\s+PW\s*=\s*"[^"]*",?\s*(?:pt|RT)?', af)
if pw_anchor:
    af = rep(af, pw_anchor.group(0), 'let PW="",RT="",ACC=FBMAIL,pt;')
else:
    raise AssertionError("No se encontró la línea de declaración de PW para actualizar las credenciales.")

af = swap(af, inf, "async function fbLogin(", "if(FB){const l=document.createElement")
af = rep(af, "if((API||FB)&&PW)push();render()}", "if((API||FB)&&(PW||RT))push();render()}")

# 4) render(): pestañas, navegación y vistas (Jugadas y Pizarra)
af = swap(af, inf, 'const tabs=[["jor"', 'const nv=document.getElementById("nav")')
af = swap(af, inf, "nv.innerHTML=tabs.map", '\n let h="";')
af = rep(af, ' document.getElementById("app").innerHTML=h}',
         ' if(tab=="jug")h=renderPlays();\n'
         ' const pzw=document.getElementById("pizW"),sp=E()&&tab=="piz";pzw.hidden=!sp;if(sp)ensurePiz();\n'
         ' document.getElementById("app").innerHTML=h}')

# 5) Lógica JavaScript del Login modal con opción de administrador y alternancia de correo
login_js = port(cut(inf, "/* ===== Login del entrenador", "let ck=0,ct;"))
login_js = rep(login_js, 'sessionStorage.setItem("adm","1");',
               'sessionStorage.setItem("adm","1");sessionStorage.setItem("cat",CATK);')
af = rep(af, cut(af, "async function unlock(){", "let ck=0,ct;"), login_js)

# 6) Jugadas + Pizarra, eventos de teclado y restauración de sesión específica por categoría
af = rep(af, 'document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeCromo();closePick()}});\n', "")
jug = port(cut(inf, "/* ===== Jugadas: los jugadores ven", 'document.addEventListener("keydown"'))
keys = 'document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeCromo();closePick();closeLogin();if(ver)closeVer()}});\n'
hash_old = cut(af, 'if(location.hash=="#admin")unlock();', "\nif(API||FB)document.querySelector")
hash_new = ('if(location.hash=="#admin")unlock();try{if(sessionStorage.getItem("adm")&&sessionStorage.getItem("cat")===CATK)'
            '{PW=sessionStorage.getItem("pw")||"";RT=sessionStorage.getItem("rt")||"";'
            'ACC=sessionStorage.getItem("mail")||FBMAIL;document.body.classList.add("edit")}}catch(e){}')
af = rep(af, hash_old, jug + keys + hash_new)

open(out, "w", encoding="utf-8").write(af)
print("Listo:", out)
print("Comprueba: modal de login con opción de administrador del club, pestaña Jugadas y Pizarra.")