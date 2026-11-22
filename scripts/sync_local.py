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
    ("cadete", "Cadete", ["CADETE"]),
    ("infantil", "Infantil", ["INFANTI"]),
    ("alevin", "Alevín", ["ALEVIN"]),
    ("benjamin", "Benjamín", ["BENJAMIN"]),
    ("prebenjamin", "Prebenjamín", ["PREBENJAMIN"]),
]
# Cosas que NO son fútbol sala (la misma página mezcla fútbol 7, baloncesto y voleibol)
EXCLUIR = ["F7", "DIV", "G.A", "G.B", "VOLEY", "LOCAL", "BASKET", "CLASIFICACION"]


def fold(s):
    """Mayúsculas sin acentos ni comillas, para comparar nombres."""
    s = "".join(unicodedata.normalize("NFD", c)[0] for c in s)
    s = re.sub(r"[\"'“”´`]", "", s.upper())
    return re.sub(r"\s+", " ", s).strip()


def bonito(s):
    """TORREJON JUNCAL "B" -> Torrejon Juncal "B"  (Title Case, con las partículas y siglas en su sitio)."""
    t = re.sub(r"\s+", " ", s).strip().title()
    t = re.sub(r"\b(Fc|Cf|Cd|Ud|Fs|Cb)\b", lambda m: m.group(1).upper(), t)
    t = re.sub(r"(?<=\s)(De|Del|La|El|Y)\b(?!$)", lambda m: m.group(1).lower(), t)
    return t.replace("\"a\"", "\"A\"")


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


def diagnostico(cid, i, datos):
    """Solo con DIAG=1: guarda el PDF y varias lecturas para ver dónde están los nombres y marcadores."""
    d = os.path.join(SALIDA, "raw", "pdf"); os.makedirs(d, exist_ok=True)
    ruta = os.path.join(d, f"{cid}-jornada{i or ''}.pdf")
    open(ruta, "wb").write(datos)
    info = []
    for cmd in (["pdffonts", ruta], ["pdfimages", "-list", ruta], ["pdftotext", "-raw", ruta, "-"], ["pdftotext", "-bbox-layout", "-f", "1", "-l", "1", ruta, "-"]):
        r = subprocess.run(cmd, capture_output=True, text=True)
        info.append("### " + " ".join(cmd[:2]) + "\n" + (r.stdout[:6000] or r.stderr[:500]))
    r = subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "ocr_jornada.py"), ruta], capture_output=True, text=True)
    open(os.path.join(SALIDA, "raw", f"diag-{cid}-jornada{i or ''}-imgs.txt"), "w", encoding="utf-8").write(r.stdout + r.stderr[-2000:])
    png = os.path.join(d, f"{cid}-jornada{i or ''}")
    subprocess.run(["pdftoppm", "-r", "200", "-png", "-singlefile", ruta, png])
    r = subprocess.run(["tesseract", png + ".png", "-", "--psm", "6", "-l", "spa"], capture_output=True, text=True)
    info.append("### tesseract psm6\n" + (r.stdout or r.stderr[:500]))
    open(os.path.join(SALIDA, "raw", f"diag-{cid}-jornada{i or ''}.txt"), "w", encoding="utf-8").write("\n".join(info))


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
RE_PARTIDO = re.compile(r"^\s*\d+\s+(.*?)\s+(\d{1,2})-(\d{2})-(\d{2})\s+([SD])(?:\s+(\d{1,2}:\d{2}))?\s*$")
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
        elif l.strip() and re.search(r"\d{1,2}-\d{2}-\d{2}", l):
            avisos.append("Línea de calendario sin entender: " + l.strip()[:120])
    if buffer:
        bloques.append((n_sig if not cabecera_despues else (bloques[-1][0] + 1 if bloques else 1), buffer))

    jornadas = []
    for n, ms in bloques:
        partidos, descansa = [], None
        for m in ms:
            cuerpo, dd, mm, aa, dia, hora = m.groups()
            partes = [p for p in re.split(r"\s{2,}", cuerpo.strip()) if p]
            fecha = f"20{aa}-{mm}-{int(dd):02d}"
            if any(fold(p) == "DESCANSA" for p in partes):
                otro = next((p for p in partes if fold(p) != "DESCANSA"), "")
                if not otro:   # «DESCANSA EQUIPO» separado por un solo espacio
                    otro = re.sub(r"^\s*DESCANSA\s+|\s+DESCANSA\s*$", "", cuerpo.strip(), flags=re.I)
                descansa = bonito(otro)
                continue
            if len(partes) in (2, 3):
                partidos.append({"local": bonito(partes[0]), "visitante": bonito(partes[1]),
                                 "campo": partes[2].strip() if len(partes) == 3 else "",
                                 "fecha": fecha, "dia": dia, "hora": hora or ""})
            else:
                avisos.append(f"Jornada {n}: no sé separar equipos y campo en «{cuerpo.strip()[:100]}» (columnas: {len(partes)})")
        if partidos or descansa:
            jornadas.append({"n": n, "descansa": descansa, "partidos": partidos})
    return jornadas, avisos


