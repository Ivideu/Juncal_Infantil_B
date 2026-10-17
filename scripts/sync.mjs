// scripts/sync.mjs — Node 20, sin dependencias
// Lee la RFFM y escribe en Firebase:
//   · TODOS los partidos: fecha, hora
//   · Partidos del Juncal B: además el pabellón (m.p). NUNCA resultado ni goleadores (los pones tú en el admin)
//   · Partidos de otros equipos: resultado (nunca goleadores)
const FB = "https://juncal-f0b64-default-rtdb.europe-west1.firebasedatabase.app";
const { FBKEY, FBMAIL, FBPASS } = process.env;
const SOLO_CERRADAS = process.env.SOLO_CERRADAS === "1";   // 1 = solo guardar resultados con acta cerrada
const MANUAL = process.env.GITHUB_EVENT_NAME === "workflow_dispatch";
// GitHub programa en UTC; aquí filtramos por hora de Madrid (8:00–23:59), también con cambio de hora
const horaMadrid = +new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "numeric", hourCycle: "h23" }).format(new Date());
if (!MANUAL && (horaMadrid < 8 || horaMadrid > 23)) { console.log("Fuera de horario:", horaMadrid, "h en Madrid"); process.exit(0); }
const FULLRUN = MANUAL || horaMadrid <= 9;                 // primeras ejecuciones del día y las manuales: las 22 jornadas
const ME = 10, GRUPO = "28125503";
const sleep = ms => new Promise(r => setTimeout(r, ms));

// CodEquipo de la RFFM -> id de tu tabla T
const ID = {
  24116776: 2,   // Aston C
  27916794: 3,   // Lope de Vega
  17175596: 4,   // Torrejón Five Play
  18925059: 5,   // Rivas Atlantis B
  17155533: 6,   // Rivas Futsal B
  18753107: 7,   // Malvar
  26753258: 8,   // Fusión San Fernando
  27111405: 9,   // Diagonal C
  24193914: 10,  // Juncal B
  26750489: 11,  // Sporting Morata
  21455532: 12,  // Limones 5 B
};

// Mismo calendario que tu web
const R = ["03-10-2026|0-3,10-5,8-7,6-9,4-11,12-2","17-10-2026|3-12,5-0,7-10,9-8,11-6,2-4","24-10-2026|3-5,0-7,10-9,8-11,6-2,12-4","07-11-2026|5-12,7-3,9-0,11-10,2-8,4-6","14-11-2026|5-7,3-9,0-11,10-2,8-4,12-6","21-11-2026|7-12,9-5,11-3,2-0,4-10,6-8","28-11-2026|7-9,5-11,3-2,0-4,10-6,12-8","12-12-2026|9-12,11-7,2-5,4-3,6-0,8-10","19-12-2026|9-11,7-2,5-4,3-6,0-8,12-10","16-01-2027|12-11,2-9,4-7,6-5,8-3,10-0","23-01-2027|11-2,9-4,7-6,5-8,3-10,0-12","30-01-2027|3-0,5-10,7-8,9-6,11-4,2-12","06-02-2027|12-3,0-5,10-7,8-9,6-11,4-2","20-02-2027|5-3,7-0,9-10,11-8,2-6,4-12","27-02-2027|12-5,3-7,0-9,10-11,8-2,6-4","06-03-2027|7-5,9-3,11-0,2-10,4-8,6-12","13-03-2027|12-7,5-9,3-11,0-2,10-4,8-6","03-04-2027|9-7,11-5,2-3,4-0,6-10,8-12","10-04-2027|12-9,7-11,5-2,3-4,0-6,10-8","17-04-2027|11-9,2-7,4-5,6-3,8-0,10-12","08-05-2027|11-12,9-2,7-4,5-6,3-8,0-10","29-05-2027|2-11,4-9,6-7,8-5,10-3,12-0"];
const J = R.map((s, i) => { const [d, p] = s.split("|");
  return { n: i + 1, d: d.split("-").reverse().join("-"),
           p: p.split(",").map(x => x.split("-").map(Number)) }; });

const iso = f => { const k = String(f || "").match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  return k ? `${k[3]}-${k[2]}-${k[1]}` : ""; };
const num = v => (v === "" || v == null || isNaN(+v)) ? null : +v;
const limpiaCampo = s => String(s || "").replace(/\s*\(futbol sala\)\s*$/i, "").trim();

// ---------- RFFM ----------
async function rffm(n) {
  const url = `https://www.rffm.es/api/results?idGroup=${GRUPO}&round=${n}`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "application/json, text/plain, */*", "Accept-Language": "es-ES,es;q=0.9",
          Referer: `https://www.rffm.es/competicion/resultados-y-jornadas?grupo=${GRUPO}&jornada=${n}` },
                                   signal: AbortSignal.timeout(15000) });
      if (r.ok) { const d = await r.json(); if (d && Array.isArray(d.partidos)) return d;
        if (d == null) { console.warn("RFFM jornada", n, "respuesta vacía, reintento…"); } }
      else console.warn("RFFM jornada", n, "HTTP", r.status);
    } catch (e) { console.warn("RFFM jornada", n, String(e)); }
    await sleep(2000 * (i + 1));
  }
  return null;
}

