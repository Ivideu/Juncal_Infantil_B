#!/usr/bin/env python3
"""
hero_lobo.py
------------
Hace que los botones "+ GOL" y "− Gol" del partido en directo se vean
IGUAL en pantalla completa que en modo normal (misma forma de píldora,
mismo tamaño, mismo brillo y sombra 3D), en todos los archivos de categoría.

Qué hace:
  1. Busca los .html que contienen el diseño de marcador en directo
     (la regla  #hero.hl:not(.fs) ).
  2. Inserta un bloque CSS justo antes del </style> de la cabecera.
  3. Es idempotente: si el bloque ya está, no lo vuelve a añadir.
  4. Guarda una copia  archivo.html.bak  antes de modificar.

Uso:
  python hero_lobo.py                 -> busca en la carpeta actual y subcarpetas
  python hero_lobo.py Categorias      -> busca en esa carpeta
  python hero_lobo.py --dry-run       -> solo muestra qué cambiaría
  python hero_lobo.py --no-backup     -> no crea archivos .bak
  python hero_lobo.py --revert        -> quita el bloque (deja el archivo como antes)
"""

import argparse
import re
import sys
from pathlib import Path

START = "/* ===== HERO_LOBO: botones GOL idénticos en pantalla completa ===== */"
END = "/* ===== /HERO_LOBO ===== */"

CSS = f"""{START}
#hero.hl.fs .gb{{width:100%;gap:28px}}
#hero.hl.fs .gbtn{{
  width:auto;min-width:0;aspect-ratio:auto;
  white-space:nowrap;word-break:normal;
  padding:.35em 1.1em .35em .45em;
  border-radius:999px;
  font-size:clamp(1rem,3.8vw,1.35rem);
}}
#hero.hl.fs .gmn{{
  font-size:.8rem;
  padding:.28em 1.1em;
}}
@media(max-width:760px){{
  #hero.hl.fs .gbtn{{font-size:.95rem;padding:.3em .8em .3em .35em;gap:.35em}}
}}
{END}
"""

# Solo tocamos archivos que tengan el diseño de marcador en directo
MARKER_LIVE = "#hero.hl:not(.fs)"
BLOCK_RE = re.compile(re.escape(START) + r".*?" + re.escape(END) + r"\r?\n?", re.S)


def read(path: Path) -> str:
    # newline="" conserva los saltos de línea originales (CRLF/LF)
    with open(path, "r", encoding="utf-8", newline="") as f:
        return f.read()


def write(path: Path, text: str) -> None:
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)


def apply(text: str):
    """Devuelve (nuevo_texto, estado)."""
    if START in text:
        return text, "ya-aplicado"
    if MARKER_LIVE not in text:
        return text, "no-aplica"

    # Insertamos antes del </style> que cierra el bloque de estilos principal:
    # el primero que aparece DESPUÉS de la regla del marcador en directo.
    pos_live = text.index(MARKER_LIVE)
    pos_close = text.find("</style>", pos_live)
    if pos_close == -1:
        return text, "sin-style"

    nl = "\r\n" if "\r\n" in text else "\n"
    bloque = CSS.replace("\n", nl)
    # Si el </style> no está al inicio de línea, añadimos salto antes
    prefijo = "" if text[:pos_close].endswith(("\n", "\r")) else nl
    nuevo = text[:pos_close] + prefijo + bloque + text[pos_close:]
    return nuevo, "ok"


def revert(text: str):
    if START not in text:
        return text, "no-estaba"
    return BLOCK_RE.sub("", text), "ok"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("carpeta", nargs="?", default=".", help="carpeta donde buscar los .html (por defecto, la actual)")
    ap.add_argument("--dry-run", action="store_true", help="no escribe nada, solo informa")
    ap.add_argument("--no-backup", action="store_true", help="no crea copias .bak")
    ap.add_argument("--revert", action="store_true", help="quita el bloque añadido")
    args = ap.parse_args()

    raiz = Path(args.carpeta)
    if not raiz.is_dir():
        print(f"No existe la carpeta: {raiz}")
        return 1

    archivos = sorted(p for p in raiz.rglob("*.html") if p.is_file())
    if not archivos:
        print("No se han encontrado archivos .html")
        return 1

    cambiados = 0
    for p in archivos:
        try:
            texto = read(p)
        except UnicodeDecodeError:
            print(f"  [salta]       {p}  (no es UTF-8)")
            continue

        nuevo, estado = revert(texto) if args.revert else apply(texto)

        if estado == "ok":
            cambiados += 1
            if args.dry_run:
                print(f"  [cambiaría]   {p}")
            else:
                if not args.no_backup:
                    write(p.with_suffix(p.suffix + ".bak"), texto)
                write(p, nuevo)
                print(f"  [{'revertido' if args.revert else 'modificado'}] {p}")
        elif estado == "ya-aplicado":
            print(f"  [ya aplicado] {p}")
        elif estado == "sin-style":
            print(f"  [aviso]       {p}  (no se encontró </style>)")
        # "no-aplica" / "no-estaba": archivos que no son de categoría; se ignoran en silencio

    print(f"\n{cambiados} archivo(s) {'afectarían' if args.dry_run else 'procesados'}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())