# ---------------------------------------------------------------- clasificación
RE_CLAS = re.compile(r"^\s*(\d{1,2})\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(-?\d+)(?:\s+(\d+))?\s*$")


def parse_clasificacion(texto):
    filas = []
    for l in texto.splitlines():
        m = RE_CLAS.match(l)
        if m:
            pos, eq, pj, g, e, p, gf, gc, dg, pts = m.groups()
            if pts is None:     # a veces el PDF coloca los puntos en otra línea: 3 por victoria y 1 por empate
                pts = 3 * int(g) + int(e)
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


# ---------------------------------------------------------------- nombres de equipos y PDF de jornada
def clave(s):
    return re.sub(r"[^A-Z0-9]", "", fold(s))


def clave_sin_numeros(s):
    return clave(re.sub(r"\b\d+\b", " ", fold(s)))


def buscar_equipo(nombre, equipos):
    """Empareja el nombre leído del PDF (OCR) con el del calendario."""
    k = clave(nombre)
    for f in (clave, clave_sin_numeros):
        c = [e for e in equipos if f(e) == (k if f is clave else clave_sin_numeros(nombre))]
        if len(c) == 1:
            return c[0]
    if len(k) >= 5:     # el PDF a veces corta el nombre («FEOS PERO CON» por «FEOS PERO CON GUSTO»)
        c = [e for e in equipos if clave(e).startswith(k) or k.startswith(clave(e))]
        if len(c) == 1:
            return c[0]
    import difflib
    ks = {clave(e): e for e in equipos}
    m = difflib.get_close_matches(k, list(ks), n=2, cutoff=0.86)
    if m and (len(m) == 1 or difflib.SequenceMatcher(None, k, m[0]).ratio() - difflib.SequenceMatcher(None, k, m[1]).ratio() > 0.04):
        return ks[m[0]]
    return None


def aplicar_jornada_ocr(jornadas, bloque, con_marcador, avisos):
    """Pasa a los partidos del calendario la fecha, campo, hora y (si ya se jugó) el marcador del PDF de jornada."""
    n = bloque.get("n")
    j = next((x for x in jornadas if x["n"] == n), None)
    if not j:
        avisos.append(f"El PDF de jornada habla de la jornada {n}, que no está en el calendario")
        return
    equipos = sorted({p[k] for x in jornadas for p in x["partidos"] for k in ("local", "visitante")} | {x["descansa"] for x in jornadas if x["descansa"]})
    for f in bloque["filas"]:
        if len(f["equipos"]) != 2 or any(fold(e) == "DESCANSA" for e in f["equipos"]):
            continue
        a, b = (buscar_equipo(e, equipos) for e in f["equipos"])
        if not a or not b:
            avisos.append(f"Jornada {n}: no reconozco los equipos «{f['equipos'][0]}» / «{f['equipos'][1]}»")
            continue
        p = next((x for x in j["partidos"] if (x["local"], x["visitante"]) in ((a, b), (b, a))), None)
        if not p:       # el PDF de jornada manda: si el calendario no traía esa fila (p. ej. sin fecha), se añade
            anio = next((x["fecha"][:4] for x in j["partidos"] if x.get("fecha")), str(datetime.now().year))
            p = {"local": a, "visitante": b, "campo": "", "fecha": f"{anio}-01-01", "dia": "", "hora": ""}
            j["partidos"].append(p)
        if f["campo"]: p["campo"] = f["campo"]
        if f["hora"]: p["hora"] = f["hora"]
        if f["fecha"]:
            d, m = f["fecha"].split("/")
            p["fecha"] = f"{p['fecha'][:4]}-{m}-{d}"
            try: p["dia"] = "LMXJVSD"[datetime(int(p["fecha"][:4]), int(m), int(d)).weekday()]
            except ValueError: pass
        if con_marcador and "ga" in f:
            if p["local"] == a: p["ga"], p["gb"] = f["ga"], f["gb"]
            else: p["ga"], p["gb"] = f["gb"], f["ga"]
            if f.get("dudoso"):
                avisos.append(f"Jornada {n}: el marcador {a} {f['ga']}-{f['gb']} {b} se ha leído con dudas")


