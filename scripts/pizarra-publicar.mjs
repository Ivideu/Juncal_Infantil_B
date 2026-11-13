// Publica en el repositorio (carpeta Pizarra/<categoría>/) los vídeos que los entrenadores
// dejan en la cola de Firebase, y borra los que han pedido eliminar.
//   node scripts/pizarra-publicar.mjs publicar   -> escribe archivos en Pizarra/ (el workflow los sube)
//   node scripts/pizarra-publicar.mjs esperar    -> espera a que GitHub Pages ya sirva lo publicado/borrado
//   node scripts/pizarra-publicar.mjs limpiar    -> vacía de la cola lo ya publicado (solo si ya está en la web)
import fs from "node:fs";
import path from "node:path";

const FB = process.env.FB_URL || "https://juncal-f0b64-default-rtdb.europe-west1.firebasedatabase.app";
const KEY = process.env.FB_KEY || "AIzaSyDXqBUkie30z_Cmyj__ayhzGYyYxZMrB3Q";
const IDT = process.env.IDT_URL || "https://identitytoolkit.googleapis.com";
const EMAIL = process.env.PIZARRA_BOT_EMAIL, PASS = process.env.PIZARRA_BOT_PASSWORD;
const OUT = process.env.PIZARRA_DIR || "Pizarra";
const HECHO = path.join(process.env.RUNNER_TEMP || process.env.TMPDIR || "/tmp", "pizarra-hecho.json");
const CATS = ["aficionado-a","aficionado-b","juvenil-a","juvenil-b","cadete-a","cadete-b","infantil-a","infantil-b","alevin-a","alevin-b"];
const ID_RE = /^[a-z0-9-]{3,90}$/;
const MAX_VIDEO = 12 * 1024 * 1024, MAX_SESION = 600 * 1024;

async function entrar() {
  if (!EMAIL || !PASS) throw new Error("Faltan los secretos PIZARRA_BOT_EMAIL y PIZARRA_BOT_PASSWORD");
  const r = await fetch(`${IDT}/v1/accounts:signInWithPassword?key=${KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS, returnSecureToken: true }),
  });
  const d = await r.json();
  if (!d.idToken) throw new Error("No se pudo entrar con el usuario publicador: " + JSON.stringify(d.error || d));
  return d.idToken;
}
const url = (tok, p, q = "") => `${FB}/${p}.json?auth=${tok}${q}`;
async function get(tok, p, q) {
  const r = await fetch(url(tok, p, q));
  if (!r.ok) throw new Error(`GET ${p}: ${r.status}`);
  return r.json();
}
async function del(tok, p) {
  const r = await fetch(url(tok, p), { method: "DELETE" });
  if (!r.ok) throw new Error(`DELETE ${p}: ${r.status}`);
}
// Las reglas dan lectura por categoría (pizarra_meta/<cat>), no del nodo completo: se lee categoría a categoría.
async function porCategoria(tok, nodo) {
  const out = {};
  for (const cat of CATS) {
    const v = await get(tok, `${nodo}/${cat}`);
    if (v && typeof v === "object" && Object.keys(v).length) out[cat] = v;
  }
  return out;
}
const leerIndex = (cat) => {
  try { const a = JSON.parse(fs.readFileSync(path.join(OUT, cat, "index.json"), "utf8")); return Array.isArray(a) ? a : []; } catch { return []; }
};
const guardarIndex = (cat, arr) => {
  arr.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  fs.mkdirSync(path.join(OUT, cat), { recursive: true });
  fs.writeFileSync(path.join(OUT, cat, "index.json"), JSON.stringify(arr, null, 2) + "\n");
};
const formatoOk = (buf, ext) =>
  ext === "webm" ? buf.length > 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3
  : ext === "mp4" ? buf.length > 12 && buf.slice(4, 8).toString() === "ftyp" : false;

async function publicar() {
  const tok = await entrar();
  const hecho = { cola: [], borrar: [], pub: [], del: [] };
  const meta = await porCategoria(tok, "pizarra_meta");
  const cambiados = new Set();

  for (const cat of Object.keys(meta)) {
    for (const key of Object.keys(meta[cat] || {})) {
      if (!ID_RE.test(key)) { console.log("Id no válido, se descarta:", key); hecho.cola.push([cat, key]); continue; }
      const it = await get(tok, `pizarra_cola/${cat}/${key}`);
      if (!it) { console.log("Sin datos (se limpia el aviso):", cat, key); hecho.cola.push([cat, key]); continue; }
      try {
        const ext = it.ext === "mp4" ? "mp4" : "webm";
        const buf = Buffer.from(String(it.video || ""), "base64");
        if (buf.length > MAX_VIDEO) throw new Error("vídeo demasiado grande");
        if (!formatoOk(buf, ext)) throw new Error("el archivo no es un vídeo " + ext);
        let sesion = String(it.sesion || "");
        if (sesion.length > MAX_SESION) throw new Error("sesión demasiado grande");
        if (sesion) JSON.parse(sesion);
        const dir = path.join(OUT, cat);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${key}.${ext}`), buf);
        if (sesion) fs.writeFileSync(path.join(dir, `${key}.json`), sesion);
        const idx = leerIndex(cat).filter((j) => j.id !== key);
        idx.push({
          id: key,
          titulo: String(it.titulo || "Jugada").slice(0, 80),
          fecha: isNaN(Date.parse(it.fecha)) ? new Date().toISOString() : new Date(it.fecha).toISOString(),
          video: `${key}.${ext}`,
          sesion: sesion ? `${key}.json` : "",
        });
        guardarIndex(cat, idx);
        cambiados.add(cat);
        hecho.pub.push([cat, key]);
        console.log("Publicada:", cat, key, (buf.length / 1048576).toFixed(2) + " MB");
      } catch (e) {
        console.log("Descartada:", cat, key, "->", e.message);
      }
      hecho.cola.push([cat, key]);
    }
  }

  const borrar = await porCategoria(tok, "pizarra_borrar");
  for (const cat of Object.keys(borrar)) {
    for (const id of Object.keys(borrar[cat] || {})) {
      if (ID_RE.test(id)) {
        for (const ext of ["webm", "mp4", "json"]) fs.rmSync(path.join(OUT, cat, `${id}.${ext}`), { force: true });
        guardarIndex(cat, leerIndex(cat).filter((j) => j.id !== id));
        cambiados.add(cat);
        hecho.del.push([cat, id]);
        console.log("Borrada:", cat, id);
      }
      hecho.borrar.push([cat, id]);
    }
  }
  fs.writeFileSync(HECHO, JSON.stringify(hecho));
  console.log(`Listo: ${hecho.cola.length} de la cola, ${hecho.borrar.length} borrados, categorías tocadas: ${[...cambiados].join(", ") || "ninguna"}`);
}

