// scripts/anadir-entrenador.mjs — Node 20. Añade la zona entrenador a las páginas de Categorias/ (menos InfantilB).
// Es seguro repetirlo: si el archivo ya la tiene, no lo toca. Se puede probar con DIR=ruta.
import fs from "node:fs";
import path from "node:path";
const DIR = process.env.DIR || "Categorias";
const EXCLUIR = (process.env.EXCLUIR || "InfantilB.html").split(",").map(s => s.trim().toLowerCase());
const TAG = '<script src="../entrenador.js" defer></script>';
if (!fs.existsSync(DIR)) { console.error("No existe la carpeta", DIR); process.exit(1); }
let cambios = 0;
for (const f of fs.readdirSync(DIR).filter(f => /\.html?$/i.test(f)).sort()) {
  if (EXCLUIR.includes(f.toLowerCase())) { console.log("= omitido:", f); continue; }
  const p = path.join(DIR, f); let h = fs.readFileSync(p, "utf8");
  if (/entrenador\.js/.test(h)) { console.log("= ya la tiene:", f); continue; }
  if (!/<\/body>/i.test(h)) { console.warn("! sin </body>, no se toca:", f); continue; }
  h = h.replace(/<\/body>/i, `${TAG}\n</body>`); fs.writeFileSync(p, h); cambios++; console.log("+ añadida a:", f);
}
console.log(cambios + " archivo(s) modificados");
