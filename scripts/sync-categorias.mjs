// scripts/sync-categorias.mjs — Node 20, sin dependencias
// Una sola sincronización para TODAS las categorías de solo lectura (todas menos Infantil B, que lleva admin y directo).
// Lee categorias.json y, por cada categoría con "grupo" rellenado, lee la RFFM y escribe en Firebase el nodo "cat-<id>":
//   · cfg: equipos (T), CodEquipo (COD), calendario (R), equipo propio (equipo), nombre y liga. Se construye solo desde la RFFM
//   · m:   fecha, hora, pabellón y resultado de TODOS los partidos
// Lo lee Categorias/<Categoria>/<Categoria>.html (formato de InfantilA.html)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FB = "https://juncal-f0b64-default-rtdb.europe-west1.firebasedatabase.app";
const SALTAR = ["infantil-b"];            // categorías con su propia sincronización (admin + directo)
const MAXJOR = 60;
const { FBKEY, FBMAIL, FBPASS } = process.env;
const SOLO = (process.env.SOLO || "").trim();                 // opcional: id de una sola categoría (para probar)
const SOLO_CERRADAS = process.env.SOLO_CERRADAS === "1";      // 1 = solo guardar resultados con acta cerrada
// Si la RFFM mantiene un partido "en juego" mucho después de empezar (pasa hasta que se cierra el acta),
// se da por terminado cuando han pasado ESPERA_MIN minutos desde su hora de inicio
const ESPERA_MIN = +process.env.ESPERA_MIN || 100;
const MANUAL = process.env.GITHUB_EVENT_NAME === "workflow_dispatch";
// GitHub programa en UTC; aquí filtramos por hora de Madrid (9:00–22:59), también con cambio de hora
const ahoraMadrid = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date());
const horaMadrid = +ahoraMadrid.find(x => x.type === "hour").value, minMadrid = +ahoraMadrid.find(x => x.type === "minute").value;
if (!MANUAL && (horaMadrid < 9 || horaMadrid > 22)) { console.log("Fuera de horario:", horaMadrid + ":" + minMadrid, "en Madrid"); process.exit(0); }
const FULLRUN = MANUAL || horaMadrid === 9;   // primera ejecución del día (las 9h) y manuales: todas las jornadas
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Busca categorias.json en varias rutas posibles (scripts/, raíz, o la indicada en CATEGORIAS)
function cargarConfig() {
  const rutas = [
    process.env.CATEGORIAS && path.resolve(process.cwd(), process.env.CATEGORIAS),
    path.join(__dirname, "categorias.json"),                    // scripts/categorias.json
    path.join(__dirname, "..", "categorias.json"),              // raíz del repositorio
    path.resolve(process.cwd(), "scripts", "categorias.json"),
    path.resolve(process.cwd(), "categorias.json")
  ].filter(Boolean);
  for (const r of rutas) {
    try {
      if (fs.existsSync(r)) { console.log("Configuración cargada desde:", r); return JSON.parse(fs.readFileSync(r, "utf8")); }
    } catch (e) { console.error("No se pudo leer", r, String(e)); }
  }
  console.error("No se encuentra categorias.json. Rutas probadas:\n - " + rutas.join("\n - "));
  process.exit(1);
}
const conf = cargarConfig();

const iso = f => { const k = String(f || "").match(/^(\d{2})[-/](\d{2})[-/](\d{4})/); return k ? `${k[3]}-${k[2]}-${k[1]}` : ""; };
const num = v => (v === "" || v == null || isNaN(+v)) ? null : +v;
const limpiaCampo = s => String(s || "").replace(/\s*\(futbol sala\)\s*$/i, "").trim();
const cap = s => String(s || "").toLowerCase().replace(/(^|[\s.\-(])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()).trim();

// Fecha (AAAA-MM-DD) y hora (HH:MM) de Madrid -> milisegundos UTC
function madridMs(d, t) {
  const [y, mo, da] = d.split("-").map(Number), [h, mi] = t.split(":").map(Number), g = Date.UTC(y, mo - 1, da, h, mi || 0);
  const off = z => { const p = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })
    .formatToParts(new Date(z)).reduce((o, x) => (o[x.type] = +x.value, o), {}); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - z; };
  return g - off(g - off(g));
}

