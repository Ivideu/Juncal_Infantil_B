// scripts/proximos.mjs — Node 20, sin dependencias
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FB = "https://juncal-f0b64-default-rtdb.europe-west1.firebasedatabase.app";
const { FBKEY, FBMAIL, FBPASS } = process.env;
const AHORA = Number(process.env.AHORA_MS) || Date.now();
const sleep = ms => process.env.SIN_PAUSAS ? Promise.resolve() : new Promise(r => setTimeout(r, ms));

// Búsqueda exhaustiva y segura de categorias.json en múltiples rutas posibles
function cargarConfig() {
  const rutasCandidatas = [
    path.join(__dirname, "categorias.json"),                 // scripts/categorias.json
    path.join(__dirname, "..", "categorias.json"),             // /categorias.json (raíz)
    path.resolve(process.cwd(), "scripts", "categorias.json"), // cwd/scripts/categorias.json
    path.resolve(process.cwd(), "categorias.json")             // cwd/categorias.json
  ];

  for (const r of rutasCandidatas) {
    try {
      if (fs.existsSync(r)) {
        console.log(`Configuración cargada correctamente desde: ${r}`);
        return JSON.parse(fs.readFileSync(r, "utf8"));
      }
    } catch (e) {
      // Ignorar error de lectura individual y probar la siguiente
    }
  }

  console.error("Error crítico: No se encuentra categorias.json en ninguna de estas rutas probadas:");
  rutasCandidatas.forEach(r => console.error(` - ${r}`));
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

// Los partidos de la semana en curso se mantienen hasta el domingo a las 23:50 (hora de Madrid), ya jugados o no:
// CORTE = el último domingo 23:50 ya pasado. Lo que empezó antes de ese momento ya no cuenta como "este fin de semana".
const isoMadrid = ms => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(ms);
const CORTE = (() => {
  for (let k = 0; k <= 8; k++) {
    const f = isoMadrid(AHORA - k * 864e5);
    if (new Date(f + "T12:00:00Z").getUTCDay() === 0 && madrid(f, "23:50") <= AHORA) return madrid(f, "23:50");
  }
  return 0;
})();

// Siguiente partido del club en esa categoría. Devuelve {partido}, null (no quedan partidos) o {error:true} (RFFM no responde)
async function siguiente(c, previo) {
  // Se empieza una jornada antes de la más baja que aún tenía partido pendiente (un partido aplazado puede estar en una jornada anterior)
  const base = previo && previo.jornada ? Math.min(previo.jornada, previo.pj || previo.jornada) : 1;
  const ini = Math.max(1, base - 1);
  let seguidos = 0, leidas = 0, ult = null, mejor = null, pj = 0;
  const ent = v => /^\d+$/.test(String(v ?? "").trim()) ? +v : null;
  for (let r = ini; r < ini + 45; r++) {
    const d = await rffm(c.grupo, r);
    if (!d) { if (++seguidos >= 2) return leidas ? null : { error: true }; continue; }
    seguidos = 0;
    if (!d.partidos.length) break;
    leidas++;
    const p = d.partidos.find(q => esLocal(c, q) || esVisit(c, q));
    if (!p) { await sleep(1200); continue; }
    const fecha = iso(p.fecha), hora = (p.hora || "").slice(0, 5);
    if (!fecha) { await sleep(1200); continue; }
    // Último partido ya jugado (para el marcador de la app): acta cerrada o resultado provisional
    let res = null;
    {
      const prov = String(p.ResultadoProvisional || "").match(/^\s*(\d+)\s*[-:]\s*(\d+)\s*$/);
      const gl = ent(p.Goles_casa) ?? (prov ? +prov[1] : null), gv = ent(p.Goles_visitante) ?? (prov ? +prov[2] : null);
      const cerrada = p.acta_cerrada === "1" || p.acta_cerrada === 1;
      if (gl !== null && gv !== null && p.partido_en_juego !== "1" && (cerrada || prov || madrid(fecha, hora || "23:59") + 3 * 36e5 < AHORA)) {
        const cs = esLocal(c, p);
        res = { gl, gv };
        ult = { jornada: r, fecha, gl, gv, casa: cs,
          local: cs && c.nombreEquipo ? c.nombreEquipo : p.Nombre_equipo_local,
          visitante: !cs && c.nombreEquipo ? c.nombreEquipo : p.Nombre_equipo_visitante };
      }
    }
    const cuando = madrid(fecha, hora || "23:59");
    if (cuando <= CORTE) { await sleep(1200); continue; }
    // Partido pendiente. Se elige el MÁS PRÓXIMO EN EL TIEMPO (no el de jornada más baja): un partido aplazado
    // puede tener una fecha muy posterior a la de las jornadas siguientes.
    if (!pj) pj = r;
    if (!mejor || cuando < mejor.cuando) mejor = { cuando, r, p, fecha, hora, res };
    // Si la jornada que se acaba de leer ya es posterior al mejor candidato, no puede haber nada más próximo
    const fechas = d.partidos.map(q => iso(q.fecha)).filter(Boolean).sort();
    if (fechas.length && fechas[0] > mejor.fecha) break;
    await sleep(1200);
  }
  if (!mejor) return null;
  const { r, p, fecha, hora, res } = mejor, casa = esLocal(c, p);
  console.log(`  ${c.nombre}: jornada ${r}, ${p.Nombre_equipo_local} - ${p.Nombre_equipo_visitante}, ${fecha} ${hora}`);
  return { partido: {
    id: c.id, categoria: c.nombre, liga: limpiaLiga(c.liga), jornada: r, fecha, hora,
    local: casa && c.nombreEquipo ? c.nombreEquipo : p.Nombre_equipo_local,
    visitante: !casa && c.nombreEquipo ? c.nombreEquipo : p.Nombre_equipo_visitante,
    codLocal: String(p.CodEquipo_local), codVisitante: String(p.CodEquipo_visitante),
    casa, campo: limpiaCampo(p.campojuego), ultimo: ult || previo?.ultimo || null,
    ...(res ? { resultado: res } : {}),
    ...(pj && pj < r ? { pj } : {}) } };
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
  if (!c.grupo) continue;
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
  const p = await fetch(`${FB}/juncal.json?auth=${tok}`, { method: "PUT", headers: etag ? { "if-match": etag } : {}, body: JSON.stringify(JSON.stringify(S)) });
  if (p.ok) { console.log("Próximos partidos guardados:", lista.length); break; }
  if (p.status === 412) { console.warn("Conflicto de escritura, reintentando…"); await sleep(1000); continue; }
  console.error("Error al guardar:", p.status); process.exit(1);
}