/* Resultados de la competición local anotados a mano por los entrenadores.
   Se guardan en Firebase (nodo local_res/<categoría>/<clave>) y se superponen a los datos del Ayuntamiento:
   si el Ayuntamiento publica el resultado, manda el oficial. */
(function () {
  const FB = "https://juncal-f0b64-default-rtdb.europe-west1.firebasedatabase.app", KEY = "AIzaSyDXqBUkie30z_Cmyj__ayhzGYyYxZMrB3Q";
  const nrm = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ss = { get: k => { try { return sessionStorage.getItem(k) || ""; } catch (e) { return ""; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} }, del: k => { try { sessionStorage.removeItem(k); } catch (e) {} } };
  const EQUIPOS = [["local", "Entrenador de local"], ...(window.CATS_PIZ || [])];
  const LM = window.LM = {
    data: null, tok: "", exp: 0, email: "", onchange: null,
    key: (n, l, v) => n + "_" + nrm(l) + "_" + nrm(v),
    async load() {
      try { const r = await fetch(FB + "/local_res.json", { cache: "no-store" }); LM.data = (await r.json()) || {}; } catch (e) { LM.data = LM.data || {}; }
      return LM.data;
    },
    /* Pone el resultado manual en los partidos que el Ayuntamiento aún no ha publicado */
    apply(cat, jornadas) {
      const m = (LM.data || {})[cat] || {};
      (jornadas || []).forEach(j => (j.partidos || []).forEach(p => {
        if (p.man) { if (p.ig) { p.ga = p.ig[0]; p.gb = p.ig[1]; delete p.ig; } else { delete p.ga; delete p.gb; } delete p.man; }
        if ((p.ga == null && p.gb == null) || p.ini) {   // p.ini: resultado inicial cargado por el club; un resultado manual lo sustituye
          const r = m[LM.key(j.n, p.local, p.visitante)];
          if (r && Number.isInteger(r.ga) && Number.isInteger(r.gb)) { if (p.ga != null) p.ig = [p.ga, p.gb]; p.ga = r.ga; p.gb = r.gb; p.man = 1; }
        }
      }));
    },
    canEdit: () => !!LM.email,
    async _signIn(email, pw) {
      const r = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + KEY, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: pw, returnSecureToken: true }) });
      const d = await r.json();
      if (!d.idToken) return false;
      LM.tok = d.idToken; LM.exp = Date.now() + (+d.expiresIn - 120) * 1000; LM.email = email;
      ss.set("lm_mail", email); ss.set("lm_rt", d.refreshToken || "");
      return true;
    },
    async _refresh() {
      const rt = ss.get("lm_rt"), em = ss.get("lm_mail");
      if (!rt || !em) return false;
      const r = await fetch("https://securetoken.googleapis.com/v1/token?key=" + KEY, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(rt) });
      const d = await r.json();
      if (!d.id_token) return false;
      LM.tok = d.id_token; LM.exp = Date.now() + (+d.expires_in - 120) * 1000; LM.email = em;
      if (d.refresh_token) ss.set("lm_rt", d.refresh_token);
      return true;
    },
    async _token() {
      if (LM.tok && Date.now() < LM.exp) return LM.tok;
      if (await LM._refresh()) return LM.tok;
      throw new Error("sesión");
    },
    /* Al entrar en la página (pestaña nueva) NO hay sesión: hay que pulsar «Entrenadores». Una vez dentro, la sesión se mantiene
       al recargar o cambiar de categoría local mientras la pestaña siga abierta o no se pulse «Salir». No se guarda la contraseña, solo un permiso renovable. */
    async restore() { try { return await LM._refresh(); } catch (e) { return false; } },
    logout() { LM.tok = ""; LM.email = ""; ss.del("lm_mail"); ss.del("lm_rt"); if (LM.onchange) LM.onchange(); },
    async save(cat, n, l, v, ga, gb) {
      const tok = await LM._token(), k = LM.key(n, l, v), url = `${FB}/local_res/${encodeURIComponent(cat)}/${k}.json?auth=${tok}`;
      const borrar = ga === null || gb === null;
      const r = await fetch(url, { method: borrar ? "DELETE" : "PUT", body: borrar ? undefined : JSON.stringify({ ga, gb, por: LM.email.split("@")[0], t: new Date().toISOString() }) });
      if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? "permiso" : "red");
      LM.data = LM.data || {}; LM.data[cat] = LM.data[cat] || {};
      if (borrar) delete LM.data[cat][k]; else LM.data[cat][k] = { ga, gb };
    },
    login() {
      if (document.getElementById("lmOv")) return;
      const ov = document.createElement("div"); ov.id = "lmOv";
      ov.setAttribute("style", "position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(8,18,53,.8)");
      ov.innerHTML = `<form id="lmF" style="background:#fff;color:#0f1b3d;border-radius:18px;padding:22px;max-width:360px;width:100%;display:flex;flex-direction:column;gap:10px;font:600 1rem Barlow,system-ui,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.5)">
        <h3 style="margin:0;font:800 1.5rem 'Barlow Condensed',sans-serif;text-transform:uppercase;color:#0f2a78">Acceso de entrenador</h3>
        <label>Equipo<select id="lmEq" style="width:100%;padding:10px;border:2px solid #7aa9ff;border-radius:10px;font:inherit;margin-top:4px">${EQUIPOS.map(e => `<option value="${e[0]}@torrejonjuncal.es">${e[1]}</option>`).join("")}<option value="">Entrar con correo…</option></select></label>
        <label id="lmEml" hidden>Correo<input id="lmE" type="email" autocomplete="username" style="width:100%;padding:10px;border:2px solid #7aa9ff;border-radius:10px;font:inherit;margin-top:4px"></label>
        <label>Contraseña<input id="lmP" type="password" autocomplete="current-password" required style="width:100%;padding:10px;border:2px solid #7aa9ff;border-radius:10px;font:inherit;margin-top:4px"></label>
        <div id="lmErr" role="alert" style="color:#b91c1c;font-size:.9rem" hidden></div>
        <div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" id="lmX" style="padding:10px 16px;border:2px solid #d5def5;border-radius:10px;background:#fff;font:inherit;cursor:pointer">Cancelar</button><button type="submit" style="padding:10px 18px;border:0;border-radius:10px;background:#ffd23f;color:#0a0f1e;font:800 1rem Barlow,sans-serif;cursor:pointer">Entrar</button></div></form>`;
      document.body.appendChild(ov);
      const q = s => ov.querySelector(s), close = () => ov.remove();
      q("#lmEq").onchange = () => { q("#lmEml").hidden = !!q("#lmEq").value; };
      q("#lmX").onclick = close; ov.onclick = e => { if (e.target === ov) close(); };
      q("#lmF").onsubmit = async ev => {
        ev.preventDefault();
        const em = q("#lmEq").value || q("#lmE").value.trim(), pw = q("#lmP").value.trim(), err = q("#lmErr");
        let ok = false; try { ok = await LM._signIn(em, pw); } catch (e) {}
        if (!ok) { err.textContent = "Contraseña incorrecta o sin conexión."; err.hidden = false; return; }
        close(); if (LM.onchange) LM.onchange();
      };
      q("#lmP").focus();
    }
  };
})();
