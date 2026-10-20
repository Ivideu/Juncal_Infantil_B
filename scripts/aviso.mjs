// scripts/aviso.mjs — envía una notificación push a todos los móviles con la app (tema "juncal")
// Lo lanza el workflow aviso.yml cuando pulsas "Fin 1ª parte" o "Final" en el directo.
const { FCM_SERVICE_ACCOUNT, TITULO, TEXTO } = process.env;
const TEMA = ["juncal", "pruebas"].includes(process.env.TEMA) ? process.env.TEMA : "juncal";   // "pruebas" = solo dispositivos del entrenador
if (!FCM_SERVICE_ACCOUNT || !TITULO) { console.error("Falta FCM_SERVICE_ACCOUNT o TITULO"); process.exit(1); }
const b64u = b => Buffer.from(b).toString("base64url");
const { createSign } = await import("node:crypto");
const sa = JSON.parse(FCM_SERVICE_ACCOUNT);
const now = Math.floor(Date.now() / 1000);
const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
const body = b64u(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
  aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(sa.private_key, "base64url");
const o = await fetch("https://oauth2.googleapis.com/token", { method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${sig}` }) });
const d = await o.json();
if (!d.access_token) { console.error("OAuth FCM:", JSON.stringify(d)); process.exit(1); }
const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, { method: "POST",
  headers: { Authorization: `Bearer ${d.access_token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ message: { topic: TEMA, notification: { title: TITULO, body: TEXTO || "" },
    android: { priority: "HIGH", notification: { channel_id: "default" } } } }) });
console.log(r.ok ? "Aviso enviado a «" + TEMA + "»:" : "ERROR " + r.status + " " + await r.text(), TITULO, "|", TEXTO);
if (!r.ok) process.exit(1);
