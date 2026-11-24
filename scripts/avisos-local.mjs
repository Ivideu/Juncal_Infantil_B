// scripts/avisos-local.mjs — avisos push de la competición local (Ayuntamiento de Torrejón)
// Compara los datos actuales (datos-local/*.json + resultados anotados por los entrenadores en Firebase)
// con datos-local/avisos-estado.json y avisa por equipo del Juncal (tema «juncal-local-<cat>-<equipo>») cuando:
//   · un partido ya tiene día, hora y pabellón        · cambia el día, la hora o el pabellón        · aparece el resultado
// La primera vez solo guarda el estado (no envía nada). Lo lanza sync-local.yml después de leer los PDF.
import fs from "node:fs";
const FB = "https://juncal-f0b64-default-rtdb.europe-west1.firebasedatabase.app";
const { FCM_SERVICE_ACCOUNT } = process.env;
const CATS = [["cadete", "Cadete"], ["infantil", "Infantil"], ["alevin", "Alevín"], ["benjamin", "Benjamín"], ["prebenjamin", "Prebenjamín"]];
const ESJ = n => /jun?cal/i.test(n || "");
const nrm = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const ESTADO = "datos-local/avisos-estado.json";
const hoy = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
const hace7 = new Date(Date.now() - 7 * 864e5).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
const diaES = f => { const t = new Date(f + "T12:00:00Z").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }); return t[0].toUpperCase() + t.slice(1); };
const campoTxt = c => { const m = String(c || "").match(/nuria[^\d]*(\d)/i); return /nuria/i.test(c || "") ? "Nuria Fernández" + (m ? " · Pab. " + m[1] : "") : String(c || ""); };

let manual = {}, manualOk = true;
try { const r = await fetch(FB + "/local_res.json", { cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status); manual = (await r.json()) || {}; } catch (e) { manualOk = false; console.log("Sin resultados manuales (se conservan los anteriores):", String(e)); }

const hayEstado = fs.existsSync(ESTADO);
const prev = hayEstado ? JSON.parse(fs.readFileSync(ESTADO, "utf8")) : {};
const nuevo = {}, avisos = [];
for (const [cat, nombreCat] of CATS) {
  let d; try { d = JSON.parse(fs.readFileSync(`datos-local/${cat}.json`, "utf8")); } catch { continue; }
  for (const j of d.jornadas || []) for (const p of j.partidos || []) {
    const eqs = [p.local, p.visitante].filter(ESJ); if (!eqs.length) continue;
    const k = [cat, j.n, nrm(p.local), nrm(p.visitante)].join("|");
    const man = (manual[cat] || {})[j.n + "_" + nrm(p.local) + "_" + nrm(p.visitante)];
    const usaMan = man && Number.isInteger(man.ga) && Number.isInteger(man.gb) && (p.ga == null || p.ini);
    const ga = usaMan ? man.ga : (p.ga ?? null), gb = usaMan ? man.gb : (p.gb ?? null);
    const completo = !!(p.fecha && p.hora && p.campo);
    const f = p.fecha ? [p.fecha, p.hora || "", p.campo || ""].join("|") : "", r = ga != null && gb != null ? `${ga}-${gb}` : "";
    const a = prev[k] || { f: "", r: "", c: false };
    const rr = r || (!manualOk ? a.r : "");   // si Firebase no responde, no «olvidamos» resultados ya avisados
    nuevo[k] = { f, r: rr, c: completo };
    if (!hayEstado) continue;
    const base = { cat, nombreCat, j: j.n, p, eqs };
    if (r && !a.r && p.fecha >= hace7) avisos.push({ ...base, tipo: "final", ga, gb });
    else if (!r && completo && p.fecha >= hoy) {
      if (!a.c) avisos.push({ ...base, tipo: "hora" });
      else if (a.f && a.f !== f) avisos.push({ ...base, tipo: "cambio" });
    }
  }
}
console.log(`Avisos locales: ${avisos.length} pendientes${hayEstado ? "" : " (primera ejecución: solo se guarda el estado)"}`);

let ok = true;
if (avisos.length) {
  if (!FCM_SERVICE_ACCOUNT) { console.log("Falta el secret FCM_SERVICE_ACCOUNT; se envían cuando exista:", JSON.stringify(avisos.map(x => x.tipo + " " + x.cat + " J" + x.j))); ok = false; }
  else {
    const { createSign } = await import("node:crypto");
    const b64u = b => Buffer.from(b).toString("base64url");
    try {
      const sa = JSON.parse(FCM_SERVICE_ACCOUNT), now = Math.floor(Date.now() / 1000);
      const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" })), body = b64u(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
      const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(sa.private_key, "base64url");
      const o = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${sig}` }) })).json();
      if (!o.access_token) throw new Error("OAuth FCM: " + JSON.stringify(o));
      for (const x of avisos.slice(0, 20)) {
        const { p } = x, vs = `${p.local} vs ${p.visitante}`;
        const title = x.tipo === "final" ? `🏁 ${x.nombreCat} local: final del partido` : x.tipo === "hora" ? `⚽ ${x.nombreCat} local: ¡ya hay día, hora y pabellón!` : `⚠️ ${x.nombreCat} local: cambio de día, hora o pabellón`;
        const text = x.tipo === "final" ? `${p.local} ${x.ga} - ${x.gb} ${p.visitante}` : `${vs} · ${diaES(p.fecha)} · ${p.hora} h · ${campoTxt(p.campo)}`;
        for (const eq of x.eqs) {
          const topic = `juncal-local-${x.cat}-${nrm(eq)}`;
          const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, { method: "POST", headers: { Authorization: `Bearer ${o.access_token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ message: { topic, notification: { title, body: text }, data: { competicion: "local", categoria: x.cat, jornada: String(x.j) }, android: { priority: "HIGH", notification: { channel_id: "default" } } } }) });
          console.log(res.ok ? "enviado" : "ERROR " + res.status + " " + await res.text(), topic, "|", title, "|", text);
          if (!res.ok) ok = false;
        }
      }
    } catch (e) { console.error("No se pudo enviar el aviso push:", String(e)); ok = false; }
  }
}
// Si algo falló, el estado no se actualiza: se reintentará en la siguiente ejecución
if (ok || !avisos.length) fs.writeFileSync(ESTADO, JSON.stringify(nuevo, null, 1));