def aplicar_jornada_texto(jornadas, texto_jornadas):
    """PDF de horarios con texto normal (p. ej. Prebenjamín): sobrescribe campo y hora de esa jornada."""
    for j in texto_jornadas:
        dest = next((x for x in jornadas if x["n"] == j["n"]), None)
        if not dest:
            continue
        for q in j["partidos"]:
            for p in dest["partidos"]:
                if clave_sin_numeros(p["local"]) == clave_sin_numeros(q["local"]) and clave_sin_numeros(p["visitante"]) == clave_sin_numeros(q["visitante"]):
                    for k in ("campo", "hora", "fecha", "dia"):
                        if q.get(k): p[k] = q[k]


def conservar_resultados(jornadas, anterior):
    """El PDF solo trae el último resultado: se conservan los de semanas anteriores guardados en el JSON previo."""
    viejos = {}
    for j in anterior.get("jornadas", []):
        for p in j["partidos"]:
            if "ga" in p:
                viejos[(j["n"], p["local"], p["visitante"])] = (p["ga"], p["gb"])
    for j in jornadas:
        for p in j["partidos"]:
            if "ga" not in p and (j["n"], p["local"], p["visitante"]) in viejos:
                p["ga"], p["gb"] = viejos[(j["n"], p["local"], p["visitante"])]


