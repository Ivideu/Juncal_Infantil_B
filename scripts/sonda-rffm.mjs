// scripts/sonda-rffm.mjs — Node 20, sin dependencias. SOLO LEE de la RFFM y escribe en el registro de la Action.
// Sirve para descubrir qué datos da la RFFM (plantillas, actas, goles, tarjetas). No toca Firebase.
const GRUPO = process.env.GRUPO || "28125503", RONDA = process.env.RONDA || "1";
const H = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json, text/plain, */*", "Accept-Language": "es-ES,es;q=0.9", Referer: `https://www.rffm.es/competicion/resultados-y-jornadas?grupo=${GRUPO}&jornada=${RONDA}` };
const cut = (s, n = 400) => String(s).replace(/\s+/g, " ").slice(0, n);
async function get(url) {
  try { const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(20000) }); const t = await r.text(); return { status: r.status, ct: r.headers.get("content-type") || "", t }; }
  catch (e) { return { status: "ERR", ct: "", t: String(e) }; }
}
const titulo = s => console.log(`\n===== ${s} =====`);

titulo(`1. Resultados grupo ${GRUPO} jornada ${RONDA}`);
const res = await get(`https://www.rffm.es/api/results?idGroup=${GRUPO}&round=${RONDA}`);
console.log("HTTP", res.status, res.ct);
let d = null; try { d = JSON.parse(res.t); } catch { console.log(cut(res.t)); }
const claves = {};
if (d) {
  console.log("Claves de la respuesta:", Object.keys(d).join(", "));
  const p = (d.partidos || [])[0];
  if (p) {
    console.log("Claves de un partido:", Object.keys(p).join(", "));
    console.log("Partido completo:", JSON.stringify(p, null, 1).slice(0, 3500));
    for (const [k, v] of Object.entries(p)) if (/acta|cod|id/i.test(k)) claves[k] = v;
  }
}

titulo("2. Rutas /api/ que usa la web de la RFFM");
const enc = new Set();
for (const pg of [`https://www.rffm.es/competicion/resultados-y-jornadas?grupo=${GRUPO}&jornada=${RONDA}`, "https://www.rffm.es/", "https://www.rffm.es/competicion/actas"]) {
  const h = await get(pg); console.log(pg, "→ HTTP", h.status, "(" + h.t.length + " bytes)");
  const srcs = [...h.t.matchAll(/(?:src|href)=["']([^"']+\.js[^"']*)["']/g)].map(m => new URL(m[1], pg).href);
  for (const m of h.t.matchAll(/["'`](\/?api\/[A-Za-z0-9_\-\/.?=&${}]+)["'`]/g)) enc.add(m[1]);
  for (const s of [...new Set(srcs)].slice(0, 25)) {
    const j = await get(s);
    for (const m of j.t.matchAll(/["'`](\/?api\/[A-Za-z0-9_\-\/.?=&${}]+)["'`]/g)) enc.add(m[1]);
  }
}
console.log([...enc].sort().join("\n") || "(no se han encontrado rutas /api/ en el código de la web)");

titulo("3. Pruebas directas");
const cod = Object.values(claves).filter(v => v && typeof v !== "object").map(String);
const eq = d && d.partidos && d.partidos[0] ? String(d.partidos[0].CodEquipo_local || "") : "";
const acta = Object.entries(claves).find(([k]) => /acta/i.test(k));
const prueba = [];
if (acta) for (const r of ["actas", "acta", "match", "matches", "partido", "matchdetail", "match-detail"]) prueba.push(`https://www.rffm.es/api/${r}/${acta[1]}`, `https://www.rffm.es/api/${r}?id=${acta[1]}`);
if (eq) for (const r of ["teams", "team", "equipos", "equipo"]) prueba.push(`https://www.rffm.es/api/${r}/${eq}`, `https://www.rffm.es/api/${r}/${eq}/players`, `https://www.rffm.es/api/${r}/${eq}/jugadores`);
if (eq) prueba.push(`https://www.rffm.es/api/players?idTeam=${eq}`, `https://www.rffm.es/api/jugadores?idEquipo=${eq}`, `https://www.rffm.es/api/team/players?idTeam=${eq}`);
prueba.push(`https://www.rffm.es/api/classification?idGroup=${GRUPO}`, `https://www.rffm.es/api/scorers?idGroup=${GRUPO}`, `https://www.rffm.es/api/goleadores?idGroup=${GRUPO}`);
for (const u of [...new Set(prueba)]) { const r = await get(u); console.log(r.status, u, "→", cut(r.t, 160)); }
console.log("\nFin de la sonda.");
