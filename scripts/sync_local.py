#!/usr/bin/env python3
"""Competición LOCAL de Torrejón de Ardoz (fútbol sala): jornadas, campos, resultados y clasificación.

Fuente: https://deportes.ayto-torrejon.es/campeonatos-locales  (PDF del Ayuntamiento, se renuevan cada semana)
Salida:
  datos-local/<id>.json        una por categoría (lo lee local-categoria.html)
  datos-local/index.json       resumen de todas las categorías (lo lee local.html)
  datos-local/raw/<id>-*.txt   texto en bruto de cada PDF, para depurar si algo no se lee bien

Solo usa la librería estándar y `pdftotext` (poppler-utils). Uso:  python3 scripts/sync_local.py [id-de-categoria]
"""
import html, json, os, re, subprocess, sys, tempfile, unicodedata
from datetime import datetime, timezone
from urllib.parse import unquote, urljoin, quote
from urllib.request import Request, urlopen

PAGINA = "https://deportes.ayto-torrejon.es/campeonatos-locales"
RAIZ = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
SALIDA = os.path.join(RAIZ, "datos-local")

# id, nombre, palabra que lleva el PDF en su nombre (sin acentos, en mayúsculas)
CATEGORIAS = [
    ("senior-superliga", "Senior Superliga", ["SUPERLIGA"]),
    ("senior-preferente", "Senior Preferente", ["PREFERENTE"]),
    ("senior-primera", "Senior Primera", ["PRIMERA", "SENIOR"]),
    ("senior-segunda", "Senior Segunda", ["SEGUNDA"]),
    ("senior-tercera", "Senior Tercera", ["TERCERA"]),
    ("juvenil", "Juvenil", ["JUVENIL"]),
    ("cadete", "Cadete", ["CADETE"]),
    ("infantil", "Infantil", ["INFANTI"]),
    ("alevin", "Alevín", ["ALEVIN"]),
    ("benjamin", "Benjamín", ["BENJAMIN"]),
    ("prebenjamin", "Prebenjamín", ["PREBENJAMIN"]),
]
# Cosas que NO son fútbol sala (la misma página mezcla fútbol 7, baloncesto y voleibol)
EXCLUIR = ["F7", "DIV", "G.A", "G.B", "VOLEY", "LOCAL", "BASKET", "SENIOR 1", "SENIOR 2", "SENIOR 3", "SENIOR 4", "SENIOR 5"]


def fold(s):
    """Mayúsculas sin acentos ni comillas, para comparar nombres."""
    s = "".join(unicodedata.normalize("NFD", c)[0] for c in s)
    s = re.sub(r"[\"'“”´`]", "", s.upper())
    return re.sub(r"\s+", " ", s).strip()


def bonito(s):
    """TORREJON JUNCAL "B" -> Torrejon Juncal "B"  (Title Case, con las partículas y siglas en su sitio)."""
    t = re.sub(r"\s+", " ", s).strip().title()
    t = re.sub(r"\b(Fc|Cf|Cd|Ud|Fs|Cb)\b", lambda m: m.group(1).upper(), t)
    return re.sub(r"\b(De|Del|La|El|Y)\b(?!$)", lambda m: m.group(1).lower(), t).replace("\"a\"", "\"A\"")


def descargar(url):
    req = Request(quote(url, safe=":/%?=&+"), headers={"User-Agent": "Mozilla/5.0 (JuncalSync)"})
    with urlopen(req, timeout=60) as r:
        return r.read()


def pdf_a_texto(datos):
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(datos)
        ruta = f.name
    try:
        return subprocess.run(["pdftotext", "-layout", ruta, "-"], capture_output=True, text=True, check=True).stdout
    finally:
        os.unlink(ruta)


def descubrir_enlaces():
    pagina = descargar(PAGINA).decode("utf-8", "replace")
    enlaces = []
    for h in re.findall(r"""href\s*=\s*["']([^"']+?\.pdf)["']""", pagina, flags=re.I):
        enlaces.append(urljoin(PAGINA, html.unescape(h)))
    if not enlaces:
        raise SystemExit("No encuentro ningún PDF en la página de Campeonatos Locales: ¿ha cambiado su estructura?")
    return list(dict.fromkeys(enlaces))


def elegir(enlaces, palabras):
    """Devuelve (calendarios, jornadas) de fútbol sala para una categoría."""
    cal, jor = [], []
    for u in enlaces:
        n = fold(unquote(u.rsplit("/", 1)[-1]))
        if any(x in n for x in EXCLUIR):
            continue
        if not all(p in n for p in palabras):
            continue
        if palabras == ["BENJAMIN"] and "PRE" in n:
            continue
        if n.startswith("CALENDARIO"):
            cal.append(u)
        elif n.startswith("HORARIOS"):
            jor.append(u)
    return cal, jor


