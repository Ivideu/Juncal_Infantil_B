// scripts/escudos.mjs — Node 20, sin dependencias
// Descarga a Escudos/<CodEquipo>.png el escudo de TODOS los equipos de TODAS las categorías (los que aún no están).
// Lee scripts/categorias.json, pide a la RFFM las primeras jornadas de cada grupo y, de cada partido, coge
// CodEquipo_local/visitante y la URL del escudo que la propia RFFM devuelve.
// Si la RFFM no da la URL, se puede indicar una plantilla en la variable ESCUDO_URL, por ejemplo https://servidor/{cod}.png
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, "..");
const DIR = path.join(RAIZ, "Escudos");
const PLANTILLA = (process.env.ESCUDO_URL || "").trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const conf = JSON.parse(fs.readFileSync(path.join(__dirname, "categorias.json"), "utf8"));
fs.mkdirSync(DIR, { recursive: true });

async function jornada(grupo, n) {
  const url = `https://www.rffm.es/api/results?idGroup=${grupo}&round=${n}`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json, text/plain, */*", "Accept-Language": "es-ES,es;q=0.9",
        Referer: `https://www.rffm.es/competicion/resultados-y-jornadas?grupo=${grupo}&jornada=${n}` }, signal: AbortSignal.timeout(15000) });
      if (r.ok) { const d = await r.json(); if (d && Array.isArray(d.partidos)) return d.partidos; }
    } catch (e) { /* reintenta */ }
    await sleep(1500 * (i + 1));
  }
  return [];
}

// ¿Qué campo del partido trae el escudo de este lado?
function urlEscudo(p, lado) {
  const w = lado === "local" ? /local|home/i : /visit|away/i;
  for (const [k, v] of Object.entries(p)) {
    if (typeof v !== "string" || !v) continue;
    if (/escudo|logo|shield|badge|imag|img|foto/i.test(k) && w.test(k)) return v;
  }
  return "";
}
// La RFFM guarda las imágenes en appweb.rffm.es (www.rffm.es devuelve una página HTML); se prueban varias formas de la misma ruta
function candidatas(u) {
  if (/^https?:\/\//i.test(u) && !/\/\/www\.rffm\.es\/(?!_next\/image)/i.test(u)) return [u];
  const ruta = u.replace(/^https?:\/\/www\.rffm\.es/i, "").replace(/^\/*/, "/");
  const real = "https://appweb.rffm.es/" + ruta;                      // https://appweb.rffm.es//pnfg/pimg/Clubes/…png
  return [real, "https://www.rffm.es/_next/image?url=" + encodeURIComponent(real) + "&w=384&q=75", "https://www.rffm.es" + ruta];
}

const equipos = new Map();          // cod -> { nombre, url }
let avisoClaves = false;
for (const cat of conf.categorias || []) {
  if (!cat.grupo) continue;
  for (const n of [1, 2]) {
    const ps = await jornada(cat.grupo, n);
    if (!avisoClaves && ps[0]) { console.log("Campos de un partido de la RFFM:", Object.keys(ps[0]).join(", ")); avisoClaves = true; }
    for (const p of ps) for (const lado of ["local", "visitante"]) {
      const cod = String(p["CodEquipo_" + lado] || "");
      if (!cod || cod === "-1") continue;
      const prev = equipos.get(cod) || { nombre: p["Nombre_equipo_" + lado], url: "" };
      prev.url = prev.url || urlEscudo(p, lado);
      equipos.set(cod, prev);
    }
    await sleep(800);
  }
}
console.log("Equipos encontrados:", equipos.size);

let bajados = 0, faltan = 0;
for (const [cod, e] of equipos) {
  const f = path.join(DIR, cod + ".png");
  if (fs.existsSync(f) && fs.statSync(f).size > 200) continue;
  const lista = e.url ? candidatas(e.url) : PLANTILLA ? [PLANTILLA.replace("{cod}", cod)] : [];
  if (!lista.length) { faltan++; console.warn("Sin URL de escudo:", cod, e.nombre); continue; }
  let guardado = false, ultimo = "";
  for (const url of lista) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "image/avif,image/webp,image/png,image/*,*/*;q=0.8", Referer: "https://www.rffm.es/" }, signal: AbortSignal.timeout(20000) });
      const tipo = r.headers.get("content-type") || "";
      if (r.ok && /image/i.test(tipo)) { fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); guardado = true; bajados++; console.log("Escudo guardado:", cod, e.nombre); break; }
      ultimo = `${url} -> ${r.status} ${tipo}`;
    } catch (err) { ultimo = `${url} -> ${String(err)}`; }
  }
  if (!guardado) { faltan++; console.warn("No se pudo bajar", cod, e.nombre, "| valor RFFM:", e.url, "| último intento:", ultimo); }
  await sleep(300);
}
console.log(`Hecho. Nuevos: ${bajados}. Sin escudo: ${faltan}.`);
