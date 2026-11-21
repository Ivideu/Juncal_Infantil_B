/* Barra de patrocinadores fija en la parte inferior.
   ---------------------------------------------------------------------
   CÓMO EDITARLA
   - url:    web del patrocinador. Si está vacío, el logo se muestra sin enlace.
   - logoH:  altura del logo en la barra (px), para que ninguno destaque de más.
   - Para cambiar el sentido del movimiento, usa DIRECCION más abajo.
   Los logos están en Images/patrocinadores/ */
(function () {
  const DIRECCION = "izquierda";   // "izquierda": los logos avanzan hacia la izquierda · "derecha": hacia la derecha
  const VELOCIDAD = 55;            // píxeles por segundo
  const RUTA = "Images/patrocinadores/";
  const VERSION = "3";             // súbelo si cambias los logos, para que el navegador no use la versión antigua

  const SPONSORS = [
    { name: "Ayuntamiento de Torrejón de Ardoz", img: "ayuntamiento.png", w: 744, h: 200,  logoH: 38, url: "https://www.ayto-torrejon.es/" },
    { name: "Asiem Servicios Jurídicos",         img: "asiem.png",        w: 616, h: 360, logoH: 46, url: "https://www.administracionfincastorrejon.es/" },
    { name: "Inmobiliaria Provan",               img: "provan.png",       w: 440, h: 360, logoH: 46, url: "https://www.provan.info/" },
    { name: "Hurtado, S.L.",                     img: "hurtado.png",      w: 520, h: 296, logoH: 44, url: "https://www.hurtadosl.es/" },
    { name: "Gor2Bar",                           img: "gor2bar.png",      w: 512, h: 208,  logoH: 38, url: "https://www.instagram.com/gor2bartorrejon/" },
    { name: "Lasercor",                          img: "lasercor.png",     w: 568, h: 192,  logoH: 36, url: "https://www.lasercor.com/" },
    { name: "Cedecar",                           img: "cedecar.png",      w: 512, h: 176,  logoH: 34, url: "https://cedecar.com/" },
    { name: "delaoliva",                         img: "delaoliva.png",    w: 496, h: 136,  logoH: 30, url: "https://delaoliva.com/" },
    { name: "Cosmos Telecomunicaciones",         img: "cosmos.png",       w: 504, h: 184,  logoH: 38, url: "https://www.cosmos.tel/" }
  ];

  const esc = t => String(t || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function item(s, copia) {
    const img = `<img src="${RUTA + esc(s.img)}?v=${VERSION}" alt="${copia ? "" : esc(s.name)}" width="${s.w}" height="${s.h}" decoding="async" draggable="false" style="--h:${s.logoH}px">`;
    if (!s.url) return `<span class="sp-it" title="${esc(s.name)}"${copia ? ' aria-hidden="true"' : ""}>${img}</span>`;
    return `<a class="sp-it" href="${esc(s.url)}" target="_blank" rel="noopener sponsored" title="${esc(s.name)}" aria-label="${esc(s.name)} (se abre en una pestaña nueva)"${copia ? ' aria-hidden="true" tabindex="-1"' : ""}>${img}</a>`;
  }

  const grupo = copia => `<div class="sp-grp">${SPONSORS.map(s => item(s, copia)).join("")}</div>`;

  const barra = document.createElement("aside");
  barra.id = "spons";
  barra.setAttribute("aria-label", "Patrocinadores");
  if (DIRECCION === "derecha") barra.classList.add("sp-der");
  barra.innerHTML = '<div class="sp-tag">Patrocinadores</div><div class="sp-view"><div class="sp-track" id="spTrack"></div></div>';
  document.body.appendChild(barra);
  document.body.classList.add("has-spons");

  const pista = barra.querySelector("#spTrack");
  const vista = barra.querySelector(".sp-view");
  let repeticiones = 0;

  /* Repite el grupo las veces necesarias para que una mitad cubra todo el ancho: el bucle no deja huecos */
  function montar() {
    const prueba = document.createElement("div");
    prueba.className = "sp-half";
    prueba.style.visibility = "hidden";
    prueba.innerHTML = grupo(true);
    pista.innerHTML = "";
    pista.appendChild(prueba);
    const ancho = prueba.offsetWidth || 1200;
    const n = Math.max(1, Math.ceil((vista.clientWidth || innerWidth) / ancho));
    repeticiones = n;
    /* Primera mitad: accesible (el primer grupo es el real). Segunda mitad: copia oculta a lectores y teclado */
    const mitad = copia => `<div class="sp-half"${copia ? ' aria-hidden="true"' : ""}>${grupo(copia)}${Array.from({ length: n - 1 }, () => grupo(true)).join("")}</div>`;
    pista.innerHTML = mitad(false) + mitad(true);
    pista.style.setProperty("--dur", Math.max(12, Math.round((ancho * n) / VELOCIDAD)) + "s");
  }

  montar();
  let t;
  addEventListener("resize", () => { clearTimeout(t); t = setTimeout(montar, 200); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { repeticiones = 0; montar(); });
})();
