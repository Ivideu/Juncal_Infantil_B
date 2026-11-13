/* categoria-extra.js · se carga DESPUÉS del script principal de cada categoría.
   Añade: cromos creados/editados desde el admin (con foto), contraseña propia por categoría, barra inferior solo para el propietario. */
(function(){
const OWN=()=>document.body.classList.contains("owner");
let AUTH_EMAIL=CAT.email;try{AUTH_EMAIL=sessionStorage.getItem("em")||CAT.email}catch(e){}
if(AUTH_EMAIL===FBMAIL)document.body.classList.add("owner");
document.head.insertAdjacentHTML("beforeend","<style>body.edit:not(.owner) #adm{display:none!important}.cvf{display:inline-flex;gap:6px;align-items:center;background:#e9f0ff;border-radius:99px;padding:2px 4px 2px 12px;font-weight:600}.cvf button{padding:0 8px;border-radius:99px}.cvf.ed2{background:#ffd23f}.cvc img,.cvph{aspect-ratio:535/1000}</style>");

/* ---------- Login: contraseña de la categoría o contraseña del propietario ---------- */
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

/* ---------- Calendario que llega de la sincronización (S.cfg) ---------- */
function cfg2(){const c=S.cfg;if(!c||CAT.me)return;
 Object.keys(T).forEach(k=>{if(k<100&&k!=99)delete T[k]});Object.keys(COD).forEach(k=>delete COD[k]);
 Object.assign(T,c.T||{});Object.assign(COD,c.COD||{});J.length=0;
 (c.R||[]).forEach((s,i)=>{const[d,p]=s.split("|");J.push({n:i+1,d:d.split("-").reverse().join("-"),p:p.split(",").map(x=>x.split("-").map(Number))})});
 ME=+Object.keys(COD).find(k=>String(COD[k])===String(c.equipo||CAT.equipo))||0}

/* ---------- Cromos generados: se escribe nombre, número y posición encima de la plantilla ---------- */
const POS={portero:"PORTERO",cierre:"CIERRE",ala:"ALA",pivot:"PÍVOT",entrenador:"ENTRENADOR"};
const W=535,H=1000,FF='"Barlow Condensed",Impact,"Arial Narrow",sans-serif';
const BLANK="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
/* Plantillas por defecto: Cromos/plantilla-jugador.jpg y Cromos/plantilla-portero.jpg */
const TPL={};let memo={};
const refresca=()=>{memo={};render()};
/* Plantillas del repositorio: Images/plantilla-jugador.jpg y Images/plantilla-portero.jpg (si tu carpeta se llama "images" en minúsculas, también la prueba) */
const RAIZ=CROMOS_DIR.replace(/Cromos\/$/,"");
["jugador","portero"].forEach(k=>{const r=["Images/","images/","Cromos/"].map(d=>RAIZ+d+"plantilla-"+k+".jpg");let n=0;const i=new Image();
 i.onload=()=>{TPL[k]=i;refresca()};i.onerror=()=>{if(++n<r.length)i.src=r[n]};i.src=r[0]});
if(document.fonts&&document.fonts.load)document.fonts.load('800 60px "Barlow Condensed"').then(refresca).catch(()=>{});
function baseDe(c){return TPL[c.pos==="portero"?"portero":"jugador"]}
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

function buildCromos(){CROMOS.length=0;
 (S.cromos||[]).forEach(c=>CROMOS.push({file:"g_"+c.id,key:"g_"+c.id,name:c.name,num:c.num||"",pos:c.pos,coach:!!c.coach,src:cromoImg(c)}));
 CROMOS.sort((a,b)=>a.coach-b.coach||(a.pos==="portero"?0:1)-(b.pos==="portero"?0:1)||(+a.num||0)-(+b.num||0))}

let EDIT="";

/* ---------- Crear / editar / borrar ---------- */
function renameP(a,b){const i=S.pl.indexOf(a);if(i>-1)S.pl[i]=b;
 if(S.dn[a]!==undefined){S.dn[b]=S.dn[a];delete S.dn[a]}
 if(S.off&&S.off[a]){S.off[b]=S.off[a];delete S.off[a]}
 Object.values(S.m).forEach(m=>["g","gm"].forEach(f=>{if(m[f]&&m[f][a]!==undefined){m[f][b]=m[f][a];delete m[f][a]}}));
 S.pl.sort((p,q)=>p.localeCompare(q))}
function quitaP(a){const i=S.pl.indexOf(a);if(i>-1)S.pl.splice(i,1);delete S.dn[a];if(S.off)delete S.off[a]}
window.addCromo=function(){const g=i=>document.getElementById(i).value.trim(),name=g("cn_name").replace(/[.$#\[\]\/]/g,""),num=g("cn_num"),pos=g("cn_pos"),coach=pos==="entrenador";
 if(!name||(!coach&&num===""))return alert("Pon el nombre y, si es jugador, el número");
 S.cromos=S.cromos||[];
 const c=EDIT&&S.cromos.find(z=>z.id===EDIT);
 if(c){if(!c.coach&&c.name!==name)renameP(c.name,name);
  if(!c.coach&&coach)quitaP(name);
  Object.assign(c,{name,num:coach?"":num,pos,coach});delete c.foto}
 else S.cromos.push({id:Date.now().toString(36),name,num:coach?"":num,pos,coach});
 if(!coach){if(!S.pl.includes(name)){S.pl.push(name);S.pl.sort((a,b)=>a.localeCompare(b))}S.dn[name]=num}
 EDIT="";save()};
window.editCromo=function(id){const c=(S.cromos||[]).find(x=>x.id===id);if(!c)return;EDIT=id;render();window.scrollTo({top:0,behavior:"smooth"})};
window.cancelCromo=function(){EDIT="";render()};
window.delCromo=function(id){const c=(S.cromos||[]).find(x=>x.id===id);if(!c||!confirm("¿Borrar el cromo de "+c.name+"?"))return;
 S.cromos=S.cromos.filter(x=>x.id!==id);if(EDIT===id)EDIT="";
 if(!c.coach)quitaP(c.name);save()};
function cromoForm(){
 const ec=EDIT?(S.cromos||[]).find(x=>x.id===EDIT):null,v=ec||{name:"",num:"",pos:"ala"};
 const opts=Object.keys(POS).map(k=>`<option value="${k}" ${v.pos===k?"selected":""}>${k==="pivot"?"Pívot":k[0].toUpperCase()+k.slice(1)}</option>`).join("");
 const L=(S.cromos||[]).map(c=>`<span class="cvf ${c.id===EDIT?"ed2":""}">${esc(c.name)} ${c.coach?"· entrenador":"· "+esc(c.num)+" · "+esc(POS[c.pos]||c.pos)}<button onclick="editCromo('${c.id}')" aria-label="Editar">✎</button><button onclick="delCromo('${c.id}')" aria-label="Borrar">✕</button></span>`).join("");
 return`<div class="card"><h2 style="font-size:1.5rem;color:#0f2a6b">${ec?"Editar cromo":"Crear cromo"}</h2>
 <div class="ed" style="display:flex"><input id="cn_name" placeholder="Nombre (sin apellido)" value="${esc(v.name)}"><input id="cn_num" class="g" type="number" min="0" max="99" placeholder="Nº" value="${esc(v.num)}"><select id="cn_pos">${opts}</select></div>
 <div class="ed" style="display:flex"><button class="on" onclick="addCromo()">${ec?"💾 Guardar cambios":"＋ Crear cromo"}</button>${ec?'<button onclick="cancelCromo()">Cancelar</button>':""}</div>
 <small class="gap" style="display:block;margin-top:6px">El cromo se genera solo: portero usa Images/plantilla-portero.jpg y el resto Images/plantilla-jugador.jpg.</small>
 <div class="cvsum">${L||'<small class="gap">Aún no hay cromos.</small>'}</div></div>`}

/* ---------- Enganche en render ---------- */
const _rn=window.render;
window.render=function(){cfg2();buildCromos();_rn();
 if(!E())return;
 if(tab=="pla")document.getElementById("app").insertAdjacentHTML("afterbegin",cromoForm());
 if(!OWN())document.getElementById("nav").insertAdjacentHTML("beforeend",'<button onclick="setEdit(false)"><span>🔓</span><span>Salir</span></button>')};
render();
})();