/* ZONA ENTRENADOR · Escuela Torrejón Juncal
   Se pone UNA línea en cada página de categoría (Categorias/XxxxX.html):
       <script src="../scripts/entrenador.js" defer></script>
   El equipo se deduce del nombre del archivo (InfantilA.html -> infantil-a).
   Opcional: <script src="../scripts/entrenador.js" data-equipo="infantil-a" defer></script>
   Opcional: <div id="zonaEntrenador"></div> donde quieras el botón (si no, flota abajo a la derecha)
   Opcional: <div id="convocadosPublico"></div> y <div id="goleadoresPublico"></div> para mostrar datos públicos
*/
(function () {
  "use strict";
  const FB = "https://juncal-f0b64-default-rtdb.europe-west1.firebasedatabase.app",
        KEY = "AIzaSyDXqBUkie30z_Cmyj__ayhzGYyYxZMrB3Q",
        DOM = "@torrejonjuncal.es"; // el usuario de Firebase de cada equipo es <equipo>@torrejonjuncal.es

  const sc = document.currentScript;
  const file = (location.pathname.split("/").pop() || "").replace(/\.html?$/i, "");
  const EQ = (sc && sc.dataset.equipo) || file.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  const NOMBRE = EQ.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  if (!EQ) return;

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (s, r) => (r || document).querySelector(s);
  const hoy = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") };
  const fmt = f => { const [y, m, d] = f.split("-"); return d + "/" + m + "/" + y };
  const dia = f => ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][new Date(f + "T12:00:00").getDay()];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const LS = { get(k) { try { return localStorage.getItem(k) } catch (e) { return null } }, set(k, v) { try { localStorage.setItem(k, v) } catch (e) {} }, del(k) { try { localStorage.removeItem(k) } catch (e) {} } };

  /* ---------- Firebase (REST) ---------- */
  let tok = "", exp = 0, rt = LS.get("zeRT_" + EQ) || "";
  const setTok = (id, refresh, secs) => { tok = id; exp = Date.now() + (+secs - 120) * 1000; if (refresh) { rt = refresh; LS.set("zeRT_" + EQ, rt) } };
  async function login(pw) {
    const r = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + KEY, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: EQ + DOM, password: pw, returnSecureToken: true }) });
    const d = await r.json();
    if (!d.idToken) return false;
    setTok(d.idToken, d.refreshToken, d.expiresIn); return true;
  }
  async function T() {
    if (tok && Date.now() < exp) return tok;
    if (rt) {
      try {
        const r = await fetch("https://securetoken.googleapis.com/v1/token?key=" + KEY, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(rt) });
        const d = await r.json();
        if (d.id_token) { setTok(d.id_token, d.refresh_token, d.expires_in); return tok }
      } catch (e) {}
    }
    throw new Error("auth");
  }
  async function api(path, method, body) {
    const t = await T();
    const r = await fetch(FB + "/" + path + ".json?auth=" + t, { method: method || "GET", body: body === undefined ? undefined : JSON.stringify(body) });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }
  const pub = async path => { try { const r = await fetch(FB + "/" + path + ".json"); return r.ok ? await r.json() : null } catch (e) { return null } };

  /* ---------- estado ---------- */
  let P = {}, A = {}, C = null, E = {}, NEXT = null; // plantilla, entrenos, convocatoria, estadísticas, próximo partido
  let tab = "ent", fecha = hoy(), rango = "todo", jsel = "", ver = "pl";
  const jug = () => Object.entries(P).map(([id, p]) => ({ id, n: p.n, d: p.d || "", a: p.a !== 0 })).sort((x, y) => x.n.localeCompare(y.n, "es"));
  const activos = () => jug().filter(p => p.a);
  const saveT = {};
  const later = (k, fn, ms) => { clearTimeout(saveT[k]); saveT[k] = setTimeout(fn, ms || 350) };

  /* ---------- estilos ---------- */
  const css = document.createElement("style");
  css.textContent = `
.ze-fab{position:fixed;right:16px;bottom:16px;z-index:9998;border:0;border-radius:999px;padding:12px 18px;font:700 15px/1 system-ui,sans-serif;background:#0f2a6b;color:#ffd23f;box-shadow:0 6px 18px rgba(0,0,0,.35);cursor:pointer}
.ze-btn{border:0;border-radius:999px;padding:12px 18px;font:700 15px/1 system-ui,sans-serif;background:#0f2a6b;color:#ffd23f;cursor:pointer}
.ze-ov{position:fixed;inset:0;z-index:9999;background:rgba(5,10,35,.72);display:none;align-items:flex-end;justify-content:center}
.ze-ov.on{display:flex}
.ze{width:min(760px,100%);height:min(94vh,900px);background:#f4f6fc;color:#10163a;border-radius:20px 20px 0 0;display:flex;flex-direction:column;font:15px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;overflow:hidden}
@media(min-width:800px){.ze-ov{align-items:center}.ze{border-radius:20px}}
.ze *{box-sizing:border-box}
.ze-h{display:flex;align-items:center;gap:10px;padding:14px 16px;background:#0f2a6b;color:#fff}
.ze-h b{font-size:17px;flex:1}.ze-h small{color:#ffd23f;font-weight:600}
.ze-h button{background:rgba(255,255,255,.15);color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer}
.ze-tabs{display:flex;background:#fff;border-bottom:1px solid #dde3f3;overflow-x:auto}
.ze-tabs button{flex:1;min-width:92px;border:0;background:none;padding:12px 8px;font:700 13px system-ui;color:#5a6697;cursor:pointer;border-bottom:3px solid transparent}
.ze-tabs button.on{color:#0f2a6b;border-color:#ffb81c}
.ze-b{flex:1;overflow:auto;padding:14px 16px 26px}
.ze-c{background:#fff;border-radius:14px;padding:12px 14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(15,42,107,.12)}
.ze-r{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #eef1fa}
.ze-r:last-child{border:0}
.ze-r .nm{flex:1;font-weight:700}.ze-r .nm i{font-style:normal;color:#8591bb;font-weight:600;margin-right:6px}
.ze-t{display:flex;gap:6px}
.ze-t button{min-width:54px;border:2px solid #cfd7ee;background:#fff;color:#5a6697;border-radius:10px;padding:9px 10px;font:800 14px system-ui;cursor:pointer}
.ze-t button.s.on{background:#1c9c53;border-color:#1c9c53;color:#fff}
.ze-t button.n.on{background:#d6334a;border-color:#d6334a;color:#fff}
.ze-ct{display:flex;align-items:center;gap:6px}
.ze-ct button{width:34px;height:34px;border-radius:9px;border:2px solid #cfd7ee;background:#fff;font:800 18px system-ui;cursor:pointer}
.ze-ct b{min-width:18px;text-align:center}
.ze input,.ze select,.ze textarea{font:inherit;border:2px solid #cfd7ee;border-radius:10px;padding:10px 12px;background:#fff;color:inherit;max-width:100%}
.ze textarea{width:100%;min-height:110px}
.ze label{font-weight:700;font-size:13px;color:#5a6697;display:block;margin:0 0 4px}
.ze-p{background:#0f2a6b;color:#fff;border:0;border-radius:10px;padding:11px 16px;font-weight:800;cursor:pointer}
.ze-g{background:#e8ecf9;color:#0f2a6b;border:0;border-radius:10px;padding:9px 13px;font-weight:700;cursor:pointer}
.ze-m{color:#5a6697;font-size:13px}
.ze table{width:100%;border-collapse:collapse}.ze th,.ze td{padding:8px 6px;text-align:center;border-bottom:1px solid #eef1fa;font-size:14px}.ze th{font-size:12px;color:#5a6697}.ze td:first-child,.ze th:first-child{text-align:left}
.ze-bar{height:8px;border-radius:6px;background:#e3e8f7;overflow:hidden;min-width:60px}.ze-bar i{display:block;height:100%;background:linear-gradient(90deg,#ffb81c,#1c9c53)}
.ze-dots{display:inline-flex;gap:3px}.ze-dots i{width:9px;height:9px;border-radius:50%;background:#cfd7ee}.ze-dots i.s{background:#1c9c53}.ze-dots i.n{background:#d6334a}
.ze-pill{display:inline-block;padding:3px 9px;border-radius:999px;font-weight:800;font-size:12px}.ze-pill.s{background:#d8f3e3;color:#12703b}.ze-pill.n{background:#fbe0e4;color:#a1243a}
.ze-err{color:#d6334a;font-weight:700;margin-top:8px}
.ze-pub{font:15px/1.4 system-ui,sans-serif;background:#fff;border-radius:14px;padding:14px 16px;box-shadow:0 2px 8px rgba(15,42,107,.15);color:#10163a}
.ze-pub h3{margin:0 0 8px;color:#0f2a6b}.ze-pub .ch{display:inline-block;margin:3px 4px 3px 0;padding:5px 11px;background:#d8f3e3;color:#12703b;border-radius:999px;font-weight:700}
`;
  document.head.appendChild(css);

  /* ---------- contenedor ---------- */
  const ov = document.createElement("div");
  ov.className = "ze-ov";
  ov.innerHTML = '<div class="ze" role="dialog" aria-modal="true" aria-label="Zona entrenador"></div>';
  document.body.appendChild(ov);
  const box = $(".ze", ov);
  ov.addEventListener("click", e => { if (e.target === ov) cerrar() });
  document.addEventListener("keydown", e => { if (e.key === "Escape") cerrar() });
  const cerrar = () => ov.classList.remove("on");
  const abrir = () => { ov.classList.add("on"); LS.get("zeRT_" + EQ) || tok ? cargar() : vistaLogin() };

  const slot = $("#zonaEntrenador");
  const fab = document.createElement("button");
  fab.type = "button"; fab.textContent = "🔒 Zona entrenador"; fab.className = slot ? "ze-btn" : "ze-fab";
  fab.onclick = abrir;
  (slot || document.body).appendChild(fab);

  /* ---------- login ---------- */
  function vistaLogin(err) {
    box.innerHTML = `<div class="ze-h"><b>Zona entrenador <small>· ${esc(NOMBRE)}</small></b><button onclick="this.closest('.ze-ov').classList.remove('on')">Cerrar</button></div>
    <div class="ze-b"><div class="ze-c"><label for="zepw">Contraseña del equipo</label>
    <div style="display:flex;gap:8px"><input id="zepw" type="password" autocomplete="current-password" style="flex:1" placeholder="Contraseña"><button class="ze-p" id="zego">Entrar</button></div>
    ${err ? '<div class="ze-err">' + esc(err) + "</div>" : ""}</div>
    <p class="ze-m">Aquí solo entran los entrenadores de ${esc(NOMBRE)}. Se guarda solo el nombre de pila de cada jugador.</p></div>`;
    const go = async () => {
      const pw = $("#zepw", box).value; if (!pw) return;
      $("#zego", box).disabled = true;
      let ok = false; try { ok = await login(pw) } catch (e) {}
      ok ? cargar() : vistaLogin("Contraseña incorrecta o sin conexión.");
    };
    $("#zego", box).onclick = go; $("#zepw", box).onkeydown = e => { if (e.key === "Enter") go() };
    setTimeout(() => { const i = $("#zepw", box); i && i.focus() }, 50);
  }
  function salir() { tok = ""; rt = ""; exp = 0; LS.del("zeRT_" + EQ); cerrar() }

  /* ---------- carga ---------- */
  async function cargar() {
    box.innerHTML = '<div class="ze-b"><p class="ze-m">Cargando…</p></div>';
    try {
      const [p, a, c, e, j] = await Promise.all([api("equipos/" + EQ + "/plantilla"), api("entrenos/" + EQ), pub("convocatoria/" + EQ), pub("estadisticas/" + EQ), pub("juncal")]);
      P = p || {}; A = a || {}; C = c; E = e || {}; NEXT = null;
      try { const S = typeof j === "string" ? JSON.parse(j) : j; NEXT = ((S && S.px && S.px.partidos) || []).find(x => x.id === EQ) || null } catch (x) {}
      pintar();
    } catch (e) {
      if (e.message === "auth" || e.message === "401" || e.message === "403") { LS.del("zeRT_" + EQ); tok = ""; rt = ""; vistaLogin(e.message === "auth" ? "" : "Esta cuenta no tiene permiso en " + NOMBRE + ". Revisa las reglas de Firebase.") }
      else box.innerHTML = '<div class="ze-b"><div class="ze-err">No se pudo cargar. Comprueba la conexión.</div></div>';
    }
  }

  /* ---------- marco ---------- */
  function pintar() {
    const tabs = [["ent", "📋 Entreno"], ["res", "📊 Resumen"], ["con", "✅ Convocatoria"], ["par", "⚽ Partido"], ["pla", "👥 Plantilla"]];
    box.innerHTML = `<div class="ze-h"><b>Zona entrenador <small>· ${esc(NOMBRE)}</small></b><button id="zesal">Salir</button><button id="zecer">✕</button></div>
    <div class="ze-tabs">${tabs.map(([k, l]) => `<button data-t="${k}" class="${tab === k ? "on" : ""}">${l}</button>`).join("")}</div><div class="ze-b" id="zeb"></div>`;
    $("#zesal", box).onclick = salir; $("#zecer", box).onclick = cerrar;
    box.querySelectorAll(".ze-tabs button").forEach(b => b.onclick = () => { tab = b.dataset.t; pintar() });
    const b = $("#zeb", box);
    ({ ent: vEnt, res: vRes, con: vCon, par: vPar, pla: vPla })[tab](b);
  }
  const vacio = '<div class="ze-c ze-m">Aún no hay jugadores. Ve a la pestaña <b>Plantilla</b> y añade los nombres.</div>';
  const errSave = e => { alert(e && e.message === "403" ? "Sin permiso para guardar. Revisa las reglas de Firebase." : "No se pudo guardar. Revisa la conexión.") };

  /* ---------- ENTRENO ---------- */
  function vEnt(b) {
    const js = activos(), s = A[fecha] || {};
    const si = js.filter(p => s[p.id] === 1).length, no = js.filter(p => s[p.id] === 0).length;
    const ent = ["miércoles", "jueves"].includes(dia(fecha));
    b.innerHTML = `<div class="ze-c"><label for="zef">Día del entrenamiento</label>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input type="date" id="zef" value="${fecha}"><span class="ze-m">${cap(dia(fecha))}${ent ? "" : " · no es día habitual de entreno"}</span></div></div>
    ${js.length ? `<div class="ze-c"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b>${si} fueron · ${no} no fueron · ${js.length - si - no} sin marcar</b><button class="ze-g" id="zeall">✔ Todos</button></div>
    ${js.map(p => `<div class="ze-r"><span class="nm">${p.d ? "<i>" + esc(p.d) + "</i>" : ""}${esc(p.n)}</span><span class="ze-t" data-id="${p.id}"><button class="s ${s[p.id] === 1 ? "on" : ""}" data-v="1">Fue</button><button class="n ${s[p.id] === 0 ? "on" : ""}" data-v="0">No</button></span></div>`).join("")}</div>` : vacio}`;
    $("#zef", b).onchange = e => { if (e.target.value) { fecha = e.target.value; pintar() } };
    const all = $("#zeall", b);
    if (all) all.onclick = async () => { const o = {}; js.forEach(p => o[p.id] = 1); A[fecha] = Object.assign({}, A[fecha], o); pintar(); try { await api("entrenos/" + EQ + "/" + fecha, "PATCH", o) } catch (e) { errSave(e) } };
    b.querySelectorAll(".ze-t button").forEach(btn => btn.onclick = async () => {
      const id = btn.parentNode.dataset.id, v = +btn.dataset.v, cur = (A[fecha] || {})[id], nv = cur === v ? null : v;
      A[fecha] = A[fecha] || {}; if (nv === null) delete A[fecha][id]; else A[fecha][id] = nv;
      if (!Object.keys(A[fecha]).length) delete A[fecha];
      const y = b.scrollTop; pintar(); $("#zeb", box).scrollTop = y;
      try { await api("entrenos/" + EQ + "/" + fecha, "PATCH", { [id]: nv }) } catch (e) { errSave(e) }
    });
  }

  /* ---------- RESUMEN ---------- */
  function stats(r) {
    const lim = r === "mes" ? new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10) : "";
    const ds = Object.keys(A).filter(d => d >= lim).sort();
    return { ds, filas: activos().map(p => { let a = 0, f = 0; const hist = ds.map(d => { const v = (A[d] || {})[p.id]; if (v === 1) a++; else if (v === 0) f++; return v }); const t = a + f; return { p, a, f, t, pct: t ? Math.round(a * 100 / t) : null, hist } }) };
  }
  function vRes(b) {
    const { ds, filas } = stats(rango);
    b.innerHTML = `<div class="ze-c" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><label style="margin:0">Mostrar</label><select id="zer"><option value="todo" ${rango === "todo" ? "selected" : ""}>Toda la temporada</option><option value="mes" ${rango === "mes" ? "selected" : ""}>Últimos 30 días</option></select><span class="ze-m">${ds.length} entrenos registrados</span></div>
    ${filas.length ? `<div class="ze-c"><table><tr><th>Jugador</th><th>Fue</th><th>No</th><th>%</th><th>Últimos</th></tr>
    ${filas.slice().sort((x, y) => (y.pct ?? -1) - (x.pct ?? -1) || x.p.n.localeCompare(y.p.n, "es")).map(r => `<tr><td><b>${esc(r.p.n)}</b></td><td>${r.a}</td><td>${r.f}</td><td>${r.pct == null ? "–" : r.pct + "%"}<div class="ze-bar"><i style="width:${r.pct || 0}%"></i></div></td><td><span class="ze-dots">${r.hist.slice(-6).map(v => `<i class="${v === 1 ? "s" : v === 0 ? "n" : ""}"></i>`).join("")}</span></td></tr>`).join("")}</table></div>
    <p class="ze-m">Verde: fue · Rojo: no fue · Gris: sin marcar. Úsalo como ayuda para repartir los minutos del fin de semana.</p>` : vacio}`;
    $("#zer", b).onchange = e => { rango = e.target.value; pintar() };
  }

  /* ---------- CONVOCATORIA (pública: solo nombres de los convocados) ---------- */
  function vCon(b) {
    const js = activos(), conv = new Set((C && C.nombres) || []), st = stats("todo").filas;
    const pctOf = id => { const r = st.find(x => x.p.id === id); return r && r.pct != null ? r.pct + "%" : "–" };
    const sug = NEXT ? `Jornada ${NEXT.jornada} · ${NEXT.local} vs ${NEXT.visitante}${NEXT.fecha ? " · " + cap(dia(NEXT.fecha)) + " " + fmt(NEXT.fecha) : ""}` : "";
    b.innerHTML = `<div class="ze-c"><label for="zect">Partido</label><input id="zect" style="width:100%" value="${esc((C && C.titulo) || sug)}" placeholder="Ej: Jornada 5 · vs Rival · sábado 14/11">
    <p class="ze-m" style="margin:8px 0 0">Esto lo ven las familias: título y nombres de los convocados.</p></div>
    ${js.length ? `<div class="ze-c"><div style="margin-bottom:6px"><b id="zecn">${conv.size} convocados</b> <span class="ze-m">de ${js.length}</span></div>
    ${js.map(p => `<div class="ze-r"><span class="nm">${p.d ? "<i>" + esc(p.d) + "</i>" : ""}${esc(p.n)} <span class="ze-m">entreno ${pctOf(p.id)}</span></span><span class="ze-t" data-n="${esc(p.n)}"><button class="s ${conv.has(p.n) ? "on" : ""}" data-v="1">Sí</button><button class="n ${!conv.has(p.n) ? "on" : ""}" data-v="0">No</button></span></div>`).join("")}</div>
    <button class="ze-g" id="zecl">Borrar convocatoria publicada</button>` : vacio}`;
    const guardar = () => later("con", async () => {
      const nombres = [...conv].filter(n => js.some(p => p.n === n)).sort((x, y) => x.localeCompare(y, "es"));
      C = { titulo: $("#zect", b).value.trim(), nombres, u: Date.now() };
      try { await api("convocatoria/" + EQ, "PUT", C) } catch (e) { errSave(e) }
    });
    $("#zect", b).oninput = guardar;
    b.querySelectorAll(".ze-t button").forEach(btn => btn.onclick = () => {
      const n = btn.parentNode.dataset.n; +btn.dataset.v ? conv.add(n) : conv.delete(n);
      btn.parentNode.querySelector(".s").classList.toggle("on", conv.has(n)); btn.parentNode.querySelector(".n").classList.toggle("on", !conv.has(n));
      $("#zecn", b).textContent = [...conv].filter(x => js.some(p => p.n === x)).length + " convocados"; guardar();
    });
    const cl = $("#zecl", b); if (cl) cl.onclick = async () => { if (!confirm("¿Quitar la convocatoria publicada?")) return; try { await api("convocatoria/" + EQ, "DELETE") } catch (e) { return errSave(e) } C = null; pintar() };
  }

  /* ---------- PARTIDO: goles y tarjetas (solo del equipo) ---------- */
  function vPar(b) {
    const js = activos(), ks = Object.keys(E).sort((x, y) => (E[y].j || 0) - (E[x].j || 0));
    const cur = jsel && E[jsel] ? E[jsel] : null, jn = cur ? cur.j : "", num = jsel ? jsel.replace(/^j/, "") : "";
    const tot = {};
    ks.forEach(k => Object.values(E[k].jug || {}).forEach(x => { const t = tot[x.n] = tot[x.n] || { g: 0, a: 0, r: 0 }; t.g += x.g || 0; t.a += x.a || 0; t.r += x.r || 0 }));
    b.innerHTML = `<div class="ze-c"><label for="zej">Jornada</label>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><select id="zejs"><option value="">— elegir —</option>${ks.map(k => `<option value="${k}" ${k === jsel ? "selected" : ""}>Jornada ${E[k].j}${E[k].rival ? " · " + esc(E[k].rival) : ""}</option>`).join("")}</select>
    <input id="zej" type="number" min="1" max="60" placeholder="Nº jornada" value="${esc(num)}" style="width:120px"><input id="zerv" placeholder="Rival (opcional)" style="flex:1;min-width:140px" value="${esc(cur ? cur.rival || "" : "")}"></div></div>
    ${num && js.length ? `<div class="ze-c"><b>Goles y tarjetas · Jornada ${esc(num)}</b>
    ${js.map(p => { const x = (cur && cur.jug && cur.jug[p.id]) || {}; return `<div class="ze-r"><span class="nm">${p.d ? "<i>" + esc(p.d) + "</i>" : ""}${esc(p.n)}</span>${[["g", "⚽"], ["a", "🟨"], ["r", "🟥"]].map(([k, ic]) => `<span class="ze-ct" data-id="${p.id}" data-k="${k}"><button data-d="-1">−</button><b>${ic}${x[k] || 0}</b><button data-d="1">+</button></span>`).join("")}</div>` }).join("")}</div>`
      : js.length ? '<div class="ze-c ze-m">Elige una jornada o escribe su número para apuntar goles y tarjetas de tu equipo.</div>' : vacio}
    ${Object.keys(tot).length ? `<div class="ze-c"><b>Total de la temporada</b><table><tr><th>Jugador</th><th>⚽</th><th>🟨</th><th>🟥</th></tr>${Object.entries(tot).sort((x, y) => y[1].g - x[1].g || x[0].localeCompare(y[0], "es")).map(([n, t]) => `<tr><td>${esc(n)}</td><td>${t.g}</td><td>${t.a}</td><td>${t.r}</td></tr>`).join("")}</table></div>` : ""}`;
    $("#zejs", b).onchange = e => { jsel = e.target.value; pintar() };
    const abrirJ = () => { const n = +$("#zej", b).value; if (n > 0) { jsel = "j" + n; E[jsel] = E[jsel] || { j: n, rival: "", jug: {} }; pintar() } };
    $("#zej", b).onchange = abrirJ;
    $("#zerv", b).oninput = e => { if (!jsel) return; E[jsel].rival = e.target.value; guardaPar() };
    b.querySelectorAll(".ze-ct button").forEach(btn => btn.onclick = () => {
      if (!jsel) return; const w = btn.parentNode, id = w.dataset.id, k = w.dataset.k, p = js.find(q => q.id === id);
      const r = E[jsel]; r.jug = r.jug || {}; const x = r.jug[id] = r.jug[id] || { n: p.n, g: 0, a: 0, r: 0 };
      x[k] = Math.max(0, (x[k] || 0) + +btn.dataset.d); x.n = p.n;
      if (!x.g && !x.a && !x.r) delete r.jug[id];
      const y = $("#zeb", box).scrollTop; guardaPar(); pintar(); $("#zeb", box).scrollTop = y;
    });
  }
  function guardaPar() { const k = jsel; later("par" + k, async () => { if (!E[k]) return; try { await api("estadisticas/" + EQ + "/" + k, "PUT", E[k]) } catch (e) { errSave(e) } }) }

  /* ---------- PLANTILLA (solo el nombre de pila) ---------- */
  const limpia = s => s.replace(/[.$#\[\]\/]/g, "").trim();
  const nombrePila = t => { let s = t.trim(); if (s.includes(",")) s = s.split(",").slice(1).join(" ").trim() || s.split(",")[0]; s = limpia(s).split(/\s+/)[0] || ""; return s ? s.charAt(0).toLocaleUpperCase("es") + s.slice(1).toLocaleLowerCase("es") : "" };
  function parse(txt) {
    const out = [];
    txt.split(/[\n;]+/).forEach(l => { l = l.trim(); if (!l) return; let d = ""; const m = l.match(/^#?(\d{1,2})[\s.\-–]+(.+)$/); if (m) { d = m[1]; l = m[2] } const n = nombrePila(l); if (n) out.push({ n, d }) });
    return out;
  }
  function vPla(b) {
    const js = jug();
    b.innerHTML = `<div class="ze-c"><label for="zept">Añadir jugadores (uno por línea)</label>
    <textarea id="zept" placeholder="7 Ana&#10;Luis&#10;GARCIA LOPEZ, PABLO"></textarea>
    <p class="ze-m">Por protección de datos solo se guarda el <b>nombre de pila</b>: si pegas «APELLIDOS, NOMBRE» o nombre y apellidos, se queda solo el nombre. Con número delante se guarda el dorsal.</p>
    <button class="ze-p" id="zepa">＋ Añadir</button></div>
    ${js.length ? `<div class="ze-c">${js.map(p => `<div class="ze-r" style="${p.a ? "" : "opacity:.5"}"><span class="nm"><input data-d="${p.id}" value="${esc(p.d)}" placeholder="Nº" inputmode="numeric" maxlength="2" style="width:58px;margin-right:8px;padding:6px 8px">${esc(p.n)}</span>
    <button class="ze-g" data-a="${p.id}">${p.a ? "Activo" : "Inactivo"}</button><button class="ze-g" data-x="${p.id}">Borrar</button></div>`).join("")}</div>` : ""}`;
    $("#zepa", b).onclick = async () => {
      const nuevos = parse($("#zept", b).value); if (!nuevos.length) return;
      const upd = {}, usados = new Set(js.map(p => p.n.toLowerCase()));
      nuevos.forEach(x => { let n = x.n, i = 2; while (usados.has(n.toLowerCase())) n = x.n + " " + i++; usados.add(n.toLowerCase()); upd["p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)] = { n, d: x.d, a: 1 } });
      Object.assign(P, upd); pintar();
      try { await api("equipos/" + EQ + "/plantilla", "PATCH", upd) } catch (e) { errSave(e) }
    };
    b.querySelectorAll("[data-a]").forEach(x => x.onclick = async () => { const id = x.dataset.a, v = P[id].a === 0 ? 1 : 0; P[id].a = v; pintar(); try { await api("equipos/" + EQ + "/plantilla/" + id + "/a", "PUT", v) } catch (e) { errSave(e) } });
    b.querySelectorAll("[data-x]").forEach(x => x.onclick = async () => { const id = x.dataset.x; if (!confirm("¿Borrar a " + P[id].n + " de la plantilla?")) return; delete P[id]; pintar(); try { await api("equipos/" + EQ + "/plantilla/" + id, "DELETE") } catch (e) { errSave(e) } });
    b.querySelectorAll("[data-d]").forEach(x => x.onchange = async () => { const id = x.dataset.d, v = x.value.replace(/\D/g, "").slice(0, 2); P[id].d = v; try { await api("equipos/" + EQ + "/plantilla/" + id + "/d", "PUT", v) } catch (e) { errSave(e) } });
  }

  /* ---------- bloques públicos (opcionales) ---------- */
  async function publicos() {
    const cp = $("#convocadosPublico"), gp = $("#goleadoresPublico");
    if (cp) {
      const c = await pub("convocatoria/" + EQ);
      cp.innerHTML = c && c.nombres && c.nombres.length ? `<div class="ze-pub"><h3>Convocados · ${esc(NOMBRE)}</h3>${c.titulo ? `<p style="margin:0 0 8px">${esc(c.titulo)}</p>` : ""}${c.nombres.map(n => `<span class="ch">${esc(n)}</span>`).join("")}</div>` : "";
    }
    if (gp) {
      const e = await pub("estadisticas/" + EQ), tot = {};
      Object.values(e || {}).forEach(r => Object.values(r.jug || {}).forEach(x => { const t = tot[x.n] = tot[x.n] || { g: 0, a: 0, r: 0 }; t.g += x.g || 0; t.a += x.a || 0; t.r += x.r || 0 }));
      const f = Object.entries(tot).sort((x, y) => y[1].g - x[1].g || x[0].localeCompare(y[0], "es"));
      gp.innerHTML = f.length ? `<div class="ze-pub"><h3>Goleadores y tarjetas · ${esc(NOMBRE)}</h3><table style="width:100%;border-collapse:collapse"><tr><th style="text-align:left">Jugador</th><th>⚽</th><th>🟨</th><th>🟥</th></tr>${f.map(([n, t]) => `<tr><td>${esc(n)}</td><td style="text-align:center">${t.g}</td><td style="text-align:center">${t.a}</td><td style="text-align:center">${t.r}</td></tr>`).join("")}</table></div>` : "";
    }
  }
  publicos();
})();
