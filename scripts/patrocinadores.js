/* Barra de patrocinadores fija en la parte inferior.
   ---------------------------------------------------------------------
   CÓMO EDITARLA
   - url:    web del patrocinador. Si está vacío, el logo se muestra sin enlace.
   - logoH:  altura del logo en la barra (px), para que ninguno destaque de más.
   - Para cambiar el sentido del movimiento, usa DIRECCION más abajo.
   Los logos están en Images/patrocinadores/ */
(function () {
  const DIRECCION = "izquierda";   // "izquierda": los logos avanzan hacia la izquierda · "derecha": hacia la derecha
  const VELOCIDAD = 55;            // píxeles por segundo (ordenador)
  const VELOCIDAD_MOVIL = 24;      // píxeles por segundo (móvil, hasta 600px de ancho)
  const RUTA = "Images/patrocinadores/";
  const VERSION = "5";             // súbelo si cambias los logos, para que el navegador no use la versión antigua

  const SPONSORS = [
    { name: "Ayuntamiento de Torrejón de Ardoz",      img: "ayuntamiento.png", w: 744, h: 200, logoH: 38, url: "https://www.ayto-torrejon.es/" },
    { name: "Asiem, asesoría, gestión, comunidades",  img: "asiem.png",        w: 616, h: 360, logoH: 46, url: "https://www.asiem.es/" },
    { name: "Inmobiliaria Provan",                    img: "provan.png",       w: 440, h: 360, logoH: 46, url: "https://www.provan.info/" },
    { name: "Embalajes Hurtado, S.L.",                img: "hurtado.png",      w: 520, h: 296, logoH: 44, url: "https://embalajeshurtado.com/" },
    { name: "Gor2Bar",                                img: "gor2bar.png",      w: 512, h: 208, logoH: 38, url: "https://www.instagram.com/gor2bartorrejon/" },
    { name: "Lasercor",                               img: "lasercor.png",     w: 568, h: 192, logoH: 36, url: "https://www.lasercor.com/" },
    { name: "Cedecar",                                img: "cedecar.png",      w: 512, h: 176, logoH: 34, url: "https://cedecar.com/" },
    { name: "delaoliva",                              img: "delaoliva.png",    w: 496, h: 136, logoH: 30, url: "https://delaoliva.com/" },
    { name: "BBVA",                                   img: "BBVA.png",         w: 496, h: 136, logoH: 30, url: "https://www.bbva.com/" },
    { name: "Cosmos Telecomunicaciones",              img: "cosmos.png",       w: 504, h: 184, logoH: 38, url: "https://www.cosmos.tel/" }
  ];

  const esc = t => String(t || "").replace(/[&<>"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[c]));

  function item(s, copia) {
    const src = RUTA + esc(s.img) + "?v=" + encodeURIComponent(VERSION);
    const w = Math.max(1, Number(s.w) || 100);
    const h = Math.max(1, Number(s.h) || 40);
    const logoH = Math.max(12, Number(s.logoH) || 36);
    const alt = copia ? "" : esc(s.name);
    const img = `<img src="${src}" alt="${alt}" width="${w}" height="${h}" decoding="async" draggable="false" style="--h:${logoH}px">`;

    if (!s.url) {
      return `<span class="sp-it"${copia ? ' aria-hidden="true"' : ` title="${esc(s.name)}"`}>${img}</span>`;
    }

    const extraAttrs = copia ? ' aria-hidden="true" tabindex="-1"' : ` title="${esc(s.name)}" aria-label="${esc(s.name)} (se abre en una pestaña nueva)"`;
    return `<a class="sp-it" href="${esc(s.url)}" target="_blank" rel="noopener sponsored"${extraAttrs}>${img}</a>`;
  }

  const grupo = copia => `<div class="sp-grp">${SPONSORS.map(s => item(s, copia)).join("")}</div>`;

  function iniciar() {
    if (!document.body || document.getElementById("spons")) return;

    const barra = document.createElement("aside");
    barra.id = "spons";
    barra.setAttribute("aria-label", "Patrocinadores");
    if (DIRECCION === "derecha") barra.classList.add("sp-der");
    barra.innerHTML = '<div class="sp-tag">Patrocinadores</div><div class="sp-view"><div class="sp-track" id="spTrack"></div></div>';

    document.body.appendChild(barra);
    document.body.classList.add("has-spons");

    const pista = barra.querySelector("#spTrack");
    const vista = barra.querySelector(".sp-view");
    if (!pista || !vista) return;

    /* Repite el grupo las veces necesarias para que una mitad cubra todo el ancho: el bucle no deja huecos */
    function montar() {
      const prueba = document.createElement("div");
      prueba.className = "sp-half";
      prueba.style.visibility = "hidden";
      prueba.style.position = "absolute";
      prueba.style.pointerEvents = "none";
      prueba.innerHTML = grupo(true);

      pista.innerHTML = "";
      pista.appendChild(prueba);

      const anchoGrupo = prueba.getBoundingClientRect().width || prueba.offsetWidth || 1200;
      const anchoVisible = vista.clientWidth || window.innerWidth || 1200;
      const n = Math.max(1, Math.ceil(anchoVisible / anchoGrupo));

      const primeraMitad = `<div class="sp-half">${grupo(false)}${Array.from({ length: n - 1 }, () => grupo(true)).join("")}</div>`;
      const segundaMitad = `<div class="sp-half" aria-hidden="true">${Array.from({ length: n }, () => grupo(true)).join("")}</div>`;

      pista.innerHTML = primeraMitad + segundaMitad;

      const vel = window.matchMedia("(max-width: 600px)").matches ? VELOCIDAD_MOVIL : VELOCIDAD;
      const duracion = Math.max(12, Math.round((anchoGrupo * n) / vel));
      pista.style.setProperty("--dur", `${duracion}s`);

      /* Recalcula cuando terminen de cargar las imágenes para evitar anchos provisionales */
      pista.querySelectorAll("img").forEach(img => {
        if (!img.complete) {
          img.addEventListener("load", montar, { once: true });
          img.addEventListener("error", montar, { once: true });
        }
      });
    }

    montar();

    let timerResize;
    window.addEventListener("resize", () => {
      clearTimeout(timerResize);
      timerResize = setTimeout(montar, 200);
    });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(montar).catch(() => {});
    }

    /* Al volver con el botón "atrás" el navegador puede restaurar la página con la animación congelada: se reinicia */
    window.addEventListener("pageshow", e => {
      if (!e.persisted) return;
      pista.style.animation = "none";
      void pista.offsetWidth;
      pista.style.animation = "";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();