// ---------- Jornada de la semana: dura hasta el domingo a las 23:00 (Madrid) ----------
const madridFin = (y, m, d) => { for (const o of [1, 2]) { const t = Date.UTC(y, m - 1, d, 23 - o, 0);
  if (+new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "numeric", hourCycle: "h23" }).format(t) === 23) return t; } return Date.UTC(y, m - 1, d, 22, 0); };
const finSemana = isoF => { const t = new Date(isoF + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + (7 - t.getUTCDay()) % 7); return madridFin(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); };
// fechas: array de "AAAA-MM-DD" (una por jornada, en orden). Devuelve los índices a leer: la jornada de esta semana
// y la anterior hasta 36 h después de su fin (por si la RFFM cierra las actas tarde).
function indicesActuales(fechas) {
  const ahora = Date.now(); let cur = fechas.findIndex(f => f && finSemana(f) > ahora);
  if (cur < 0) cur = fechas.length - 1;
  const out = [cur];
  if (cur > 0 && fechas[cur - 1] && ahora < finSemana(fechas[cur - 1]) + 36 * 36e5) out.unshift(cur - 1);
  return out;
}

// ---------- RFFM ----------
async function rffm(grupo, n) {
  const url = `https://www.rffm.es/api/results?idGroup=${grupo}&round=${n}`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "application/json, text/plain, */*", "Accept-Language": "es-ES,es;q=0.9",
          Referer: `https://www.rffm.es/competicion/resultados-y-jornadas?grupo=${grupo}&jornada=${n}` },
        signal: AbortSignal.timeout(15000) });
      if (r.ok) { const d = await r.json(); if (d && Array.isArray(d.partidos)) return d; }
      else console.warn(`[${grupo}] jornada`, n, "HTTP", r.status);
    } catch (e) { console.warn(`[${grupo}] jornada`, n, String(e)); }
    await sleep(2000 * (i + 1));
  }
  return null;
}

// Devuelve { rondas:[{n,partidos}], full }. Completo: todas las jornadas hasta que la RFFM no devuelve más. Reciente: solo la jornada de esta semana (hasta el domingo 23:00).
async function leerRFFM(cat, prev) {
  const out = [], full = FULLRUN || !(prev && prev.cfg && prev.cfg.R && prev.cfg.R.length);
  if (full) {
    let nulos = 0;
    const fallidas = [];
    for (let n = 1; n <= MAXJOR; n++) {
      const d = await rffm(cat.grupo, n);
      if (!d) { fallidas.push(n); if (++nulos >= 3) break; continue; }
      nulos = 0;
      if (!d.partidos.length) break;
      out.push({ n, partidos: d.partidos });
      await sleep(1500);
    }
    // Segunda pasada: jornadas que fallaron, con más calma (solo las que quedan antes de la última leída)
    const ultima = out.length ? Math.max(...out.map(o => o.n)) : 0;
    for (const n of fallidas.filter(n => n < ultima)) {
      await sleep(5000);
      const d = await rffm(cat.grupo, n);
      if (d && d.partidos.length) out.push({ n, partidos: d.partidos });
      else console.warn(`[${cat.id}] jornada ${n}: no se pudo leer (se conserva lo que había)`);
    }
    out.sort((a, b) => a.n - b.n);
  } else {
    // Solo la jornada de esta semana (y la anterior unas horas, para los resultados que tardan en cerrarse)
    const fechas = prev.cfg.R.map(r => { const [dd, mm, aa] = String(r).split("|")[0].split("-"); return `${aa}-${mm}-${dd}`; });
    for (const i of indicesActuales(fechas)) {
      const d = await rffm(cat.grupo, i + 1);
      if (d) {
        // Equipo que la web aún no conoce: se haría pasar por «descansa» y su resultado no se guardaría → lectura completa
        const conocidos = new Set(Object.values(prev.cfg.COD || {}).map(String));
        const nuevo = d.partidos.some(p => [p.CodEquipo_local, p.CodEquipo_visitante].some(c => +c !== -1 && c && !conocidos.has(String(c))));
        if (nuevo) { console.log(`[${cat.id}] equipo nuevo en la jornada ${i + 1}: lectura completa`); return leerRFFM(cat, null); }
        out.push({ n: i + 1, partidos: d.partidos });
      }
      await sleep(1500);
    }
  }
  if (!out.length) throw new Error("No se pudo leer ninguna jornada de la RFFM (¿grupo incorrecto o cambió la API?)");
  console.log(`[${cat.id}] jornadas leídas: ${out.length} · modo: ${full ? "completo" : "reciente"}`);
  return { rondas: out, full };
}

