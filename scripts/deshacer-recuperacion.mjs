// scripts/deshacer-recuperacion.mjs — quita de Firebase SOLO lo que añadió la recuperación del 21/11 (nombres con dorsal duplicados).
//   node scripts/deshacer-recuperacion.mjs <nodo> <estado-antes.json> <copia-aportada.json>
// Un dato se quita únicamente si: está en la copia aportada, NO estaba en el estado de antes de recuperar y sigue valiendo lo mismo ahora.
import fs from "node:fs";
const FB = "https://juncal-f0b64-default-rtdb.europe-west1.firebasedatabase.app";
const { FBKEY, FBMAIL, FBPASS } = process.env;
const [nodo, fAntes, fCopia] = process.argv.slice(2);
const obj = x => x == null ? {} : (typeof x === "string" ? JSON.parse(x) : x);
const antes = obj(JSON.parse(fs.readFileSync(fAntes, "utf8")).raw), copia = obj(JSON.parse(fs.readFileSync(fCopia, "utf8")));
const r0 = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FBKEY}`,
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: FBMAIL, password: FBPASS, returnSecureToken: true }) });
const tok = (await r0.json()).idToken; if (!tok) { console.error("Login Firebase fallido"); process.exit(1); }
const g = await fetch(`${FB}/${nodo}.json?auth=${tok}`, { headers: { "X-Firebase-ETag": "true" } });
const etag = g.headers.get("etag"), S = obj(await g.json());
const goles = X => { let t = 0; for (const m of Object.values(X.m || {})) for (const v of Object.values(m.g || {})) t += +v || 0; return t; };
console.log(`Goles de jugadores ahora: ${goles(S)} · antes de la recuperación: ${goles(antes)}`);
const quita = []; const j = JSON.stringify;
// plantilla: nombres con dorsal («1-Rubén») que añadió la recuperación
S.pl = (S.pl || []).filter(x => { const mio = (copia.pl || []).includes(x) && !(antes.pl || []).includes(x); if (mio) quita.push("pl · " + x); return !mio; });
for (const campo of ["dn", "off"]) for (const k of Object.keys(S[campo] || {})) if ((copia[campo] || {})[k] !== undefined && (antes[campo] || {})[k] === undefined && j(S[campo][k]) === j(copia[campo][k])) { delete S[campo][k]; quita.push(`${campo} · ${k}`); }
for (const [k, m] of Object.entries(copia.m || {})) for (const c of ["g", "gm"]) for (const n of Object.keys(m[c] || {}))
  if (((S.m || {})[k] || {})[c] && S.m[k][c][n] !== undefined && ((antes.m || {})[k] || {})[c]?.[n] === undefined && j(S.m[k][c][n]) === j(m[c][n])) { delete S.m[k][c][n]; quita.push(`m/${k}/${c} · ${n}`); }
console.log(quita.length ? "QUITO:\n" + quita.join("\n") : "No hay nada que quitar.");
console.log(`Goles tras quitar: ${goles(S)}`);
if (quita.length) {
  S.u = Date.now();
  const p = await fetch(`${FB}/${nodo}.json?auth=${tok}`, { method: "PUT", headers: etag ? { "if-match": etag } : {}, body: j(j(S)) });
  console.log(p.ok ? `✓ Deshecho: ${quita.length} datos duplicados quitados` : "ERROR al guardar: " + p.status);
  if (!p.ok) process.exit(1);
}