// Hasta que GitHub Pages no sirve el index.json nuevo, la jugada sigue visible desde Firebase.
// Solo se limpia Firebase cuando la web ya la tiene (o ya no la tiene, si era un borrado).
async function esperar() {
  if (!fs.existsSync(HECHO)) return;
  const hecho = JSON.parse(fs.readFileSync(HECHO, "utf8"));
  const pend = [...(hecho.pub || []).map(([c, id]) => [c, id, true]), ...(hecho.del || []).map(([c, id]) => [c, id, false])];
  if (!pend.length) return;
  const base = (process.env.PAGES_URL || "").replace(/\/?$/, "/");
  if (base === "/") throw new Error("Falta PAGES_URL");
  const limite = Date.now() + (Number(process.env.ESPERA_MIN) || 10) * 60000;
  const falta = new Set(pend.map((p) => p.join("|")));
  while (falta.size) {
    for (const key of [...falta]) {
      const [c, id, quiere] = key.split("|");
      try {
        const r = await fetch(`${base}Pizarra/${c}/index.json?t=${Date.now()}`, { cache: "no-store" });
        const arr = r.ok ? await r.json() : [];
        const esta = Array.isArray(arr) && arr.some((j) => j.id === id);
        if (esta === (quiere === "true")) falta.delete(key);
      } catch {}
    }
    if (!falta.size) break;
    if (Date.now() > limite) throw new Error("GitHub Pages aún no sirve: " + [...falta].join(", "));
    await new Promise((r) => setTimeout(r, Number(process.env.ESPERA_PASO_MS) || 15000));
  }
  console.log("La web ya sirve los cambios");
}

async function limpiar() {
  if (!fs.existsSync(HECHO)) { console.log("Nada que limpiar"); return; }
  const hecho = JSON.parse(fs.readFileSync(HECHO, "utf8"));
  if (!hecho.cola.length && !hecho.borrar.length) { console.log("Nada que limpiar"); return; }
  const tok = await entrar();
  for (const [c, k] of hecho.cola) { await del(tok, `pizarra_cola/${c}/${k}`); await del(tok, `pizarra_meta/${c}/${k}`); }
  for (const [c, k] of hecho.borrar) await del(tok, `pizarra_borrar/${c}/${k}`);
  console.log("Cola limpiada");
}

const modo = process.argv[2];
if (modo === "publicar") await publicar();
else if (modo === "esperar") await esperar();
else if (modo === "limpiar") await limpiar();
else { console.error("Uso: node scripts/pizarra-publicar.mjs publicar|esperar|limpiar"); process.exit(1); }