// ---------- Firebase ----------
async function login() {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FBKEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: FBMAIL, password: FBPASS, returnSecureToken: true }) });
  const d = await r.json();
  if (!d.idToken) { console.error("Login Firebase fallido:", d.error?.message); process.exit(1); }
  return d.idToken;
}
async function leerFB(tok, node) {
  const g = await fetch(`${FB}/${node}.json?auth=${tok}`, { headers: { "X-Firebase-ETag": "true" } });
  if (!g.ok) throw new Error("No se pudo leer Firebase " + node + ": " + g.status);
  const raw = await g.json();
  return { etag: g.headers.get("etag"), S: raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null };
}

// ---------- Aplicar la RFFM sobre los datos ----------
function aplicar(S, lectura, cat) {
  const hoy = Date.now(), hoyISO = new Date(hoy).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  S.m ||= {};
  const cfg = S.cfg ||= { T: {}, COD: {}, R: [] };
  const antes = JSON.stringify(cfg);
  const inv = () => Object.fromEntries(Object.entries(cfg.COD).map(([i, c]) => [String(c), +i]));
  let ids = inv(), total = 0;
  const idDe = (cod, nombre, campo) => {
    const c = String(cod);
    if (+cod === -1 || !c) return 0;
    if (!ids[c]) {
      if (!lectura.full) return 0;                  // en ejecuciones recientes no se crean equipos nuevos
      const id = Math.max(0, ...Object.keys(cfg.COD).map(Number)) + 1;
      cfg.COD[id] = +cod; ids = inv();
    }
    const id = ids[c];
    if (lectura.full) {
      if (nombre) cfg.T[id] = [cap(nombre), (cfg.T[id] && cfg.T[id][1]) || ""];
      if (campo && cfg.T[id] && !cfg.T[id][1]) cfg.T[id][1] = campo;
    }
    return id;
  };
  const R = lectura.full ? [] : null;
  const prevR = Array.isArray(cfg.R) ? cfg.R.slice() : [];
  let ultimaFecha = "";
  for (const { n, partidos } of lectura.rondas) {
    const pares = [];
    let fechaJor = "";
    for (const p of partidos) {
      const h = idDe(p.CodEquipo_local, p.Nombre_equipo_local, limpiaCampo(p.campojuego)),
            a = idDe(p.CodEquipo_visitante, p.Nombre_equipo_visitante, "");
      const fecha = iso(p.fecha), hora = (p.hora || "").slice(0, 5);
      if (fecha && (!fechaJor || fecha < fechaJor)) fechaJor = fecha;
      if (!h && !a) { if (+p.CodEquipo_local !== -1 || +p.CodEquipo_visitante !== -1) console.warn(`[${cat.id}] equipo desconocido:`, p.Nombre_equipo_local, "/", p.Nombre_equipo_visitante); continue; }
      pares.push(`${h}-${a}`);
      if (!h || !a) continue;                        // descansa
      const inicio = fecha && hora ? madridMs(fecha, hora) : 0;
      const cerrada = p.acta_cerrada === "1";
      const pasado = inicio && hoy > inicio + ESPERA_MIN * 6e4;
      // Terminado = la RFFM ya no lo marca "en juego", o tiene el acta cerrada, o ya pasó tiempo de sobra desde su inicio
      const terminado = cerrada || p.partido_en_juego !== "1" || pasado;
      const jugado = terminado && fecha && fecha <= hoyISO && (!SOLO_CERRADAS || cerrada);
      const gl = jugado ? num(p.Goles_casa) : null, gv = jugado ? num(p.Goles_visitante) : null;
      // Diagnóstico: partidos de hoy que ya deberían tener resultado y la RFFM todavía no lo da
      if (inicio && fecha === hoyISO && hoy > inicio + 90 * 6e4 && (gl === null || gv === null))
        console.log(`[${cat.id}] sin resultado aún: ${p.Nombre_equipo_local} - ${p.Nombre_equipo_visitante} | ${hora} | acta_cerrada=${p.acta_cerrada} | goles=${p.Goles_casa}-${p.Goles_visitante} | en_juego=${p.partido_en_juego}`);
      const k = `${n}_${h}`, m = S.m[k] || {};
      let ch = 0;
      if (fecha && fecha !== m.d) { m.d = fecha; ch++; }
      if (hora && hora !== m.t) { m.t = hora; ch++; }
      const campo = limpiaCampo(p.campojuego);
      if (campo && campo !== m.p) { m.p = campo; ch++; }
      if (Number.isInteger(gl) && Number.isInteger(gv) && !(m.h !== undefined && m.h !== "" && +m.h === gl && +m.a === gv)) { m.h = gl; m.a = gv; ch++; }
      if (ch) { S.m[k] = m; total += ch; }
    }
    if (R) {
      const f = fechaJor || ultimaFecha || "2099-01-01"; ultimaFecha = f;
      R[n - 1] = `${f.split("-").reverse().join("-")}|${pares.join(",")}`;
    }
  }
  if (R) {
    // Nunca dejar huecos (null) ni acortar el calendario: lo que no se pudo leer se conserva de la vez anterior.
    // Si tampoco había nada, se pone una jornada vacía para que la web no se rompa.
    const largo = Math.max(R.length, prevR.length);
    let ult = "";
    for (let i = 0; i < largo; i++) {
      if (!R[i] && typeof prevR[i] === "string" && prevR[i]) R[i] = prevR[i];
      if (!R[i]) { R[i] = `${ult || "31-12-2099"}|0-0`; console.warn(`[${cat.id}] jornada ${i + 1} sin datos: se deja vacía`); }
      ult = R[i].split("|")[0];
    }
    cfg.R = R;
  }
  // Equipo propio: el de categorias.json, o el primero cuyo nombre contenga JUNCAL
  if (lectura.full) {
    let eq = cat.equipo ? +cat.equipo : 0;
    if (!eq) { const id = Object.keys(cfg.T).find(i => /juncal/i.test(cfg.T[i][0])); if (id) eq = cfg.COD[id]; }
    if (eq) cfg.equipo = eq; else console.warn(`[${cat.id}] no se encontró el equipo propio (rellena "equipo" en categorias.json)`);
    const idP = Object.keys(cfg.COD).find(i => cfg.COD[i] === cfg.equipo);
    console.log(`[${cat.id}] equipo propio: ${cfg.equipo} → ${idP ? "id " + idP + " (" + (cfg.T[idP] || [])[0] + ")" : "NO ESTÁ ENTRE LOS EQUIPOS LEÍDOS"} · jornadas en el calendario: ${cfg.R.length}`);
    if (!idP) console.error(`[${cat.id}] ¡OJO! El equipo propio (${cfg.equipo}) no aparece en la RFFM de este grupo: la web mostrará "Temporada finalizada". Revisa "equipo" y "grupo" en categorias.json`);
    cfg.nombre = cat.nombreEquipo || ""; cfg.liga = cat.liga || "";
  }
  if (JSON.stringify(cfg) !== antes) total++;
  return total;
}