# ---------------------------------------------------------------- calendario
RE_PARTIDO = re.compile(r"^\s*\d+\s+(.*?)\s+(\d{2})-(\d{2})-(\d{2})\s+([SD])(?:\s+(\d{1,2}:\d{2}))?\s*$")
RE_JORNADA = re.compile(r"Jornada\s*N[ºo°.]*\s*(\d+)", re.I)


def parse_calendario(texto):
    lineas = texto.splitlines()
    avisos, bloques, buffer = [], [], []
    primera_p = next((i for i, l in enumerate(lineas) if RE_PARTIDO.match(l)), None)
    primera_j = next((i for i, l in enumerate(lineas) if RE_JORNADA.search(l)), None)
    cabecera_despues = primera_p is not None and (primera_j is None or primera_p < primera_j)   # «Jornada Nº X» cierra cada bloque
    n_sig = 1
    for l in lineas:
        mj = RE_JORNADA.search(l)
        if mj and not RE_PARTIDO.match(l):
            if cabecera_despues:
                bloques.append((int(mj.group(1)), buffer)); buffer = []
            else:
                if buffer: bloques.append((n_sig, buffer))
                buffer, n_sig = [], int(mj.group(1))
            continue
        m = RE_PARTIDO.match(l)
        if m:
            buffer.append(m)
        elif l.strip() and re.search(r"\d{2}-\d{2}-\d{2}", l):
            avisos.append("Línea de calendario sin entender: " + l.strip()[:120])
    if buffer:
        bloques.append((n_sig if not cabecera_despues else (bloques[-1][0] + 1 if bloques else 1), buffer))

    jornadas = []
    for n, ms in bloques:
        partidos, descansa = [], None
        for m in ms:
            cuerpo, dd, mm, aa, dia, hora = m.groups()
            partes = [p for p in re.split(r"\s{2,}", cuerpo.strip()) if p]
            fecha = f"20{aa}-{mm}-{dd}"
            if any(fold(p) == "DESCANSA" for p in partes):
                otro = next((p for p in partes if fold(p) != "DESCANSA"), "")
                if not otro:   # «DESCANSA EQUIPO» separado por un solo espacio
                    otro = re.sub(r"^\s*DESCANSA\s+|\s+DESCANSA\s*$", "", cuerpo.strip(), flags=re.I)
                descansa = bonito(otro)
                continue
            if len(partes) == 3:
                partidos.append({"local": bonito(partes[0]), "visitante": bonito(partes[1]), "campo": partes[2].strip(),
                                 "fecha": fecha, "dia": dia, "hora": hora or ""})
            else:
                avisos.append(f"Jornada {n}: no sé separar equipos y campo en «{cuerpo.strip()[:100]}» (columnas: {len(partes)})")
        if partidos or descansa:
            jornadas.append({"n": n, "descansa": descansa, "partidos": partidos})
    return jornadas, avisos


# ---------------------------------------------------------------- clasificación
RE_CLAS = re.compile(r"^\s*(\d{1,2})\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(-?\d+)\s+(\d+)\s*$")


def parse_clasificacion(texto):
    filas = []
    for l in texto.splitlines():
        m = RE_CLAS.match(l)
        if m:
            pos, eq, pj, g, e, p, gf, gc, dg, pts = m.groups()
            filas.append({"pos": int(pos), "equipo": bonito(eq.strip()), "pj": int(pj), "g": int(g), "e": int(e), "p": int(p),
                          "gf": int(gf), "gc": int(gc), "dg": int(dg), "pts": int(pts)})
    # Si el PDF repite la tabla, nos quedamos con la primera completa
    vistas, unicas = set(), []
    for f in filas:
        if f["pos"] in vistas:
            break
        vistas.add(f["pos"]); unicas.append(f)
    return unicas


# ---------------------------------------------------------------- resultados
RE_RESULT = re.compile(r"^\s*(?:\d{1,2}[/-]\d{1,2}\s+)?(.+?\S)\s+(\d{1,2})\s*[-–:]\s*(\d{1,2})\s+(\S.*?)\s*$")


def parse_resultados(texto):
    res = []
    for l in texto.splitlines():
        if re.search(r"\d{1,2}:\d{2}", l):      # una hora, no un marcador
            continue
        m = RE_RESULT.match(l)
        if m:
            a, ga, gb, b = m.groups()
            if re.search(r"[A-Za-zÁÉÍÓÚÑ]{2}", a) and re.search(r"[A-Za-zÁÉÍÓÚÑ]{2}", b):
                res.append((fold(a), int(ga), int(gb), fold(b)))
    return res


