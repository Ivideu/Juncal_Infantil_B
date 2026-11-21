"""Lee los PDF «Jornada y Clasificación» (generados con Microsoft Print To PDF).

En ellos los nombres de los equipos y los marcadores son IMÁGENES, no texto; solo fechas, campos, horas y la
clasificación son texto. Aquí se localizan las imágenes con PyMuPDF, se reconoce cada una con Tesseract y se
agrupan por filas. Devuelve dos bloques: la jornada ya jugada (con marcadores) y la que se juega este fin de semana.
"""
import os, re, subprocess, sys, tempfile
import fitz  # PyMuPDF
from PIL import Image, ImageOps

RE_FECHA = re.compile(r"^(\d{1,2})/(\d{1,2})$")
RE_HORA = re.compile(r"^\d{1,2}:\d{2}$")
PAG = 10000  # separa las páginas en una sola escala vertical


def _ocr(ruta, psm, digitos=False):
    cmd = ["tesseract", ruta, "-", "--psm", str(psm), "-l", "spa"]
    if digitos:
        cmd += ["-c", "tessedit_char_whitelist=0123456789"]
    return " ".join(subprocess.run(cmd, capture_output=True, text=True).stdout.split())


def _render(pagina, caja, dpi):
    pm = pagina.get_pixmap(clip=fitz.Rect(caja), dpi=dpi, alpha=False)
    im = ImageOps.expand(Image.frombytes("RGB", (pm.width, pm.height), pm.samples), border=int(dpi / 10), fill="white")
    tmp = tempfile.mktemp(suffix=".png"); im.save(tmp)
    return tmp


def _leer_imagen(pagina, caja, estrecha):
    if not estrecha:
        tmp = _render(pagina, caja, 400)
        try: return {"txt": _ocr(tmp, 7), "dudoso": False}
        finally: os.unlink(tmp)
    lecturas = []      # un marcador (1-2 cifras): se lee con dos resoluciones y se avisa si no coinciden
    for dpi in (400, 600, 300):
        tmp = _render(pagina, caja, dpi)
        try: lecturas.append(_ocr(tmp, 7, True))
        finally: os.unlink(tmp)
    votos = {}
    for l in lecturas:
        if l: votos[l] = votos.get(l, 0) + 1
    if not votos: return {"txt": "", "dudoso": True}
    mejor = max(votos, key=votos.get)
    return {"txt": mejor, "dudoso": votos[mejor] < 2}


def leer(ruta_pdf):
    doc = fitz.open(ruta_pdf)
    imgs, palabras, cache = [], [], {}
    for n, pg in enumerate(doc):
        for info in pg.get_image_info(xrefs=True):
            x0, y0, x1, y1 = info["bbox"]
            est = (x1 - x0) < 14
            clave = (info["xref"], round(x1 - x0), est)
            if clave not in cache:
                cache[clave] = _leer_imagen(pg, info["bbox"], est)
            imgs.append({"x0": x0, "x1": x1, "y": n * PAG + (y0 + y1) / 2, **cache[clave], "est": est})
        for w in pg.get_text("words"):
            palabras.append({"x0": w[0], "x1": w[2], "y": n * PAG + (w[1] + w[3]) / 2, "t": w[4]})
    palabras.sort(key=lambda w: (w["y"], w["x0"]))
    # Marcas de sección: «Jornada Nº N» (ya jugada) y «Enfrentamientos de la jornada N» (próxima), y «CLASIFICACIÓN»
    prev_n = next_n = None; y_clas = y_next = None; y_prev = None
    for i, w in enumerate(palabras):
        t = w["t"].upper()
        if t.startswith("JORNADA") and prev_n is None and i + 2 < len(palabras) and palabras[i + 1]["t"].upper().startswith("N"):
            m = re.search(r"\d+", palabras[i + 2]["t"])
            if m: prev_n, y_prev = int(m.group()), w["y"]
        if t == "CLASIFICACIÓN" and y_clas is None:
            y_clas = w["y"]
        if t.startswith("ENFRENTAMIENTOS") and y_next is None:
            y_next = w["y"]
            m = re.search(r"\d+", " ".join(x["t"] for x in palabras if abs(x["y"] - w["y"]) < 4 and x["x0"] > w["x0"]))
            if m: next_n = int(m.group())
    # Cabecera de la jornada ya jugada: «Jornada Nº 4» puede salir después de las filas en el texto; se usa la posición real
    def seccion(y):
        if y_clas is not None and y_prev is not None and y_prev < y < y_clas: return "prev"
        if y_next is not None and y > y_next: return "next"
        return None
    # Agrupa las imágenes por fila (centro vertical)
    filas = []
    for im in sorted(imgs, key=lambda i: i["y"]):
        if seccion(im["y"]) is None: continue
        if filas and abs(filas[-1]["y"] - im["y"]) < 4: filas[-1]["ims"].append(im)
        else: filas.append({"y": im["y"], "ims": [im]})
    salida = {"prev": {"n": prev_n, "filas": []}, "next": {"n": next_n, "filas": []}}
    for f in filas:
        sec = seccion(f["y"])
        ims = sorted(f["ims"], key=lambda i: i["x0"])
        nombres = [i for i in ims if not i["est"]]
        marc = [i for i in ims if i["est"]]
        # texto de la misma fila (fecha, campo, hora) — solo la zona derecha de la tabla
        pal = [w for w in palabras if abs(w["y"] - f["y"]) < 5 and w["x0"] > 240 and seccion(w["y"]) == sec]
        fecha = hora = None; campo = []
        for w in sorted(pal, key=lambda w: w["x0"]):
            m = RE_FECHA.match(w["t"])
            if m and not fecha: fecha = f"{int(m.group(1)):02d}/{int(m.group(2)):02d}"
            elif RE_HORA.match(w["t"]): hora = w["t"]
            elif len(w["t"]) == 1 and w["t"] in "SDLMXJV" and fecha and not campo: continue   # día de la semana
            else: campo.append(w["t"])
        fila = {"equipos": [n["txt"] for n in nombres], "fecha": fecha, "hora": hora or "", "campo": " ".join(campo)}
        if sec == "prev" and len(marc) >= 2:
            a, b = marc[0], marc[1]
            if a["txt"].isdigit() and b["txt"].isdigit():
                fila["ga"], fila["gb"] = int(a["txt"]), int(b["txt"])
                fila["dudoso"] = bool(a["dudoso"] or b["dudoso"])
        salida[sec]["filas"].append(fila)
    return salida


if __name__ == "__main__":
    import json
    print(json.dumps(leer(sys.argv[1]), ensure_ascii=False, indent=1))
