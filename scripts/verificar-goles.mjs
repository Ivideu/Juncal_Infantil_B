// scripts/verificar-goles.mjs — copia de seguridad y comprobación de los datos de una categoría en Firebase.
//   node scripts/verificar-goles.mjs copia <nodo> <archivo.json>      guarda el nodo tal cual está (por si hay que volver atrás)
//   node scripts/verificar-goles.mjs comprobar <nodo> <archivo.json>  compara el nodo actual con esa copia
// Comprueba que NO ha cambiado nada de lo que escribe el entrenador: goles y minutos de cada jugador en cada partido
// (m.g, m.gm), directos (m.c), plantilla (pl, dn, off, cp, ent, estado...) y cualquier otro dato.
// Solo se permite que cambie lo que trae la RFFM: fecha, hora, pabellón y resultado (d, t, p, h, a) y la configuración (cfg, u).
// Si algo no coincide, restaura la copia y termina con error.
import fs from "node:fs";
const FB = "https://juncal-f0b64-default-rtdb.europe-west1.firebasedatabase.app";
const { FBKEY, FBMAIL, FBPASS } = process.env;
const [modo, nodo, archivo] = process.argv.slice(2);
if (!modo || !nodo || !archivo) { console.error("Uso: verificar-goles.mjs copia|comprobar <nodo> <archivo>"); process.exit(2); }
const r0 = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FBKEY}`,
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: FBMAIL, password: FBPASS, returnSecureToken: true }) });
const tok = (await r0.json()).idToken;
if (!tok) { console.error("Login Firebase fallido"); process.exit(1); }
const leer = async () => { const g = await fetch(`${FB}/${nodo}.json?auth=${tok}`); if (!g.ok) throw new Error("No se pudo leer " + nodo + ": " + g.status); return g.json(); };
const aObj = raw => raw == null ? null : (typeof raw === "string" ? JSON.parse(raw) : raw);
const goles = S => { let t = 0; for (const m of Object.values((S && S.m) || {})) { for (const v of Object.values((m && m.g) || {})) t += +v || 0; } return t; };
const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

if (modo === "copia") {
  const raw = await leer();
  fs.writeFileSync(archivo, JSON.stringify({ nodo, guardado: new Date().toISOString(), raw }, null, 1));
  const S = aObj(raw);
  console.log(`Copia de «${nodo}» guardada en ${archivo} · partidos: ${Object.keys((S && S.m) || {}).length} · goles de jugadores: ${goles(S)}`);
  process.exit(0);
}

const { raw: rawAntes } = JSON.parse(fs.readFileSync(archivo, "utf8"));
const A = aObj(rawAntes) || {}, D = aObj(await leer()) || {};
const fallos = [];
const PERMITIDO_TOP = new Set(["cfg", "u", "m"]), PERMITIDO_M = new Set(["d", "t", "p", "h", "a"]);
for (const k of new Set([...Object.keys(A), ...Object.keys(D)])) if (!PERMITIDO_TOP.has(k) && !igual(A[k], D[k])) fallos.push(`campo «${k}» distinto`);
for (const [k, m] of Object.entries(A.m || {})) {
  const n = (D.m || {})[k];
  if (!n) { fallos.push(`partido ${k} desaparecido`); continue; }
  for (const c of new Set([...Object.keys(m), ...Object.keys(n)])) if (!PERMITIDO_M.has(c) && !igual(m[c], n[c])) fallos.push(`partido ${k}: «${c}» distinto`);
}
if (goles(D) !== goles(A)) fallos.push(`goles de jugadores: antes ${goles(A)}, ahora ${goles(D)}`);
if (fallos.length) {
  console.error("¡NO COINCIDE! " + fallos.slice(0, 20).join(" · ") + " → restauro la copia");
  const p = await fetch(`${FB}/${nodo}.json?auth=${tok}`, { method: "PUT", body: JSON.stringify(typeof rawAntes === "string" ? rawAntes : JSON.stringify(rawAntes)) });
  console.error(p.ok ? "Copia restaurada" : "NO SE PUDO RESTAURAR: " + p.status + " (la copia está en " + archivo + ")");
  process.exit(1);
}
const nuevos = Object.keys(D.m || {}).length - Object.keys(A.m || {}).length;
console.log(`✓ Todo igual: goles de jugadores ${goles(A)} → ${goles(D)}, plantilla y directos intactos (partidos nuevos con fecha/hora/resultado: ${nuevos}).`);
