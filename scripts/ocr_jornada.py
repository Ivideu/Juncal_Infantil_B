"""Lee los PDF «Jornada y Clasificación» (Microsoft Print To PDF): nombres de equipos y marcadores vienen como imágenes."""
import os, subprocess, tempfile, sys, json
import fitz  # PyMuPDF
from PIL import Image, ImageOps


def ocr_png(ruta, psm, extra=()):
    r = subprocess.run(["tesseract", ruta, "-", "--psm", str(psm), "-l", "spa", *extra], capture_output=True, text=True)
    return " ".join(r.stdout.split())


def imagenes(doc, pagina):
    """Devuelve las imágenes de la página con su caja y el texto OCR (una vez por imagen distinta)."""
    cache, out = {}, []
    for info in pagina.get_image_info(xrefs=True):
        x0, y0, x1, y1 = info["bbox"]
        xref = info["xref"]
        clave = (xref, round(x1 - x0), round(y1 - y0))
        if clave not in cache:
            pm = pagina.get_pixmap(clip=fitz.Rect(info["bbox"]), dpi=400, alpha=False)
            im = Image.frombytes("RGB", (pm.width, pm.height), pm.samples)
            im = ImageOps.expand(im, border=40, fill="white")
            tmp = tempfile.mktemp(suffix=".png"); im.save(tmp)
            ancho = (x1 - x0)
            cache[clave] = {"txt": ocr_png(tmp, 7), "dig": ocr_png(tmp, 7, ("-c", "tessedit_char_whitelist=0123456789-")), "png": tmp, "w": ancho}
        c = cache[clave]
        out.append({"x0": x0, "y0": y0, "x1": x1, "y1": y1, "xref": xref, "txt": c["txt"], "dig": c["dig"]})
    return out, cache


if __name__ == "__main__":
    doc = fitz.open(sys.argv[1])
    for n, pg in enumerate(doc):
        ims, cache = imagenes(doc, pg)
        ims.sort(key=lambda i: (round(i["y0"] / 6), i["x0"]))
        for i in ims:
            print(f"p{n} y={i['y0']:.0f}-{i['y1']:.0f} x={i['x0']:.0f}-{i['x1']:.0f} xref={i['xref']} w={i['x1']-i['x0']:.0f} txt={i['txt']!r} dig={i['dig']!r}")
        pal = pg.get_text("words")
        print("--- texto")
        for w in sorted(pal, key=lambda w: (round(w[1] / 6), w[0])):
            print(f"y={w[1]:.0f} x={w[0]:.0f}-{w[2]:.0f} {w[4]}")