def completar_nombres(clasif, jornadas, avisos):
    """La clasificación del PDF corta los nombres («Torrejon Juncal» sin A/B). Se recuperan con el calendario y los resultados conocidos."""
    equipos = sorted({p[k] for x in jornadas for p in x["partidos"] for k in ("local", "visitante")} | {x["descansa"] for x in jornadas if x["descansa"]})
    if not equipos:
        return
    reclamados, pendientes = set(), []
    for fila in clasif:
        ex = [e for e in equipos if clave(e) == clave(fila["equipo"]) and e not in reclamados]
        if ex:
            fila["equipo"] = ex[0]; reclamados.add(ex[0])
        else:
            pendientes.append(fila)
    grupos = {}
    for fila in pendientes:
        cands = tuple(e for e in equipos if e not in reclamados and clave(e).startswith(clave(fila["equipo"])))
        grupos.setdefault(cands, []).append(fila)
    # estadísticas ya conocidas por equipo (de los marcadores guardados)
    est = {}
    for x in jornadas:
        for p in x["partidos"]:
            if "ga" not in p: continue
            for e, gf, gc in ((p["local"], p["ga"], p["gb"]), (p["visitante"], p["gb"], p["ga"])):
                s_ = est.setdefault(e, {"pj": 0, "g": 0, "e": 0, "p": 0, "gf": 0, "gc": 0})
                s_["pj"] += 1; s_["gf"] += gf; s_["gc"] += gc
                s_["g" if gf > gc else "p" if gf < gc else "e"] += 1
    def fallos(fila, e):
        s_ = est.get(e, {})
        return sum(1 for k in ("pj", "g", "e", "p", "gf", "gc") if s_.get(k, 0) > fila[k])
    import itertools
    for cands, filas in grupos.items():
        if len(cands) == 1 and len(filas) == 1:
            filas[0]["equipo"] = cands[0]; reclamados.add(cands[0]); continue
        if not cands or len(cands) != len(filas) or len(filas) > 4:
            for f in filas: f["equipo"] = bonito(f["equipo"])
            if len(filas) > 1: avisos.append(f"Clasificación: no puedo distinguir «{filas[0]['equipo']}» ({len(filas)} equipos con el mismo nombre)")
            continue
        puntos = []
        for perm in itertools.permutations(cands):
            puntos.append((sum(fallos(f, e) for f, e in zip(filas, perm)), perm))
        puntos.sort(key=lambda x: x[0])
        if len(puntos) > 1 and puntos[0][0] == puntos[1][0]:
            for f in filas: f["equipo"] = bonito(f["equipo"])
            avisos.append(f"Clasificación: no puedo distinguir entre {', '.join(cands)} con los resultados conocidos")
        else:
            for f, e in zip(filas, puntos[0][1]): f["equipo"] = e


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
    open(os.path.join(SALIDA, "raw", "enlaces.txt"), "w", encoding="utf-8").write("\n".join(unquote(e) for e in enlaces))
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
            anterior = json.load(open(os.path.join(SALIDA, cid + ".json"), encoding="utf-8"))
        except (OSError, ValueError):
            anterior = {}
        textos_cal, textos_jor, pdfs_jor = [], [], []
        try:
            for i, u in enumerate(cal_u[:1]):
                t = pdf_a_texto(descargar(u)); textos_cal.append(t)
                open(os.path.join(SALIDA, "raw", f"{cid}-calendario.txt"), "w", encoding="utf-8").write(t)
            for i, u in enumerate(jor_u):
                dat = descargar(u)
                if os.environ.get("DIAG"): diagnostico(cid, i, dat)
                t = pdf_a_texto(dat); textos_jor.append(t); pdfs_jor.append(dat)
                open(os.path.join(SALIDA, "raw", f"{cid}-jornada{i or ''}.txt"), "w", encoding="utf-8").write(t)
        except Exception as e:      # un PDF caído no debe tumbar las demás categorías
            out["avisos"].append(f"Error al leer los PDF: {e}")
            fallos += 1
        for t in textos_cal:
            out["jornadas"], av = parse_calendario(t)
            out["avisos"] += av
        conservar_resultados(out["jornadas"], anterior)
        for t, dat in zip(textos_jor, pdfs_jor):
            if not out["clasificacion"]:
                out["clasificacion"] = parse_clasificacion(t)
            if "nfrentamientos" in t:        # PDF «Jornada y Clasificación»: nombres y marcadores son imágenes -> OCR
                try:
                    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                        f.write(dat); ruta = f.name
                    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
                    import ocr_jornada
                    res = ocr_jornada.leer(ruta)
                    aplicar_jornada_ocr(out["jornadas"], res["prev"], True, out["avisos"])
                    aplicar_jornada_ocr(out["jornadas"], res["next"], False, out["avisos"])
                except Exception as e:
                    out["avisos"].append(f"No he podido leer las imágenes del PDF de jornada: {e}")
                finally:
                    try: os.unlink(ruta)
                    except Exception: pass
            else:                             # PDF de horarios con texto normal
                js, av = parse_calendario(t)
                aplicar_jornada_texto(out["jornadas"], js)
        completar_nombres(out["clasificacion"], out["jornadas"], out["avisos"])
        equipos = sorted({p[k] for j in out["jornadas"] for p in j["partidos"] for k in ("local", "visitante")})
        n_part = sum(len(j["partidos"]) for j in out["jornadas"])
        jug = sum(1 for j in out["jornadas"] for p in j["partidos"] if "ga" in p)
        out["equipos"] = equipos
        guardar(os.path.join(SALIDA, cid + ".json"), out)
        indice.append({"id": cid, "nombre": nombre, "equipos": len(equipos), "jornadas": len(out["jornadas"]), "partidos": n_part,
                       "jugados": jug, "juncal": any(("JUNCAL" in fold(e) or "JUCAL" in fold(e)) for e in equipos), "avisos": len(out["avisos"]), "actualizado": ahora})
        print(f"{nombre:18} equipos={len(equipos):2} jornadas={len(out['jornadas']):2} partidos={n_part:3} con_resultado={jug:3} "
              f"clasif={len(out['clasificacion']):2} avisos={len(out['avisos'])}")
    if not solo:
        guardar(os.path.join(SALIDA, "index.json"), {"actualizado": ahora, "categorias": indice})
    if fallos == len(CATEGORIAS):
        raise SystemExit("Ninguna categoría se ha podido leer")


if __name__ == "__main__":
    main()
