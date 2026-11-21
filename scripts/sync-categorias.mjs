// scripts/sync-categorias.mjs — Node 20, sin dependencias
// Una sola sincronización para TODAS las categorías (Infantil B incluido: guarda en el nodo "juncal", ver "node" en categorias.json).
// Lee categorias.json y, por cada categoría con "grupo" rellenado, lee la RFFM y escribe en Firebase el nodo "cat-<id>":
//   · cfg: equipos (T), CodEquipo (COD), calendario (R), equipo propio (equipo), nombre y liga. Se construye solo desde la RFFM
//   · m:   fecha, hora, pabellón y resultado de TODOS los partidos
// Lo lee Categorias/<Categoria>/<Categoria>.html (formato de InfantilA.html)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FB = "https://juncal-f0b64-default-rtdb.europe-west1.firebasedatabase.app";
const SALTAR = [];                        // categorías que NO se sincronizan aquí (ninguna: Infantil B ya va por este mismo script)
const MAXJOR = 60;
const { FBKEY, FBMAIL, FBPASS, FCM_SERVICE_ACCOUNT } = process.env;
const SOLO = (process.env.SOLO || "").trim();                 // opcional: id de una sola categoría (para probar)
const SOLO_CERRADAS = process.env.SOLO_CERRADAS === "1";      // 1 = solo guardar resultados con acta cerrada
// Si la RFFM mantiene un partido "en juego" mucho después de empezar (pasa hasta que se cierra el acta),
// se da por terminado cuando han pasado ESPERA_MIN minutos desde su hora de inicio
const ESPERA_MIN = +process.env.ESPERA_MIN || 100;
// RAPIDO=1 (workflow «Sincronizar semana»): solo la jornada actual y la siguiente, nunca todas las jornadas
const RAPIDO = process.env.RAPIDO === "1";
const MANUAL = (process.env.GITHUB_EVENT_NAME === "workflow_dispatch" && process.env.CADENA !== "1") || process.env.FORZAR === "1";   // CADENA=1: ejecución encadenada automática (no es manual)
// GitHub programa en UTC; aquí filtramos por hora de Madrid (9:00–22:59), también con cambio de hora
const ahoraMadrid = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date());
const horaMadrid = +ahoraMadrid.find(x => x.type === "hour").value, minMadrid = +ahoraMadrid.find(x => x.type === "minute").value;
const diaMadrid = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", weekday: "short" }).format(new Date());   // Sat, Sun, Mon, Tue…
// Ventana del modo rápido (hora de Madrid): sábado 9:00 → martes 23:30, y una ejecución diaria (9:xx) de miércoles a viernes
const dentroSemana = (diaMadrid === "Sat" && horaMadrid >= 9) || diaMadrid === "Sun" || diaMadrid === "Mon" || (diaMadrid === "Tue" && (horaMadrid < 23 || (horaMadrid === 23 && minMadrid <= 30)))
  || (["Wed", "Thu", "Fri"].includes(diaMadrid) && horaMadrid === 9);   // miércoles a viernes: una sola ejecución al día, a las 9:xx
if (RAPIDO && !MANUAL && !dentroSemana) { console.log("Fuera de la ventana de sincronización:", diaMadrid, horaMadrid + ":" + minMadrid, "en Madrid"); process.exit(0); }
if (!RAPIDO && !MANUAL && (horaMadrid < 8 || (horaMadrid === 23 && minMadrid > 30))) { console.log("Fuera de horario:", horaMadrid + ":" + minMadrid, "en Madrid"); process.exit(0); }
const FULLRUN = !RAPIDO && (MANUAL || horaMadrid === 9);   // primera ejecución del día (las 9h) y manuales: todas las jornadas
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
  if (RAPIDO && cur < fechas.length - 1) out.push(cur + 1);   // modo rápido: también la jornada siguiente
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
        if (nuevo && RAPIDO) { console.warn(`[${cat.id}] equipo nuevo en la jornada ${i + 1}: se omite en modo rápido (lanza «Sincronizar categorías» a mano para la lectura completa)`); await sleep(1500); continue; }
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