// ---------- Main ----------
const cats = conf.categorias
  .filter(c => c.grupo && !SALTAR.includes(c.id) && c.activa !== false && (!SOLO || c.id === SOLO));
if (!cats.length) { console.log("No hay categorías activas para sincronizar"); process.exit(0); }
console.log("Categorías:", cats.map(c => c.id).join(", "));

const tok = await login();
let errores = 0;
for (const cat of cats) {
  const node = "cat-" + cat.id;
  try {
    const { S: previo } = await leerFB(tok, node);
    const lectura = await leerRFFM(cat, previo);
    for (let intento = 0; intento < 4; intento++) {
      const { etag, S: leido } = await leerFB(tok, node);
      const S = leido || { u: 0, m: {}, cfg: { T: {}, COD: {}, R: [] } };
      const cambios = aplicar(S, lectura, cat);
      if (!cambios) { console.log(`[${cat.id}] sin cambios`); break; }
      S.u = Date.now();
      // PUT condicional: si alguien escribió mientras tanto, Firebase responde 412 y reintentamos
      const p = await fetch(`${FB}/${node}.json?auth=${tok}`, {
        method: "PUT", headers: etag ? { "if-match": etag } : {}, body: JSON.stringify(JSON.stringify(S)) });
      if (p.ok) { console.log(`[${cat.id}] cambios guardados: ${cambios}`); break; }
      if (p.status === 412) { console.warn(`[${cat.id}] conflicto de escritura, reintentando…`); await sleep(1000); continue; }
      throw new Error("Error al guardar: " + p.status);
    }
  } catch (e) { errores++; console.error(`[${cat.id}] ERROR:`, String(e)); }
}
if (errores) { console.error(errores, "categoría(s) con error"); process.exit(1); }
