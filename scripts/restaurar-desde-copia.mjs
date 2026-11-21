// scripts/restaurar-desde-copia.mjs — recupera datos perdidos de un nodo de Firebase desde un .json de copia.
//   node scripts/restaurar-desde-copia.mjs <nodo> <copia.json> [--aplicar]
// Sin --aplicar solo informa de las diferencias. Con --aplicar AÑADE lo que falta (entrenos, goles, plantilla, estados...)
// y NUNCA borra ni sobrescribe nada de lo que ya hay en Firebase. Escribe con PUT condicional (etag).
import fs from "node:fs";
const FB = "https://juncal-f0b64-default-rtdb.europe-west1.firebasedatabase.app";
const { FBKEY, FBMAIL, FBPASS } = process.env;
const [nodo, archivo, flag] = process.argv.slice(2), APLICAR = flag === "--aplicar";
const r0 = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FBKEY}`,
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: FBMAIL, password: FBPASS, returnSecureToken: true }) });
const tok = (await r0.json()).idToken; if (!tok) { console.error("Login Firebase fallido"); process.exit(1); }
const obj = x => x == null ? {} : (typeof x === "string" ? JSON.parse(x) : x);
const copia = obj(JSON.parse(fs.readFileSync(archivo, "utf8")));
const g = await fetch(`${FB}/${nodo}.json?auth=${tok}`, { headers: { "X-Firebase-ETag": "true" } });
const etag = g.headers.get("etag"), S = obj(await g.json());
console.log("EN FIREBASE AHORA:", Object.keys(S).join(", "));
console.log(" · entrenos (fechas):", Object.keys(S.ent || {}).join(", ") || "(ninguna)");
console.log(" · jugadores en plantilla:", (S.pl || []).length, "· partidos:", Object.keys(S.m || {}).length);
console.log("EN LA COPIA:", Object.keys(copia).join(", "), "· entrenos:", Object.keys(copia.ent || {}).join(", "));
let cambios = 0; const log = [];
// añade a destino lo que le falta de origen (objetos: recursivo; listas de texto: elementos que faltan; valores sueltos: solo si no existe)
function mezcla(dest, orig, ruta) {
  for (const [k, v] of Object.entries(orig)) {
    if (dest[k] === undefined || dest[k] === null) { dest[k] = v; cambios++; log.push("+ " + ruta + "/" + k); }
    else if (v && typeof v === "object" && !Array.isArray(v) && typeof dest[k] === "object" && !Array.isArray(dest[k])) mezcla(dest[k], v, ruta + "/" + k);
    else if (Array.isArray(v) && Array.isArray(dest[k]) && v.every(x => typeof x === "string")) for (const x of v) if (!dest[k].includes(x)) { dest[k].push(x); cambios++; log.push("+ " + ruta + "/" + k + " · " + x); }
  }
}
for (const campo of ["ent", "pl", "dn", "estado", "off", "cp", "av", "pos"]) {
  if (copia[campo] === undefined) continue;
  if (S[campo] === undefined) { S[campo] = Array.isArray(copia[campo]) ? [] : {}; }
  mezcla({ x: S[campo] }, { x: copia[campo] }, campo);
}
// partidos: solo goles, minutos, directo y datos propios que falten (no se tocan fecha/hora/campo/resultado que ya trae la RFFM)
for (const [k, m] of Object.entries(copia.m || {})) {
  S.m ||= {}; const d = S.m[k] ||= {};
  for (const c of ["g", "gm", "c"]) if (m[c] !== undefined) { if (d[c] === undefined) { d[c] = m[c]; cambios++; log.push(`+ m/${k}/${c}`); } else if (typeof m[c] === "object") mezcla(d[c], m[c], `m/${k}/${c}`); }
}
console.log(cambios ? "FALTAN EN FIREBASE:\n" + log.join("\n") : "No falta nada: Firebase ya tiene todo lo de la copia.");
if (APLICAR && cambios) {
  S.u = Date.now();
  const p = await fetch(`${FB}/${nodo}.json?auth=${tok}`, { method: "PUT", headers: etag ? { "if-match": etag } : {}, body: JSON.stringify(JSON.stringify(S)) });
  console.log(p.ok ? `✓ RECUPERADO: ${cambios} datos añadidos` : "ERROR al guardar: " + p.status + (p.status === 412 ? " (alguien escribió a la vez; vuelve a ejecutar)" : ""));
  if (!p.ok) process.exit(1);
}