// ---------- Avisos push por categoría (Firebase Cloud Messaging) ----------
// Cada categoría tiene su tema «juncal-<id>»: la app del club suscribe a los equipos que elige cada familia.
let avisosCat = [];
const b64u = b => Buffer.from(b).toString("base64url");
async function tokenFCM(sa) {
  const { createSign } = await import("node:crypto");
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64u(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(sa.private_key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${sig}` }) });
  const d = await r.json();
  if (!d.access_token) throw new Error("OAuth FCM: " + JSON.stringify(d));
  return d.access_token;
}
const diaES = f => { const t = new Date(f + "T12:00:00Z").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return t[0].toUpperCase() + t.slice(1); };
async function avisar(cat, S, lista) {
  if (!lista.length) return;
  if (!FCM_SERVICE_ACCOUNT) { console.log(`[${cat.id}] aviso pendiente, falta el secret FCM_SERVICE_ACCOUNT:`, JSON.stringify(lista)); return; }
  const nom = id => (S.cfg.T[id] && S.cfg.T[id][0]) || "Rival";
  // Como máximo un aviso de horario (el del partido más próximo) y uno de resultado (el último)
  const horario = lista.filter(x => x.tipo !== "final").sort((p, q) => p.jor - q.jor)[0];
  const final = lista.filter(x => x.tipo === "final").sort((p, q) => q.jor - p.jor)[0];
  try {
    const sa = JSON.parse(FCM_SERVICE_ACCOUNT), tk = await tokenFCM(sa);
    for (const x of [horario, final].filter(Boolean)) {
      const title = x.tipo === "hora" ? `⚽ ${cat.nombre}: ¡ya hay hora para el partido!`
                  : x.tipo === "cambio" ? `⚠️ ${cat.nombre}: cambio de día/hora` : `🏁 ${cat.nombre}: final del partido`;
      const text = x.tipo === "final" ? `${nom(x.h)} ${x.gl} - ${x.gv} ${nom(x.a)}` : `${nom(x.h)} vs ${nom(x.a)} · ${diaES(x.fecha)} · ${x.hora} h`;
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, { method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { ...(cat.avisoGeneral ? { condition: `'juncal' in topics || 'juncal-${cat.id}' in topics` } : { topic: "juncal-" + cat.id }), notification: { title, body: text },
          data: { categoria: cat.id, jornada: String(x.jor) }, android: { priority: "HIGH", notification: { channel_id: "default" } } } }) });
      console.log(`[${cat.id}] aviso push`, r.ok ? "enviado:" : "ERROR " + r.status + " " + await r.text(), title, "|", text);
    }
  } catch (e) { console.error(`[${cat.id}] no se pudo enviar el aviso push:`, String(e)); }
}

// Total de goles de jugadores (m.g) y de minutos (m.gm) guardados: la sincronización NUNCA debe reducirlo
function golesTotal(S) {
  let t = 0;
  for (const m of Object.values(S.m || {})) {
    for (const v of Object.values((m && m.g) || {})) t += +v || 0;
    for (const a of Object.values((m && m.gm) || {})) t += Array.isArray(a) ? a.length : 0;
  }
  return t;
}

// ---------- Aplicar la RFFM sobre los datos ----------
function aplicar(S, lectura, cat) {
  const hoy = Date.now(), hoyISO = new Date(hoy).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  const ayerISO = new Date(hoy - 864e5).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  avisosCat = [];
  S.m ||= {};
  const cfg = S.cfg ||= { T: {}, COD: {}, R: [] };
  cfg.T ||= {}; cfg.COD ||= {}; cfg.R ||= [];
  // Categorías que ya tenían datos propios (Infantil B): los ids de equipo YA usados en las claves de partido (jornada_idLocal)
  // se respetan. Así los goles y demás datos guardados siguen apuntando al partido correcto.
  if (cat.ids && !Object.keys(cfg.COD).length) cfg.COD = Object.fromEntries(Object.entries(cat.ids).map(([i, c]) => [i, +c]));
  const propioId = +(Object.keys(cfg.COD).find(i => cfg.COD[i] === cfg.equipo) || 0);
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
      let gl = jugado ? num(p.Goles_casa) : null, gv = jugado ? num(p.Goles_visitante) : null;
      // Si la RFFM aún no da los goles pero sí un resultado provisional («3-1»), se usa ese hasta que cierren el acta
      const prov = String(p.ResultadoProvisional || "").match(/^\s*(\d+)\s*[-:]\s*(\d+)\s*$/);
      if (jugado && gl === null && gv === null && prov) { gl = +prov[1]; gv = +prov[2]; console.log(`[${cat.id}] resultado PROVISIONAL usado: ${p.Nombre_equipo_local} ${gl}-${gv} ${p.Nombre_equipo_visitante}`); }
      // Diagnóstico: partidos de hoy que ya deberían tener resultado y la RFFM todavía no lo da
      if (inicio && hoy > inicio + 90 * 6e4 && (gl === null || gv === null))
        console.log(`[${cat.id}] sin resultado aún: ${p.Nombre_equipo_local} - ${p.Nombre_equipo_visitante} | ${hora} | acta_cerrada=${p.acta_cerrada} | goles=${p.Goles_casa}-${p.Goles_visitante} | en_juego=${p.partido_en_juego} | estado=${p.estado} | motivo=${p.motivo_estado} | provisional=${p.ResultadoProvisional} | retirado=${p.Retirado_local}/${p.Retirado_visitante} | jugado=${jugado} | fecha=${fecha}`);
      const k = `${n}_${h}`, m = S.m[k] || {};
      if (m.c && !m.c.fin) continue;                 // directo en curso desde el admin: no se toca hasta que termine
      const prevT = m.t, prevD = m.d, prevRes = m.h !== undefined && m.h !== "";
      const propio = propioId && (h === propioId || a === propioId);
      let ch = 0;
      if (fecha && fecha !== m.d) { m.d = fecha; ch++; }
      if (hora && hora !== m.t) { m.t = hora; ch++; }
      const campo = limpiaCampo(p.campojuego);
      if (campo && campo !== m.p) { m.p = campo; ch++; }
      if (Number.isInteger(gl) && Number.isInteger(gv) && !(m.h !== undefined && m.h !== "" && +m.h === gl && +m.a === gv)) { m.h = gl; m.a = gv; ch++; }
      // Avisos push del equipo propio (se envían después de guardar): hora nueva, cambio de día/hora y resultado final
      if (propio && hora && fecha && inicio > hoy) {   // solo partidos que aún no han empezado
        if (!prevT) avisosCat.push({ tipo: "hora", jor: n, h, a, fecha, hora });
        else if (hora !== prevT || (prevD && fecha !== prevD)) avisosCat.push({ tipo: "cambio", jor: n, h, a, fecha, hora });
      }
      if (propio && !prevRes && Number.isInteger(gl) && Number.isInteger(gv) && fecha >= ayerISO) avisosCat.push({ tipo: "final", jor: n, h, a, fecha, gl, gv });
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
  const node = cat.node || "cat-" + cat.id;
  try {
    const { S: previo } = await leerFB(tok, node);
    const lectura = await leerRFFM(cat, previo);
    for (let intento = 0; intento < 4; intento++) {
      const { etag, S: leido } = await leerFB(tok, node);
      const S = leido || { u: 0, m: {}, cfg: { T: {}, COD: {}, R: [] } };
      const golesAntes = golesTotal(S);
      const cambios = aplicar(S, lectura, cat);
      if (golesTotal(S) < golesAntes) throw new Error(`se perderían goles de jugadores (${golesAntes} → ${golesTotal(S)}): no se guarda nada`);
      if (!cambios) { console.log(`[${cat.id}] sin cambios`); break; }
      S.u = Date.now();
      // PUT condicional: si alguien escribió mientras tanto, Firebase responde 412 y reintentamos
      const p = await fetch(`${FB}/${node}.json?auth=${tok}`, {
        method: "PUT", headers: etag ? { "if-match": etag } : {}, body: JSON.stringify(JSON.stringify(S)) });
      if (p.ok) { console.log(`[${cat.id}] cambios guardados: ${cambios}`); await avisar(cat, S, avisosCat); break; }
      if (p.status === 412) { console.warn(`[${cat.id}] conflicto de escritura, reintentando…`); await sleep(1000); continue; }
      throw new Error("Error al guardar: " + p.status);
    }
  } catch (e) { errores++; console.error(`[${cat.id}] ERROR:`, String(e)); }
}
if (errores) { console.error(errores, "categoría(s) con error"); process.exit(1); }
