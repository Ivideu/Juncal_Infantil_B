/* categoria-extra.js · se carga DESPUÉS del script principal de cada categoría.
   Añade: cromos creados desde el admin (jugadores sobre plantilla; entrenadores desde Images/Entrenadores), contraseña propia por categoría, barra inferior solo para el propietario. */
(function(){
const OWN=()=>document.body.classList.contains("owner");
/* Páginas con el login nuevo (ventana con acceso de administrador, Jugadas y Pizarra): ese login manda; aquí no se sobrescribe. */
const PORT=typeof openLogin==="function";
let AUTH_EMAIL=CAT.email;try{AUTH_EMAIL=sessionStorage.getItem("em")||CAT.email}catch(e){}
if(AUTH_EMAIL===FBMAIL)document.body.classList.add("owner");
document.head.insertAdjacentHTML("beforeend","<style>body.edit:not(.owner) #adm{display:none!important}.cvf{display:inline-flex;gap:6px;align-items:center;background:#e9f0ff;border-radius:99px;padding:2px 4px 2px 12px;font-weight:600}.cvf button{padding:0 8px;border-radius:99px}.cvf.ed2{background:#ffd23f}.cvc img,.cvph{aspect-ratio:535/1000}</style>");

/* ---------- Login antiguo (solo en páginas sin el login nuevo) ---------- */
if(!PORT){
window.fbLogin=async function(pw,em){const r=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key="+FBKEY,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:em||AUTH_EMAIL,password:pw,returnSecureToken:true})}),d=await r.json();
 if(!d.idToken)return false;idt=d.idToken;exp=Date.now()+(d.expiresIn-120)*1000;return true};
window.unlock=async function(){const p=(prompt("Contraseña de entrenador")||"").trim();if(!p)return;
 let ok=false,own=false;
 try{ok=await fbLogin(p,CAT.email);if(!ok){ok=own=await fbLogin(p,FBMAIL)}}catch(e){return alert("Error de conexión")}
 if(!ok)return alert("Contraseña incorrecta");
 AUTH_EMAIL=own?FBMAIL:CAT.email;PW=p;
 try{sessionStorage.setItem("adm","1");sessionStorage.setItem("pw",p);sessionStorage.setItem("em",AUTH_EMAIL)}catch(e){}
 document.body.classList.add("edit");document.body.classList.toggle("owner",own);render()};
const _se=window.setEdit;
window.setEdit=function(on){if(!on){document.body.classList.remove("owner");AUTH_EMAIL=CAT.email;try{sessionStorage.removeItem("em")}catch(e){}}_se(on)};
}

/* ---------- Calendario que llega de la sincronización (S.cfg) ---------- */
function cfg2(){const c=S.cfg;if(!c||CAT.me)return;
 Object.keys(T).forEach(k=>{if(k<100&&k!=99)delete T[k]});Object.keys(COD).forEach(k=>delete COD[k]);
 Object.assign(T,c.T||{});Object.assign(COD,c.COD||{});J.length=0;
 (c.R||[]).forEach((s,i)=>{const[d,p]=s.split("|");J.push({n:i+1,d:d.split("-").reverse().join("-"),p:p.split(",").map(x=>x.split("-").map(Number))})});
 ME=+Object.keys(COD).find(k=>String(COD[k])===String(c.equipo||CAT.equipo))||0}

/* ---------- Cromos de jugadores: nombre, número y posición escritos sobre la plantilla ---------- */
const POS={portero:"PORTERO",cierre:"CIERRE",ala:"ALA",pivot:"PÍVOT",entrenador:"ENTRENADOR"};
const W=535,H=1000,FF='"Barlow Condensed",Impact,"Arial Narrow",sans-serif';
const BLANK="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const RAIZ=CROMOS_DIR.replace(/Cromos\/$/,"");                       // raíz de la web vista desde esta página (normalmente "../")
const rutaImg=p=>RAIZ+p.split("/").map(encodeURIComponent).join("/"); // "Images/Entrenadores/Ivan.jpg" -> URL
/* Plantillas del repositorio: Images/plantilla-jugador.jpg y Images/plantilla-portero.jpg (también prueba "images/" y "Cromos/") */
const TPL={};let memo={};
const refresca=()=>{memo={};render()};
["jugador","portero"].forEach(k=>{const r=["Images/","images/","Cromos/"].map(d=>RAIZ+d+"plantilla-"+k+".jpg");let n=0;const i=new Image();
 i.onload=()=>{TPL[k]=i;refresca()};i.onerror=()=>{if(++n<r.length)i.src=r[n]};i.src=r[0]});
if(document.fonts&&document.fonts.load)document.fonts.load('800 60px "Barlow Condensed"').then(refresca).catch(()=>{});
const baseDe=c=>TPL[c.pos==="portero"?"portero":"jugador"];
function cromoImg(c){
 const base=baseDe(c);if(!base)return BLANK;
 const key=JSON.stringify([c.id,c.name,c.num,c.pos,c.coach]);
 if(memo[key])return memo[key];
 const cv=document.createElement("canvas");cv.width=W;cv.height=H;const g=cv.getContext("2d");
 g.drawImage(base,0,0,W,H);
 /* t: texto en cursiva con borde oscuro y brillo azul. (x,y)=centro/derecha/izquierda según align; rot en radianes */
 const t=(s,x,y,size,align,maxW,rot)=>{
  g.save();g.translate(x,y);if(rot)g.rotate(rot);g.transform(1,0,-.2,1,0,0);
  g.font=`800 ${size}px ${FF}`;const w=g.measureText(s).width;if(maxW&&w>maxW)size*=maxW/w;
  g.font=`800 ${size}px ${FF}`;g.textAlign=align;g.textBaseline="middle";g.lineJoin="round";
  g.lineWidth=size*.12;g.strokeStyle="rgba(3,10,38,.9)";g.strokeText(s,0,0);
  g.shadowColor="rgba(40,140,255,.95)";g.shadowBlur=size*.3;g.fillStyle="#fff";g.fillText(s,0,0);g.fillText(s,0,0);
  g.restore()};
 t(POS[c.pos]||String(c.pos||"").toUpperCase(),POSX.x,POSX.y,POSX.s,"left",POSX.w);
 if(!c.coach)t(String(c.num),NUMX.x,NUMX.y,NUMX.s,"right",NUMX.w);
 t(String(c.name).toUpperCase(),NAMX.x,NAMX.y,NAMX.s,"center",NAMX.w,NAMX.r);
 return memo[key]=cv.toDataURL("image/jpeg",.9)}
/* Posiciones sobre la plantilla (535x1000): posición arriba-izquierda, número arriba-derecha, nombre abajo inclinado */
const POSX={x:50,y:78,s:40,w:170},NUMX={x:488,y:96,s:104,w:150},NAMX={x:268,y:858,s:112,w:380,r:-.17};

/* Entrenador con imagen propia (c.img) -> se muestra tal cual; el resto se dibuja sobre la plantilla */
function buildCromos(){CROMOS.length=0;
 (S.cromos||[]).forEach(c=>CROMOS.push({file:"g_"+c.id,key:"g_"+c.id,name:c.name,num:c.num||"",pos:c.pos,coach:!!c.coach,src:(c.coach&&c.img)?rutaImg(c.img):cromoImg(c)}));
 CROMOS.sort((a,b)=>a.coach-b.coach||(a.pos==="portero"?0:1)-(b.pos==="portero"?0:1)||(+a.num||0)-(+b.num||0))}

/* ---------- Entrenadores: se eligen de Images/Entrenadores/<nombre>.jpg ---------- */
const ENT={list:null,started:false};
/* Lista los archivos de la carpeta con la API de GitHub (sin token si el repositorio es público; si no, usa el token guardado) */
async function cargaEnt(){
 if(ENT.started)return;ENT.started=true;
 let tk="";try{tk=localStorage.getItem("ghtk")||""}catch(e){}
 const heads=tk?[{Authorization:"Bearer "+tk},{}]:[{}];
 for(const d of ["Images","images"])for(const h of heads){
  try{const r=await fetch(`https://api.github.com/repos/${GH_USER}/${GH_REPO}/contents/${d}/Entrenadores`,{headers:h});
   if(!r.ok)continue;const a=await r.json();
   if(Array.isArray(a)){ENT.list=a.filter(f=>f.type==="file"&&/\.(jpe?g|png|webp)$/i.test(f.name)).map(f=>({name:f.name.replace(/\.[^.]+$/,""),path:f.path})).sort((x,y)=>x.name.localeCompare(y.name));break}
  }catch(e){}
  if(ENT.list)break}
 if(!ENT.list)ENT.list=[];
 render()}
const existe=u=>new Promise(ok=>{const i=new Image();i.onload=()=>ok(true);i.onerror=()=>ok(false);i.src=u});
/* Si no se puede listar la carpeta, se escribe el nombre y se busca el archivo */
async function buscaImg(nombre){
 const n=nombre.trim(),cap=n.charAt(0).toUpperCase()+n.slice(1).toLowerCase();
 for(const d of ["Images","images"])for(const nm of [...new Set([n,cap,n.toLowerCase()])])for(const e of [".jpg",".jpeg",".png",".webp"]){
  const p=`${d}/Entrenadores/${nm}${e}`;if(await existe(rutaImg(p)))return p}
 return ""}

/* ---------- Crear / editar / borrar ---------- */
let EDIT="",PRE=null;
function renameP(a,b){const i=S.pl.indexOf(a);if(i>-1)S.pl[i]=b;
 if(S.dn[a]!==undefined){S.dn[b]=S.dn[a];delete S.dn[a]}
 if(S.off&&S.off[a]){S.off[b]=S.off[a];delete S.off[a]}
 Object.values(S.m).forEach(m=>["g","gm"].forEach(f=>{if(m[f]&&m[f][a]!==undefined){m[f][b]=m[f][a];delete m[f][a]}}));
 S.pl.sort((p,q)=>p.localeCompare(q))}
function quitaP(a){const i=S.pl.indexOf(a);if(i>-1)S.pl.splice(i,1);delete S.dn[a];if(S.off)delete S.off[a]}
window.cnPos=function(v){const co=v==="entrenador";document.getElementById("cn_pl").style.display=co?"none":"contents";document.getElementById("cn_co").style.display=co?"contents":"none"};
window.addCromo=async function(){
 const g=i=>{const e=document.getElementById(i);return e?e.value.trim():""},pos=g("cn_pos"),coach=pos==="entrenador";
 let name=g("cn_name").replace(/[.$#\[\]\/]/g,""),num=g("cn_num"),img="";
 if(coach){
  const cs=document.getElementById("cn_cs");
  if(cs){img=cs.value;name=cs.options[cs.selectedIndex]?cs.options[cs.selectedIndex].textContent:""}
  else{name=g("cn_ci").replace(/[.$#\[\]\/]/g,"");if(!name)return alert("Escribe el nombre del entrenador (el del archivo)");
   img=await buscaImg(name);if(!img)return alert("No encuentro Images/Entrenadores/"+name+".jpg en la web. Revisa el nombre del archivo.");name=img.split("/").pop().replace(/\.[^.]+$/,"")}
  if(!img)return alert("Elige un entrenador");
  num="";
 }else if(!name||num==="")return alert("Pon el nombre y, si es jugador, el número");
 S.cromos=S.cromos||[];
 if(coach&&S.cromos.some(z=>z.coach&&z.img===img&&z.id!==EDIT))return alert("Ese entrenador ya está añadido");
 const c=EDIT&&S.cromos.find(z=>z.id===EDIT);
 if(!c&&!coach&&PRE&&PRE.old&&name!==PRE.old)renameP(PRE.old,name);
 if(c){if(!c.coach&&!coach&&c.name!==name)renameP(c.name,name);
  if(!c.coach&&coach)quitaP(c.name);
  Object.assign(c,{name,num,pos,coach});if(coach)c.img=img;else delete c.img;delete c.foto}
 else S.cromos.push(Object.assign({id:Date.now().toString(36),name,num,pos,coach},coach?{img}:{}));
 if(!coach){if(!S.pl.includes(name)){S.pl.push(name);S.pl.sort((a,b)=>a.localeCompare(b))}S.dn[name]=num}
 EDIT="";PRE=null;save()};
window.editCromo=function(id){const c=(S.cromos||[]).find(x=>x.id===id);if(!c)return;EDIT=id;PRE=null;render();window.scrollTo({top:0,behavior:"smooth"})};
window.editPl=function(i){const p=S.pl[i];if(!p)return;const q=pn(p);
 const c=(S.cromos||[]).find(z=>!z.coach&&z.name===q.name);
 if(c){EDIT=c.id;PRE=null}else{EDIT="";PRE={old:p,name:q.name,num:q.num}}
 render();window.scrollTo({top:0,behavior:"smooth"})};
window.delP=function(i){const n=S.pl[i];if(!n)return;if(!confirm("¿Eliminar a "+n+" de la plantilla?"))return;
 const q=pn(n);
 (S.cromos||[]).filter(c=>!c.coach&&c.name===q.name).forEach(c=>{if(S.estado)delete S.estado["g_"+c.id]});
 S.cromos=(S.cromos||[]).filter(c=>c.coach||c.name!==q.name);
 delete S.dn[n];if(S.off)delete S.off[n];if(S.estado)delete S.estado["p_"+n];S.pl.splice(i,1);save()};
window.cancelCromo=function(){EDIT="";PRE=null;render()};
window.delCromo=function(id){const c=(S.cromos||[]).find(x=>x.id===id);if(!c||!confirm("¿Borrar el cromo de "+c.name+"?"))return;
 S.cromos=S.cromos.filter(x=>x.id!==id);if(EDIT===id)EDIT="";
 if(!c.coach)quitaP(c.name);if(S.estado)delete S.estado["g_"+id];save()};
function cromoForm(){
 const ec=EDIT?(S.cromos||[]).find(x=>x.id===EDIT):null,v=ec||(PRE?{name:PRE.name,num:PRE.num,pos:"ala"}:{name:"",num:"",pos:"ala"}),co=v.pos==="entrenador",mod=!!(ec||PRE);
 const opts=Object.keys(POS).map(k=>`<option value="${k}" ${v.pos===k?"selected":""}>${k==="pivot"?"Pívot":k[0].toUpperCase()+k.slice(1)}</option>`).join("");
 const picker=ENT.list&&ENT.list.length
  ?`<select id="cn_cs" aria-label="Entrenador">${ENT.list.map(e=>`<option value="${esc(e.path)}" ${v.img===e.path?"selected":""}>${esc(e.name)}</option>`).join("")}</select>`
  :`<input id="cn_ci" placeholder="Nombre del entrenador (como el archivo)" value="${esc(co?v.name:"")}" style="min-width:230px">`;
 const L=(S.cromos||[]).map(c=>`<span class="cvf ${c.id===EDIT?"ed2":""}">${esc(c.name)} ${c.coach?"· entrenador":"· "+esc(c.num)+" · "+esc(POS[c.pos]||c.pos)}<button onclick="editCromo('${c.id}')" aria-label="Editar">✎</button><button onclick="delCromo('${c.id}')" aria-label="Borrar">✕</button></span>`).join("");
 return`<div class="card"><h2 style="font-size:1.5rem;color:#0f2a6b">${ec?"Editar cromo":PRE?"Cromo de "+esc(PRE.name):"Crear cromo"}</h2>
 <div class="ed" style="display:flex"><span id="cn_pl" style="display:${co?"none":"contents"}"><input id="cn_name" placeholder="Nombre (sin apellido)" value="${esc(co?"":v.name)}"><input id="cn_num" class="g" type="number" min="0" max="99" placeholder="Nº" value="${esc(v.num)}"></span><span id="cn_co" style="display:${co?"contents":"none"}">${picker}</span><select id="cn_pos" onchange="cnPos(this.value)">${opts}</select></div>
 <div class="ed" style="display:flex"><button class="on" onclick="addCromo()">${mod?"💾 Guardar cambios":"＋ Crear cromo"}</button>${mod?'<button onclick="cancelCromo()">Cancelar</button>':""}</div>
 <small class="gap" style="display:block;margin-top:6px">Jugadores: el cromo se escribe solo sobre Images/plantilla-jugador.jpg (portero: plantilla-portero.jpg). Entrenadores: se elige uno de Images/Entrenadores.</small>
 <div class="cvsum">${L||'<small class="gap">Aún no hay cromos.</small>'}</div></div>`}
/* Cuerpo técnico dentro de la pestaña Plantilla */
function cuerpoTecnico(){
 const l=CROMOS.filter(c=>c.coach);if(!l.length)return"";
 return`<div class="cvhd"><h2>Cuerpo técnico</h2></div>`+l.map(c=>{const id=c.key.slice(2);
  return`<div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span style="display:flex;align-items:center;gap:12px"><img src="${c.src}" alt="Cromo de ${esc(c.name)}" style="width:56px;aspect-ratio:535/1000;object-fit:contain;border-radius:8px"><b>${esc(c.name)}</b><span class="gap">Entrenador</span></span><span style="display:flex;gap:8px"><button onclick="editCromo('${id}')">✎ Cambiar</button><button onclick="delCromo('${id}')">Quitar</button></span></div>`}).join("")}

/* ---------- Guardado en Firebase: si falla, se avisa (antes solo se veía en la barra del administrador) ---------- */
if(typeof push==="function"&&typeof fbTok==="function"&&FB){
 window.push=function(){clearTimeout(pt);setSt("Guardando…");
  pt=setTimeout(async()=>{
   try{const t=await fbTok(),raw=JSON.stringify(S);lastRaw=raw;
    const r=await fetch(FB+"/"+CAT.node+".json?auth="+t,{method:"PUT",body:JSON.stringify(raw)});
    if(r.ok){setSt("✓ Guardado");return}
    const m=(r.status===401||r.status===403)?"No se ha guardado: Firebase no permite escribir en «"+CAT.node+"». Hay que revisar las reglas.":"No se ha guardado (Firebase "+r.status+").";
    setSt("⚠ "+m);toast(m)
   }catch(e){const m=e===0?"La sesión ha caducado. Sal y vuelve a entrar para guardar.":"No se ha guardado: error de conexión.";setSt("⚠ "+m);toast(m)}
  },150)}}

/* ---------- Enganche en render ---------- */
const _rn=window.render;
window.render=function(){cfg2();buildCromos();
 if(PORT)document.body.classList.toggle("owner",E()&&ACC===FBMAIL); // administrador del club: ve la barra completa
 _rn();
 if(!E())return;
 if(tab=="pla"){const a=document.getElementById("app");a.insertAdjacentHTML("afterbegin",cromoForm());a.insertAdjacentHTML("beforeend",cuerpoTecnico());cargaEnt();
  a.querySelectorAll('button[onclick^="delP("]').forEach(b=>{const m=b.getAttribute("onclick").match(/delP\((\d+)\)/);if(!m)return;const i=+m[1];
   const e=document.createElement("button");e.textContent="✎ Editar";e.setAttribute("onclick","editPl("+i+")");b.parentNode.insertBefore(e,b);
   const p=S.pl[i],c=p&&cromoFor(p),row=b.closest(".card"),sv=row&&row.querySelector("svg");
   if(c&&sv){const im=document.createElement("img");im.src=c.src;im.alt="";im.style.cssText="width:34px;aspect-ratio:535/1000;object-fit:contain;border-radius:5px";sv.replaceWith(im)}})}

 if(!PORT&&!OWN())document.getElementById("nav").insertAdjacentHTML("beforeend",'<button onclick="setEdit(false)"><span>🔓</span><span>Salir</span></button>')};
render();
})();