def aplicar_resultados(jornadas, resultados):
    sueltos = []
    for a, ga, gb, b in resultados:
        puesto = False
        for j in jornadas:
            for p in j["partidos"]:
                if "ga" in p:
                    continue
                la, vb = fold(p["local"]), fold(p["visitante"])
                if (la == a or la.startswith(a) or a.startswith(la)) and (vb == b or vb.startswith(b) or b.startswith(vb)):
                    p["ga"], p["gb"] = ga, gb
                    puesto = True
                    break
            if puesto:
                break
        if not puesto:
            sueltos.append(f"{a} {ga}-{gb} {b}")
    return sueltos


# ---------------------------------------------------------------- principal
def sin_fecha(o):
    if isinstance(o, dict):
        return {k: sin_fecha(v) for k, v in o.items() if k != "actualizado"}
    if isinstance(o, list):
        return [sin_fecha(x) for x in o]
    return o


def guardar(ruta, obj):
    """Escribe el JSON solo si los datos han cambiado (así no hay un commit nuevo cada vez que se revisa)."""
    try:
        if sin_fecha(json.load(open(ruta, encoding="utf-8"))) == sin_fecha(obj):
            return False
    except (OSError, ValueError):
        pass
    json.dump(obj, open(ruta, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return True


def main():
    solo = sys.argv[1] if len(sys.argv) > 1 else ""
    os.makedirs(os.path.join(SALIDA, "raw"), exist_ok=True)
    enlaces = descubrir_enlaces()
    print(f"{len(enlaces)} PDF en la página")
    ahora = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    indice, fallos = [], 0
    for cid, nombre, palabras in CATEGORIAS:
        if solo and solo != cid:
            continue
        cal_u, jor_u = elegir(enlaces, palabras)
        out = {"id": cid, "nombre": nombre, "actualizado": ahora, "fuente": {"calendario": cal_u, "jornada": jor_u},
               "jornadas": [], "clasificacion": [], "avisos": []}
        if not cal_u:
            out["avisos"].append("No he encontrado el PDF de calendario en la web del Ayuntamiento.")
        try:
            textos_cal = []
            for i, u in enumerate(cal_u[:1]):
                t = pdf_a_texto(descargar(u)); textos_cal.append(t)
                open(os.path.join(SALIDA, "raw", f"{cid}-calendario.txt"), "w", encoding="utf-8").write(t)
            textos_jor = []
            for i, u in enumerate(jor_u):
                t = pdf_a_texto(descargar(u)); textos_jor.append(t)
                open(os.path.join(SALIDA, "raw", f"{cid}-jornada{i or ''}.txt"), "w", encoding="utf-8").write(t)
        except Exception as e:      # un PDF caído no debe tumbar las demás categorías
            out["avisos"].append(f"Error al leer los PDF: {e}")
            fallos += 1
            textos_cal, textos_jor = [], []
        for t in textos_cal:
            out["jornadas"], av = parse_calendario(t)
            out["avisos"] += av
        for t in textos_jor:
            if not out["clasificacion"]:
                out["clasificacion"] = parse_clasificacion(t)
        sueltos = []
        for t in textos_jor:
            sueltos += aplicar_resultados(out["jornadas"], parse_resultados(t))
        if sueltos:
            out["avisos"].append(f"{len(sueltos)} resultados que no he podido unir a un partido (ver raw/)")
        equipos = sorted({p[k] for j in out["jornadas"] for p in j["partidos"] for k in ("local", "visitante")})
        n_part = sum(len(j["partidos"]) for j in out["jornadas"])
        jug = sum(1 for j in out["jornadas"] for p in j["partidos"] if "ga" in p)
        out["equipos"] = equipos
        guardar(os.path.join(SALIDA, cid + ".json"), out)
        indice.append({"id": cid, "nombre": nombre, "equipos": len(equipos), "jornadas": len(out["jornadas"]), "partidos": n_part,
                       "jugados": jug, "juncal": any("JUNCAL" in fold(e) for e in equipos), "avisos": len(out["avisos"]), "actualizado": ahora})
        print(f"{nombre:18} equipos={len(equipos):2} jornadas={len(out['jornadas']):2} partidos={n_part:3} con_resultado={jug:3} "
              f"clasif={len(out['clasificacion']):2} avisos={len(out['avisos'])}")
    if not solo:
        guardar(os.path.join(SALIDA, "index.json"), {"actualizado": ahora, "categorias": indice})
    if fallos == len(CATEGORIAS):
        raise SystemExit("Ninguna categoría se ha podido leer")


if __name__ == "__main__":
    main()
