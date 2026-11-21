// scripts/migrar-entrenos.mjs — pasa la asistencia a entrenos y las convocatorias guardadas con la clave antigua
// («Ruben_1_portero») a la clave actual de cada jugador («g_<id>» de S.cromos), emparejando por nombre y dorsal.
// Solo AÑADE claves nuevas (no borra las antiguas ni pisa lo que ya esté marcado con la clave nueva).
//   node scripts/migrar-entrenos.mjs <nodo>
import fs from "node:fs";
const FB = "https://juncal-f0b64-default-rtdb.europe-west1.firebasedatabase.app";
const { FBKEY, FBMAIL, FBPASS } = process.env;
const nodo = process.argv[2];
const obj = x => x == null ? {} : (typeof x === "string" ? JSON.parse(x) : x);
const r0 = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FBKEY}`,
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: FBMAIL, password: FBPASS, returnSecureToken: true }) });
const tok = (await r0.json()).idToken; if (!tok) { console.error("Login Firebase fallido"); process.exit(1); }
const g = await fetch(`${FB}/${nodo}.json?auth=${tok}`, { headers: { "X-Firebase-ETag": "true" } });
const etag = g.headers.get("etag"), S = obj(await g.json());
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const porNombre = {};
for (const c of S.cromos || []) if (!c.coach) porNombre[norm(c.name) + "_" + String(c.num || "").replace(/\D/g, "")] = "g_" + c.id;
console.log("Jugadores actuales (S.cromos):", Object.entries(porNombre).map(([k, v]) => k + "→" + v).join(" · ") || "(ninguno)");
const nueva = vieja => {            // «Ruben_1_portero» → nombre "ruben", dorsal "1"
  if (/^g_/.test(vieja)) return null;
  const p = vieja.split("_"); if (p.length < 3 || /entrenador/i.test(p[p.length - 1])) return null;
  return porNombre[norm(p[0]) + "_" + p[1].replace(/\D/g, "")] || null;
};
let n = 0; const sin = new Set();
for (const [campo, mapa] of [["estado", S.estado], ...Object.entries(S.ent || {}).map(([d, m]) => ["ent/" + d, m])]) {
  if (!mapa) continue;
  for (const [k, v] of Object.entries({ ...mapa })) {
    const nk = nueva(k);
    if (nk === null) { if (!/^g_/.test(k) && !/entrenador/i.test(k)) sin.add(k); continue; }
    if (mapa[nk] === undefined) { mapa[nk] = v; n++; }
  }
}
console.log(`Claves nuevas añadidas: ${n}` + (sin.size ? ` · sin pareja: ${[...sin].join(", ")}` : ""));
if (n) {
  S.u = Date.now();
  const p = await fetch(`${FB}/${nodo}.json?auth=${tok}`, { method: "PUT", headers: etag ? { "if-match": etag } : {}, body: JSON.stringify(JSON.stringify(S)) });
  console.log(p.ok ? "✓ Guardado" : "ERROR al guardar: " + p.status); if (!p.ok) process.exit(1);
}
