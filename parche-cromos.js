/* ===== CROMOS desde la carpeta Cromos/ =====
   Sustituye en tu index.html las funciones cardMarkup, renderCromos y openCromo
   por TODO este bloque. Deja closeCromo tal cual. */
const CROMOS_DIR="Cromos/";
const CROMOS_FILES=["Alex_10_ala.png","Edu_11_ala.png","Erik_5_pivot.png","Gabriel_15_ala.png","Hector_18_ala.png","Ivan_entrenador.png","Izan_7_pivot.png","Javi_entrenador.png","Joel_8_ala.png","Manu_2_cierre.png","Marcos_13_portero.png","Nico_6_cierre.png","Pablo_89_portero.png","Pedro_28_ala.png","Ruben_1_portero.png"];
const POSN={ala:"Ala",pivot:"Pívot",cierre:"Cierre",portero:"Portero"};
// Nombre_dorsal_posicion.png  ·  Nombre_entrenador.png
const CROMOS=CROMOS_FILES.map(f=>{const p=f.replace(/\.png$/i,"").split("_"),co=p[p.length-1]==="entrenador";return{file:f,name:p[0],num:co?"":p[1],pos:co?"entrenador":p[2],coach:co}}).sort((a,b)=>(+a.num||0)-(+b.num||0));

// Clave de convocatoria: si el jugador existe en Plantilla (mismo nombre o dorsal) se usa su nombre, así el
// desplegable «Convocatoria» de Plantilla y el botón del cromo controlan lo mismo.
function cKey(c){const t=noacc(c.name),m=(S.pl||[]).filter(n=>noacc(pn(n).name).split(" ")[0]===t);return(m.length>1&&m.find(n=>pn(n).num==c.num))||m[0]||c.name}
const cEstado=c=>(S.estado&&S.estado[cKey(c)])||"convocado";
function toggleCromo(file){const c=CROMOS.find(x=>x.file===file);if(!c)return;const k=cKey(c);S.estado=S.estado||{};S.estado[k]=cEstado(c)==="convocado"?"descartado":"convocado";save()}

function cardMarkup(c,large=false){
 const img=`<img class="cromo-img" src="${CROMOS_DIR+encodeURIComponent(c.file)}" alt="Cromo de ${esc(c.name)}${c.num?" (dorsal "+esc(c.num)+")":""}"${large?"":' loading="lazy"'}>`;
 if(large)return img;
 const off=!c.coach&&cEstado(c)==="descartado",f=esc(c.file);
 const tg=E()&&!c.coach?`<button class="cromo-tg" onclick="toggleCromo('${f}')">${off?"✓ Convocar":"✕ Descartar"}</button>`:"";
 return`<div class="cromo-wrap"><div class="cromo ${off?"off":""}" data-f="${f}" tabindex="0" role="button" aria-label="Ver cromo de ${esc(c.name)}" onclick="openCromo(this.dataset.f)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openCromo(this.dataset.f)}">${img}</div>${tg}</div>`}

function renderCromos(){
 const jug=CROMOS.filter(c=>!c.coach),conv=jug.filter(c=>cEstado(c)==="convocado"),desc=jug.filter(c=>cEstado(c)==="descartado"),tec=CROMOS.filter(c=>c.coach);
 const section=(title,list,cls,mark,unit,empty)=>`<section class="squad-section ${cls}"><div class="squad-heading"><div class="squad-title-mark">${mark}</div><div><h2>${title}</h2><p>${list.length} ${unit}</p></div><span class="squad-count">${list.length}</span></div>${list.length?`<div class="cards-grid">${list.map(c=>cardMarkup(c)).join("")}</div>`:`<div class="empty">${empty}</div>`}</section>`;
 return`<section class="cards-head"><div><h2>Jugadores · Torrejón Juncal B</h2><p class="gap">Temporada 2026/27</p></div><span class="dt">${jug.length} jugadores · ${tec.length} entrenadores</span></section>`
  +section("Convocados",conv,"convocados","✓",conv.length===1?"jugador":"jugadores","No hay jugadores convocados.")
  +section("No convocados",desc,"descartados","–",desc.length===1?"jugador":"jugadores","No hay jugadores no convocados.")
  +section("Cuerpo técnico",tec,"tecnico","★",tec.length===1?"entrenador":"entrenadores","Sin entrenadores.")}

function openCromo(file){const c=CROMOS.find(x=>x.file===file);if(!c)return;document.getElementById("cromoModalCard").innerHTML=cardMarkup(c,true);document.getElementById("cromoModal").classList.add("open");document.body.style.overflow="hidden"}
