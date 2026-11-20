/* Menú «Equipos» desplegable (Local / Federado).
   - Escritorio: se abre al pasar el ratón, con un clic se "fija" abierto.
   - Móvil / táctil: se abre y cierra con un toque (acordeón dentro del menú).
   - Teclado: Intro/Espacio o ↓ abren, ←/→ cambian de tarjeta, Esc cierra.
   El panel se desplaza solo para no salirse de la pantalla. */
(function () {
  const dd = document.querySelector(".dd");
  if (!dd) return;
  const btn = dd.querySelector(".dd-btn");
  const panel = dd.querySelector(".dd-panel");
  if (!btn || !panel) return;

  const movil = matchMedia("(max-width:800px)");
  let timer = 0;

  /* Mantiene el panel dentro de la pantalla (solo escritorio) */
  function colocar() {
    let dx = 0;
    if (!movil.matches) {
      const r = dd.getBoundingClientRect();
      const w = panel.offsetWidth, m = 12;
      const izq = r.left + r.width / 2 - w / 2;
      const der = izq + w;
      if (izq < m) dx = m - izq;
      else if (der > innerWidth - m) dx = innerWidth - m - der;
    }
    panel.style.setProperty("--dx", Math.round(dx) + "px");
  }

  function abrir(porHover) {
    clearTimeout(timer);
    colocar();
    dd.dataset.fijo = porHover ? "0" : "1";
    dd.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
  }

  function cerrar(devolverFoco) {
    clearTimeout(timer);
    dd.classList.remove("open");
    dd.dataset.fijo = "0";
    btn.setAttribute("aria-expanded", "false");
    if (devolverFoco) btn.focus();
  }

  btn.addEventListener("click", e => {
    e.stopPropagation();
    if (!dd.classList.contains("open")) return abrir(false);
    /* Si se abrió con el ratón encima, el clic lo deja fijo en vez de cerrarlo */
    if (dd.dataset.fijo === "0" && !movil.matches && e.detail > 0) { dd.dataset.fijo = "1"; return; }
    cerrar();
  });

  dd.addEventListener("pointerenter", e => {
    if (e.pointerType === "mouse" && !movil.matches) abrir(true);
  });
  dd.addEventListener("pointerleave", e => {
    if (e.pointerType !== "mouse" || movil.matches || dd.dataset.fijo === "1") return;
    timer = setTimeout(() => cerrar(), 220);
  });

  /* Cerrar al pulsar fuera, al salir con el teclado o al elegir un enlace */
  document.addEventListener("click", e => { if (!dd.contains(e.target)) cerrar(); });
  dd.addEventListener("focusout", e => { if (e.relatedTarget && !dd.contains(e.relatedTarget)) cerrar(); });
  panel.addEventListener("click", e => { if (e.target.closest("a")) cerrar(); });
  addEventListener("resize", () => { if (dd.classList.contains("open")) colocar(); });

  /* Teclado */
  dd.addEventListener("keydown", e => {
    const items = [...panel.querySelectorAll("a")];
    if (e.key === "Escape" && dd.classList.contains("open")) {
      e.preventDefault(); e.stopPropagation(); cerrar(true);
    } else if (e.target === btn && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault(); abrir(false); setTimeout(() => items[0] && items[0].focus(), 30);
    } else if (items.includes(e.target) && ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) {
      e.preventDefault();
      const i = items.indexOf(e.target);
      const sig = e.key === "ArrowRight" || e.key === "ArrowDown" ? i + 1 : i - 1;
      items[(sig + items.length) % items.length].focus();
    }
  });
})();
