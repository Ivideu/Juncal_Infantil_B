/* ACCESO · Escuela Torrejón Juncal
   Botón flotante abajo a la derecha (candado) con dos entradas: entrenadores y jugadores.
   Se pone UNA línea en la portada, justo antes de </body>:
       <script src="acceso.js" defer></script>
*/
(function () {
  "use strict";
  var CATS = [["aficionado-a", "Aficionado A"], ["aficionado-b", "Aficionado B"], ["juvenil-a", "Juvenil A"], ["juvenil-b", "Juvenil B"], ["cadete-a", "Cadete A"], ["cadete-b", "Cadete B"], ["infantil-a", "Infantil A"], ["infantil-b", "Infantil B"], ["alevin-a", "Alevín A"], ["alevin-b", "Alevín B"]];
  var css = document.createElement("style");
  css.textContent =
    ".ac-fab{position:fixed;right:16px;bottom:16px;z-index:9990;display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:12px 18px;font:700 15px/1 system-ui,sans-serif;background:#0f2a6b;color:#ffd23f;box-shadow:0 6px 18px rgba(0,0,0,.4);cursor:pointer;transition:transform .15s,background .15s}" +
    ".ac-fab:hover{background:#163a8f;transform:translateY(-2px)}" +
    ".ac-fab:focus-visible,.ac-box a:focus-visible,.ac-box button:focus-visible,.ac-box select:focus-visible{outline:3px solid #ffd23f;outline-offset:2px}" +
    ".ac-ov{position:fixed;inset:0;z-index:9995;background:rgba(5,10,35,.75);display:none;align-items:flex-end;justify-content:center;padding:12px}" +
    ".ac-ov.on{display:flex}" +
    "@media(min-width:640px){.ac-ov{align-items:center}}" +
    ".ac-box{width:min(560px,100%);background:#0d2561;color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:20px;padding:20px;font:15px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.5)}" +
    ".ac-box *{box-sizing:border-box}" +
    ".ac-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}" +
    ".ac-h b{font-size:20px}" +
    ".ac-x{border:0;background:rgba(255,255,255,.14);color:#fff;border-radius:10px;width:38px;height:38px;font-size:18px;cursor:pointer}" +
    ".ac-g{display:grid;gap:12px}" +
    "@media(min-width:520px){.ac-g{grid-template-columns:1fr 1fr}}" +
    ".ac-c{background:#0a1f55;border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:8px}" +
    ".ac-c h3{margin:0;font-size:17px}.ac-c p{margin:0;opacity:.8;font-size:13.5px;flex:1}" +
    ".ac-c select{font:inherit;color:#fff;background:#173a8f;border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:9px 10px;min-height:40px;width:100%}" +
    ".ac-b{display:block;text-align:center;text-decoration:none;font:800 15px system-ui,sans-serif;background:#ffd23f;color:#0b2a6f;border:0;border-radius:10px;padding:11px 14px;cursor:pointer}" +
    ".ac-b:hover{background:#ffe27a}";
  document.head.appendChild(css);

  var fab = document.createElement("button");
  fab.className = "ac-fab"; fab.type = "button"; fab.setAttribute("aria-haspopup", "dialog");
  fab.innerHTML = "<span aria-hidden='true'>🔒</span> Acceso";

  var ov = document.createElement("div");
  ov.className = "ac-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Acceso");
  ov.innerHTML =
    "<div class='ac-box'>" +
    "<div class='ac-h'><b>🔒 Acceso</b><button class='ac-x' type='button' aria-label='Cerrar'>✕</button></div>" +
    "<div class='ac-g'>" +
    "<div class='ac-c'><h3>🧑‍🏫 Entrenadores</h3><p>Pizarra táctica, jugadas, entrenos y convocatoria. Necesitas la contraseña de tu equipo.</p><a class='ac-b' href='entrenadores.html'>Entrar</a></div>" +
    "<div class='ac-c'><h3>⚽ Jugadores</h3><p>Mira las jugadas que ha preparado tu entrenador.</p>" +
    "<select aria-label='Tu categoría'>" + CATS.map(function (c) { return "<option value='" + c[0] + "'>" + c[1] + "</option>"; }).join("") + "</select>" +
    "<a class='ac-b' href='jugadas.html'>Ver jugadas</a></div>" +
    "</div></div>";

  document.body.appendChild(fab);
  document.body.appendChild(ov);

  var sel = ov.querySelector("select"), go = ov.querySelectorAll("a.ac-b")[1];
  try { var last = localStorage.getItem("jgCat"); if (last) sel.value = last; } catch (e) {}
  function link() { go.href = "jugadas.html?cat=" + sel.value; }
  sel.addEventListener("change", link); link();

  function abrir() { ov.classList.add("on"); ov.querySelector(".ac-x").focus(); }
  function cerrar() { ov.classList.remove("on"); fab.focus(); }
  fab.addEventListener("click", abrir);
  ov.querySelector(".ac-x").addEventListener("click", cerrar);
  ov.addEventListener("click", function (e) { if (e.target === ov) cerrar(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && ov.classList.contains("on")) cerrar(); });
})();
