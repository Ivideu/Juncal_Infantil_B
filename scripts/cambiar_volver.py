import glob

NUEVA_VOLVER = '''/* Volver al inicio: en la app Android va a app.html y en la web a index.html */
const enApp=()=>{try{return !!(window.Capacitor&&((Capacitor.isNativePlatform&&Capacitor.isNativePlatform())||(Capacitor.Plugins&&Capacitor.Plugins.FirebaseMessaging)))||localStorage.getItem("jb_app")==="1"}catch(e){return false}};
function volver(){location.href=enApp()?"../app.html":"../index.html"}'''

CAMBIOS = [
    ('function volver(){if(history.length>1)history.back();else location.href="../index.html#equipos"}',
     NUEVA_VOLVER),
    ('tabs.push(["back","↩ Volver"]);',
     'tabs.push(["back","🏠 Inicio"]);'),
    ('back:E()?"Salir y volver":"Volver"',
     'back:E()?"Salir e inicio":"Inicio"'),
    ('title="${E()?"Cerrar sesión de entrenador y volver":"Volver a la página anterior"}"',
     'title="${E()?"Cerrar sesión de entrenador e ir al inicio":"Ir al inicio"}"'),
]

archivos = sorted(glob.glob("Categorias/*.html"))
print("Archivos encontrados:", len(archivos))

for f in archivos:
    with open(f, encoding="utf-8") as fh:
        txt = fh.read()
    original = txt
    faltan = []
    for viejo, nuevo in CAMBIOS:
        if viejo in txt:
            txt = txt.replace(viejo, nuevo)
        elif nuevo not in txt:
            faltan.append(viejo[:50] + "...")
    if txt != original:
        with open(f, "w", encoding="utf-8") as fh:
            fh.write(txt)
        print("OK         ", f)
    else:
        print("SIN CAMBIOS", f)
    for x in faltan:
        print("   AVISO: no encontrado ->", x)