async function leerRFFM() {
  const hoy = Date.now(), hoyISO = new Date(hoy).toISOString().slice(0, 10), out = [];
  // Primeras ejecuciones del día y manuales: las 22 jornadas. Resto: últimos 14 días y próximos 7.
  const rondas = FULLRUN ? J : J.filter(j => {
    const t = new Date(j.d + "T12:00:00Z").getTime();
    return t > hoy - 14 * 864e5 && t < hoy + 7 * 864e5;
  });
  let fallos = 0;
  for (const j of rondas) {
    const d = await rffm(j.n);
    if (!d) { fallos++; continue; }
    for (const p of d.partidos) {
      const h = ID[p.CodEquipo_local], a = ID[p.CodEquipo_visitante];
      if (!h || !a) {
        if (+p.CodEquipo_local !== -1 && +p.CodEquipo_visitante !== -1)
          console.warn("Equipo desconocido:", p.Nombre_equipo_local, "/", p.Nombre_equipo_visitante);
        continue;                                   // descansa o equipo no reconocido
      }
      const fecha = iso(p.fecha), hora = (p.hora || "").slice(0, 5);
      const jugado = p.partido_en_juego !== "1" && fecha && fecha <= hoyISO && (!SOLO_CERRADAS || p.acta_cerrada === "1");
      out.push({ h, a, fecha, hora, campo: limpiaCampo(p.campojuego),
                 gl: jugado ? num(p.Goles_casa) : null,
                 gv: jugado ? num(p.Goles_visitante) : null });
    }
    await sleep(1500);
  }
  if (rondas.length && fallos === rondas.length) {
    console.error("No se pudo leer ninguna jornada de la RFFM (¿cambió la API?)");
    process.exit(1);
  }
  console.log("Jornadas leídas:", rondas.length - fallos, "de", rondas.length, "· partidos:", out.length);
  return out;
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

function aplicar(S, partidos) {
  S.m ||= {};
  let total = 0;
  for (const r of partidos) {
    const jor = J.find(j => j.p.some(([x, y]) => x === r.h && y === r.a));
    if (!jor) continue;
    const k = `${jor.n}_${r.h}`, m = S.m[k] ? S.m[k] : {};
    const mio = r.h === ME || r.a === ME;
    if (mio && m.c && !m.c.fin) continue;           // directo en curso: no tocar
    let ch = 0;
    if (r.fecha && r.fecha !== (m.d || jor.d)) { m.d = r.fecha; ch++; }
    if (r.hora && r.hora !== m.t)              { m.t = r.hora;  ch++; }
    if (mio && r.campo && r.campo !== m.p)     { m.p = r.campo; ch++; }
    if (!mio && Number.isInteger(r.gl) && Number.isInteger(r.gv)) {
      const igual = m.h !== undefined && m.h !== "" && +m.h === r.gl &&
                    m.a !== undefined && m.a !== "" && +m.a === r.gv;
      if (!igual) { m.h = r.gl; m.a = r.gv; ch++; }
    }
    if (ch) { S.m[k] = m; total += ch; }
  }
  return total;
}

// ---------- Main ----------
const partidos = await leerRFFM();
const tok = await login();

for (let intento = 0; intento < 4; intento++) {
  const g = await fetch(`${FB}/juncal.json?auth=${tok}`, { headers: { "X-Firebase-ETag": "true" } });
  if (!g.ok) { console.error("No se pudo leer Firebase:", g.status); process.exit(1); }
  const etag = g.headers.get("etag"), raw = await g.json();
  const S = raw ? JSON.parse(raw) : { u: 0, m: {}, pl: [], dn: {} };
  S.pl ||= []; S.dn ||= {};

  const cambios = aplicar(S, partidos);
  if (!cambios) { console.log("Sin cambios"); break; }
  S.u = Date.now();

  // PUT condicional: si alguien (tú desde el admin) escribió mientras tanto, Firebase responde 412 y reintentamos
  const p = await fetch(`${FB}/juncal.json?auth=${tok}`, {
    method: "PUT", headers: etag ? { "if-match": etag } : {}, body: JSON.stringify(JSON.stringify(S)) });
  if (p.ok) { console.log("Cambios guardados:", cambios); break; }
  if (p.status === 412) { console.warn("Conflicto de escritura, reintentando…"); await sleep(1000); continue; }
  console.error("Error al guardar:", p.status); process.exit(1);
}
