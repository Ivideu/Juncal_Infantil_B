// scripts/proximos.mjs — Node 20, sin dependencias
// Recorre cada categoría de categorias.json en la RFFM, busca el siguiente partido del club
// y lo guarda en Firebase (campo "px" de los datos) para las fichas de "Próximos partidos" de la portada.
// No toca partidos, resultados ni goleadores del Infantil B: solo añade/actualiza "px".
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FB = "https://juncal-f0b64-default-rtdb.europe-west1.firebasedatabase.app";
const { FBKEY, FBMAIL, FBPASS } = process.env;
const AHORA = Number(process.env.AHORA_MS) || Date.now();
const sleep = ms => process.env.SIN_PAUSAS ? Promise.resolve() : new Promise(r => setTimeout(r, ms));

// Carga robusta con respaldo (busca en la carpeta scripts/ o en la raíz si fuera necesario)
function cargarConfig() {
  const rutasCandidatas = [
    path.join(__dirname, "categorias.json"),
    path.join(__dirname, "..", "categorias.json")
  ];
  for (const r of rutasCandidatas) {
    try {
      if (fs.existsSync(r)) {
        return JSON.parse(fs.readFileSync(r, "utf8"));
      }
    } catch (e) {
      // Ignorar y probar la siguiente
    }
  }
  console.error("Error crítico: No se encuentra el archivo categorias.json en ninguna ruta conocida.");
  process.exit(1);
}

const conf = cargarConfig();

const iso = f => { const k = String(f || "").match(/^(\d{2})[-/](\d{2})[-/](\d{4})/); return k ? `${k[3]}-${k[2]}-${k[1]}` : ""; };
const limpiaCampo = s => String(s || "").replace(/\s*\(futbol sala\)\s*/i, " ").replace(/\s+/g, " ").trim();
const limpiaLiga = s => String(s || "").replace(/\s*·\s*Grupo\s*\?/i, "").trim();
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

// Hora de Madrid -> instante UTC (con cambio de hora)
function madrid(d, t) {
  const [y, mo, da] = d.split("-").map(Number), [h, mi] = t.split(":").map(Number), g = Date.UTC(y, mo - 1, da, h, mi || 0);
  const off = z => { const p = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })
    .formatToParts(new Date(z)).reduce((o, x) => (o[x.type] = +x.value, o), {}); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - z; };
  return g - off(g - off(g));
}

async function rffm(grupo, n) {
  const url = `https://www.rffm.es/api/results?idGroup=${grupo}&round=${n}`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json, text/plain, */*", "Accept-Language": "es-ES,es;q=0.9",
        Referer: `https://www.rffm.es/competicion/resultados-y-jornadas?grupo=${grupo}&jornada=${n}` }, signal: AbortSignal.timeout(15000) });
      if (r.ok) { const d = await r.json(); if (d && Array.isArray(d.partidos)) return d; }
      else console.warn("RFFM grupo", grupo, "jornada", n, "HTTP", r.status);
    } catch (e) { console.warn("RFFM grupo", grupo, "jornada", n, String(e)); }
    await sleep(2000 * (i + 1));
  }
  return null;
}

const esLocal = (c, p) => c.equipo ? String(p.CodEquipo_local) === String(c.equipo) : /JUNCAL/.test(norm(p.Nombre_equipo_local));
const esVisit = (c, p) => c.equipo ? String(p.CodEquipo_visitante) === String(c.equipo) : /JUNCAL/.test(norm(p.Nombre_equipo_visitante));

// Siguiente partido del club en esa categoría. Devuelve {partido}, null (no quedan partidos) o {error:true} (RFFM no responde)
async function siguiente(c, previo) {
  const ini = Math.max(1, previo && previo.jornada ? previo.jornada - 1 : 1);   // las jornadas pasadas no se vuelven a leer
  let seguidos = 0, leidas = 0;
  for (let r = ini; r < ini + 45; r++) {
    const d = await rffm(c.grupo, r);
    if (!d) { if (++seguidos >= 2) return leidas ? null : { error: true }; continue; }
    seguidos = 0;
    if (!d.partidos.length) break;                       // se acabaron las jornadas
    leidas++;
    const p = d.partidos.find(q => esLocal(c, q) || esVisit(c, q));
    if (!p) { await sleep(1200); continue; }             // el equipo descansa esa jornada
    const fecha = iso(p.fecha), hora = (p.hora || "").slice(0, 5);
    if (!fecha) { await sleep(1200); continue; }         // sin fecha todavía
    if (madrid(fecha, hora || "23:59") + 3 * 36e5 < AHORA) { await sleep(1200); continue; }   // ya jugado
    const casa = esLocal(c, p);
    console.log(`  ${c.nombre}: jornada ${r}, ${p.Nombre_equipo_local} - ${p.Nombre_equipo_visitante}, ${fecha} ${hora}`);
    return { partido: {
      id: c.id, categoria: c.nombre, liga: limpiaLiga(c.liga), jornada: r, fecha, hora,
      local: casa && c.nombreEquipo ? c.nombreEquipo : p.Nombre_equipo_local,
      visitante: !casa && c.nombreEquipo ? c.nombreEquipo : p.Nombre_equipo_visitante,
      codLocal: String(p.CodEquipo_local), codVisitante: String(p.CodEquipo_visitante),
      casa, campo: limpiaCampo(p.campojuego) } };
  }
  return null;
}

async function login() {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FBKEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: FBMAIL, password: FBPASS, returnSecureToken: true }) });
  const d = await r.json();
  if (!d.idToken) { console.error("Login Firebase fallido:", d.error?.message); process.exit(1); }
  return d.idToken;
}
async function leer(tok) {
  const g = await fetch(`${FB}/juncal.json?auth=${tok}`, { headers: { "X-Firebase-ETag": "true" } });
  if (!g.ok) { console.error("No se pudo leer Firebase:", g.status); process.exit(1); }
  const raw = await g.json();
  return { etag: g.headers.get("etag"), S: raw ? JSON.parse(raw) : { u: 0, m: {}, pl: [], dn: {} } };
}

// ---------- Main ----------
const tok = await login();
const previos = (await leer(tok)).S.px?.partidos || [];
const lista = [];
for (const c of conf.categorias) {
  if (!c.grupo) continue;                                // categoría sin activar
  const ant = previos.find(p => p.id === c.id);
  const r = await siguiente(c, ant);
  if (r && r.partido) lista.push(r.partido);
  else if (r && r.error) { console.warn(`  ${c.nombre}: la RFFM no responde, se mantiene el dato anterior`); if (ant) lista.push(ant); }
  else console.log(`  ${c.nombre}: no quedan partidos por jugar`);
}

for (let intento = 0; intento < 4; intento++) {
  const { etag, S } = await leer(tok);
  const actual = JSON.stringify(S.px?.partidos || []);
  if (actual === JSON.stringify(lista) && S.px?.temporada === conf.temporada) { console.log("Sin cambios"); break; }
  S.px = { actualizado: new Date(AHORA).toISOString(), temporada: conf.temporada, partidos: lista };
  S.u = Date.now();
  // PUT condicional: si alguien escribió mientras tanto, Firebase responde 412 y reintentamos
  const p = await fetch(`${FB}/juncal.json?auth=${tok}`, { method: "PUT", headers: etag ? { "if-match": etag } : {}, body: JSON.stringify(JSON.stringify(S)) });
  if (p.ok) { console.log("Próximos partidos guardados:", lista.length); break; }
  if (p.status === 412) { console.warn("Conflicto de escritura, reintentando…"); await sleep(1000); continue; }
  console.error("Error al guardar:", p.status); process.exit(1);
}